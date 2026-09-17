"""Check that every practice item's citation is recorded in ``SOURCES.md``, without a network call.

A citation the source record does not carry is a claim nobody wrote down, and an item claiming a
check older than the record is citing a page state nobody verified. Both pass the item schema, and
both are invisible to a reviewer reading a forty-item diff, so they are checked here instead.

Whether a cited page is still reachable is ``tools/check_links.py``'s business, and whether it still
says what the item claims is a reviewer's. This gate reads local files only.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from drills.engine.validation import DEFAULT_BANK_PATH, find_bank_items  # noqa: E402

DEFAULT_SOURCES_PATH = REPOSITORY_ROOT / "SOURCES.md"

_REFERENCE_DEFINITION = re.compile(r"^\[(?P<label>[^\]]+)\]:\s*(?P<url>\S+)\s*$")
_TABLE_ROW = re.compile(
    r"^\|(?P<cited>[^|]*)\|.*\|\s*(?P<verified>\d{4}-\d{2}-\d{2})\s*\|$",
)
_REFERENCE_CITATION = re.compile(r"\]\[(?P<label>[^\]]+)\]")
_INLINE_CITATION = re.compile(r"\]\((?P<url>https?://[^)\s]+)\)")


class SourceIntegrityError(ValueError):
    """The source record and the bank's citations disagree."""


@dataclass(frozen=True)
class CitationProblem:
    """One item's citation that the source record does not support."""

    item_path: Path
    message: str

    def format(self, root: Path) -> str:
        """Render the problem with a path a reader can open."""
        try:
            location = self.item_path.relative_to(root)
        except ValueError:
            location = self.item_path
        return f"{location}: {self.message}"


def read_source_record(sources_path: Path = DEFAULT_SOURCES_PATH) -> dict[str, str]:
    """Map each recorded URL to the date its row states the page was checked.

    ``SOURCES.md`` is parsed a line at a time on purpose. A single anchored expression applied to
    the whole document lets a trailing ``\\s*$`` run past a line ending, so one row swallows its
    neighbours and pages that are plainly recorded are reported as missing.
    """
    lines = sources_path.read_text(encoding="utf-8").split("\n")
    labels: dict[str, str] = {}
    for line in lines:
        definition = _REFERENCE_DEFINITION.match(line.strip())
        if definition is not None:
            labels[definition["label"]] = definition["url"]

    record: dict[str, str] = {}
    for line in lines:
        row = _TABLE_ROW.match(line.strip())
        if row is None:
            continue
        for citation in _REFERENCE_CITATION.finditer(row["cited"]):
            url = labels.get(citation["label"])
            if url is not None:
                record[url] = row["verified"]
        for citation in _INLINE_CITATION.finditer(row["cited"]):
            record[citation["url"]] = row["verified"]
    return record


def citation_problems(
    bank_path: Path = DEFAULT_BANK_PATH,
    sources_path: Path = DEFAULT_SOURCES_PATH,
) -> list[CitationProblem]:
    """Return every citation the source record does not carry or does not support."""
    record = read_source_record(sources_path)
    problems: list[CitationProblem] = []
    for bank_item in find_bank_items(bank_path):
        sources = bank_item.item.get("sources")
        if not isinstance(sources, list):
            continue
        for source in sources:
            if not isinstance(source, dict):
                continue
            url = source.get("url")
            verified_on = source.get("verified_on")
            if not isinstance(url, str) or not isinstance(verified_on, str):
                continue
            recorded_on = record.get(url)
            if recorded_on is None:
                problems.append(
                    CitationProblem(bank_item.path, f"cited URL has no row in SOURCES.md: {url}")
                )
            elif verified_on < recorded_on:
                problems.append(
                    CitationProblem(
                        bank_item.path,
                        f"verified_on {verified_on} is earlier than the SOURCES.md row's "
                        f"{recorded_on} for {url}",
                    )
                )
    return problems


def check_source_integrity(
    bank_path: Path = DEFAULT_BANK_PATH,
    sources_path: Path = DEFAULT_SOURCES_PATH,
) -> None:
    """Raise ``SourceIntegrityError`` listing every citation the record does not support."""
    problems = citation_problems(bank_path, sources_path)
    if problems:
        listed = "\n".join(f"- {problem.format(REPOSITORY_ROOT)}" for problem in problems)
        raise SourceIntegrityError(f"Citations without a matching source record:\n{listed}")


def main(argv: list[str] | None = None) -> int:
    """Run the check and return a shell-compatible exit status."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--bank", type=Path, default=DEFAULT_BANK_PATH)
    parser.add_argument("--sources", type=Path, default=DEFAULT_SOURCES_PATH)
    args = parser.parse_args(argv)

    try:
        check_source_integrity(args.bank, args.sources)
    except (SourceIntegrityError, OSError) as error:
        print(f"Source integrity check failed: {error}")
        return 1
    print("Source integrity check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
