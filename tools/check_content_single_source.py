"""Reject study prose that has been copied into the website source tree."""

from __future__ import annotations

import argparse
import re
from collections.abc import Iterable
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
PROTECTED_ROOTS = (
    Path("notes"),
    Path("cheatsheets"),
    Path("guide"),
    Path("study-plans"),
    Path("drills/bank"),
)
SITE_TEXT_EXTENSIONS = {".astro", ".css", ".html", ".js", ".json", ".md", ".mjs", ".ts", ".txt"}
IGNORED_SITE_DIRECTORIES = {
    ".astro",  # Astro's generated content cache holds copies of the sources it loaded.
    ".git",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}
MINIMUM_PROSE_LENGTH = 40
_WHITESPACE = re.compile(r"\s+")
_MARKDOWN_SYNTAX = re.compile(r"[*_`~]+")
_PUNCTUATION_EQUIVALENTS = str.maketrans(
    {
        "–": "-",
        "—": "-",
        "−": "-",
        "‘": "'",
        "’": "'",
        "“": '"',
        "”": '"',
        "×": "x",
        " ": " ",
    }
)
_MARKDOWN_PREFIX = re.compile(r"^(?:[-*+]\s+|\d+\.\s+)")
_YAML_VALUE = re.compile(r"^(?:[\w-]+:\s*)(?P<value>.+)$")


def find_duplicate_prose(repository_root: Path) -> list[str]:
    """Return errors for protected prose fragments that appear in ``site/`` files."""
    source_fragments = _protected_prose(repository_root)
    errors: list[str] = []
    for site_path in _site_text_files(repository_root / "site"):
        site_text = _normalize(site_path.read_text(encoding="utf-8"))
        if not site_text:
            continue
        for fragment, source_path in source_fragments.items():
            if fragment in site_text:
                errors.append(
                    f"{site_path.relative_to(repository_root)} duplicates protected prose from "
                    f"{source_path.relative_to(repository_root)}: {fragment[:80]!r}"
                )
    return errors


def _protected_prose(repository_root: Path) -> dict[str, Path]:
    """Collect normalized prose paragraphs from every protected content root."""
    fragments: dict[str, Path] = {}
    for protected_root in PROTECTED_ROOTS:
        root = repository_root / protected_root
        if not root.exists():
            continue
        for source_path in sorted(path for path in root.rglob("*") if path.is_file()):
            for fragment in _prose_fragments(source_path):
                fragments.setdefault(fragment, source_path)
    return fragments


def _site_text_files(site_root: Path) -> Iterable[Path]:
    """Yield text files in the site source while excluding generated output and dependencies."""
    if not site_root.exists():
        return
    for path in sorted(site_root.rglob("*")):
        if not path.is_file() or path.suffix not in SITE_TEXT_EXTENSIONS:
            continue
        if any(part in IGNORED_SITE_DIRECTORIES for part in path.parts):
            continue
        yield path


def _prose_fragments(source_path: Path) -> set[str]:
    """Extract meaningful Markdown paragraphs and YAML scalar values from a source file."""
    lines = source_path.read_text(encoding="utf-8").splitlines()
    if source_path.suffix == ".md":
        candidates = _markdown_paragraphs(lines)
    else:
        candidates = _yaml_values(lines)
    return {
        normalized
        for candidate in candidates
        if len(normalized := _normalize(candidate)) >= MINIMUM_PROSE_LENGTH
    }


def _markdown_paragraphs(lines: list[str]) -> list[str]:
    """Return paragraph-like Markdown content while excluding headings, tables, and metadata."""
    paragraphs: list[str] = []
    current: list[str] = []
    in_front_matter = False
    for index, line in enumerate(lines):
        stripped = line.strip()
        if index == 0 and stripped == "---":
            in_front_matter = True
            continue
        if in_front_matter:
            if stripped == "---":
                in_front_matter = False
            continue
        if not stripped:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        if stripped.startswith("#") or stripped.startswith("|"):
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        if stripped.startswith("Authoring prompt:"):
            continue
        current.append(_MARKDOWN_PREFIX.sub("", stripped))
    if current:
        paragraphs.append(" ".join(current))
    return paragraphs


def _yaml_values(lines: list[str]) -> list[str]:
    """Return scalar values and folded blocks from the drill-bank YAML without parsing YAML."""
    values: list[str] = []
    folded_lines: list[str] | None = None
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if folded_lines is not None:
                values.append(" ".join(folded_lines))
                folded_lines = None
            continue
        if folded_lines is not None and line.startswith(("  ", "    ")):
            folded_lines.append(stripped)
            continue
        if folded_lines is not None:
            values.append(" ".join(folded_lines))
            folded_lines = None
        match = _YAML_VALUE.match(stripped.lstrip("- ").strip())
        if match is None:
            continue
        value = match.group("value").strip('"')
        if value in {">", ">-", "|", "|-"}:
            folded_lines = []
        else:
            values.append(value)
    if folded_lines is not None:
        values.append(" ".join(folded_lines))
    return values


def _normalize(text: str) -> str:
    """Reduce text to comparable prose, ignoring Markdown syntax and typographic variants.

    Prose pasted into a template usually loses its Markdown emphasis and gains ASCII punctuation,
    so comparing raw text would miss the most common way study content gets duplicated.
    """
    translated = text.translate(_PUNCTUATION_EQUIVALENTS)
    return _WHITESPACE.sub(" ", _MARKDOWN_SYNTAX.sub("", translated)).strip().casefold()


def main(argv: list[str] | None = None) -> int:
    """Run the duplication gate and return a shell-compatible status."""
    parser = argparse.ArgumentParser(description="Reject copied study prose in site sources.")
    parser.add_argument("--root", type=Path, default=REPOSITORY_ROOT)
    arguments = parser.parse_args(argv)
    errors = find_duplicate_prose(arguments.root.resolve())
    for error in errors:
        print(error)
    if errors:
        print(f"Copied study-prose fragments: {len(errors)}")
        return 1
    print("No copied study prose found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
