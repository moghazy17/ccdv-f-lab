"""Prove that duplicated study content blocks publication (SC-008, FR-005, FR-047)."""

from __future__ import annotations

from pathlib import Path

from tools.check_content_single_source import (
    find_duplicate_prose,
)
from tools.check_content_single_source import (
    main as single_source_main,
)


def test_duplicate_study_prose_in_site_blocks_publication(tmp_path: Path) -> None:
    """Copying study prose from protected roots into site/ fails the single-source gate."""
    notes_dir = tmp_path / "notes" / "02-applications-and-integration"
    notes_dir.mkdir(parents=True)
    site_src_dir = tmp_path / "site" / "src"
    site_src_dir.mkdir(parents=True)

    study_prose = (
        "This authoritative study prose explains the nuances of prompt caching "
        "and context management."
    )
    (notes_dir / "README.md").write_text(f"# Notes\n\n{study_prose}\n", encoding="utf-8")
    (site_src_dir / "Page.astro").write_text(f"<div>{study_prose}</div>\n", encoding="utf-8")

    errors = find_duplicate_prose(tmp_path)
    assert len(errors) == 1
    assert "duplicates protected prose" in errors[0]
    assert "notes/02-applications-and-integration/README.md" in errors[0].replace("\\", "/")


def test_single_source_command_exit_code_blocks_publication(tmp_path: Path) -> None:
    """The check_content_single_source tool returns exit code 1 on duplication."""
    guide_dir = tmp_path / "guide"
    guide_dir.mkdir(parents=True)
    site_dir = tmp_path / "site" / "src"
    site_dir.mkdir(parents=True)

    copied_paragraph = (
        "Registration requires a Partner Network organization email on a recognized company domain."
    )
    (guide_dir / "eligibility.md").write_text(
        f"# Eligibility\n\n{copied_paragraph}\n", encoding="utf-8"
    )
    (site_dir / "Duplicate.astro").write_text(f"<p>{copied_paragraph}</p>\n", encoding="utf-8")

    exit_code = single_source_main(["--root", str(tmp_path)])
    assert exit_code == 1
