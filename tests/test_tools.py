"""Tests for repository-maintenance gates and content-preserving generators."""

from __future__ import annotations

from pathlib import Path

from drills.engine.blueprint import load_blueprint, slugify
from tools.build_cheatsheets import build_cheatsheets
from tools.build_flashcards import build_flashcards
from tools.check_blueprint_consistency import main as consistency_main
from tools.check_links import check_links

ROOT = Path(__file__).resolve().parents[1]


def test_link_checker_accepts_a_good_relative_link(tmp_path: Path) -> None:
    """A Markdown fixture can point to a sibling file without producing an error."""
    (tmp_path / "guide.md").write_text("# Guide\n", encoding="utf-8")
    (tmp_path / "page.md").write_text("[Guide](guide.md)\n", encoding="utf-8")

    errors, external_links = check_links(tmp_path)

    assert errors == []
    assert external_links == 0


def test_link_checker_reports_a_broken_relative_link_with_its_line(tmp_path: Path) -> None:
    """A deliberately broken Markdown fixture reports its file and source line."""
    (tmp_path / "page.md").write_text("# Page\n[Missing](missing.md)\n", encoding="utf-8")

    errors, _ = check_links(tmp_path)

    assert len(errors) == 1
    assert errors[0].startswith("page.md:2:")
    assert "missing.md" in errors[0]


def test_link_checker_checks_built_routes_and_heading_fragments(tmp_path: Path) -> None:
    """Built links must use the configured base, a trailing slash, and a real emitted fragment."""
    dist = tmp_path / "site" / "dist"
    (dist / "topic").mkdir(parents=True)
    (dist / "index.html").write_text(
        '<a href="/ccdv-f-lab/topic/#details">Topic</a>', encoding="utf-8"
    )
    (dist / "topic" / "index.html").write_text('<h1 id="details">Details</h1>', encoding="utf-8")

    errors, external_links = check_links(tmp_path)

    assert errors == []
    assert external_links == 0


def test_link_checker_rejects_a_broken_built_fragment(tmp_path: Path) -> None:
    """A built deep link to a removed heading fails the same local-link gate."""
    dist = tmp_path / "site" / "dist"
    dist.mkdir(parents=True)
    (dist / "index.html").write_text('<a href="#missing">Missing</a>', encoding="utf-8")

    errors, _ = check_links(tmp_path)

    assert [error.replace("\\", "/") for error in errors] == [
        "site/dist/index.html: broken built fragment '#missing'"
    ]


def test_blueprint_consistency_gate_passes_for_the_repository() -> None:
    """The checked-in blueprint and every dependent tree currently agree."""
    assert consistency_main([]) == 0


def test_blueprint_consistency_gate_rejects_a_mutated_domain_weight(tmp_path: Path) -> None:
    """A copied blueprint with a changed published weight cannot silently pass the gate."""
    altered = tmp_path / "BLUEPRINT.md"
    source = (ROOT / "BLUEPRINT.md").read_text(encoding="utf-8")
    altered.write_text(source.replace("14.7%", "14.6%", 1), encoding="utf-8")

    assert consistency_main(["--blueprint", str(altered)]) == 1


def test_generators_handle_the_note_skeletons_and_create_expected_layout(tmp_path: Path) -> None:
    """Empty scaffolds generate an importable empty deck and one structural sheet per domain."""
    blueprint = load_blueprint()
    flashcards = tmp_path / "flashcards" / "ccdv-f.tsv"
    cheatsheets = tmp_path / "cheatsheets"

    counts = build_flashcards(ROOT / "notes", flashcards)
    sheets = build_cheatsheets(ROOT / "notes", cheatsheets)

    assert flashcards.is_file()
    assert flashcards.read_text(encoding="utf-8") == ""
    assert counts == {domain.name: 0 for domain in blueprint.domains}
    assert sheets == tuple(
        cheatsheets / f"{domain.number:02d}-{slugify(domain.name)}.md"
        for domain in blueprint.domains
    )
    for domain, sheet in zip(blueprint.domains, sheets, strict=True):
        text = sheet.read_text(encoding="utf-8")
        assert f"# {domain.name} cheat sheet" in text
        assert f"| {domain.weight}% |" in text
        assert "## Authored note extracts" not in text


def test_flashcard_generator_preserves_exact_blueprint_labels(tmp_path: Path) -> None:
    """An authored section carries exact domain and sub-skill labels in a two-column TSV card."""
    notes = tmp_path / "notes" / "01-agents-and-workflows"
    notes.mkdir(parents=True)
    (notes / "authored.md").write_text(
        "---\n"
        'domain_name: "Agents and Workflows"\n'
        "sub_skills:\n"
        '  - name: "Agent Construction with Claude"\n'
        '    weight: "5.3%"\n'
        "---\n\n"
        "# Authored note\n\n"
        "## Agent Construction with Claude\n\n"
        "An authored source sentence.\n",
        encoding="utf-8",
    )
    output = tmp_path / "cards.tsv"

    counts = build_flashcards(tmp_path / "notes", output)

    row = output.read_text(encoding="utf-8").strip()
    assert row.count("\t") == 1
    assert "Domain: Agents and Workflows" in row
    assert "Sub-skill: Agent Construction with Claude" in row
    assert counts["Agents and Workflows"] == 1
