"""Tests for the sourced Claude Code data export and its publication gates."""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from tools.export_claude_code_data import (
    ClaudeCodeDataError,
    check_freshness,
    export_claude_code_data,
    load_command_data,
    render_export,
    source_anchors,
    validate_blueprint_coverage,
    validate_citations,
    validate_custom_commands,
    validate_guided_tasks,
    validate_note_anchors,
    validate_scope_exercise,
    worked_example,
)

ROOT = Path(__file__).resolve().parents[1]


def test_export_contains_each_repository_derived_section() -> None:
    """The one generated document supplies command, exercise, example, and recorded-hook data."""
    exported = export_claude_code_data(ROOT)

    assert set(exported) == {"commands", "scopes", "fragments", "workedExample", "hookRecording"}
    components = exported["workedExample"]
    assert any(
        item["path"] == "CLAUDE.md" and item["componentType"] == "rules" for item in components
    )
    assert any(
        item["path"] == ".claude/README.md"
        and item["componentType"] == "documentation"
        and "contents" not in item
        for item in components
    )
    assert exported["hookRecording"]["hookPath"].endswith("prevent_destructive_actions.py")


def test_worked_example_embeds_one_readme_preferred_representative_per_teaching_type() -> None:
    """Discovery keeps every path but only representative teaching files carry their contents."""
    components = worked_example(ROOT)
    embedded = [item for item in components if "contents" in item]

    assert {item["componentType"] for item in embedded} == {
        "rules",
        "settings",
        "command",
        "skill",
        "agent",
        "hook",
    }
    assert len(embedded) == 6
    assert any(item["path"] == ".claude/skills/triage-security/SKILL.md" for item in embedded)
    assert any(
        item["path"] == ".claude/skills/speckit-analyze/SKILL.md" and "contents" not in item
        for item in components
    )


def test_worked_example_does_not_classify_an_unknown_file_as_rules(tmp_path: Path) -> None:
    """A newly discovered location receives an explicit non-teaching classification."""
    (tmp_path / ".claude").mkdir()
    (tmp_path / ".claude" / "README.md").write_text("# Configuration\n", encoding="utf-8")
    (tmp_path / ".claude" / "misc.txt").write_text("metadata\n", encoding="utf-8")
    (tmp_path / "CLAUDE.md").write_text("# Instructions\n", encoding="utf-8")

    components = worked_example(tmp_path)

    assert any(
        item["path"] == ".claude/misc.txt" and item["componentType"] == "unrecognized"
        for item in components
    )


def test_citation_gate_blocks_an_unresolved_anchor() -> None:
    """A command without a registered source cannot be published."""
    with pytest.raises(ClaudeCodeDataError, match="missing SOURCES.md anchor"):
        validate_citations([{"id": "uncited", "source_anchor": "absent"}], source_anchors())


def test_blueprint_coverage_gate_accepts_the_populated_bounded_set() -> None:
    """The sourced command set covers every feature in the Claude Code blueprint row."""
    commands = load_command_data()["commands"]

    validate_blueprint_coverage(commands, ROOT / "BLUEPRINT.md")


def test_note_anchors_resolve_against_the_authored_notes() -> None:
    """Every worked-example component points at a heading the Claude Code notes actually carry."""
    validate_note_anchors(worked_example(ROOT), ROOT / "notes" / "03-claude-code")


def test_note_anchor_gate_names_an_unresolved_heading() -> None:
    """Publication names the component and the heading, rather than failing anonymously."""
    component = {"path": ".claude/settings.json", "noteAnchor": "no-such-heading"}

    with pytest.raises(
        ClaudeCodeDataError,
        match=r"\.claude/settings\.json.*no-such-heading",
    ):
        validate_note_anchors([component], ROOT / "notes" / "03-claude-code")


def test_custom_command_gate_blocks_a_missing_definition() -> None:
    """A simulator entry cannot claim a command absent from this repository."""
    with pytest.raises(ClaudeCodeDataError, match="missing definition"):
        validate_custom_commands(
            [{"id": "missing", "kind": "custom", "defined_by": ".claude/commands/missing.md"}], ROOT
        )


def test_guided_task_gate_requires_a_complete_order_independent_of_command_ids() -> None:
    """Guided membership stays in source data when command identifiers change."""
    commands = load_command_data()["commands"]
    renamed = [{**command, "id": f"renamed-{index}"} for index, command in enumerate(commands)]

    validate_guided_tasks(renamed)

    duplicate_position = [dict(command) for command in commands]
    guided = [command for command in duplicate_position if command.get("guided_task") is not None]
    guided[-1]["guided_task"] = guided[0]["guided_task"]
    with pytest.raises(ClaudeCodeDataError, match="unique and consecutive"):
        validate_guided_tasks(duplicate_position)


def test_scope_exercise_gate_blocks_a_flattened_fixture() -> None:
    """The hierarchy data cannot lose its conflict or its unenforceable instruction."""
    scopes = [
        {"id": "managed-policy", "name": "managed policy", "order": 1},
        {"id": "user", "name": "user", "order": 2},
        {"id": "project", "name": "project", "order": 3},
        {"id": "local", "name": "local", "order": 4},
    ]
    flattened = [
        {
            "id": "ordinary-rule",
            "scope_id": "project",
            "conflicts_with": None,
            "enforceable": True,
            "enforced_by": None,
        }
    ]

    with pytest.raises(ClaudeCodeDataError, match="conflicting pair"):
        validate_scope_exercise(scopes, flattened)

    conflict_without_enforcement = [
        {
            "id": "managed-rule",
            "scope_id": "managed-policy",
            "conflicts_with": "project-rule",
            "enforceable": True,
            "enforced_by": None,
        },
        {
            "id": "project-rule",
            "scope_id": "project",
            "conflicts_with": "managed-rule",
            "enforceable": True,
            "enforced_by": None,
        },
    ]
    with pytest.raises(ClaudeCodeDataError, match="cannot enforce"):
        validate_scope_exercise(scopes, conflict_without_enforcement)


def test_scope_exercise_gate_blocks_an_unknown_fragment_scope() -> None:
    """A malformed fragment cannot vanish when contributions are grouped by scope."""
    data = load_command_data()
    fragments = [dict(fragment) for fragment in data["fragments"]]
    fragments[0]["scope_id"] = "missing-scope"

    with pytest.raises(ClaudeCodeDataError, match="unknown scope"):
        validate_scope_exercise(data["scopes"], fragments)


def test_freshness_gate_blocks_a_stale_generated_file(tmp_path: Path) -> None:
    """A file that differs from a fresh export cannot be published."""
    shutil.copytree(ROOT / "claude-code", tmp_path / "claude-code")
    shutil.copytree(ROOT / ".claude", tmp_path / ".claude")
    shutil.copy2(ROOT / "CLAUDE.md", tmp_path / "CLAUDE.md")
    shutil.copy2(ROOT / "SOURCES.md", tmp_path / "SOURCES.md")
    (tmp_path / "site" / "src" / "data").mkdir(parents=True)
    generated = tmp_path / "site" / "src" / "data" / "claude-code.json"
    generated.write_text(render_export(export_claude_code_data(tmp_path)), encoding="utf-8")
    generated.write_text("{}\n", encoding="utf-8")

    with pytest.raises(ClaudeCodeDataError, match="stale"):
        check_freshness(tmp_path)
