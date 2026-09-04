"""Tests for quota apportionment, seeded generation, and scoring mathematics."""

from __future__ import annotations

import copy
from pathlib import Path

from drills.engine.blueprint import load_blueprint
from drills.engine.mock import apportion_items, domain_quota_difference, generate_weighted_mock
from drills.engine.scoring import format_score_report, score_attempt
from drills.engine.validation import BankItem, load_item

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = REPOSITORY_ROOT / "tests" / "fixtures" / "fake-practice-item.yaml"


def fake_item() -> dict[str, object]:
    """Load a synthetic fixture item that cannot be mistaken for study content."""
    return load_item(FIXTURE_PATH)


def synthetic_bank(items_per_domain: int = 20) -> list[BankItem]:
    """Create enough fake, valid items to exercise seeded weighted selection."""
    blueprint = load_blueprint()
    bank: list[BankItem] = []
    for domain in blueprint.domains:
        for index in range(items_per_domain):
            item = copy.deepcopy(fake_item())
            item["id"] = f"fake-{domain.number}-{index}"
            item["domain"] = domain.name
            item["sub_skill"] = domain.sub_skills[0]
            bank.append(BankItem(path=Path(f"fake-{domain.number}-{index}.yaml"), item=item))
    return bank


def test_largest_remainder_apportionment_sums_to_53_and_stays_within_one_item() -> None:
    """The full mock has exactly the blueprint item count and numerical weighted quotas."""
    blueprint = load_blueprint()
    quotas = apportion_items(blueprint, blueprint.exam_item_count)

    assert blueprint.exam_item_count == 53
    assert sum(quotas.values()) == 53
    for domain in blueprint.domains:
        assert domain_quota_difference(domain, blueprint, 53, quotas[domain.name]) <= 1


def test_seeded_generation_is_stable() -> None:
    """A fixed seed selects the same unique items and quota allocation every time."""
    blueprint = load_blueprint()
    bank = synthetic_bank()
    first = generate_weighted_mock(bank, blueprint, blueprint.exam_item_count, seed=17)
    second = generate_weighted_mock(bank, blueprint, blueprint.exam_item_count, seed=17)

    assert first.quotas == second.quotas
    assert [item["id"] for item in first.items] == [item["id"] for item in second.items]
    assert len({item["id"] for item in first.items}) == blueprint.exam_item_count
    assert first.warnings == ()


def test_scoring_math_domain_breakdown_and_scaled_estimate() -> None:
    """Exact answer sets produce correct overall, domain, and linear scaled-score values."""
    blueprint = load_blueprint()
    first = fake_item()
    first["id"] = "fake-one"
    second = fake_item()
    second["id"] = "fake-two"
    third = fake_item()
    third["id"] = "fake-three"
    third["domain"] = "Applications and Integration"
    third["sub_skill"] = "Claude Application Design"
    mock = {"items": [first, second, third]}
    attempt = {
        "answers": [
            {"item_id": "fake-one", "selected_option_ids": ["a", "b"]},
            {"item_id": "fake-two", "selected_option_ids": ["a"]},
            {"item_id": "fake-three", "selected_option_ids": ["a", "b"]},
        ]
    }

    report = score_attempt(mock, attempt, blueprint)

    assert report.correct == 2
    assert report.item_count == 3
    assert report.estimated_scaled_score == 700
    assert report.domains[0].correct == 1
    assert report.domains[0].item_count == 2
    assert report.domains[0].fraction_correct == 0.5
    assert report.domains[1].correct == 1
    assert report.domains[1].item_count == 1
    output = format_score_report(report)
    assert "Overall: 2/3 correct (66.7%)" in output
    assert "ESTIMATED scaled score: 700/1000" in output
    assert "68.9% correct" in output
    assert "criterion-referenced" in output


def test_score_anchor_is_configurable() -> None:
    """A conservative comparison anchor changes the displayed score threshold assumption."""
    blueprint = load_blueprint()
    item = fake_item()
    report = score_attempt(
        {"items": [item]},
        {"answers": [{"item_id": item["id"], "selected_option_ids": ["a", "b"]}]},
        blueprint,
        score_anchor=800,
    )

    assert report.score_anchor == 800
    assert "77.8% correct" in format_score_report(report)
