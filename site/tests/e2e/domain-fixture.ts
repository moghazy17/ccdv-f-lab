import { execFile } from "node:child_process";
import { rmSync } from "node:fs";
import { cp, mkdtemp, open, readFile, readdir, rm, stat, utimes } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const STALE_LOCK_THRESHOLD_MS = 20_000;
// Output directories legitimately outlive a lock: a spec keeps one alive for the whole test.
// Playwright gives each spec file its own worker, so `trackedDirectories` cannot see another
// worker's live fixtures — reclaiming them on the lock's timescale deletes directories still
// in use. Only a directory left by a run that died long ago is safe to remove.
const STALE_OUTPUT_THRESHOLD_MS = 600_000;
// The lock serializes every fixture build in the suite, so a waiter must outlast the whole
// queue ahead of it rather than a single build. At 50ms per attempt this waits up to ten
// minutes; a shorter wait fails whichever spec queued last instead of the one actually stuck.
const LOCK_WAIT_ATTEMPTS = 12_000;
const trackedDirectories = new Set<string>();
let activeLockPath: string | null = null;
let exitHooksRegistered = false;

function cleanupTrackedSync(): void {
  if (activeLockPath !== null) {
    try {
      rmSync(activeLockPath, { force: true });
    } catch {
      // Ignore errors during synchronous process exit cleanup
    }
  }
  for (const directory of trackedDirectories) {
    try {
      rmSync(directory, { force: true, recursive: true });
    } catch {
      // Ignore errors during synchronous process exit cleanup
    }
  }
}

function registerExitHooks(): void {
  if (exitHooksRegistered) {
    return;
  }
  exitHooksRegistered = true;
  process.once("exit", cleanupTrackedSync);
  process.once("SIGINT", () => {
    cleanupTrackedSync();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    cleanupTrackedSync();
    process.exit(143);
  });
}

export interface DomainFixtureSite {
  close(): Promise<void>;
  url: string;
}

export interface ContentFixtureOptions {
  notesDir?: string;
  cheatsheetsDir?: string;
  guideDir?: string;
  studyPlansDir?: string;
  label?: string;
  extraEnv?: Record<string, string>;
}

export async function buildCustomContentFixture(
  options: ContentFixtureOptions
): Promise<DomainFixtureSite> {
  registerExitHooks();
  const siteRoot = fileURLToPath(new URL("../../", import.meta.url));
  await cleanOrphanedDirectories(siteRoot);
  const label = options.label ?? "fixture";
  const outputDirectory = await mkdtemp(join(siteRoot, `.us2-${label}-`));
  trackedDirectories.add(outputDirectory);
  const astroCli = fileURLToPath(
    new URL("../../node_modules/astro/bin/astro.mjs", import.meta.url)
  );

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    BASE: "/",
    SITE_OUTPUT_DIRECTORY: outputDirectory,
    ...(options.extraEnv ?? {})
  };

  if (options.notesDir) {
    env.SITE_NOTES_DIRECTORY_URL = pathToFileURL(
      options.notesDir.endsWith("/") || options.notesDir.endsWith("\\")
        ? options.notesDir
        : `${options.notesDir}/`
    ).href;
  }
  if (options.cheatsheetsDir) {
    env.SITE_CHEATSHEETS_DIRECTORY_URL = pathToFileURL(
      options.cheatsheetsDir.endsWith("/") || options.cheatsheetsDir.endsWith("\\")
        ? options.cheatsheetsDir
        : `${options.cheatsheetsDir}/`
    ).href;
  }
  if (options.guideDir) {
    env.SITE_GUIDE_DIRECTORY_URL = pathToFileURL(
      options.guideDir.endsWith("/") || options.guideDir.endsWith("\\")
        ? options.guideDir
        : `${options.guideDir}/`
    ).href;
  }
  if (options.studyPlansDir) {
    env.SITE_STUDY_PLANS_DIRECTORY_URL = pathToFileURL(
      options.studyPlansDir.endsWith("/") || options.studyPlansDir.endsWith("\\")
        ? options.studyPlansDir
        : `${options.studyPlansDir}/`
    ).href;
  }

  try {
    const releaseBuildLock = await acquireFixtureBuildLock(siteRoot);
    try {
      await executeFile(process.execPath, [astroCli, "build"], {
        cwd: siteRoot,
        env
      });
    } finally {
      await releaseBuildLock();
    }
  } catch (error) {
    trackedDirectories.delete(outputDirectory);
    await rm(outputDirectory, { force: true, recursive: true });
    throw error;
  }

  const server = await serveDirectory(outputDirectory);
  return {
    close: async () => {
      try {
        await new Promise<void>((resolveClose, rejectClose) => {
          server.close((error) => (error === undefined ? resolveClose() : rejectClose(error)));
        });
      } finally {
        trackedDirectories.delete(outputDirectory);
        await rm(outputDirectory, { force: true, recursive: true });
      }
    },
    url: `http://127.0.0.1:${addressPort(server)}`
  };
}

