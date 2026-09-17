"""Tests for the repository's executable Claude Code destructive-action hook."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from tools.export_claude_code_data import HOOK_FIXTURES, hook_recording

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
    denied = run_hook({"tool_name": "Write", "tool_input": {"file_path": "LICENSE"}})
    permitted = run_hook({"tool_name": "Write", "tool_input": {"file_path": "lab/security.py"}})

    assert denied.returncode != 0
    assert "permissionDecision" in denied.stderr
    assert permitted.returncode == 0


def test_hook_recording_matches_the_committed_generated_data() -> None:
    """Published decisions come from executing the live hook."""
    data_path = REPOSITORY_ROOT / "site" / "src" / "data" / "claude-code.json"
    generated = json.loads(data_path.read_text(encoding="utf-8"))

    assert generated["hookRecording"] == hook_recording(REPOSITORY_ROOT)


def test_hook_recording_battery_covers_every_required_case() -> None:
    """The battery retains denials, allows, whole-command matching, and malformed input."""
    recorded_labels = {case["label"] for case in hook_recording(REPOSITORY_ROOT)["recordedCases"]}

    assert recorded_labels == {label for label, _ in HOOK_FIXTURES}
