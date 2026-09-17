/**
 * Fails the build when anything but the two sanctioned components can reach the Python runtime.
 *
 * The runtime is a multi-megabyte download, so which modules are allowed to pull it in is a
 * policy, and a policy nobody checks drifts. Two components may reach it, each behind a dynamic
 * import inside an explicit user action: `CodePane` runs a lab, and `ConfigBuilder` proves a
 * generated hook. Every other component, and every page, must not.
 *
 * Matching the barrel matters as much as matching the client. `lib/runtime/index.ts` re-exports
 * `run`, `runHook`, and the rest, and it is the documented entry point, so a check that only
 * looked for `runtime/client` would pass a page that imported `../lib/runtime` and shipped the
 * whole runtime anyway.
 *
 * `lib/runtime/labs.ts` is deliberately exempt: it reads `lab/`'s sources with `node:fs` at module
 * load, which happens only in page frontmatter at build time, and it pulls in no Pyodide.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../src", import.meta.url));

/** The only modules permitted to reach the runtime, each behind an explicit user action. */
const PERMITTED = new Set(["components/CodePane.astro", "components/ConfigBuilder.astro"]);

/** Matches the runtime barrel and the client, but not the build-time `labs` catalogue. */
const RUNTIME_IMPORT = /["'][^"']*lib\/runtime(?:\/client|\/index)?["']/;

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const searched = [join(source, "pages"), join(source, "components")];
const offenders = [];
for (const directory of searched) {
  for (const path of files(directory)) {
    const identifier = relative(source, path).replaceAll("\\", "/");
    if (PERMITTED.has(identifier)) {
      continue;
    }
    if (RUNTIME_IMPORT.test(readFileSync(path, "utf8"))) {
      offenders.push(identifier);
    }
  }
}

if (offenders.length > 0) {
  throw new Error(
    `Only ${[...PERMITTED].join(" and ")} may reach the Python runtime. Found imports in: ` +
      offenders.join(", ")
  );
}

console.log(
  `check:runtime-page-imports — only ${PERMITTED.size} sanctioned components reach the runtime.`
);
