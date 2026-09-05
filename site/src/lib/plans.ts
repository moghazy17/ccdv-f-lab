import { domains } from "./blueprint";

export type PlanSlug = "1-week" | "3-weeks" | "6-weeks";

export interface PlanAllocation {
  domainNumber: number;
  domainName: string;
  domainSlug: string;
  weight: number;
  hours: number;
}

export interface StudyPlan {
  slug: PlanSlug;
  title: string;
  totalHours: number;
  allocations: readonly PlanAllocation[];
}

export interface PlanEntry {
  body?: string;
  id: string;
}

export const REQUIRED_PLAN_SLUGS: readonly PlanSlug[] = ["1-week", "3-weeks", "6-weeks"];

export function loadStudyPlans(entries: Iterable<PlanEntry>): StudyPlan[] {
  const plans: StudyPlan[] = [];
  for (const entry of entries) {
    const slug = entry.id.replace(/\.md$/, "");
    if (isPlanSlug(slug)) {
      plans.push(parseStudyPlanMarkdown(slug, entry.body ?? ""));
    }
  }
  validateAllPlans(plans);
  return plans.sort((left, right) => left.totalHours - right.totalHours);
}

export function parseStudyPlanMarkdown(slug: string, markdown: string): StudyPlan {
  if (!isPlanSlug(slug)) {
    throw new Error(`Invalid plan slug: ${slug}. Must be one of: ${REQUIRED_PLAN_SLUGS.join(", ")}`);
  }

  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `${slug} study plan`;

  const totalHoursMatch = markdown.match(/\*\*([0-9]+\.[0-9]+)\s+total hours\*\*/i);
  if (!totalHoursMatch) {
    throw new Error(`Could not find total hours in plan markdown for ${slug}`);
  }
  const totalHours = Number(totalHoursMatch[1]);

  const rows = parseTableRows(markdown);
  const allocations: PlanAllocation[] = [];

  for (const row of rows) {
    if (row.domain.toLowerCase().includes("total")) {
      continue;
    }
    const domain = domains.find(
      (d) => d.name.toLowerCase() === row.domain.toLowerCase()
    );
    if (!domain) {
      throw new Error(
        `Plan ${slug} contains unrecognized domain: "${row.domain}". Does not match blueprint.`
      );
    }

    const rowWeight = parseWeight(row.weight);
    if (Math.abs(rowWeight - domain.weight) > 0.001) {
      throw new Error(
        `Plan ${slug} domain "${domain.name}" weight ${rowWeight}% does not match blueprint weight ${domain.weight}%`
      );
    }

    const expectedHours = Number(((totalHours * domain.weight) / 100).toFixed(3));
    const rowHours = Number(row.hours);
    if (Math.abs(rowHours - expectedHours) > 0.001) {
      throw new Error(
        `Plan ${slug} domain "${domain.name}" hours ${rowHours} does not match expected allocation ${expectedHours} to three decimal places`
      );
    }

    allocations.push({
      domainNumber: domain.number,
      domainName: domain.name,
      domainSlug: domain.slug,
      weight: domain.weight,
      hours: rowHours
    });
  }

  if (allocations.length !== 8) {
    throw new Error(
      `Plan ${slug} has ${allocations.length} domain allocations, expected 8.`
    );
  }

  const sumHours = Number(
    allocations.reduce((sum, alloc) => sum + alloc.hours, 0).toFixed(3)
  );
  if (Math.abs(sumHours - totalHours) > 0.001) {
    throw new Error(
      `Plan ${slug} allocations sum to ${sumHours}, expected ${totalHours}`
    );
  }

  return {
    slug,
    title,
    totalHours,
    allocations
  };
}

export function validateAllPlans(plans: readonly StudyPlan[]): void {
  const presentSlugs = new Set(plans.map((p) => p.slug));
  for (const required of REQUIRED_PLAN_SLUGS) {
    if (!presentSlugs.has(required)) {
      throw new Error(`Missing required study plan: ${required}`);
    }
  }
}

export function allocationsOrderedByWeight(
  allocations: readonly PlanAllocation[]
): PlanAllocation[] {
  // Sort descending by weight, with tiebreak by domain number ascending
  return [...allocations].sort((left, right) => {
    const weightDiff = right.weight - left.weight;
    if (Math.abs(weightDiff) > 0.0001) {
      return weightDiff;
    }
    return left.domainNumber - right.domainNumber;
  });
}

export function isPlanSlug(slug: string): slug is PlanSlug {
  return (REQUIRED_PLAN_SLUGS as readonly string[]).includes(slug);
}

export function extractPlanTotals(plans: readonly StudyPlan[]): Record<PlanSlug, number> {
  const totals: Partial<Record<PlanSlug, number>> = {};
  for (const plan of plans) {
    totals[plan.slug] = Math.round(plan.totalHours);
  }
  return totals as Record<PlanSlug, number>;
}

interface RawTableRow {
  domain: string;
  weight: string;
  hours: string;
}

function parseTableRows(markdown: string): RawTableRow[] {
  const lines = markdown.split("\n");
  const rows: RawTableRow[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      inTable = false;
      continue;
    }
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length >= 3) {
      if (cells[0].toLowerCase() === "domain" || cells[0].startsWith("---")) {
        inTable = true;
        continue;
      }
      if (inTable) {
        rows.push({
          domain: cells[0].replace(/\*\*/g, "").trim(),
          weight: cells[1].replace(/\*\*/g, "").trim(),
          hours: cells[2].replace(/\*\*/g, "").trim()
        });
      }
    }
  }
  return rows;
}

function parseWeight(raw: string): number {
  const clean = raw.replace("%", "").trim();
  return Number(clean);
}
