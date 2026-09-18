"""Per-domain and per-sub-skill authoring targets, measured against what the bank holds.

A target is never written down. It is the blueprint's own apportionment of a full-size mock,
multiplied by :data:`TARGET_MULTIPLE` and lifted to :data:`DOMAIN_FLOOR` where a light domain would
otherwise hold too few items for a quiz to vary between attempts. Those two constants are authoring
policy; everything else here is read from ``BLUEPRINT.md``, so a reweighted blueprint moves every
target with no edit to this module.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from drills.engine.blueprint import (
    DEFAULT_BLUEPRINT_PATH,
    Blueprint,
    parse_sub_skills,
    weight_value,
)
from drills.engine.mock import apportion_items, apportion_weights
from drills.engine.validation import BankItem

TARGET_MULTIPLE = 3
"""How many full mocks' worth of items a domain should hold, so repeated sittings vary."""

DOMAIN_FLOOR = 6
"""The fewest items any domain holds, whatever its weight, so its quiz can vary at all."""

DIFFICULTIES = ("recall", "application", "analysis")
"""The difficulty levels the item schema defines, in ascending demand."""


@dataclass(frozen=True)
class SubSkillCoverage:
    """What one sub-skill holds against its apportioned share of its domain's target."""

    name: str
    held: int
    target: int

    @property
    def shortfall(self) -> int:
        """Items still owed; zero once the target is met, and never negative on a surplus."""
        return max(self.target - self.held, 0)


@dataclass(frozen=True)
class DomainCoverage:
    """What one domain holds against its target, with the floors a count alone cannot show."""

    name: str
    quota: int
    held: int
    target: int
    sub_skills: tuple[SubSkillCoverage, ...]
    missing_difficulties: tuple[str, ...]
    holds_multiple_response: bool

    @property
    def shortfall(self) -> int:
        """Items still owed against the domain target."""
        return max(self.target - self.held, 0)

    @property
    def single_item_sub_skills(self) -> tuple[str, ...]:
        """Sub-skills holding fewer than two items, which a quiz cannot vary across."""
        return tuple(
            sub_skill.name for sub_skill in self.sub_skills if sub_skill.held < MINIMUM_SUB_SKILL
        )


@dataclass(frozen=True)
class BankCoverage:
    """Every domain's coverage, in descending exam weight."""

    domains: tuple[DomainCoverage, ...]

    @property
    def held(self) -> int:
        """Eligible items the whole bank holds."""
        return sum(domain.held for domain in self.domains)

    @property
    def target(self) -> int:
        """Items the whole bank should hold once every domain reaches its target."""
        return sum(domain.target for domain in self.domains)

    @property
    def shortfall(self) -> int:
        """Items still owed across every domain."""
        return sum(domain.shortfall for domain in self.domains)


MINIMUM_SUB_SKILL = 2
"""The fewest items a sub-skill holds, so it cannot be passed on one remembered question."""


def domain_target(quota: int) -> int:
    """Return a domain's authoring target from its apportioned mock quota."""
    return max(quota * TARGET_MULTIPLE, DOMAIN_FLOOR)


def is_eligible(item: dict[str, Any]) -> bool:
    """Whether an item counts toward coverage, matching what the site exporter publishes."""
    return item.get("format_demonstration") is not True


