"""Publication checks for the repository-derived Claude Code worked example."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

import pytest

from tools.export_claude_code_data import (
    ClaudeCodeDataError,
    export_claude_code_data,
    render_export,
    validate_worked_example_targets,
    worked_example,
)

ROOT = Path(__file__).resolve().parents[1]


def _copy_export_sources(destination: Path) -> None:
    """Copy only the repository sources the pure exporter reads."""
    claude_files = [
        ".claude/README.md",
        ".claude/settings.json",
        ".claude/commands/verify-triage.md",
        ".claude/skills/triage-security/SKILL.md",
        ".claude/agents/triage-security-reviewer.md",
        ".claude/hooks/prevent_destructive_actions.py",
    ]
    for relative in claude_files:
        source = ROOT / relative
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    shutil.copytree(ROOT / "claude-code", destination / "claude-code")
    shutil.copy2(ROOT / "CLAUDE.md", destination / "CLAUDE.md")
    shutil.copy2(ROOT / "BLUEPRINT.md", destination / "BLUEPRINT.md")
    shutil.copy2(ROOT / "SOURCES.md", destination / "SOURCES.md")


def test_discovered_file_changes_export_without_a_site_edit(tmp_path: Path) -> None:
    """Discovery, rather than a site-maintained list, controls the published inventory."""
    _copy_export_sources(tmp_path)
    site_marker = tmp_path / "site" / "unchanged.txt"
    site_marker.parent.mkdir()
    site_marker.write_text("unchanged\n", encoding="utf-8")
    before = render_export(export_claude_code_data(tmp_path))

    discovered = tmp_path / ".claude" / "inventory-entry.txt"
    discovered.write_text("repository-owned metadata\n", encoding="utf-8")
    after = render_export(export_claude_code_data(tmp_path))

    assert after != before
    assert ".claude/inventory-entry.txt" in after
    assert site_marker.read_text(encoding="utf-8") == "unchanged\n"


def test_publication_rejects_a_missing_repository_target() -> None:
    """Every inventory link must still name a file within the repository."""
    components = worked_example(ROOT)
    components[0] = {**components[0], "path": ".claude/missing.md"}

    with pytest.raises(ClaudeCodeDataError, match="missing repository file"):
        validate_worked_example_targets(
            components,
            ROOT,
            ROOT / "notes" / "03-claude-code",
        )


def test_publication_rejects_a_missing_note_target() -> None:
    """Every inventory link must still name an authored note heading."""
    components = worked_example(ROOT)
    components[0] = {**components[0], "noteAnchor": "missing-heading"}

    with pytest.raises(ClaudeCodeDataError, match="missing-heading"):
        validate_worked_example_targets(
            components,
            ROOT,
            ROOT / "notes" / "03-claude-code",
        )


def test_site_has_no_hand_written_repository_hook_behavior_sentence() -> None:
    """Repository-hook behavior belongs to generated recordings, not site-authored prose."""
    sentence_pattern = re.compile(
        r"(?:repository(?:'s)?|worked example|project safety)\W+hook"
        r"[^.!?\n]*(?:den(?:y|ies|ied)|block|protect|refus|catch|match)",
        re.IGNORECASE,
    )
    violations: list[str] = []
    ignored_directories = {"node_modules", "dist", "public", "test-results"}
    for path in sorted((ROOT / "site").rglob("*")):
        if any(part in ignored_directories for part in path.parts):
            continue
        if not path.is_file() or path.suffix not in {".astro", ".css", ".js", ".md", ".ts"}:
            continue
        text = path.read_text(encoding="utf-8")
        if sentence_pattern.search(text):
            violations.append(path.relative_to(ROOT).as_posix())

    assert violations == []
