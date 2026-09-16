"""Read authored note material without turning scaffold prompts into study content."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class Note:
    """A Markdown note with its YAML frontmatter and authored sections."""

    path: Path
    metadata: dict[str, Any]
    sections: tuple["NoteSection", ...]


@dataclass(frozen=True)
class NoteSection:
    """One heading and the authored text immediately below it."""

    heading: str
    level: int
    body: str
    sub_skill: str | None


_FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)
_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)


def load_notes(notes_path: Path) -> tuple[Note, ...]:
    """Load Markdown notes in a platform-independent path order, accepting an empty directory.

    Sorting ``Path`` objects directly is not portable: ``PureWindowsPath`` compares case-folded
    while ``PurePosixPath`` compares by code point, so ``README.md`` sorts before
    ``decision-tables.md`` on Linux and after it on Windows. Anything generated from this order -
    ``flashcards/ccdv-f.tsv`` above all - would then depend on the machine that built it. Sorting
    the POSIX string fixes one order everywhere.
    """
    if not notes_path.exists():
        return ()
    paths = sorted(notes_path.rglob("*.md"), key=lambda path: path.as_posix())
    return tuple(parse_note(path) for path in paths)


def parse_note(path: Path) -> Note:
    """Read one note and retain only sections containing authored, non-scaffold text."""
    text = path.read_text(encoding="utf-8")
    frontmatter = _FRONTMATTER.match(text)
    body = text[frontmatter.end() :] if frontmatter else text
    metadata = _metadata(frontmatter.group(1) if frontmatter else "")
    sections = _sections(body, _sub_skill_names(metadata))
    return Note(path=path, metadata=metadata, sections=sections)


def explicit_flashcards(note: Note) -> tuple[tuple[str, str, str | None], ...]:
    """Return author-supplied front/back cards and their declared sub-skill, when present."""
    cards = note.metadata.get("flashcards", [])
    if not isinstance(cards, list):
        return ()

    result: list[tuple[str, str, str | None]] = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        front = card.get("front")
        back = card.get("back")
        if isinstance(front, str) and front.strip() and isinstance(back, str) and back.strip():
            sub_skill = card.get("sub_skill")
            result.append(
                (front.strip(), back.strip(), sub_skill if isinstance(sub_skill, str) else None)
            )
    return tuple(result)


def _metadata(frontmatter: str) -> dict[str, Any]:
    """Parse mapping-shaped frontmatter while treating malformed metadata as absent."""
    try:
        parsed = yaml.safe_load(frontmatter) if frontmatter else {}
    except yaml.YAMLError:
        return {}
    return dict(parsed) if isinstance(parsed, dict) else {}


def _sub_skill_names(metadata: dict[str, Any]) -> set[str]:
    """Extract exact sub-skill names from the notes' existing frontmatter convention."""
    sub_skills = metadata.get("sub_skills", [])
    if not isinstance(sub_skills, list):
        return set()
    return {
        sub_skill["name"]
        for sub_skill in sub_skills
        if isinstance(sub_skill, dict) and isinstance(sub_skill.get("name"), str)
    }


def _sections(body: str, sub_skills: set[str]) -> tuple[NoteSection, ...]:
    """Split a Markdown body into headings that carry authored prose or Markdown."""
    headings = list(_HEADING.finditer(body))
    sections: list[NoteSection] = []
    current_sub_skill: str | None = None
    for index, heading in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(body)
        heading_text = heading.group(2).strip()
        if heading_text in sub_skills:
            current_sub_skill = heading_text
        authored_body = _without_scaffold_prompts(body[heading.end() : end])
        if _has_authored_content(authored_body):
            sections.append(
                NoteSection(
                    heading=heading_text,
                    level=len(heading.group(1)),
                    body=authored_body.strip(),
                    sub_skill=current_sub_skill,
                )
            )
    return tuple(sections)


def _without_scaffold_prompts(text: str) -> str:
    """Remove the explicit prompts that seed note skeletons without changing authored lines."""
    return "\n".join(
        line for line in text.splitlines() if not line.strip().startswith("Authoring prompt:")
    )


def _has_authored_content(text: str) -> bool:
    """Require a non-heading, non-empty line so bare skeleton headings make no content."""
    return any(line.strip() and not line.lstrip().startswith("#") for line in text.splitlines())
