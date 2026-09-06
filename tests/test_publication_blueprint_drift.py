"""Prove that blueprint drift blocks publication (SC-008, FR-002, FR-047)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.check_blueprint_consistency import (
    ConsistencyError,
    check_consistency,
    check_site_blueprint_data,
)
from tools.check_blueprint_consistency import (
    main as consistency_main,
)

ROOT = Path(__file__).resolve().parents[1]


def test_blueprint_weight_drift_blocks_publication(tmp_path: Path) -> None:
    """Mutating a domain weight in the blueprint causes the consistency gate to fail."""
    altered_blueprint = tmp_path / "BLUEPRINT.md"
    original_text = (ROOT / "BLUEPRINT.md").read_text(encoding="utf-8")
    # Alter domain 1 weight from 14.7% to 14.6%
    altered_text = original_text.replace("14.7%", "14.6%", 1)
    altered_blueprint.write_text(altered_text, encoding="utf-8")

    # The consistency checker command returns non-zero exit code, failing CI and blocking publish
    exit_code = consistency_main(["--blueprint", str(altered_blueprint)])
    assert exit_code == 1

    with pytest.raises(ConsistencyError, match=r"Domain weights sum to .* expected 100.0%"):
        check_consistency(ROOT, altered_blueprint)


def test_stale_site_blueprint_data_blocks_publication(tmp_path: Path) -> None:
    """A stale or drifted site/src/data/blueprint.json blocks the consistency check."""
    stale_data_path = tmp_path / "blueprint.json"
    valid_data = json.loads(
        (ROOT / "site" / "src" / "data" / "blueprint.json").read_text(encoding="utf-8")
    )
    # Drift the data by altering a domain's recorded weight
    valid_data["domains"][0]["weight"] = 99.9
    stale_data_path.write_text(json.dumps(valid_data), encoding="utf-8")

    with pytest.raises(
        ConsistencyError, match="Derived site blueprint data is stale against BLUEPRINT.md"
    ):
        check_site_blueprint_data(ROOT / "BLUEPRINT.md", ROOT / "notes", stale_data_path)


def test_missing_site_blueprint_data_blocks_publication(tmp_path: Path) -> None:
    """Missing derived site data immediately raises ConsistencyError to block publication."""
    missing_data_path = tmp_path / "nonexistent.json"

    with pytest.raises(ConsistencyError, match="Derived site blueprint data is missing"):
        check_site_blueprint_data(ROOT / "BLUEPRINT.md", ROOT / "notes", missing_data_path)
