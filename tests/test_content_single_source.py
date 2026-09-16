"""Exercise the study-prose duplication gate with allowed and rejected examples."""

from __future__ import annotations

from pathlib import Path

from tools.check_content_single_source import find_copied_runtime_source, find_duplicate_prose

PROSE = "This source paragraph is deliberately long enough to trigger the duplication gate."


def test_single_source_gate_ignores_a_test_fixture_content_copy(tmp_path: Path) -> None:
    """A propagation spec's temporary copy of protected prose is scaffolding, not a duplication.

    The end-to-end specs copy notes, guide, cheatsheets, and study plans into ``site/.us2-*``
    directories so they can build the site against edited content. A run killed part-way leaves
    them behind, and before they were skipped this gate reported every copied paragraph as a
    violation of a rule nobody had broken.
    """
    (tmp_path / "notes").mkdir()
    fixture = tmp_path / "site" / ".us2-src-plans-propagation-abc123"
    fixture.mkdir(parents=True)
    (tmp_path / "notes" / "source.md").write_text(f"# Source\n\n{PROSE}\n", encoding="utf-8")
    (fixture / "source.md").write_text(f"# Source\n\n{PROSE}\n", encoding="utf-8")

    assert find_duplicate_prose(tmp_path) == []


def test_single_source_gate_still_rejects_a_copy_outside_a_fixture_directory(
    tmp_path: Path,
) -> None:
    """The prefix skip is narrow: an ordinary directory under ``site/`` is still checked."""
    (tmp_path / "notes").mkdir()
    (tmp_path / "site" / "src").mkdir(parents=True)
    (tmp_path / "notes" / "source.md").write_text(f"# Source\n\n{PROSE}\n", encoding="utf-8")
    (tmp_path / "site" / "src" / "page.astro").write_text(f"<p>{PROSE}</p>\n", encoding="utf-8")

    assert len(find_duplicate_prose(tmp_path)) == 1


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


def test_single_source_gate_rejects_lab_source_copied_under_site(tmp_path: Path) -> None:
    """A lab/ module copied into site/src, rather than served from the archive, is caught."""
    (tmp_path / "lab").mkdir()
    (tmp_path / "site" / "src" / "runtime").mkdir(parents=True)
    module_source = "def run() -> None:\n    return None\n"
    (tmp_path / "lab" / "loop.py").write_text(module_source, encoding="utf-8")
    (tmp_path / "site" / "src" / "runtime" / "loop.py").write_text(module_source, encoding="utf-8")

    errors = find_copied_runtime_source(tmp_path)

    assert len(errors) == 1
    assert "lab/loop.py" in errors[0].replace("\\", "/")


def test_single_source_gate_ignores_the_generated_runtime_archive(tmp_path: Path) -> None:
    """The build's own generated archive under site/public/runtime is never flagged."""
    (tmp_path / "lab").mkdir()
    (tmp_path / "site" / "public" / "runtime").mkdir(parents=True)
    module_source = "def run() -> None:\n    return None\n"
    (tmp_path / "lab" / "loop.py").write_text(module_source, encoding="utf-8")
    (tmp_path / "site" / "public" / "runtime" / "lab-drills.zip").write_bytes(b"PK\x03\x04")

    assert find_copied_runtime_source(tmp_path) == []
