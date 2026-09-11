export type ContentStatus = "authored" | "partial" | "scaffold";

export interface ContentSectionStatus {
  heading: string;
  status: "authored" | "scaffold";
}

const HEADING = /^(#{1,6})\s+(.+?)\s*$/gm;
// Mirrors _FRONTMATTER in tools/note_content.py. Metadata is not note content, and a YAML comment
// inside it would otherwise read as a heading whose body is the rest of the frontmatter.
const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export function authoredHeadings(markdown: string): string[] {
  // Return headings that have authored content under the repository's note rule.
  return sectionStatuses(markdown)
    .filter((section) => section.status === "authored")
    .map((section) => section.heading);
}

export function sectionStatuses(markdown: string): ContentSectionStatus[] {
  // Classify each Markdown heading after removing frontmatter and scaffold authoring prompts.
  const content = withoutAuthoringPrompts(withoutFrontMatter(markdown));
  const headings = Array.from(content.matchAll(HEADING));

  return headings.map((heading, index) => {
    const sectionEnd = headings[index + 1]?.index ?? content.length;
    const body = content.slice((heading.index ?? 0) + heading[0].length, sectionEnd);
    return {
      heading: heading[2].trim(),
      status: hasAuthoredContent(body) ? "authored" : "scaffold"
    };
  });
}

export function domainContentStatus(markdowns: Iterable<string>): ContentStatus {
  // Summarise all note headings in one domain as scaffold, partial, or authored.
  const statuses = Array.from(markdowns, sectionStatuses).flatMap((sections) => sections);
  const authored = statuses.filter((section) => section.status === "authored").length;

  if (authored === 0) {
    return "scaffold";
  }
  return authored === statuses.length ? "authored" : "partial";
}

function withoutFrontMatter(markdown: string): string {
  return markdown.replace(FRONT_MATTER, "");
}

function withoutAuthoringPrompts(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("Authoring prompt:"))
    .join("\n");
}

function hasAuthoredContent(markdown: string): boolean {
  return markdown.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });
}
