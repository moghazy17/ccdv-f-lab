"""Scoring, per-domain reporting, and a transparent study-only scaled-score estimate."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from drills.engine.blueprint import Blueprint

READINESS_OVERALL_FRACTION = 0.85
READINESS_DOMAIN_FRACTION = 0.70


@dataclass(frozen=True)
class DomainResult:
    """The number correct and attempted for a single blueprint domain."""

    name: str
    correct: int
    item_count: int

    @property
    def fraction_correct(self) -> float | None:
        """Return the domain fraction, or ``None`` when this mock has no item in the domain."""
        return self.correct / self.item_count if self.item_count else None


@dataclass(frozen=True)
class ScoreReport:
    """A scored attempt plus reporting values derived from the local blueprint."""

    correct: int
    item_count: int
    domains: tuple[DomainResult, ...]
    estimated_scaled_score: int
    score_anchor: int
    scale_minimum: int
    scale_maximum: int

    @property
    def fraction_correct(self) -> float:
        """Return the mock-wide fraction correct, or zero for an empty mock."""
        return self.correct / self.item_count if self.item_count else 0.0

    @property
    def unassessed_domains(self) -> tuple[str, ...]:
        """Return domains without items in the scored mock."""
        return tuple(domain.name for domain in self.domains if domain.item_count == 0)

    @property
    def low_domains(self) -> tuple[str, ...]:
        """Return assessed domains that fall below the repository readiness bar."""
        return tuple(
            domain.name
            for domain in self.domains
            if domain.fraction_correct is not None
            and domain.fraction_correct < READINESS_DOMAIN_FRACTION
        )

    @property
    def ready(self) -> bool:
        """Whether this attempt clears the stated bar with every domain assessed."""
        return (
            bool(self.item_count)
            and not self.unassessed_domains
            and self.fraction_correct >= READINESS_OVERALL_FRACTION
            and not self.low_domains
        )


def _selected_options(attempt: dict[str, Any]) -> dict[str, set[str]]:
    answers = attempt.get("answers", [])
    if not isinstance(answers, list):
        return {}

    selections: dict[str, set[str]] = {}
    for answer in answers:
        if not isinstance(answer, dict):
            continue
        item_id = answer.get("item_id")
        selected_option_ids = answer.get("selected_option_ids")
        if isinstance(item_id, str) and isinstance(selected_option_ids, list):
            selections[item_id] = {
                option_id for option_id in selected_option_ids if isinstance(option_id, str)
            }
    return selections


def score_attempt(
    mock: dict[str, Any],
    attempt: dict[str, Any],
    blueprint: Blueprint,
    score_anchor: int | None = None,
) -> ScoreReport:
    """Score exact selections and calculate per-domain and study-estimate results."""
    items = mock.get("items")
    if not isinstance(items, list):
        raise ValueError("Mock has no item list")

    anchor = blueprint.passing_score if score_anchor is None else score_anchor
    if not blueprint.scale_minimum <= anchor <= blueprint.scale_maximum:
        raise ValueError(
            f"Score anchor must be between {blueprint.scale_minimum} and {blueprint.scale_maximum}"
        )

    selected_options = _selected_options(attempt)
    correct_by_domain = {domain.name: 0 for domain in blueprint.domains}
    count_by_domain = {domain.name: 0 for domain in blueprint.domains}
    total_correct = 0
    item_count = 0

    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Mock contains a non-object item")
        item_id = item.get("id")
        domain_name = item.get("domain")
        options = item.get("options")
        if (
            not isinstance(item_id, str)
            or not isinstance(domain_name, str)
            or not isinstance(options, list)
        ):
            raise ValueError("Mock contains an incomplete item")
        if domain_name not in count_by_domain:
            raise ValueError(f"Mock item {item_id!r} has a domain absent from BLUEPRINT.md")

        correct_options = {
            option["id"]
            for option in options
            if isinstance(option, dict)
            and option.get("correct") is True
            and isinstance(option.get("id"), str)
        }
        selected = selected_options.get(item_id, set())
        is_correct = selected == correct_options
        item_count += 1
        count_by_domain[domain_name] += 1
        if is_correct:
            total_correct += 1
            correct_by_domain[domain_name] += 1

    fraction_correct = total_correct / item_count if item_count else 0.0
    estimated_scaled_score = round(
        blueprint.scale_minimum
        + (blueprint.scale_maximum - blueprint.scale_minimum) * fraction_correct
    )
    domain_results = tuple(
        DomainResult(
            name=domain.name,
            correct=correct_by_domain[domain.name],
            item_count=count_by_domain[domain.name],
        )
        for domain in blueprint.domains
    )
    return ScoreReport(
        correct=total_correct,
        item_count=item_count,
        domains=domain_results,
        estimated_scaled_score=estimated_scaled_score,
        score_anchor=anchor,
        scale_minimum=blueprint.scale_minimum,
        scale_maximum=blueprint.scale_maximum,
    )


def format_score_report(report: ScoreReport) -> str:
    """Render a terminal report with clear estimate and readiness limitations."""
    overall_percent = report.fraction_correct * 100
    lines = [
        f"Overall: {report.correct}/{report.item_count} correct ({overall_percent:.1f}%)",
        "Per-domain results:",
    ]
    for domain in report.domains:
        if domain.fraction_correct is None:
            lines.append(f"- {domain.name}: not assessed (0 items)")
        else:
            lines.append(
                f"- {domain.name}: {domain.correct}/{domain.item_count} correct "
                f"({domain.fraction_correct * 100:.1f}%)"
            )

    score_range = report.scale_maximum - report.scale_minimum
    anchor_percent = (report.score_anchor - report.scale_minimum) / score_range * 100
    lines.extend(
        [
            (f"ESTIMATED scaled score: {report.estimated_scaled_score}/{report.scale_maximum}"),
            (
                "Assumption: linear study model "
                f"{report.scale_minimum} + {score_range} * fraction correct; "
                f"the configurable {report.score_anchor} score anchor corresponds to "
                f"{anchor_percent:.1f}% correct."
            ),
            (
                "The actual exam is criterion-referenced and scaled by a method Anthropic does not "
                "publish, so this is a study signal and not a prediction."
            ),
        ]
    )
    if report.ready:
        lines.append(
            "Readiness: READY (at least 85.0% overall and at least 70.0% in every domain)."
        )
    elif report.unassessed_domains:
        lines.append(
            "Readiness: NOT READY (unassessed domains: "
            + ", ".join(report.unassessed_domains)
            + "; bar is at least 85.0% overall and at least 70.0% in every domain)."
        )
    else:
        lines.append(
            "Readiness: NOT READY (bar is at least 85.0% overall and at least 70.0% in every "
            "domain)."
        )
    return "\n".join(lines)
