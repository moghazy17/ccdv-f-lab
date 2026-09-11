"""Parse the repository's CCDV-F blueprint without duplicating its taxonomy in code."""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path


@dataclass(frozen=True)
class Domain:
    """One weighted domain and its exact blueprint sub-skills."""

    number: int
    name: str
    weight: Decimal
    sub_skills: tuple[str, ...]


@dataclass(frozen=True)
class Blueprint:
    """The facts the drill engine needs from the local source-of-truth document."""

    domains: tuple[Domain, ...]
    exam_item_count: int
    time_limit_minutes: int
    scale_minimum: int
    scale_maximum: int
    passing_score: int

    def domain(self, name: str) -> Domain | None:
        """Return a domain by its exact name, if the blueprint defines it."""
        return next((domain for domain in self.domains if domain.name == name), None)


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BLUEPRINT_PATH = REPOSITORY_ROOT / "BLUEPRINT.md"


def _without_emphasis(value: str) -> str:
    return value.replace("**", "").strip()


def slugify(name: str) -> str:
    """Match the note-directory naming convention without third-party dependencies."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def parse_domains(blueprint: str) -> list[tuple[int, str, str]]:
    """Return domain number, exact name, and published weight from the Domains table."""
    table = blueprint.split("## Domains", maxsplit=1)[1].split("## Sub-skills", maxsplit=1)[0]
    pattern = re.compile(r"^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([^|]+?)\s*\|", re.MULTILINE)

    return [
        (int(number), _without_emphasis(name), _without_emphasis(weight))
        for number, name, weight in pattern.findall(table)
    ]


def parse_sub_skills(blueprint: str, domain_number: int) -> list[tuple[str, str]]:
    """Return exact sub-skill names and weights for a blueprint domain."""
    sub_skill_section = blueprint.split("## Sub-skills", maxsplit=1)[1].split(
        "## Weighted mock composition", maxsplit=1
    )[0]
    heading = re.compile(rf"^### Domain {domain_number} .+$", re.MULTILINE)
    start = heading.search(sub_skill_section)
    if start is None:
        raise ValueError(f"Blueprint has no sub-skill section for domain {domain_number}")

    following_heading = re.compile(r"^### Domain \d+ .+$", re.MULTILINE).search(
        sub_skill_section, start.end()
    )
    end = following_heading.start() if following_heading else len(sub_skill_section)
    domain_section = sub_skill_section[start.end() : end]
    row_pattern = re.compile(r"^\|\s*(.+?)\s*\|\s*([^|]+?)\s*\|", re.MULTILINE)

    return [
        (_without_emphasis(name), _without_emphasis(weight))
        for name, weight in row_pattern.findall(domain_section)
        if name.strip() not in {"Sub-skill", "---"}
    ]


def _parse_exam_facts(blueprint: str) -> tuple[int, int, int, int, int]:
    exam_facts = blueprint.split("## Exam facts", maxsplit=1)[1].split("## Domains", maxsplit=1)[0]
    item_match = re.search(r"^\|\s*Items\s*\|\s*\*{0,2}(\d+)", exam_facts, re.MULTILINE)
    time_match = re.search(r"^\|\s*Time limit\s*\|\s*\*{0,2}(\d+)", exam_facts, re.MULTILINE)
    score_match = re.search(
        r"^\|\s*Passing score\s*\|\s*\*{0,2}(\d+).*?\*{0,2}(\d+)\s*[–-]\s*(\d+)",
        exam_facts,
        re.MULTILINE,
    )
    if item_match is None or time_match is None or score_match is None:
        raise ValueError(
            "Blueprint exam facts do not contain item count, time limit, and scaled-score range"
        )

    return (
        int(item_match.group(1)),
        int(time_match.group(1)),
        int(score_match.group(2)),
        int(score_match.group(3)),
        int(score_match.group(1)),
    )


def _weight_value(weight: str) -> Decimal:
    """Convert a published percentage string into an exact decimal percentage."""
    if not weight.endswith("%"):
        raise ValueError(f"Blueprint domain weight is not a percentage: {weight!r}")
    return Decimal(weight.removesuffix("%"))


def load_blueprint(path: Path = DEFAULT_BLUEPRINT_PATH) -> Blueprint:
    """Load domains, sub-skills, weights, and score facts from ``BLUEPRINT.md``."""
    text = path.read_text(encoding="utf-8")
    parsed_domains = parse_domains(text)
    domains = tuple(
        Domain(
            number=number,
            name=name,
            weight=_weight_value(weight),
            sub_skills=tuple(sub_skill for sub_skill, _ in parse_sub_skills(text, number)),
        )
        for number, name, weight in parsed_domains
    )
    item_count, time_limit_minutes, scale_minimum, scale_maximum, passing_score = _parse_exam_facts(
        text
    )
    return Blueprint(
        domains=domains,
        exam_item_count=item_count,
        time_limit_minutes=time_limit_minutes,
        scale_minimum=scale_minimum,
        scale_maximum=scale_maximum,
        passing_score=passing_score,
    )
