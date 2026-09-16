/**
 * Vendors the Pyodide runtime and the wheels lab/drills need into site/public/runtime/.
 *
 * The npm `pyodide` package ships the interpreter core but not the package wheels it can load, and
 * Principle III forbids fetching a wheel from a package index (or a CDN) at page-load time. This
 * script does the equivalent fetch at build time instead, from `cdn.jsdelivr.net`'s Pyodide
 * distribution, and copies everything the runtime worker needs into the site's own origin so
 * `indexURL` never has to leave it.
 *
 * The package versions are never hard-coded: they come from the installed
 * node_modules/pyodide/pyodide-lock.json, so bumping the `pyodide` devDependency changes what this
 * script downloads with no edit here.
 */

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const PYODIDE_PACKAGE_DIR = fileURLToPath(new URL("../node_modules/pyodide/", import.meta.url));
const RUNTIME_DIR = fileURLToPath(new URL("../public/runtime/", import.meta.url));

/** The ESM loader's core files: everything it reads before it can import a single package. */
const CORE_FILES = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

/** The third-party packages lab/ and drills/ import directly. */
const DIRECT_PACKAGES = [
  "jsonschema",
  "attrs",
  "referencing",
  "jsonschema-specifications",
  "rpds-py",
  "pyyaml",
];

function normalizePackageName(name) {
  return name.replaceAll("_", "-").toLowerCase();
}

/** Walk `depends` in the lock file to collect the full set of wheels this runtime needs. */
function resolvePackageClosure(lockPackages, rootNames) {
  const resolved = new Map();
  const pending = [...rootNames];
  while (pending.length > 0) {
    const name = normalizePackageName(pending.pop());
    if (resolved.has(name)) {
      continue;
    }
    const entry = lockPackages[name];
    if (!entry) {
      throw new Error(`vendor-runtime: pyodide-lock.json has no package named "${name}".`);
    }
    resolved.set(name, entry);
    for (const dependency of entry.depends ?? []) {
      pending.push(dependency);
    }
  }
  return resolved;
}

async function fileMatchesSize(path, expectedSize) {
  try {
    const info = await stat(path);
    return info.isFile() && info.size === expectedSize;
  } catch {
    return false;
  }
}

async function fileMatchesChecksum(path, expectedSha256) {
  let contents;
  try {
    contents = await readFile(path);
  } catch {
    return false;
  }
  return createHash("sha256").update(contents).digest("hex") === expectedSha256;
}

async function copyCoreFile(name) {
  const source = new URL(name, `file://${PYODIDE_PACKAGE_DIR}`);
  const sourcePath = fileURLToPath(source);
  const destinationPath = `${RUNTIME_DIR}${name}`;
  const sourceInfo = await stat(sourcePath);
  if (await fileMatchesSize(destinationPath, sourceInfo.size)) {
    console.log(`  skip   ${name} (already vendored)`);
    return;
  }
  await copyFile(sourcePath, destinationPath);
  console.log(`  copied ${name}`);
}

async function downloadWheel(version, entry) {
  const destinationPath = `${RUNTIME_DIR}${entry.file_name}`;
  const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${entry.file_name}`;
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`vendor-runtime: failed to download ${url} (HTTP ${response.status}).`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (entry.sha256 && digest !== entry.sha256) {
    throw new Error(
      `vendor-runtime: ${entry.file_name} does not match the checksum pyodide-lock.json expects.`
    );
  }
  const writeStream = createWriteStream(destinationPath);
  await finished(Readable.from(buffer).pipe(writeStream));
}

async function vendorWheel(version, entry) {
  const destinationPath = `${RUNTIME_DIR}${entry.file_name}`;
  // pyodide-lock.json carries a checksum rather than a size for wheels; a checksum match is a
  // stronger idempotency check than size alone, so a file already vendored correctly is skipped.
  if (await fileMatchesChecksum(destinationPath, entry.sha256)) {
    console.log(`  skip    ${entry.file_name} (already vendored)`);
    return;
  }
  try {
    await downloadWheel(version, entry);
    console.log(`  fetched ${entry.file_name}`);
  } catch (error) {
    throw new Error(`vendor-runtime: could not vendor ${entry.file_name}: ${error.message}`);
  }
}

async function main() {
  await mkdir(RUNTIME_DIR, { recursive: true });

  const packageManifest = JSON.parse(
    await readFile(`${PYODIDE_PACKAGE_DIR}package.json`, "utf-8")
  );
  const version = packageManifest.version;
  if (!version) {
    throw new Error("vendor-runtime: node_modules/pyodide/package.json has no version.");
  }

  console.log(`Vendoring Pyodide ${version} core files:`);
  for (const name of CORE_FILES) {
    await copyCoreFile(name);
  }

  const lock = JSON.parse(await readFile(`${PYODIDE_PACKAGE_DIR}pyodide-lock.json`, "utf-8"));
  const closure = resolvePackageClosure(lock.packages, DIRECT_PACKAGES);

  console.log(`Vendoring ${closure.size} wheel(s) for jsonschema and its dependencies:`);
  for (const entry of closure.values()) {
    await vendorWheel(version, entry);
  }

  console.log(`Runtime vendored into ${RUNTIME_DIR}`);
}

await main();
