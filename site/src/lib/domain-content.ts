import type { BlueprintDomain, SubSkill } from "./blueprint";
import { domainContentStatus, type ContentStatus } from "./content-status";

export interface NoteEntry {
  body?: string;
  id: string;
}

export interface DomainSubSkill {
  definition: SubSkill;
  status: "authored" | "scaffold";
}

export interface DomainContent {
  labModules: readonly string[];
  markdown: string;
  status: ContentStatus;
  subSkills: readonly DomainSubSkill[];
}

const HEADING = /^(#{1,6})\s+(.+?)\s*$/gm;

const LAB_MODULES_BY_DOMAIN: Readonly<Record<number, readonly string[]>> = {
  2: ["batch", "caching", "config", "ingest", "transport"],
  4: ["output", "transport"],
  5: ["batch", "caching", "config", "router", "transport"],
  6: ["context", "ingest", "loop", "output"],
  7: ["ingest", "secrets", "security"]
};

interface MarkdownHeading {
  body: string;
  depth: number;
  line: string;
  name: string;
}

export function buildDomainContent(
  domain: BlueprintDomain,
  noteEntries: Iterable<NoteEntry>
): DomainContent {
  // Join the typed blueprint to source notes without retaining a second copy of the study content.
  const entries = [...noteEntries]
    .filter((entry) => entry.id.startsWith(`${domain.slug}/`))
    .sort((left, right) => left.id.localeCompare(right.id));
  const markdowns = entries.map((entry) => entry.body ?? "");
  const authoredSubSkills = new Set<string>();
  const markdown = markdowns
    .map((markdown) => authoredMarkdown(markdown, domain, authoredSubSkills))
    .filter((markdown) => markdown.length > 0)
    .join("\n\n");

  return {
    labModules: LAB_MODULES_BY_DOMAIN[domain.number] ?? [],
    markdown,
    status: domainContentStatus(markdowns),
    subSkills: domain.subSkills.map((definition) => ({
      definition,
      status: authoredSubSkills.has(definition.name) ? "authored" : "scaffold"
    }))
  };
}

function authoredMarkdown(
  markdown: string,
  domain: BlueprintDomain,
  authoredSubSkills: Set<string>
): string {
  const headings = markdownHeadings(markdown);
  const subSkillNames = new Set(domain.subSkills.map((subSkill) => subSkill.name));
  const selected = new Set<number>();
  const parentSubSkill = new Map<number, number>();
  let currentSubSkill: number | undefined;

  headings.forEach((heading, index) => {
    if (subSkillNames.has(heading.name)) {
      currentSubSkill = index;
    }
    if (currentSubSkill !== undefined) {
      parentSubSkill.set(index, currentSubSkill);
    }
    if (hasAuthoredContent(heading.body)) {
      selected.add(index);
      const parent = parentSubSkill.get(index);
      if (parent !== undefined) {
        authoredSubSkills.add(headings[parent].name);
      }
    }
  });

  const emittedParents = new Set<number>();
  return headings
    .flatMap((heading, index) => {
      if (!selected.has(index)) {
        return [];
      }

      const parent = parentSubSkill.get(index);
      const fragments: string[] = [];
      if (
        parent !== undefined &&
        parent !== index &&
        !selected.has(parent) &&
        !emittedParents.has(parent)
      ) {
        fragments.push(headings[parent].line);
        emittedParents.add(parent);
      }

      if (heading.depth === 1 && heading.name === domain.name) {
        fragments.push(heading.body.trim());
      } else {
        fragments.push(`${heading.line}\n\n${heading.body.trim()}`);
      }
      return fragments.filter((fragment) => fragment.length > 0);
    })
    .join("\n\n");
}

function markdownHeadings(markdown: string): MarkdownHeading[] {
  const withoutPrompts = markdown
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("Authoring prompt:"))
    .join("\n");
  const matches = Array.from(withoutPrompts.matchAll(HEADING));

  return matches.map((match, index) => {
    const nextHeading = matches[index + 1];
    const bodyEnd = nextHeading?.index ?? withoutPrompts.length;
    return {
      body: withoutPrompts.slice((match.index ?? 0) + match[0].length, bodyEnd),
      depth: match[1].length,
      line: match[0],
      name: match[2].trim()
    };
  });
}

function hasAuthoredContent(markdown: string): boolean {
  return markdown.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });
}
