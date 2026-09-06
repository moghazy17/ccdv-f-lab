"""Exercise the study-prose duplication gate with allowed and rejected examples."""

from __future__ import annotations

from pathlib import Path

from tools.check_content_single_source import find_duplicate_prose


def test_single_source_gate_allows_presentation_code_without_study_prose(tmp_path: Path) -> None:
    """Ordinary site markup does not resemble protected content and remains allowed."""
    (tmp_path / "notes").mkdir()
    (tmp_path / "site" / "src").mkdir(parents=True)
    (tmp_path / "notes" / "source.md").write_text(
        "# Source\n\n"
        "A protected paragraph has enough words to exceed the comparison threshold safely.\n",
        encoding="utf-8",
    )
    (tmp_path / "site" / "src" / "page.astro").write_text("<h1>Study home</h1>\n", encoding="utf-8")

    assert find_duplicate_prose(tmp_path) == []


def test_single_source_gate_rejects_copied_protected_prose(tmp_path: Path) -> None:
    """A protected paragraph copied into site source produces a precise rejection."""
    (tmp_path / "guide").mkdir()
    (tmp_path / "site" / "src").mkdir(parents=True)
    prose = "This source paragraph is deliberately long enough to trigger the duplication gate."
    (tmp_path / "guide" / "source.md").write_text(f"# Source\n\n{prose}\n", encoding="utf-8")
    (tmp_path / "site" / "src" / "page.astro").write_text(f"<p>{prose}</p>\n", encoding="utf-8")

    errors = find_duplicate_prose(tmp_path)

    assert len(errors) == 1
    assert "guide/source.md" in errors[0].replace("\\", "/")


def test_single_source_gate_rejects_prose_stripped_of_markdown_formatting(tmp_path: Path) -> None:
    """Prose pasted into a template loses its Markdown syntax and must still be rejected."""
    (tmp_path / "study-plans").mkdir()
    (tmp_path / "site" / "src").mkdir(parents=True)
    (tmp_path / "study-plans" / "plan.md").write_text(
        "# Plan\n\n"
        "This schedule assumes **14.000 total hours** across the eight domains, and each "
        "allocation is `14.000 × domain weight / 100` so the table totals exactly.\n",
        encoding="utf-8",
    )
    (tmp_path / "site" / "src" / "page.astro").write_text(
        "<p>This schedule assumes 14.000 total hours across the eight domains, and each "
        "allocation is 14.000 x domain weight / 100 so the table totals exactly.</p>\n",
        encoding="utf-8",
    )

    errors = find_duplicate_prose(tmp_path)

    assert len(errors) == 1
    assert "study-plans/plan.md" in errors[0].replace("\\", "/")


def test_single_source_gate_rejects_copied_decision_table_cells(tmp_path: Path) -> None:
    """Long authored decision-table cells receive the same protection as paragraphs."""
    (tmp_path / "notes").mkdir()
    (tmp_path / "site" / "src").mkdir(parents=True)
    cell = "Choose this approach when a deterministic sequence gives safer and clearer control."
    (tmp_path / "notes" / "source.md").write_text(
        f"| Option | Choose this when |\n|---|---|\n| Workflow | {cell} |\n",
        encoding="utf-8",
    )
    (tmp_path / "site" / "src" / "page.astro").write_text(f"<p>{cell}</p>\n", encoding="utf-8")

    errors = find_duplicate_prose(tmp_path)

    assert len(errors) == 1
    assert "notes/source.md" in errors[0].replace("\\", "/")
