import { domains } from "./blueprint";

export type ExperienceLevel = "none" | "some" | "strong";

export type PlanSlug = "1-week" | "3-weeks" | "6-weeks";

export interface DiagnosticInput {
  experience: Record<string, string>;
  weeksAvailable: number;
  hoursPerWeek: number;
}

export interface DiagnosticResult {
  source: "self-report";
  experience: Record<string, ExperienceLevel>;
  weeksAvailable: number;
  hoursPerWeek: number;
  recommendedPlan: PlanSlug;
  reason: string;
  completedAt: string;
}

const PLAN_HOURS: Record<PlanSlug, number> = {
  "1-week": 14,
  "3-weeks": 42,
  "6-weeks": 84
};

export function recommend(
  input: DiagnosticInput,
  completedAt: string = new Date().toISOString()
): DiagnosticResult {
  const weeks = Math.max(1, Math.round(input.weeksAvailable || 1));
  const hoursPerWeek = Math.max(1, Number(input.hoursPerWeek) || 1);
  const budget = weeks * hoursPerWeek;

  let basePlan: PlanSlug = "1-week";
  if (budget >= 84) {
    basePlan = "6-weeks";
  } else if (budget >= 42) {
    basePlan = "3-weeks";
  } else {
    basePlan = "1-week";
  }

  const normalizedExperience = normalizeExperience(input.experience);
  const isBiased = hasNoExperienceInHeaviestDomains(normalizedExperience);

  let recommendedPlan = basePlan;
  if (isBiased) {
    if (basePlan === "1-week") {
      recommendedPlan = "3-weeks";
    } else if (basePlan === "3-weeks") {
      recommendedPlan = "6-weeks";
    }
  }

  const reason = buildReason({
    basePlan,
    budget,
    hoursPerWeek,
    isBiased,
    recommendedPlan,
    weeks
  });

  return {
    source: "self-report",
    experience: normalizedExperience,
    weeksAvailable: weeks,
    hoursPerWeek,
    recommendedPlan,
    reason,
    completedAt
  };
}

function normalizeExperience(
  raw: Record<string, string> | undefined
): Record<string, ExperienceLevel> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const result: Record<string, ExperienceLevel> = {};
  for (const [key, value] of Object.entries(raw)) {
    const val = String(value).toLowerCase();
    if (val === "none" || val === "some" || val === "strong") {
      result[key] = val;
    }
  }
  return result;
}

function hasNoExperienceInHeaviestDomains(
  experience: Record<string, ExperienceLevel>
): boolean {
  return heaviestDomainSlugs().every((slug) => experience[slug] === "none");
}

/**
 * The two domains carrying the most exam weight, derived from the blueprint rather than named here.
 * Hard-coding which domains are heaviest would silently target the wrong ones if the published
 * weights ever change, and no gate would catch it.
 */
function heaviestDomainSlugs(): string[] {
  return [...domains]
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 2)
    .map((domain) => domain.slug);
}

interface ReasonParams {
  basePlan: PlanSlug;
  budget: number;
  hoursPerWeek: number;
  isBiased: boolean;
  recommendedPlan: PlanSlug;
  weeks: number;
}

function buildReason(params: ReasonParams): string {
  const { basePlan, budget, hoursPerWeek, isBiased, recommendedPlan, weeks } = params;
  const planHours = PLAN_HOURS[recommendedPlan];

  if (isBiased && recommendedPlan !== basePlan) {
    return `Your time budget of ${weeks} ${weeks === 1 ? "week" : "weeks"} at ${hoursPerWeek} hours per week (${budget} hours total) matches the ${basePlan} plan. Because you reported no prior experience in the two heaviest domains (Applications and Integration, and Model Selection and Optimization), we recommend the ${recommendedPlan} (${planHours}-hour) plan to provide adequate preparation time.`;
  }

  if (budget < 14) {
    return `At ${weeks} ${weeks === 1 ? "week" : "weeks"} and ${hoursPerWeek} hours per week (${budget} hours total), your available time is under the standard plans. The 1-week plan (14 hours) is recommended as the closest starting point.`;
  }

  if (weeks === 3 && hoursPerWeek === 14) {
    return "Three weeks at 14 hours matches the 42-hour plan most closely.";
  }

  const weeksWord = weeks === 1 ? "1 week" : `${weeks} weeks`;
  return `${weeksWord} at ${hoursPerWeek} hours per week (${budget} hours total) matches the ${recommendedPlan} (${planHours}-hour) plan most closely.`;
}
