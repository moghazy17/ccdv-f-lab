/**
 * Scoring for the mock exam and the domain quizzes.
 *
 * This mirrors `drills/engine/scoring.py`. The duplication is deliberate and recorded in
 * `specs/002-lab-runner-mock-exam/plan.md`: scoring has to run in the browser as a candidate
 * answers, and the mock deliberately carries no Python runtime, so the rule is implemented twice
 * and pinned by fixtures the Python engine generates (`tests/test_scoring_fixtures.py` writes
 * `site/tests/fixtures/scoring-cases.json`, and `site/tests/unit/scoring.test.ts` replays it).
 * Change one side and the other fails, which is the point.
 *
 * The rule itself is small and closed: a selection is correct only when it is exactly the set of
 * correct options, tallies are kept per blueprint domain, and readiness is withheld unless every
 * domain was assessed.
 */

/** The bar this repository states, matching `READINESS_OVERALL_FRACTION` in the Python engine. */
export const READINESS_OVERALL_FRACTION = 0.85;

/** The per-domain bar, matching `READINESS_DOMAIN_FRACTION` in the Python engine. */
export const READINESS_DOMAIN_FRACTION = 0.7;

/** One option of a scored item; only its identity and correctness matter to scoring. */
export interface ScorableOption {
  id: string;
  correct: boolean;
}

/** One scored item, carrying the exact blueprint domain name it belongs to. */
export interface ScorableItem {
  id: string;
  domain: string;
  options: readonly ScorableOption[];
}

/** What a candidate selected, keyed by item; an absent item counts as unanswered. */
export type Selections = Readonly<Record<string, readonly string[]>>;

/** The number correct and attempted for one blueprint domain. */
export interface DomainResult {
  name: string;
  correct: number;
  itemCount: number;
}

/** The scale the estimate is expressed on, read from the exported blueprint data. */
export interface ScoringScale {
  minimum: number;
  maximum: number;
  /** The published passing score, reported back so a report can state its own anchor. */
  passingScore: number;
}

/** A scored attempt and the reporting values derived from the blueprint. */
export interface ScoreOutcome {
  correct: number;
  itemCount: number;
  fractionCorrect: number;
  domains: DomainResult[];
  estimatedScaledScore: number;
  scoreAnchor: number;
  scaleMinimum: number;
  scaleMaximum: number;
  unassessedDomains: string[];
  lowDomains: string[];
  ready: boolean;
}

/**
 * Round the way Python's `round` does — half to even — so the estimate this produces is the same
 * integer the engine produces. `Math.round` rounds a half away from zero, which would disagree at
 * every exact `.5`, and an estimate that differs between the two implementations is exactly the
 * drift the fixtures exist to catch.
 */
function roundHalfToEven(value: number): number {
  const floor = Math.floor(value);
  const remainder = value - floor;
  if (remainder > 0.5) {
    return floor + 1;
  }
  if (remainder < 0.5) {
    return floor;
  }
  return floor % 2 === 0 ? floor : floor + 1;
}

/** The correct option identifiers of one item, as a set. */
export function correctOptionIds(item: ScorableItem): Set<string> {
  return new Set(item.options.filter((option) => option.correct).map((option) => option.id));
}

/** Whether a selection is exactly the item's correct set — no partial credit either way. */
export function isCorrect(item: ScorableItem, selected: readonly string[] | undefined): boolean {
  const expected = correctOptionIds(item);
  const chosen = new Set(selected ?? []);
  if (chosen.size !== expected.size) {
    return false;
  }
  for (const id of chosen) {
    if (!expected.has(id)) {
      return false;
    }
  }
  return true;
}

/**
 * Score one attempt against every blueprint domain.
 *
 * `domainNames` comes from the exported blueprint data, so a domain with no item in this mock
 * still appears in the report — as unassessed, which is what withholds readiness.
 */
export function scoreAttempt(
  items: readonly ScorableItem[],
  selections: Selections,
  domainNames: readonly string[],
  scale: ScoringScale,
  scoreAnchor: number = scale.passingScore
): ScoreOutcome {
  if (scoreAnchor < scale.minimum || scoreAnchor > scale.maximum) {
    throw new Error(`Score anchor must be between ${scale.minimum} and ${scale.maximum}.`);
  }

  const correctByDomain = new Map(domainNames.map((name) => [name, 0]));
  const countByDomain = new Map(domainNames.map((name) => [name, 0]));
  let totalCorrect = 0;
  let itemCount = 0;

  for (const item of items) {
    if (!countByDomain.has(item.domain)) {
      throw new Error(`Item ${item.id} has a domain absent from the blueprint: ${item.domain}.`);
    }
    itemCount += 1;
    countByDomain.set(item.domain, (countByDomain.get(item.domain) ?? 0) + 1);
    if (isCorrect(item, selections[item.id])) {
      totalCorrect += 1;
      correctByDomain.set(item.domain, (correctByDomain.get(item.domain) ?? 0) + 1);
    }
  }

  const fractionCorrect = itemCount === 0 ? 0 : totalCorrect / itemCount;
  const domains: DomainResult[] = domainNames.map((name) => ({
    name,
    correct: correctByDomain.get(name) ?? 0,
    itemCount: countByDomain.get(name) ?? 0
  }));
  const unassessedDomains = domains
    .filter((domain) => domain.itemCount === 0)
    .map((domain) => domain.name);
  const lowDomains = domains
    .filter(
      (domain) =>
        domain.itemCount > 0 && domain.correct / domain.itemCount < READINESS_DOMAIN_FRACTION
    )
    .map((domain) => domain.name);

  return {
    correct: totalCorrect,
    itemCount,
    fractionCorrect,
    domains,
    estimatedScaledScore: roundHalfToEven(
      scale.minimum + (scale.maximum - scale.minimum) * fractionCorrect
    ),
    scoreAnchor,
    scaleMinimum: scale.minimum,
    scaleMaximum: scale.maximum,
    unassessedDomains,
    lowDomains,
    ready:
      itemCount > 0 &&
      unassessedDomains.length === 0 &&
      fractionCorrect >= READINESS_OVERALL_FRACTION &&
      lowDomains.length === 0
  };
}
