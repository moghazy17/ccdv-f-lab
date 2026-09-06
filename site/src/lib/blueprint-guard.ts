export interface PublishedDomainRow {
  number: number;
  name: string;
  weight: number;
}

export interface DerivedDomain {
  number?: unknown;
  name?: unknown;
  weight?: unknown;
}

// Mirrors _DOMAIN_ROW in tools/export_site_data.py.
const DOMAIN_ROW = /^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(\d+(?:\.\d+)?)%\s*\|\s*~(\d+)\s*\|$/;

export function publishedDomainRows(blueprintText: string): PublishedDomainRow[] {
  // Mirrors _domain_table in tools/export_site_data.py: the published domain table only, stopping
  // before the later allocation tables that repeat the same domain names.
  const afterHeading = blueprintText.split("## Domains")[1];
  const section = afterHeading?.split("## Sub-skills")[0];
  if (section === undefined) {
    throw new Error("BLUEPRINT.md has no complete Domains section.");
  }
  const rows: PublishedDomainRow[] = [];
  for (const line of section.split("\n")) {
    const match = DOMAIN_ROW.exec(line.replaceAll("**", ""));
    if (match === null) {
      continue;
    }
    rows.push({
      number: Number(match[1]),
      name: match[2].replaceAll("`", "").trim(),
      weight: Number(match[3])
    });
  }
  return rows;
}

export function assertDerivedDomainsMatchBlueprint(
  derived: readonly DerivedDomain[],
  blueprintText: string
): void {
  // The digest proves which blueprint the data came from, not that the data still says what that
  // blueprint says. Reading every published domain figure back out of BLUEPRINT.md is what makes a
  // weight edited directly into the generated file fail the build rather than reach a page.
  const published = publishedDomainRows(blueprintText);
  if (derived.length !== published.length) {
    throw new Error(
      `Generated blueprint data holds ${derived.length} domains, BLUEPRINT.md publishes ` +
        `${published.length}. Run python tools/export_site_data.py.`
    );
  }
  for (const [index, row] of published.entries()) {
    const domain = derived[index];
    if (domain?.number !== row.number || domain?.name !== row.name || domain?.weight !== row.weight) {
      throw new Error(
        `Generated blueprint data disagrees with BLUEPRINT.md for domain ${row.number} ` +
          `(${row.name}, ${row.weight}%). Run python tools/export_site_data.py.`
      );
    }
  }
  const weightTotal = published.reduce((total, row) => total + row.weight, 0);
  if (Math.abs(weightTotal - 100) > 0.000001) {
    throw new Error(`Published domain weights sum to ${weightTotal}, expected 100.`);
  }
}
