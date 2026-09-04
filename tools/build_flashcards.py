"""Generate tab-separated flashcards from authored Markdown notes."""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from drills.engine.blueprint import DEFAULT_BLUEPRINT_PATH, load_blueprint  # noqa: E402
from tools.note_content import explicit_flashcards, load_notes  # noqa: E402

DEFAULT_NOTES_PATH = REPOSITORY_ROOT / "notes"
DEFAULT_OUTPUT_PATH = REPOSITORY_ROOT / "flashcards" / "ccdv-f.tsv"


def build_flashcards(
    notes_path: Path, output_path: Path, blueprint_path: Path = DEFAULT_BLUEPRINT_PATH
) -> dict[str, int]:
    """Write an Anki- and Quizlet-importable TSV from authored note sections and card metadata."""
    blueprint = load_blueprint(blueprint_path)
    counts: Counter[str] = Counter({domain.name: 0 for domain in blueprint.domains})
    rows: list[str] = []

    for note in load_notes(notes_path):
        domain_name = note.metadata.get("domain_name")
        if not isinstance(domain_name, str):
            continue
        domain = blueprint.domain(domain_name)
        if domain is None:
            continue
        for front, back, sub_skill in explicit_flashcards(note):
            if sub_skill not in domain.sub_skills:
                continue
            rows.append(_tsv_row(front, _with_blueprint_tags(back, domain_name, sub_skill)))
            counts[domain_name] += 1
        for section in note.sections:
            if section.sub_skill not in domain.sub_skills:
                continue
            rows.append(
                _tsv_row(
                    section.heading,
                    _with_blueprint_tags(section.body, domain_name, section.sub_skill),
                )
            )
            counts[domain_name] += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(rows) + ("\n" if rows else ""), encoding="utf-8")
    return dict(counts)


def _with_blueprint_tags(back: str, domain_name: str, sub_skill: str) -> str:
    """Append exact blueprint labels so every generated card remains machine-joinable."""
    return f"{back}\n\nDomain: {domain_name}\nSub-skill: {sub_skill}"


def _tsv_row(front: str, back: str) -> str:
    """Keep two Quizlet-compatible fields on one TSV row while retaining Markdown line breaks."""
    return "\t".join(_tsv_cell(value) for value in (front, back))


def _tsv_cell(value: str) -> str:
    """Encode tabs and physical newlines without adding content to an authored card."""
    return value.replace("\t", " ").replace("\r\n", "\n").replace("\n", "<br>")


def main(argv: list[str] | None = None) -> int:
    """Generate the card deck and report the transformed-card count for every blueprint domain."""
    parser = argparse.ArgumentParser(description="Build TSV flashcards from authored notes.")
    parser.add_argument("--notes", type=Path, default=DEFAULT_NOTES_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--blueprint", type=Path, default=DEFAULT_BLUEPRINT_PATH)
    arguments = parser.parse_args(argv)
    counts = build_flashcards(arguments.notes, arguments.output, arguments.blueprint)
    print(f"Wrote {sum(counts.values())} flashcard(s) to {arguments.output}.")
    for domain_name, count in counts.items():
        print(f"{domain_name}: {count} card(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
