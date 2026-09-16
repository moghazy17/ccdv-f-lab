"""Verify the exported item bank honours the schema and drops every format demonstration."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from drills.engine.blueprint import load_blueprint
from drills.engine.validation import find_bank_items
from tools.export_item_bank import export_item_bank, write_item_bank

ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT_PATH = ROOT / "BLUEPRINT.md"
BANK_PATH = ROOT / "drills" / "bank"


def _valid_item(item_id: str, *, format_demonstration: bool = False) -> dict[str, object]:
    """Build one schema-valid item, optionally flagged as a format demonstration."""
    item: dict[str, object] = {
        "id": item_id,
        "domain": "Claude Code",
        "sub_skill": "Claude Code Operation",
        "difficulty": "recall",
        "select": 1,
        "stem": "Which control does this item exercise for the purpose of this test?",
        "options": [
            {"id": "a", "text": "The correct one.", "correct": True, "rationale": "It is right."},
            {
                "id": "b",
                "text": "A plausible wrong one.",
                "correct": False,
                "rationale": "It is wrong.",
                "trap_type": "overkill",
            },
            {
                "id": "c",
                "text": "Another wrong one.",
                "correct": False,
                "rationale": "Also wrong.",
                "trap_type": "wrong-layer",
            },
            {
                "id": "d",
                "text": "A third wrong one.",
                "correct": False,
                "rationale": "Wrong as well.",
                "trap_type": "cost-theater",
            },
        ],
        "sources": [
            {
                "title": "Claude Code overview",
                "url": "https://example.invalid/claude-code",
                "verified_on": "2026-09-11",
            }
        ],
    }
    if format_demonstration:
        item["format_demonstration"] = True
    return item


def _write_bank(bank_path: Path, items: list[dict[str, object]]) -> None:
    bank_path.mkdir(parents=True, exist_ok=True)
    for item in items:
        (bank_path / f"{item['id']}.yaml").write_text(
            yaml.safe_dump(item, sort_keys=False, allow_unicode=True), encoding="utf-8"
        )


def test_format_demonstrations_never_reach_the_exported_bank(tmp_path: Path) -> None:
    """FR-022: an item flagged as a format demonstration is dropped by the exporter itself."""
    bank_path = tmp_path / "bank"
    _write_bank(
        bank_path,
        [_valid_item("real-item"), _valid_item("format-only-item", format_demonstration=True)],
    )

    data = export_item_bank(bank_path, BLUEPRINT_PATH)

    assert [item["id"] for item in data["items"]] == ["real-item"]
    assert data["available"]["Claude Code"] == 1


def test_the_repositorys_own_bank_excludes_its_format_demonstration() -> None:
    """The shipped bank carries one format demonstration, and it reaches no learner surface."""
    flagged = [
        bank_item.item["id"]
        for bank_item in find_bank_items(BANK_PATH)
        if bank_item.item.get("format_demonstration") is True
    ]
    data = export_item_bank(BANK_PATH, BLUEPRINT_PATH)
    exported_ids = {item["id"] for item in data["items"]}

    assert flagged, "The bank no longer carries a format demonstration to exclude."
    assert exported_ids.isdisjoint(flagged)


def test_exported_items_carry_the_schema_fields_the_site_reads() -> None:
    """Every published item keeps its exact blueprint names, its options, and its sources."""
    blueprint = load_blueprint(BLUEPRINT_PATH)
    domain_names = {domain.name for domain in blueprint.domains}
    data = export_item_bank(BANK_PATH, BLUEPRINT_PATH)

    assert data["generatedFrom"] == "drills/bank/"
    assert set(data["available"]) == domain_names
    assert len(data["items"]) == sum(data["available"].values())

    for item in data["items"]:
        assert item["domain"] in domain_names
        domain = blueprint.domain(item["domain"])
        assert domain is not None
        assert item["subSkill"] in domain.sub_skills
        assert item["select"] == sum(option["correct"] is True for option in item["options"])
        assert len(item["options"]) >= 4
        for option in item["options"]:
            assert option["rationale"]
            # The schema pairs a trap type with every wrong option and forbids it on a right one.
            assert ("trapType" in option) is (option["correct"] is False)
        assert item["sources"]
        for source in item["sources"]:
            assert source["url"].startswith("http")
            assert source["verifiedOn"]


def test_export_refuses_a_malformed_item(tmp_path: Path) -> None:
    """A malformed item blocks publication instead of reaching a candidate (FR-021, US6)."""
    bank_path = tmp_path / "bank"
    malformed = _valid_item("malformed-item")
    del malformed["sources"]
    _write_bank(bank_path, [malformed])

    with pytest.raises(ValueError, match="Bank validation failed"):
        export_item_bank(bank_path, BLUEPRINT_PATH)


def test_written_file_is_deterministic_utf8_json(tmp_path: Path) -> None:
    """Two exports of the same bank produce identical bytes for the site to read."""
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"
    write_item_bank(BANK_PATH, BLUEPRINT_PATH, first)
    write_item_bank(BANK_PATH, BLUEPRINT_PATH, second)

    assert first.read_bytes() == second.read_bytes()
    assert json.loads(first.read_text(encoding="utf-8"))["generatedFrom"] == "drills/bank/"
