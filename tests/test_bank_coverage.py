"""The authoring targets agree with the mock's own apportionment, and never restate a count."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from drills.engine.blueprint import DEFAULT_BLUEPRINT_PATH, load_blueprint, parse_sub_skills
from drills.engine.coverage import (
    DIFFICULTIES,
    DOMAIN_FLOOR,
    MINIMUM_SUB_SKILL,
    TARGET_MULTIPLE,
    build_coverage,
    coverage_document,
    domain_target,
    format_coverage_report,
)
from drills.engine.mock import apportion_items, apportion_weights
from drills.engine.validation import find_bank_items

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def blueprint():
    return load_blueprint()


@pytest.fixture(scope="module")
def coverage(blueprint):
    return build_coverage(find_bank_items(), blueprint)


def test_domain_targets_follow_the_mocks_own_apportionment(blueprint, coverage):
    quotas = apportion_items(blueprint, blueprint.exam_item_count)
    for domain in coverage.domains:
        assert domain.quota == quotas[domain.name]
        assert domain.target == max(domain.quota * TARGET_MULTIPLE, DOMAIN_FLOOR)


def test_sub_skill_targets_sum_to_their_domain_target(coverage):
    for domain in coverage.domains:
        assert sum(sub_skill.target for sub_skill in domain.sub_skills) == domain.target


def test_shared_apportionment_reproduces_domain_quotas_including_tie_breaks(blueprint):
    ordered = sorted(blueprint.domains, key=lambda domain: domain.number)
    weights = [(domain.name, domain.weight) for domain in ordered]
    for size in range(1, blueprint.exam_item_count + 1):
        assert apportion_weights(weights, size) == apportion_items(blueprint, size)


def test_equal_weights_break_ties_by_listed_position():
    weights = [("first", Decimal("25")), ("second", Decimal("25")), ("third", Decimal("25"))]
    allocation = apportion_weights(weights, 4)

    assert allocation == {"first": 2, "second": 1, "third": 1}


def test_every_blueprint_sub_skill_is_reported(blueprint, coverage):
    blueprint_text = DEFAULT_BLUEPRINT_PATH.read_text(encoding="utf-8")
    reported = {
        (domain.name, sub_skill.name)
        for domain in coverage.domains
        for sub_skill in domain.sub_skills
    }
    published = {
        (domain.name, sub_skill)
        for domain in blueprint.domains
        for sub_skill, _ in parse_sub_skills(blueprint_text, domain.number)
    }

    assert reported == published


def test_a_sub_skill_holding_nothing_is_reported_rather_than_omitted(blueprint):
    """An empty sub-skill is invisible in any count that multiplies what exists, so it is named."""
    empty = build_coverage([], blueprint)

    assert empty.held == 0
    for domain in empty.domains:
        assert domain.sub_skills, f"{domain.name} reported no sub-skills"
        for sub_skill in domain.sub_skills:
            assert sub_skill.held == 0
            assert sub_skill.shortfall == sub_skill.target
        assert set(domain.missing_difficulties) == set(DIFFICULTIES)
        assert domain.holds_multiple_response is False


def test_domains_are_reported_in_descending_exam_weight(blueprint, coverage):
    weights = {domain.name: domain.weight for domain in blueprint.domains}
    reported = [weights[domain.name] for domain in coverage.domains]

    assert reported == sorted(reported, reverse=True)


def test_the_format_demonstration_is_excluded_from_every_count(blueprint):
    bank_items = find_bank_items()
    eligible = [item for item in bank_items if item.item.get("format_demonstration") is not True]

    assert len(eligible) < len(bank_items)
    assert build_coverage(bank_items, blueprint).held == len(eligible)


def test_a_surplus_reports_no_shortfall_rather_than_a_negative_one():
    assert domain_target(quota=0) == DOMAIN_FLOOR
    coverage = _coverage_of({"held": DOMAIN_FLOOR + 4, "target": DOMAIN_FLOOR})

    assert coverage.shortfall == 0


def test_the_report_names_floors_a_count_alone_cannot_show(coverage):
    report = format_coverage_report(coverage)

    assert "held" in report and "target" in report and "short" in report
    for domain in coverage.domains:
        if domain.missing_difficulties:
            assert "no item at difficulty" in report
        if not domain.holds_multiple_response:
            assert "no item with more than one correct option" in report


def test_the_json_document_carries_the_policy_constants(coverage):
    document = coverage_document(coverage)

    assert document["target_multiple"] == TARGET_MULTIPLE
    assert document["domain_floor"] == DOMAIN_FLOOR
    assert document["held"] == coverage.held
    assert len(document["domains"]) == len(coverage.domains)


def test_no_per_domain_target_is_written_into_the_engine():
    """The targets are computed; a literal per-domain count in the module would be drift."""
    source = (REPOSITORY_ROOT / "drills" / "engine" / "coverage.py").read_text(encoding="utf-8")
    quotas = apportion_items(load_blueprint(), load_blueprint().exam_item_count)
    targets = {str(domain_target(quota)) for quota in quotas.values()}

    for target in sorted(targets - {str(DOMAIN_FLOOR)}):
        assert target not in source


def test_the_sub_skill_minimum_is_a_floor_not_a_target(coverage):
    for domain in coverage.domains:
        for sub_skill in domain.sub_skills:
            if sub_skill.held < MINIMUM_SUB_SKILL:
                assert sub_skill.name in domain.single_item_sub_skills


def _coverage_of(entry):
    from drills.engine.coverage import BankCoverage, DomainCoverage

    return BankCoverage(
        domains=(
            DomainCoverage(
                name="Example",
                quota=0,
                held=entry["held"],
                target=entry["target"],
                sub_skills=(),
                missing_difficulties=(),
                holds_multiple_response=True,
            ),
        )
    )
