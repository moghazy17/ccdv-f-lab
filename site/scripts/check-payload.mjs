/**
 * Fails the build when the in-browser runtime payload exceeds its stated budget.
 *
 * Principle VIII requires a stated performance budget, and Principle VI requires gates to be
 * mechanical rather than aspirational — a ceiling nobody checks is a ceiling that drifts.
 *
 * The budget is expressed in *transferred* bytes, because that is what a candidate on a mobile
 * connection actually waits for. GitHub Pages serves gzip, so this measures gzip rather than raw
 * size or brotli. Measured baseline at Pyodide 314.0.6 is roughly 6 MiB; the ceiling leaves headroom
 * for a version bump without a surprise.
 */

import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CEILING_BYTES = 8 * 1024 * 1024;
const RUNTIME_DIR = fileURLToPath(new URL("../public/runtime/", import.meta.url));

/** Files that are downloaded on a first Run. Anything else in the directory is not counted. */
const COUNTED_EXTENSIONS = [".wasm", ".zip", ".mjs", ".js", ".whl", ".json"];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else if (COUNTED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(path);
    }
  }
  return files;
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function main() {
  try {
    await stat(RUNTIME_DIR);
  } catch {
    console.log("check:payload — no runtime vendored yet; nothing to measure.");
    return;
  }

  const files = await collectFiles(RUNTIME_DIR);
  let transferred = 0;
  const rows = [];
  for (const path of files) {
    const contents = await readFile(path);
    // Already-compressed containers do not shrink again; measuring their gzip is still the
    // honest number, because that is what the host will send.
    const size = gzipSync(contents).byteLength;
    transferred += size;
    rows.push({ path: path.slice(RUNTIME_DIR.length), size });
  }

  rows.sort((left, right) => right.size - left.size);
  for (const row of rows.slice(0, 10)) {
    console.log(`  ${formatMiB(row.size).padStart(9)}  ${row.path}`);
  }
  console.log(`check:payload — ${formatMiB(transferred)} transferred, ceiling ${formatMiB(CEILING_BYTES)}`);

  if (transferred > CEILING_BYTES) {
    console.error(
      `check:payload FAILED — the runtime payload is ${formatMiB(transferred)}, over the ` +
        `${formatMiB(CEILING_BYTES)} ceiling stated in the plan. Either drop what was added or ` +
        `change the budget deliberately, in the spec, with a reason.`
    );
    process.exitCode = 1;
  }
}

await main();
