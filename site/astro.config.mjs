import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { assertDerivedDomainsMatchBlueprint } from "./src/lib/blueprint-guard.ts";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const site = process.env.SITE ?? "https://moghazy17.github.io";
const configuredBase = process.env.BASE ?? "/ccdv-f-lab/";
const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
const outDir = process.env.SITE_OUTPUT_DIRECTORY;
// `public/` holds only the vendored Python runtime, and Astro copies all of it into every build.
// The content-propagation fixtures build the site eight times behind one lock and never load the
// runtime, so they point this at an empty directory: fourteen megabytes copied eight times is
// pure latency in the one place the suite is serialized, and it is what pushed that queue past
// its ceiling on a slow runner.
const publicDir = process.env.SITE_PUBLIC_DIRECTORY;
const blueprintPath = fileURLToPath(new URL("../BLUEPRINT.md", import.meta.url));
const blueprintDataPath = fileURLToPath(new URL("./src/data/blueprint.json", import.meta.url));

function assertCurrentBlueprintData() {
  if (!existsSync(blueprintDataPath)) {
    throw new Error("Generated blueprint data is missing. Run python tools/export_site_data.py.");
  }
  const data = JSON.parse(readFileSync(blueprintDataPath, "utf8"));
  // Must match tools/export_site_data.py: hash the newline-normalized text, so a CRLF working
  // copy and an LF checkout agree on the digest.
  const blueprintText = readFileSync(blueprintPath, "utf8").replace(/\r\n/g, "\n");
  const sourceDigest = createHash("sha256").update(blueprintText, "utf8").digest("hex");
  if (data.sourceDigest !== sourceDigest) {
    throw new Error("Generated blueprint data is stale. Run python tools/export_site_data.py.");
  }
  assertDerivedDomainsMatchBlueprint(data.domains ?? [], blueprintText);
}

assertCurrentBlueprintData();

export default defineConfig({
  site,
  base,
  outDir,
  ...(publicDir === undefined ? {} : { publicDir }),
  output: "static",
  trailingSlash: "always",
  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: {
        allow: [repositoryRoot]
      }
    }
  }
});