def build_coverage(
    bank_items: list[BankItem],
    blueprint: Blueprint,
    blueprint_path: Path = DEFAULT_BLUEPRINT_PATH,
) -> BankCoverage:
    """Measure every domain and sub-skill against its target, heaviest domain first."""
    blueprint_text = blueprint_path.read_text(encoding="utf-8")
    quotas = apportion_items(blueprint, blueprint.exam_item_count)

    eligible = [bank_item.item for bank_item in bank_items if is_eligible(bank_item.item)]
    domains: list[DomainCoverage] = []
    for domain in sorted(blueprint.domains, key=lambda entry: (-entry.weight, entry.number)):
        domain_items = [item for item in eligible if item.get("domain") == domain.name]
        target = domain_target(quotas[domain.name])
        sub_skill_weights = [
            (name, weight_value(weight))
            for name, weight in parse_sub_skills(blueprint_text, domain.number)
        ]
        sub_skill_targets = apportion_weights(sub_skill_weights, target)
        held_difficulties = {item.get("difficulty") for item in domain_items}
        domains.append(
            DomainCoverage(
                name=domain.name,
                quota=quotas[domain.name],
                held=len(domain_items),
                target=target,
                sub_skills=tuple(
                    SubSkillCoverage(
                        name=name,
                        held=sum(1 for item in domain_items if item.get("sub_skill") == name),
                        target=sub_skill_targets[name],
                    )
                    for name, _ in sub_skill_weights
                ),
                missing_difficulties=tuple(
                    difficulty for difficulty in DIFFICULTIES if difficulty not in held_difficulties
                ),
                holds_multiple_response=any(
                    isinstance(item.get("select"), int) and item["select"] > 1
                    for item in domain_items
                ),
            )
        )
    return BankCoverage(domains=tuple(domains))


def coverage_document(coverage: BankCoverage) -> dict[str, Any]:
    """Return the report as plain data, for a test or a follow-on tool to read."""
    return {
        "target_multiple": TARGET_MULTIPLE,
        "domain_floor": DOMAIN_FLOOR,
        "held": coverage.held,
        "target": coverage.target,
        "shortfall": coverage.shortfall,
        "domains": [
            {
                "domain": domain.name,
                "quota": domain.quota,
                "held": domain.held,
                "target": domain.target,
                "shortfall": domain.shortfall,
                "missing_difficulties": list(domain.missing_difficulties),
                "holds_multiple_response": domain.holds_multiple_response,
                "sub_skills": [
                    {
                        "sub_skill": sub_skill.name,
                        "held": sub_skill.held,
                        "target": sub_skill.target,
                        "shortfall": sub_skill.shortfall,
                    }
                    for sub_skill in domain.sub_skills
                ],
            }
            for domain in coverage.domains
        ],
    }


def _row(label: str, held: int, target: int, shortfall: int, width: int) -> str:
    return f"{label:<{width}} {held:>5} {target:>7} {shortfall:>6}"


def format_coverage_report(coverage: BankCoverage) -> str:
    """Render the report a reader works from, domains in descending exam weight."""
    labels = [domain.name for domain in coverage.domains]
    labels += [
        f"  {sub_skill.name}" for domain in coverage.domains for sub_skill in domain.sub_skills
    ]
    width = max(len(label) for label in [*labels, "Total"]) + 2

    lines = [f"{'Domain':<{width}} {'held':>5} {'target':>7} {'short':>6}"]
    for domain in coverage.domains:
        lines.append(_row(domain.name, domain.held, domain.target, domain.shortfall, width))
        for sub_skill in domain.sub_skills:
            lines.append(
                _row(
                    f"  {sub_skill.name}",
                    sub_skill.held,
                    sub_skill.target,
                    sub_skill.shortfall,
                    width,
                )
            )
        for note in domain_floor_notes(domain):
            lines.append(f"  ! {note}")
    lines.append(_row("Total", coverage.held, coverage.target, coverage.shortfall, width))
    return "\n".join(lines)


def domain_floor_notes(domain: DomainCoverage) -> tuple[str, ...]:
    """Return the floors this domain does not meet, which its counts alone do not show."""
    notes: list[str] = []
    if domain.missing_difficulties:
        notes.append(f"no item at difficulty: {', '.join(domain.missing_difficulties)}")
    if not domain.holds_multiple_response:
        notes.append("no item with more than one correct option")
    single_item = domain.single_item_sub_skills
    if single_item:
        notes.append(f"sub-skill below {MINIMUM_SUB_SKILL} items: {', '.join(single_item)}")
    return tuple(notes)
