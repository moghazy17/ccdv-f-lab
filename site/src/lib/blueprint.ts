import sourceData from "../data/blueprint.json";

export interface ExamFacts {
  items: number;
  timeLimitMinutes: number;
  passingScore: number;
  scaleMin: number;
  scaleMax: number;
  feeUsd: number;
  validityMonths: number;
}

export interface SubSkill {
  name: string;
  weight: number;
  approximateItems: number;
  measured: string;
}

export interface BlueprintDomain {
  number: number;
  slug: string;
  name: string;
  weight: number;
  approximateItems: number;
  mockItems: number;
  subSkills: readonly SubSkill[];
}

export interface BlueprintData {
  sourceDigest: string;
  generatedFrom: "BLUEPRINT.md";
  examFacts: ExamFacts;
  domains: readonly BlueprintDomain[];
}

export const blueprint = parseBlueprintData(sourceData);
export const domains = blueprint.domains;

export function domainBySlug(slug: string): BlueprintDomain | undefined {
  // Find one source-validated domain without changing the blueprint's published order.
  return domains.find((domain) => domain.slug === slug);
}

function parseBlueprintData(value: unknown): BlueprintData {
  const record = requiredRecord(value, "blueprint data");
  const domainsValue = record.domains;
  if (!Array.isArray(domainsValue) || domainsValue.length === 0) {
    throw new Error("Generated blueprint data has no domains.");
  }

  return {
    sourceDigest: requiredString(record.sourceDigest, "sourceDigest"),
    generatedFrom: requiredGeneratedFrom(record.generatedFrom),
    examFacts: parseExamFacts(record.examFacts),
    domains: domainsValue.map(parseDomain)
  };
}

function parseExamFacts(value: unknown): ExamFacts {
  const record = requiredRecord(value, "examFacts");
  return {
    items: requiredNumber(record.items, "examFacts.items"),
    timeLimitMinutes: requiredNumber(record.timeLimitMinutes, "examFacts.timeLimitMinutes"),
    passingScore: requiredNumber(record.passingScore, "examFacts.passingScore"),
    scaleMin: requiredNumber(record.scaleMin, "examFacts.scaleMin"),
    scaleMax: requiredNumber(record.scaleMax, "examFacts.scaleMax"),
    feeUsd: requiredNumber(record.feeUsd, "examFacts.feeUsd"),
    validityMonths: requiredNumber(record.validityMonths, "examFacts.validityMonths")
  };
}

function parseDomain(value: unknown): BlueprintDomain {
  const record = requiredRecord(value, "domain");
  const subSkills = record.subSkills;
  if (!Array.isArray(subSkills)) {
    throw new Error("Generated blueprint data has a domain without sub-skills.");
  }
  return {
    number: requiredNumber(record.number, "domain.number"),
    slug: requiredString(record.slug, "domain.slug"),
    name: requiredString(record.name, "domain.name"),
    weight: requiredNumber(record.weight, "domain.weight"),
    approximateItems: requiredNumber(record.approximateItems, "domain.approximateItems"),
    mockItems: requiredNumber(record.mockItems, "domain.mockItems"),
    subSkills: subSkills.map(parseSubSkill)
  };
}

function parseSubSkill(value: unknown): SubSkill {
  const record = requiredRecord(value, "sub-skill");
  return {
    name: requiredString(record.name, "sub-skill.name"),
    weight: requiredNumber(record.weight, "sub-skill.weight"),
    approximateItems: requiredNumber(record.approximateItems, "sub-skill.approximateItems"),
    measured: requiredString(record.measured, "sub-skill.measured")
  };
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Generated blueprint data has an invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Generated blueprint data has an invalid ${label}.`);
  }
  return value;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Generated blueprint data has an invalid ${label}.`);
  }
  return value;
}

function requiredGeneratedFrom(value: unknown): "BLUEPRINT.md" {
  if (value !== "BLUEPRINT.md") {
    throw new Error("Generated blueprint data has an invalid generatedFrom field.");
  }
  return value;
}
