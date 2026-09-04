"""Structural checks that keep note skeleton metadata aligned with the blueprint."""

from __future__ import annotations

import re
from pathlib import Path

from drills.engine.blueprint import parse_domains, parse_sub_skills, slugify

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT_PATH = REPOSITORY_ROOT / "BLUEPRINT.md"
NOTES_PATH = REPOSITORY_ROOT / "notes"
EXPECTED_FILES = ("README.md", "decision-tables.md", "pitfalls.md", "self-check.md")


def frontmatter(path: Path) -> str:
    """Read the file's YAML frontmatter without a YAML dependency."""
    content = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\n(.*?)\n---\n", content, flags=re.DOTALL)
    assert match, f"{path} does not start with YAML frontmatter"
    return match.group(1)


def frontmatter_value(metadata: str, key: str) -> str:
    """Return one scalar value from frontmatter."""
    pattern = r"^" + re.escape(key) + r':\s*"?([^"\n]+)"?\s*$'
    match = re.search(pattern, metadata, re.MULTILINE)
    assert match, f"Frontmatter has no {key}"
    return match.group(1).strip()


def frontmatter_sub_skills(metadata: str) -> list[tuple[str, str]]:
    """Return the YAML sub-skill names and weights from the skeleton frontmatter."""
    pattern = re.compile(r'^  - name: "(.+?)"\n    weight: "(.+?)"$', re.MULTILINE)
    return pattern.findall(metadata)


def test_note_skeletons_match_blueprint_domains() -> None:
    """Every blueprint domain has the expected note files with the matching frontmatter weight."""
    domains = parse_domains(BLUEPRINT_PATH.read_text(encoding="utf-8"))

    assert domains
    for number, name, weight in domains:
        domain_directory = NOTES_PATH / f"{number:02d}-{slugify(name)}"
        assert domain_directory.is_dir(), f"Missing notes directory: {domain_directory}"
        expected_sub_skills = parse_sub_skills(BLUEPRINT_PATH.read_text(encoding="utf-8"), number)

        for filename in EXPECTED_FILES:
            note_file = domain_directory / filename
            assert note_file.is_file(), f"Missing skeleton file: {note_file}"
            metadata = frontmatter(note_file)
            assert frontmatter_value(metadata, "domain_name") == name
            assert frontmatter_value(metadata, "domain_number") == str(number)
            assert frontmatter_value(metadata, "domain_weight") == weight
            assert frontmatter_sub_skills(metadata) == expected_sub_skills
