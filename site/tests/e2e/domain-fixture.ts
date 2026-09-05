import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtemp, open, readFile, rm, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const executeFile = promisify(execFile);

export interface DomainFixtureSite {
  close(): Promise<void>;
  url: string;
}

export async function buildDomainFixture(
  state: "authored" | "partial"
): Promise<DomainFixtureSite> {
  const fixtureRoot = fileURLToPath(
    new URL(`../fixtures/domain-content/${state}/`, import.meta.url)
  );
  const siteRoot = fileURLToPath(new URL("../../", import.meta.url));
  const outputDirectory = await mkdtemp(join(siteRoot, `.us2-${state}-`));
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
    await rm(outputDirectory, { force: true, recursive: true });
    throw error;
  }

  const server = await serveDirectory(outputDirectory);
  return {
    close: async () => {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error === undefined ? resolveClose() : rejectClose(error)));
      });
      await rm(outputDirectory, { force: true, recursive: true });
    },
    url: `http://127.0.0.1:${addressPort(server)}`
  };
}

async function acquireFixtureBuildLock(siteRoot: string): Promise<() => Promise<void>> {
  const lockPath = join(siteRoot, ".us2-fixture-build.lock");
  for (let attempt = 0; attempt < 600; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      return async () => {
        await handle.close();
        await rm(lockPath, { force: true });
      };
    } catch (error) {
      if (isExistingFileError(error)) {
        await delay(50);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Timed out waiting to build an isolated domain-content fixture.");
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
