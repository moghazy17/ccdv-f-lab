import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  generateConfiguration,
  representativeConfigurationFixtures,
  type GenerationFailure
} from "../src/lib/claude-code/generate.ts";

const outputPath = resolve(import.meta.dirname, "../src/data/generated-hook-fixtures.json");

function render(): string {
  const cases = representativeConfigurationFixtures().map(({ name, draft }) => {
    const result = generateConfiguration(draft);
    if ("errors" in result) {
      throw new Error(`Representative configuration ${name} was refused: ${(result as GenerationFailure).errors.join(" ")}`);
    }
    const hook = result.files.find((file) => file.language === "python");
    if (hook === undefined) throw new Error(`Representative configuration ${name} has no Python hook.`);
    return { name, hook: hook.contents, samples: result.samples };
  });
  return `${JSON.stringify({ cases }, null, 2)}\n`;
}

if (process.argv.includes("--check")) {
  const expected = JSON.parse(render()) as unknown;
  const actual = JSON.parse(readFileSync(outputPath, "utf8")) as unknown;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Generated hook fixture is stale. Run its export script.");
  }
} else {
  process.stdout.write(render());
}
