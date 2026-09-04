"""Tests for the repository's executable Claude Code destructive-action hook."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
HOOK_PATH = REPOSITORY_ROOT / ".claude" / "hooks" / "prevent_destructive_actions.py"


def run_hook(payload: dict[str, object]) -> subprocess.CompletedProcess[str]:
    """Execute the hook as Claude Code does, sending one PreToolUse-shaped JSON document."""
    return subprocess.run(
        [sys.executable, str(HOOK_PATH)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
        cwd=REPOSITORY_ROOT,
    )


def test_project_claude_instructions_live_at_the_repository_root() -> None:
    """Claude Code loads shared project instructions from the repository root convention."""
    instructions = REPOSITORY_ROOT / "CLAUDE.md"

    assert instructions.is_file()
    assert "project-level" in instructions.read_text(encoding="utf-8")


def test_hook_denies_protected_file_write_and_permits_an_ordinary_file() -> None:
    """The direct executable hook has both a deny path and a non-destructive allow path."""
    denied = run_hook({"tool_name": "Write", "tool_input": {"file_path": "BLUEPRINT.md"}})
    permitted = run_hook({"tool_name": "Write", "tool_input": {"file_path": "lab/security.py"}})

    assert denied.returncode != 0
    assert "permissionDecision" in denied.stderr
    assert permitted.returncode == 0
