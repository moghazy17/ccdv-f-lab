"""Verify the site's mock quotas are the drill engine's, not a second apportionment."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from drills.engine.blueprint import load_blueprint
from drills.engine.mock import apportion_items
from tools.export_mock_data import MockDataExportError, export_mock_data, write_mock_data

ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT_PATH = ROOT / "BLUEPRINT.md"


def test_exported_quotas_equal_the_engine_apportionment() -> None:
    """FR-024 requires equality to be verified, not asserted, for the published mock size."""
    blueprint = load_blueprint(BLUEPRINT_PATH)
    data = export_mock_data(BLUEPRINT_PATH)

    assert data["quotas"] == apportion_items(blueprint, blueprint.exam_item_count)


@pytest.mark.parametrize("size", [1, 8, 20, 40, 53, 100])
def test_engine_apportionment_holds_for_every_size_the_site_could_publish(size: int) -> None:
    """A quota set always sums to its size and covers every domain, whatever the size becomes."""
    blueprint = load_blueprint(BLUEPRINT_PATH)
    quotas = apportion_items(blueprint, size)

    assert sum(quotas.values()) == size
    assert set(quotas) == {domain.name for domain in blueprint.domains}
    assert all(quota >= 0 for quota in quotas.values())


def test_exported_figures_all_come_from_the_blueprint() -> None:
    """The size, the time limit, and the scale are read, never typed (FR-023)."""
    blueprint = load_blueprint(BLUEPRINT_PATH)
    data = export_mock_data(BLUEPRINT_PATH)

    assert data["generatedFrom"] == "BLUEPRINT.md"
    assert data["fullMockSize"] == blueprint.exam_item_count
    assert data["timeLimitMinutes"] == blueprint.time_limit_minutes
    assert data["passingScore"] == blueprint.passing_score
    assert data["scaleMinimum"] == blueprint.scale_minimum
    assert data["scaleMaximum"] == blueprint.scale_maximum


def test_source_digest_ignores_line_endings() -> None:
    """A CRLF working copy and an LF checkout hold the same blueprint and the same digest."""
    normalized = BLUEPRINT_PATH.read_text(encoding="utf-8").replace("\r\n", "\n")
    data = export_mock_data(BLUEPRINT_PATH)

    assert data["sourceDigest"] == hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def test_quotas_are_emitted_in_published_domain_order() -> None:
    """A stable key order keeps the generated file from churning between regenerations."""
    blueprint = load_blueprint(BLUEPRINT_PATH)
    data = export_mock_data(BLUEPRINT_PATH)

    assert list(data["quotas"]) == [domain.name for domain in blueprint.domains]


def test_written_file_is_deterministic_utf8_json(tmp_path: Path) -> None:
    """The site reads this file at build time, so two exports must be byte-identical."""
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"
    write_mock_data(BLUEPRINT_PATH, first)
    write_mock_data(BLUEPRINT_PATH, second)

    assert first.read_bytes() == second.read_bytes()
    assert json.loads(first.read_text(encoding="utf-8"))["generatedFrom"] == "BLUEPRINT.md"


def test_export_rejects_a_blueprint_whose_exam_facts_are_missing(tmp_path: Path) -> None:
    """A blueprint the exporter cannot read fails publication rather than emitting a guess."""
    broken = tmp_path / "BLUEPRINT.md"
    broken.write_text("# Blueprint\n\nNothing to parse here.\n", encoding="utf-8")

    with pytest.raises((MockDataExportError, ValueError, IndexError)):
        export_mock_data(broken)