export async function buildDomainFixture(
  state: "authored" | "partial"
): Promise<DomainFixtureSite> {
  const fixtureRoot = fileURLToPath(
    new URL(`../fixtures/domain-content/${state}/`, import.meta.url)
  );
  return buildCustomContentFixture({
    notesDir: fixtureRoot,
    label: state
  });
}

export async function createTemporaryContentCopy(
  sourceDirectory: string,
  label: string
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  registerExitHooks();
  const siteRoot = fileURLToPath(new URL("../../", import.meta.url));
  const tempDir = await mkdtemp(join(siteRoot, `.us2-src-${label}-`));
  trackedDirectories.add(tempDir);
  await cp(sourceDirectory, tempDir, { recursive: true });
  return {
    path: tempDir,
    cleanup: async () => {
      trackedDirectories.delete(tempDir);
      await rm(tempDir, { force: true, recursive: true });
    }
  };
}

async function cleanOrphanedDirectories(siteRoot: string): Promise<void> {
  try {
    const entries = await readdir(siteRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        (entry.name.startsWith(".us2-") || entry.name.startsWith(".us2-src-"))
      ) {
        const directoryPath = join(siteRoot, entry.name);
        if (!trackedDirectories.has(directoryPath)) {
          try {
            const entryStat = await stat(directoryPath);
            if (Date.now() - entryStat.mtimeMs > STALE_OUTPUT_THRESHOLD_MS) {
              await rm(directoryPath, { force: true, recursive: true });
            }
          } catch {
            // Entry may have been removed concurrently
          }
        }
      }
    }
  } catch {
    // Ignore directory scan errors
  }
}

async function acquireFixtureBuildLock(siteRoot: string): Promise<() => Promise<void>> {
  const lockPath = join(siteRoot, ".us2-fixture-build.lock");
  for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      activeLockPath = lockPath;
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
      const heartbeat = setInterval(() => {
        utimes(lockPath, new Date(), new Date()).catch(() => {});
      }, 2000);

      return async () => {
        clearInterval(heartbeat);
        activeLockPath = null;
        await handle.close();
        await rm(lockPath, { force: true });
      };
    } catch (error) {
      if (isExistingFileError(error)) {
        const isStale = await isLockStale(lockPath);
        if (isStale) {
          await rm(lockPath, { force: true });
          continue;
        }
        await delay(50);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Timed out waiting to build an isolated domain-content fixture.");
}

async function isLockStale(lockPath: string): Promise<boolean> {
  try {
    const lockStat = await stat(lockPath);
    if (Date.now() - lockStat.mtimeMs > STALE_LOCK_THRESHOLD_MS) {
      return true;
    }
    const rawContent = await readFile(lockPath, "utf-8");
    if (rawContent.trim().length > 0) {
      const data = JSON.parse(rawContent) as { pid?: unknown };
      if (typeof data.pid === "number") {
        try {
          process.kill(data.pid, 0);
        } catch (killError: unknown) {
          if (
            typeof killError === "object" &&
            killError !== null &&
            "code" in killError &&
            killError.code === "ESRCH"
          ) {
            return true;
          }
        }
      }
    }
  } catch {
    // If file cannot be read or parsed, check if file exists
    return false;
  }
  return false;
}

function isExistingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function serveDirectory(directory: string): Promise<Server> {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const decodedPath = decodeURIComponent(pathname);
    const candidate = resolve(directory, `.${decodedPath}`);
    if (relative(directory, candidate).startsWith("..")) {
      response.writeHead(403).end();
      return;
    }

    const filePath = await indexFile(candidate);
    if (filePath === null) {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(await readFile(filePath));
  });

  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return server;
}

async function indexFile(candidate: string): Promise<string | null> {
  try {
    return (await stat(candidate)).isDirectory() ? join(candidate, "index.html") : candidate;
  } catch {
    return null;
  }
}

function contentType(filePath: string): string {
  const extension = basename(filePath).split(".").pop();
  return {
    css: "text/css; charset=utf-8",
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8"
  }[extension ?? ""] ?? "application/octet-stream";
}

function addressPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Fixture server did not receive a TCP address.");
  }
  return address.port;
}
