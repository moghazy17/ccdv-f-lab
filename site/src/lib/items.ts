/**
 * The shape of one practice item as the site consumes it.
 *
 * Items are authored as YAML in `drills/bank/` and exported to `site/src/data/items.json` at
 * build time by `tools/export_item_bank.py`. These types describe that exported shape, so the
 * mock exam, the domain quizzes, and a stored attempt all agree on one definition rather than
 * each restating it. They live here, and not in the storage module, because they describe study
 * content rather than anything about how progress is persisted.
 */

export interface PracticeOption {
  id: string;
  text: string;
  correct: boolean;
  rationale: string;
  trapType?: string;
}

export interface PracticeSource {
  title: string;
  url: string;
  verifiedOn: string;
}

export interface PracticeItem {
  id: string;
  domain: string;
  subSkill: string;
  difficulty: "recall" | "application" | "analysis";
  select: number;
  stem: string;
  options: PracticeOption[];
  sources: PracticeSource[];
}
