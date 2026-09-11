"""Tests for repository-maintenance gates and content-preserving generators."""

from __future__ import annotations

from pathlib import Path

import pytest

from drills.engine.blueprint import load_blueprint, slugify
from tools.build_cheatsheets import build_cheatsheets
from tools.build_flashcards import build_flashcards
from tools.check_blueprint_consistency import main as consistency_main
from tools.check_links import check_links
from tools.check_links import main as links_main

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


def test_link_checker_validates_markdown_fragments_in_target_and_same_files(tmp_path: Path) -> None:
    """Markdown heading links are accepted only when their GitHub-style fragments exist."""
    (tmp_path / "guide.md").write_text("# Guide details\n\n## Next steps\n", encoding="utf-8")
    (tmp_path / "page.md").write_text(
        "# Page\n\n[Guide](guide.md#guide-details)\n[Section](#page)\n", encoding="utf-8"
    )

    errors, external_links = check_links(tmp_path)

    assert errors == []
    assert external_links == 0


def test_link_checker_reports_a_broken_markdown_fragment(tmp_path: Path) -> None:
    """A link to a removed Markdown heading blocks the local-link gate."""
    (tmp_path / "guide.md").write_text("# Guide\n", encoding="utf-8")
    (tmp_path / "page.md").write_text("[Missing](guide.md#missing-heading)\n", encoding="utf-8")

    errors, _ = check_links(tmp_path)

    assert errors == [
        f"page.md:1: broken Markdown fragment 'missing-heading' in {tmp_path / 'guide.md'}"
    ]


