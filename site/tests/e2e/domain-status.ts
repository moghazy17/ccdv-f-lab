import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { domainContentStatus, type ContentStatus } from "../../src/lib/content-status";

/**
 * Read a domain's authored-or-scaffold status from the notes themselves.
 *
 * Tests must not hard-code which domains are authored. Authoring notes is the point of the
 * repository, so an expectation frozen at "everything is a scaffold" fails the first time someone
 * writes one — and fails for the best possible reason, which makes it a bad test.
 */
export function statusForDomain(slug: string): ContentStatus {
  const directory = fileURLToPath(new URL(`../../../notes/${slug}/`, import.meta.url));
  const markdowns = readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .map((name) => readFileSync(join(directory, name), "utf8"));
  return domainContentStatus(markdowns);
}

/** How many domains the landing page should report as authored. */
export function authoredDomainCount(slugs: readonly string[]): number {
  return slugs.filter((slug) => statusForDomain(slug) === "authored").length;
}
