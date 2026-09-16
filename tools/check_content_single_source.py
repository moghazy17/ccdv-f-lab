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
    ".astro",  # Untracked build output necessarily mirrors the sources and is skipped by this gate.
    ".git",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}
# The end-to-end content-propagation specs copy notes, guide, cheatsheets, and study plans into
# temporary directories under site/ so they can build the site against edited content. Those copies
# are protected prose by construction, and a run killed part-way leaves them behind, which made this
# gate report hundreds of duplications that were nothing but test scaffolding. Skip them by prefix:
# the gate should answer "has prose been copied into the site's source", not "did a test crash".
FIXTURE_DIRECTORY_PREFIX = ".us2-"
# tools/export_runtime_bundle.py deliberately archives lab/ and drills/ source into this generated,
# git-ignored directory for the browser runtime to unpack. That archive is the intended delivery
# mechanism for FR-001, not a violation of it, so this gate never looks inside it.
GENERATED_RUNTIME_DIRECTORY = Path("public") / "runtime"
# tools/export_item_bank.py and tools/export_mock_data.py write these generated, git-ignored files
# from drills/bank/ and BLUEPRINT.md so the mock exam and the quizzes can read the bank without
# loading the runtime. Carrying item text is what the export is for (contracts/mock-data.md), so
# this gate never looks inside them. Every other file under site/ is still checked, which is what
# keeps a hand-copied item out of the tree.
GENERATED_DATA_FILES = frozenset(
    {
        Path("src") / "data" / "mock.json",
        Path("src") / "data" / "items.json",
    }
)
RUNTIME_SOURCE_ROOTS = (Path("lab"), Path("drills"))
RUNTIME_SOURCE_EXTENSION = ".py"
EXCLUDED_RUNTIME_SOURCE_DIRECTORY_NAMES = {"__pycache__"}
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


def find_copied_runtime_source(repository_root: Path) -> list[str]:
    """Return errors for ``lab/`` or ``drills/`` source files copied under ``site/`` (FR-001).

    The runtime archive that ships this same source to the browser (``site/public/runtime/``) is
    generated at build time and explicitly excluded: it is the sanctioned way this source reaches
    the site, not a second copy of it.
    """
    protected_files = _protected_runtime_source(repository_root)
    errors: list[str] = []
    for site_path in _site_python_files(repository_root / "site"):
        site_text = site_path.read_text(encoding="utf-8")
        for content, source_path in protected_files.items():
            if content and site_text.strip() == content:
                errors.append(
                    f"{site_path.relative_to(repository_root)} duplicates runtime source from "
                    f"{source_path.relative_to(repository_root)}."
                )
    return errors


def _protected_runtime_source(repository_root: Path) -> dict[str, Path]:
    """Collect the exact text of every importable module under ``lab/`` and ``drills/``."""
    sources: dict[str, Path] = {}
    for protected_root in RUNTIME_SOURCE_ROOTS:
        root = repository_root / protected_root
        if not root.exists():
            continue
        for source_path in sorted(root.rglob(f"*{RUNTIME_SOURCE_EXTENSION}")):
            if any(part in EXCLUDED_RUNTIME_SOURCE_DIRECTORY_NAMES for part in source_path.parts):
                continue
            sources.setdefault(source_path.read_text(encoding="utf-8").strip(), source_path)
    return sources


def _site_python_files(site_root: Path) -> Iterable[Path]:
    """Yield ``.py`` files under the site source, excluding the generated runtime archive."""
    if not site_root.exists():
        return
    for path in sorted(site_root.rglob(f"*{RUNTIME_SOURCE_EXTENSION}")):
        if not path.is_file():
            continue
        relative = path.relative_to(site_root)
        if (
            relative.parts[: len(GENERATED_RUNTIME_DIRECTORY.parts)]
            == GENERATED_RUNTIME_DIRECTORY.parts
        ):
            continue
        if _is_ignored(path):
            continue
        yield path


def _is_ignored(path: Path) -> bool:
    """Whether a path lies in build output, a dependency tree, or a test's content copy."""
    return any(
        part in IGNORED_SITE_DIRECTORIES or part.startswith(FIXTURE_DIRECTORY_PREFIX)
        for part in path.parts
    )


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
        if _is_ignored(path):
            continue
        if path.relative_to(site_root) in GENERATED_DATA_FILES:
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
    """Return meaningful Markdown paragraphs and decision-table cells, excluding metadata."""
    paragraphs: list[str] = []
    current: list[str] = []
    in_front_matter = False
    in_table = False
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
            in_table = False
            continue
        if stripped.startswith("#"):
            if current:
                paragraphs.append(" ".join(current))
                current = []
            in_table = False
            continue
        if stripped.startswith("|"):
            if current:
                paragraphs.append(" ".join(current))
                current = []
            cells = [cell.strip() for cell in stripped.strip("|").split("|")]
            if _is_table_separator(cells):
                in_table = True
            elif in_table:
                paragraphs.extend(cells)
            continue
        if stripped.startswith("Authoring prompt:"):
            continue
        in_table = False
        current.append(_MARKDOWN_PREFIX.sub("", stripped))
    if current:
        paragraphs.append(" ".join(current))
    return paragraphs


def _is_table_separator(cells: list[str]) -> bool:
    """Recognize Markdown alignment rows so they never become protected prose."""
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


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
    root = arguments.root.resolve()
    errors = find_duplicate_prose(root) + find_copied_runtime_source(root)
    for error in errors:
        print(error)
    if errors:
        print(f"Copied study-prose or runtime-source fragments: {len(errors)}")
        return 1
    print("No copied study prose or runtime source found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
