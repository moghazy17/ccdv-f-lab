"""Prove that a missing domain directory blocks publication (SC-008, FR-008, FR-047)."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from drills.engine.blueprint import parse_domains
from tools.check_blueprint_consistency import (
    ConsistencyError,
    _check_notes,
    check_consistency,
)
from tools.export_site_data import (
    BlueprintExportError,
    export_blueprint_data,
)

ROOT = Path(__file__).resolve().parents[1]


def test_missing_notes_domain_directory_raises_consistency_error(tmp_path: Path) -> None:
    """Removing one of the eight domain directories from notes/ fails the consistency gate."""
    notes_copy = tmp_path / "notes"
    shutil.copytree(ROOT / "notes", notes_copy)

    # Remove domain 02 directory
    removed_domain = notes_copy / "02-applications-and-integration"
    shutil.rmtree(removed_domain)

    blueprint_text = (ROOT / "BLUEPRINT.md").read_text(encoding="utf-8")
    parsed_domains = parse_domains(blueprint_text)

    with pytest.raises(
        ConsistencyError,
        match=r"BLUEPRINT\.md domain is missing notes directory '02-applications-and-integration'",
    ):
        _check_notes(notes_copy, parsed_domains)


def test_missing_domain_blocks_site_data_export(tmp_path: Path) -> None:
    """Missing a domain notes directory prevents exporting site data."""
    notes_copy = tmp_path / "notes"
    shutil.copytree(ROOT / "notes", notes_copy)

    # Remove domain 05 directory
    shutil.rmtree(notes_copy / "05-model-selection-and-optimization")

    with pytest.raises(
        BlueprintExportError,
        match=r"BLUEPRINT\.md domain has no notes directory: 05-model-selection-and-optimization",
    ):
        export_blueprint_data(ROOT / "BLUEPRINT.md", notes_copy)


def test_missing_domain_directory_fails_publication_gate(tmp_path: Path) -> None:
    """A simulated repo with a missing domain notes directory exits with code 1."""
    notes_copy = tmp_path / "notes"
    shutil.copytree(ROOT / "notes", notes_copy)
    shutil.rmtree(notes_copy / "01-agents-and-workflows")

    # The consistency checker fails, blocking publication
    with pytest.raises(ConsistencyError, match="missing notes directory"):
        check_consistency(tmp_path, ROOT / "BLUEPRINT.md")
