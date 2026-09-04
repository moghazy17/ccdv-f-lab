"""Generate per-domain Markdown cheat sheets from the blueprint and authored note extracts."""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from drills.engine.blueprint import (  # noqa: E402
    DEFAULT_BLUEPRINT_PATH,
    load_blueprint,
    parse_sub_skills,
    slugify,
)
from drills.engine.mock import apportion_items  # noqa: E402
from tools.note_content import Note, load_notes  # noqa: E402

DEFAULT_NOTES_PATH = REPOSITORY_ROOT / "notes"
DEFAULT_OUTPUT_PATH = REPOSITORY_ROOT / "cheatsheets"


def build_cheatsheets(
    notes_path: Path, output_path: Path, blueprint_path: Path = DEFAULT_BLUEPRINT_PATH
) -> tuple[Path, ...]:
    """Write one printable Markdown sheet per blueprint domain and return its paths."""
    blueprint = load_blueprint(blueprint_path)
    blueprint_text = blueprint_path.read_text(encoding="utf-8")
    notes_by_domain: dict[str, list[Note]] = defaultdict(list)
    for note in load_notes(notes_path):
        domain_name = note.metadata.get("domain_name")
        if isinstance(domain_name, str) and note.sections:
            notes_by_domain[domain_name].append(note)

    quotas = apportion_items(blueprint, blueprint.exam_item_count)
    output_path.mkdir(parents=True, exist_ok=True)
    generated: list[Path] = []
    for domain in blueprint.domains:
        destination = output_path / f"{domain.number:02d}-{slugify(domain.name)}.md"
        sub_skills = parse_sub_skills(blueprint_text, domain.number)
        destination.write_text(
            _sheet_markdown(
                domain.name,
                domain.weight,
                blueprint.exam_item_count,
                quotas[domain.name],
                sub_skills,
                notes_by_domain[domain.name],
                notes_path,
            ),
            encoding="utf-8",
        )
        generated.append(destination)
    return tuple(generated)


def _sheet_markdown(
    domain_name: str,
    domain_weight: Decimal,
    exam_item_count: int,
    mock_quota: int,
    sub_skills: list[tuple[str, str]],
    notes: list[Note],
    notes_path: Path,
) -> str:
    """Render structural blueprint facts and exact authored extracts without study guidance."""
    exact_items = Decimal(exam_item_count) * domain_weight / Decimal("100")
    lines = [
        f"# {domain_name} cheat sheet",
        "",
        "## Blueprint allocation",
        "",
        f"| Domain weight | Approximate items in a {exam_item_count}-item mock | "
        "Allocated mock items |",
        "|---:|---:|---:|",
        f"| {domain_weight}% | {exact_items:.1f} | {mock_quota} |",
        "",
        "## Sub-skills",
        "",
        "| Sub-skill | Weight |",
        "|---|---:|",
    ]
    lines.extend(f"| {name} | {weight} |" for name, weight in sub_skills)

    extracts: list[str] = []
    for note in notes:
        relative_path = note.path.relative_to(notes_path.parent)
        sheet_link = Path("..") / relative_path
        for section in note.sections:
            extracts.extend(
                (
                    "",
                    f"### {section.heading}",
                    "",
                    section.body,
                    "",
                    f"Source note: [{relative_path}]({sheet_link.as_posix()})",
                )
            )
    if extracts:
        lines.extend(("", "## Authored note extracts", *extracts))
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    """Generate printable sheets and report their output directory."""
    parser = argparse.ArgumentParser(description="Build cheat sheets from the blueprint and notes.")
    parser.add_argument("--notes", type=Path, default=DEFAULT_NOTES_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--blueprint", type=Path, default=DEFAULT_BLUEPRINT_PATH)
    arguments = parser.parse_args(argv)
    sheets = build_cheatsheets(arguments.notes, arguments.output, arguments.blueprint)
    print(f"Wrote {len(sheets)} cheat sheet(s) to {arguments.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
