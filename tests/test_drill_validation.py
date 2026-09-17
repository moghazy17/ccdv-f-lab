"""Tests for practice-item schema, blueprint rules, and bank-wide IDs."""

from __future__ import annotations

import copy
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

from drills.engine.blueprint import load_blueprint
from drills.engine.coverage import DIFFICULTIES, build_coverage
from drills.engine.validation import (
    NEAR_DUPLICATE_RATIO,
    BankItem,
    bank_validation_errors,
    find_bank_items,
    item_validation_errors,
    load_item,
    load_schema,
    near_duplicate_advisories,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = REPOSITORY_ROOT / "tests" / "fixtures" / "fake-practice-item.yaml"
EXAMPLE_PATH = (
    REPOSITORY_ROOT
    / "drills"
    / "bank"
    / "01-agents-and-workflows"
    / "format-demonstration-workflow-selection.yaml"
)


def fake_item() -> dict[str, object]:
    """Load a deep-copyable fake practice item, not real study material."""
    return load_item(FIXTURE_PATH)


def test_schema_accepts_the_format_demonstration_item() -> None:
    """The one checked-in example exercises the complete required item format."""
    assert item_validation_errors(load_item(EXAMPLE_PATH), load_blueprint()) == []


def test_schema_accepts_synthetic_fixture_item() -> None:
    """The test fixture is independently valid before mutations are applied."""
    assert item_validation_errors(fake_item(), load_blueprint()) == []


def test_schema_is_a_valid_json_schema() -> None:
    """The checked-in schema itself complies with the declared JSON Schema draft."""
    Draft202012Validator.check_schema(load_schema())


def test_schema_rejects_required_and_property_malformations() -> None:
    """Every required practice-item field and constrained option form is enforced."""
    cases: list[tuple[str, callable[[dict[str, object]], None]]] = [
        ("missing id", lambda item: item.pop("id")),
        ("missing domain", lambda item: item.pop("domain")),
        ("missing sub-skill", lambda item: item.pop("sub_skill")),
        ("missing difficulty", lambda item: item.pop("difficulty")),
        ("missing select", lambda item: item.pop("select")),
        ("missing stem", lambda item: item.pop("stem")),
        ("missing options", lambda item: item.pop("options")),
        ("missing sources", lambda item: item.pop("sources")),
        ("invalid id", lambda item: item.__setitem__("id", "not a slug")),
        ("unknown domain", lambda item: item.__setitem__("domain", "Fake Domain")),
        ("unknown sub-skill", lambda item: item.__setitem__("sub_skill", "Fake Sub-skill")),
        ("invalid difficulty", lambda item: item.__setitem__("difficulty", "guessing")),
        ("non-integer select", lambda item: item.__setitem__("select", "two")),
        ("zero select", lambda item: item.__setitem__("select", 0)),
        ("too few options", lambda item: item.__setitem__("options", item["options"][:3])),
        ("missing option id", lambda item: item["options"][0].pop("id")),
        ("missing option text", lambda item: item["options"][0].pop("text")),
        ("missing option correctness", lambda item: item["options"][0].pop("correct")),
        ("missing option rationale", lambda item: item["options"][0].pop("rationale")),
        ("missing wrong-answer trap", lambda item: item["options"][2].pop("trap_type")),
        (
            "trap on correct answer",
            lambda item: item["options"][0].__setitem__("trap_type", "overkill"),
        ),
        (
            "unknown trap type",
            lambda item: item["options"][2].__setitem__("trap_type", "fake-trap"),
        ),
        ("empty sources", lambda item: item.__setitem__("sources", [])),
        ("invalid source URL", lambda item: item["sources"][0].__setitem__("url", "not a url")),
        ("undated source", lambda item: item["sources"][0].pop("verified_on")),
    ]

    for case_name, mutate in cases:
        item = copy.deepcopy(fake_item())
        mutate(item)
        assert item_validation_errors(item, load_blueprint()), case_name


def test_correct_option_count_must_equal_select() -> None:
    """Multiple-choice and multiple-response metadata cannot disagree with answer keys."""
    item = fake_item()
    item["select"] = 1
    errors = item_validation_errors(item, load_blueprint())
    assert any("does not equal" in error for error in errors)


def test_sub_skill_must_belong_to_its_domain() -> None:
    """A valid global sub-skill name cannot be attached to the wrong domain."""
    item = fake_item()
    item["sub_skill"] = "Prompt Engineering"
    errors = item_validation_errors(item, load_blueprint())
    assert any("does not belong" in error for error in errors)


def test_bank_ids_are_unique(tmp_path: Path) -> None:
    """The bank-level validator catches duplicate stable item IDs."""
    item = fake_item()
    serialized = yaml.safe_dump(item, sort_keys=False)
    (tmp_path / "first.yaml").write_text(serialized, encoding="utf-8")
    (tmp_path / "second.yaml").write_text(serialized, encoding="utf-8")

    errors = bank_validation_errors(tmp_path, blueprint=load_blueprint())
    assert len(errors) == 1
    assert "duplicates" in errors[0]


def _bank_item(item_id: str, stem: str, rationale: str) -> BankItem:
    item = fake_item()
    item["id"] = item_id
    item["stem"] = stem
    for option in item["options"]:
        if option["correct"] is True:
            option["rationale"] = rationale
    return BankItem(path=Path(f"{item_id}.yaml"), item=item)


def test_near_duplicate_stems_within_a_domain_are_reported() -> None:
    """An author is shown the neighbours of what they just wrote."""
    stem = "A team must choose between a bounded workflow and an agent for a repeatable task."
    advisories = near_duplicate_advisories(
        [
            _bank_item("first-item", stem, "Distinct reasoning about the first case."),
            _bank_item("second-item", stem + " Which approach fits?", "Other reasoning entirely."),
        ]
    )

    assert [advisory.basis for advisory in advisories] == ["stems"]
    assert advisories[0].first_id == "first-item"
    assert advisories[0].second_id == "second-item"


def test_near_duplicate_correct_rationales_are_reported() -> None:
    rationale = "A workflow is right because the path is fixed and the steps are known in advance."
    advisories = near_duplicate_advisories(
        [
            _bank_item("first-item", "One clearly different situation to reason about.", rationale),
            _bank_item("second-item", "A wholly unrelated setup, other bounds.", rationale),
        ]
    )

    assert [advisory.basis for advisory in advisories] == ["correct-option rationales"]


def test_a_near_duplicate_is_reported_at_a_realistic_stem_length() -> None:
    """Short fixtures hide the defect: difflib changes behavior once a sequence reaches 200."""
    stem = (
        "A production integration sends a large policy document followed by a short question, and "
        "the team is deciding how to keep the per-request cost down without changing the answer "
        "quality that reviewers already signed off on last quarter."
    )
    assert len(stem) > 200
    advisories = near_duplicate_advisories(
        [
            _bank_item("first-item", stem, "One line of reasoning."),
            _bank_item("second-item", stem.replace("team", "group"), "Another line entirely."),
        ]
    )

    assert [advisory.basis for advisory in advisories] == ["stems"]
    assert advisories[0].ratio > NEAR_DUPLICATE_RATIO


def test_distinct_items_produce_no_advisory() -> None:
    advisories = near_duplicate_advisories(
        [
            _bank_item("first-item", "A caching decision under a latency budget.", "Cache first."),
            _bank_item("second-item", "Choosing a transport for an MCP server.", "Use stdio."),
        ]
    )

    assert advisories == []


def test_items_in_different_domains_are_never_paired() -> None:
    """Shared vocabulary across domains is expected; pairing it would teach authors to ignore."""
    stem = "A team must choose between a bounded workflow and an agent for a repeatable task."
    first = _bank_item("first-item", stem, "Reasoning.")
    second = _bank_item("second-item", stem, "Reasoning.")
    second.item["domain"] = "Security and Safety"
    second.item["sub_skill"] = "AI Application Security"

    assert near_duplicate_advisories([first, second]) == []


def test_the_advisory_never_becomes_a_validation_error(tmp_path: Path) -> None:
    """FR-012 is a reading, not a measurement, so a near-duplicate pair must still validate."""
    stem = "A team must choose between a bounded workflow and an agent for a repeatable task."
    for name, suffix in (("first", ""), ("second", " Which approach fits?")):
        item = fake_item()
        item["id"] = f"{name}-item"
        item["stem"] = stem + suffix
        (tmp_path / f"{name}.yaml").write_text(yaml.safe_dump(item, sort_keys=False), "utf-8")

    assert bank_validation_errors(tmp_path, blueprint=load_blueprint()) == []
    assert near_duplicate_advisories(find_bank_items(tmp_path))


def test_every_difficulty_the_schema_defines_is_reportable() -> None:
    """Naming a missing difficulty is how the level nobody has written becomes visible."""
    coverage = build_coverage(find_bank_items(), load_blueprint())
    schema_difficulties = set(load_schema()["properties"]["difficulty"]["enum"])

    assert set(DIFFICULTIES) == schema_difficulties
    for domain in coverage.domains:
        held = set(DIFFICULTIES) - set(domain.missing_difficulties)
        assert held, f"{domain.name} holds no item at any difficulty"


def test_the_correct_answer_is_not_always_in_the_same_position() -> None:
    """A batch keyed to one position is answerable without reading a single stem."""
    positions: dict[int, int] = {}
    single_select = 0
    for bank_item in find_bank_items():
        item = bank_item.item
        if item.get("select") != 1:
            continue
        single_select += 1
        for index, option in enumerate(item["options"]):
            if option.get("correct") is True:
                positions[index] = positions.get(index, 0) + 1

    assert single_select > 0
    largest_share = max(positions.values()) / single_select
    assert largest_share <= 0.5, (
        f"{largest_share:.0%} of single-select items key the same position; "
        "shuffle the options so position carries no signal"
    )


def test_the_correct_option_is_not_reliably_the_longest() -> None:
    """A candidate who always picks the longest option should not out-score one who guesses."""
    longest_is_correct = 0
    total = 0
    for bank_item in find_bank_items():
        options = bank_item.item["options"]
        correct = max(len(str(o["text"]).split()) for o in options if o.get("correct") is True)
        other = max(len(str(o["text"]).split()) for o in options if o.get("correct") is not True)
        total += 1
        if correct > other:
            longest_is_correct += 1

    assert total > 0
    share = longest_is_correct / total
    assert share <= 0.7, (
        f"the longest option is the correct one in {share:.0%} of items; "
        "move explanation out of the keyed option and into its rationale"
    )
