"""Tests for practice-item schema, blueprint rules, and bank-wide IDs."""

from __future__ import annotations

import copy
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

from drills.engine.blueprint import load_blueprint
from drills.engine.validation import (
    bank_validation_errors,
    item_validation_errors,
    load_item,
    load_schema,
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
