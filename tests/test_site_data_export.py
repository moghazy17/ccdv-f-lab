"""Verify the derived site blueprint data is an exact, current blueprint transcription."""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from pathlib import Path

import pytest

from drills.engine.blueprint import parse_domains, parse_sub_skills
from tools.check_blueprint_consistency import ConsistencyError, check_site_blueprint_data
from tools.export_site_data import export_blueprint_data, write_blueprint_data

ROOT = Path(__file__).resolve().parents[1]


def test_exporter_matches_the_complete_published_blueprint() -> None:
    """The data has every exact domain and sub-skill, published item count, and source digest."""
    blueprint_path = ROOT / "BLUEPRINT.md"
    data = export_blueprint_data(blueprint_path, ROOT / "notes")

    assert data["sourceDigest"] == hashlib.sha256(blueprint_path.read_bytes()).hexdigest()
    assert data["generatedFrom"] == "BLUEPRINT.md"
    assert len(data["domains"]) == 8
    assert sum(len(domain["subSkills"]) for domain in data["domains"]) == 25
    assert sum(Decimal(str(domain["weight"])) for domain in data["domains"]) == Decimal("100.0")
    assert sum(domain["mockItems"] for domain in data["domains"]) == 53
    assert data["domains"][1]["name"] == "Applications and Integration"
    assert data["domains"][1]["approximateItems"] == 17
    assert data["domains"][1]["subSkills"][0]["approximateItems"] == 4.6
    expected_domains = parse_domains(blueprint_path.read_text(encoding="utf-8"))
    assert [
        (domain["number"], domain["name"], f"{domain['weight']:.1f}%") for domain in data["domains"]
    ] == expected_domains
    for domain, (number, _, _) in zip(data["domains"], expected_domains, strict=True):
        assert [sub_skill["name"] for sub_skill in domain["subSkills"]] == [
            name for name, _ in parse_sub_skills(blueprint_path.read_text(encoding="utf-8"), number)
        ]
    assert [domain["slug"] for domain in data["domains"]] == sorted(
        path.name for path in (ROOT / "notes").iterdir() if path.is_dir()
    )


def test_exporter_writes_the_committed_artifact_byte_for_byte(tmp_path: Path) -> None:
    """The generator emits deterministic UTF-8 JSON with the expected data shape."""
    target = tmp_path / "blueprint.json"

    write_blueprint_data(ROOT / "BLUEPRINT.md", ROOT / "notes", target)

    assert json.loads(target.read_text(encoding="utf-8")) == export_blueprint_data(
        ROOT / "BLUEPRINT.md", ROOT / "notes"
    )


def test_site_blueprint_gate_rejects_stale_derived_data(tmp_path: Path) -> None:
    """A changed committed artifact fails rather than silently serving stale exam data."""
    artifact = tmp_path / "blueprint.json"
    write_blueprint_data(ROOT / "BLUEPRINT.md", ROOT / "notes", artifact)
    stale = json.loads(artifact.read_text(encoding="utf-8"))
    stale["sourceDigest"] = "0" * 64
    artifact.write_text(json.dumps(stale), encoding="utf-8")

    with pytest.raises(ConsistencyError, match="stale"):
        check_site_blueprint_data(ROOT / "BLUEPRINT.md", ROOT / "notes", artifact)
