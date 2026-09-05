"""Keep the authored-content rule aligned with the site's shared fixture."""

from __future__ import annotations

import json
from pathlib import Path

from tools.note_content import parse_note

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = ROOT / "tests" / "fixtures" / "note-content-status.json"


def test_note_content_status_matches_the_shared_fixture(tmp_path: Path) -> None:
    """Python recognises exactly the sections declared authored by the shared cases."""
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    for index, case in enumerate(fixture["cases"]):
        note_path = tmp_path / f"case-{index}.md"
        note_path.write_text(case["markdown"], encoding="utf-8")

        note = parse_note(note_path)

        assert [section.heading for section in note.sections] == case["authoredHeadings"]
