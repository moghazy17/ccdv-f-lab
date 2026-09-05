import { execFile } from "node:child_process";
import { rmSync } from "node:fs";
import { mkdtemp, open, readFile, readdir, rm, stat, utimes } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const STALE_LOCK_THRESHOLD_MS = 20_000;
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

export async function buildDomainFixture(
  state: "authored" | "partial"
): Promise<DomainFixtureSite> {
  registerExitHooks();
  const fixtureRoot = fileURLToPath(
    new URL(`../fixtures/domain-content/${state}/`, import.meta.url)
  );
  const siteRoot = fileURLToPath(new URL("../../", import.meta.url));
  await cleanOrphanedDirectories(siteRoot);
  const outputDirectory = await mkdtemp(join(siteRoot, `.us2-${state}-`));
  trackedDirectories.add(outputDirectory);
  const astroCli = fileURLToPath(
    new URL("../../node_modules/astro/bin/astro.mjs", import.meta.url)
  );

  try {
    const releaseBuildLock = await acquireFixtureBuildLock(siteRoot);
    try {
      await executeFile(process.execPath, [astroCli, "build"], {
        cwd: siteRoot,
        env: {
          ...process.env,
          BASE: "/",
          SITE_NOTES_DIRECTORY_URL: pathToFileURL(`${fixtureRoot}/`).href,
          SITE_OUTPUT_DIRECTORY: outputDirectory
        }
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

async function cleanOrphanedDirectories(siteRoot: string): Promise<void> {
  try {
    const entries = await readdir(siteRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(".us2-")) {
        const directoryPath = join(siteRoot, entry.name);
        if (!trackedDirectories.has(directoryPath)) {
          try {
            const entryStat = await stat(directoryPath);
            if (Date.now() - entryStat.mtimeMs > STALE_LOCK_THRESHOLD_MS) {
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
  for (let attempt = 0; attempt < 600; attempt += 1) {
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