def test_link_checker_reports_when_built_output_is_unavailable(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The Markdown-only run identifies why it did not inspect generated HTML."""
    assert links_main(["--root", str(tmp_path)]) == 0

    assert "Built-output links skipped: site/dist is absent." in capsys.readouterr().out


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


def _write_scaffold_notes(notes_path: Path) -> None:
    """Create a notes tree whose every heading carries only an authoring prompt."""
    blueprint = load_blueprint()
    for domain in blueprint.domains:
        directory = notes_path / f"{domain.number:02d}-{slugify(domain.name)}"
        directory.mkdir(parents=True)
        sub_skills = "\n".join(f'  - name: "{name}"' for name in domain.sub_skills)
        headings = "\n\n".join(
            f"## {name}\n\nAuthoring prompt: Add original material." for name in domain.sub_skills
        )
        (directory / "README.md").write_text(
            f'---\ndomain_name: "{domain.name}"\nsub_skills:\n{sub_skills}\n---\n\n'
            f"# {domain.name}\n\n{headings}\n",
            encoding="utf-8",
        )


def test_generators_turn_unauthored_scaffolds_into_an_empty_deck(tmp_path: Path) -> None:
    """A tree of pure scaffolds yields an importable empty deck and no authored extracts."""
    blueprint = load_blueprint()
    notes = tmp_path / "notes"
    _write_scaffold_notes(notes)
    flashcards = tmp_path / "flashcards" / "ccdv-f.tsv"
    cheatsheets = tmp_path / "cheatsheets"

    counts = build_flashcards(notes, flashcards)
    sheets = build_cheatsheets(notes, cheatsheets)

    assert flashcards.read_text(encoding="utf-8") == ""
    assert counts == {domain.name: 0 for domain in blueprint.domains}
    for sheet in sheets:
        assert "## Authored note extracts" not in sheet.read_text(encoding="utf-8")


def test_generators_create_the_expected_layout_for_every_domain(tmp_path: Path) -> None:
    """Against the repository's own notes, every domain still gets one structural sheet."""
    blueprint = load_blueprint()
    flashcards = tmp_path / "flashcards" / "ccdv-f.tsv"
    cheatsheets = tmp_path / "cheatsheets"

    counts = build_flashcards(ROOT / "notes", flashcards)
    sheets = build_cheatsheets(ROOT / "notes", cheatsheets)

    assert flashcards.is_file()
    assert set(counts) == {domain.name for domain in blueprint.domains}
    assert sheets == tuple(
        cheatsheets / f"{domain.number:02d}-{slugify(domain.name)}.md"
        for domain in blueprint.domains
    )
    for domain, sheet in zip(blueprint.domains, sheets, strict=True):
        text = sheet.read_text(encoding="utf-8")
        assert f"# {domain.name} cheat sheet" in text
        assert f"| {domain.weight}% |" in text


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
    assert "Card: 01-agent-construction-with-claude-authored-1" in row
    assert counts["Agents and Workflows"] == 1


def test_flashcard_generator_uses_stable_source_position_identifiers(tmp_path: Path) -> None:
    """Thirty cards retain unique identities even where the visible fields collide four ways."""
    output = tmp_path / "ccdv-f.tsv"

    build_flashcards(ROOT / "notes", output)
    rows = [line.split("\t") for line in output.read_text(encoding="utf-8").splitlines()]
    identifiers = [row[1].split("Card: ")[-1] for row in rows]

    assert len(rows) == 30
    assert all(len(row) == 2 for row in rows)
    assert len(set(identifiers)) == 30

    technical = [
        identifier
        for front, back in rows
        if front == "Technical Fundamentals"
        and "Domain: Model Selection and Optimization" in back
        and "Sub-skill: Technical Fundamentals" in back
        for identifier in [back.split("Card: ")[-1]]
    ]
    # Compared as a set, not a sequence: what matters is that four cards sharing a front, a
    # domain, and a sub-skill get four distinct identities. Which one the deck lists first is a
    # property of note ordering, pinned separately below.
    assert sorted(technical) == [
        "05-technical-fundamentals-decision-tables-1",
        "05-technical-fundamentals-pitfalls-1",
        "05-technical-fundamentals-readme-1",
        "05-technical-fundamentals-self-check-1",
    ]

    rewritten_notes = tmp_path / "notes"
    rewritten_notes.mkdir()
    for source in (ROOT / "notes").rglob("*.md"):
        target = rewritten_notes / source.relative_to(ROOT / "notes")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            source.read_text(encoding="utf-8").replace("ordinary", "everyday"), encoding="utf-8"
        )
    rewritten = tmp_path / "rewritten.tsv"
    build_flashcards(rewritten_notes, rewritten)
    rewritten_ids = [
        row.split("\t", 1)[1].split("Card: ")[-1]
        for row in rewritten.read_text(encoding="utf-8").splitlines()
    ]
    assert rewritten_ids == identifiers


def test_flashcard_generation_is_deterministic_and_platform_independent(tmp_path: Path) -> None:
    """The committed deck must not depend on which machine generated it.

    ``sorted()`` over ``Path`` objects compares case-folded on Windows and by code point on POSIX,
    so note order - and therefore every row's position in the deck - once differed by platform.
    A regenerated deck would then churn against the committed one depending on who rebuilt it.
    """
    first = tmp_path / "first.tsv"
    second = tmp_path / "second.tsv"

    build_flashcards(ROOT / "notes", first)
    build_flashcards(ROOT / "notes", second)

    assert first.read_bytes() == second.read_bytes()
    # Uppercase sorts before lowercase by code point, which is the order both platforms now take.
    assert (
        first.read_text(encoding="utf-8")
        .splitlines()[0]
        .split("\t")[1]
        .endswith("Card: 05-technical-fundamentals-readme-1")
    )


def test_committed_flashcard_deck_matches_a_fresh_generation(tmp_path: Path) -> None:
    """A rebuild is a no-op: the deck in the tree is what the notes currently produce."""
    regenerated = tmp_path / "regenerated.tsv"
    build_flashcards(ROOT / "notes", regenerated)

    committed = (ROOT / "flashcards" / "ccdv-f.tsv").read_text(encoding="utf-8")
    assert regenerated.read_text(encoding="utf-8") == committed
