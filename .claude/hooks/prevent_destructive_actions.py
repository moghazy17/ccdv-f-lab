#!/usr/bin/env python3
"""Deny protected-file writes and destructive shell commands from Claude Code PreToolUse hooks."""

from __future__ import annotations

import json
import re
import sys
from pathlib import PurePath
from typing import Any

PROTECTED_FILES = frozenset({"AGENTS.MD", "BLUEPRINT.MD", "LICENSE"})
_DESTRUCTIVE_COMMAND = re.compile(
    r"(?:\brm\s+-[a-z]*[rf]|\brmdir\s+/[sq]|\bdel\s+/[a-z]*[sqf]|"
    r"\bremove-item\b.{0,80}\b-recurse\b|\bgit\s+reset\s+--hard\b|"
    r"\bgit\s+clean\s+-[a-z]*f|\bformat\s+[a-z]:|\bmkfs\b|\bdd\s+if=)",
    re.IGNORECASE,
)


def _deny(message: str) -> int:
    """Tell Claude Code that the PreToolUse action is denied, then return a failing status."""
    print(
        json.dumps(
            {
                "hookSpecificOutput": {"permissionDecision": "deny"},
                "systemMessage": message,
            }
        ),
        file=sys.stderr,
    )
    return 2


def _protected_path(value: object) -> bool:
    """Match a protected basename from a relative or absolute write path."""
    if not isinstance(value, str):
        return False
    return PurePath(value.replace("\\", "/")).name.upper() in PROTECTED_FILES


def _protected_file_in_command(command: str) -> str | None:
    """Return the protected filename referenced by a shell command, if any."""
    for filename in PROTECTED_FILES:
        if re.search(rf"(?<![A-Z0-9_]){re.escape(filename)}(?![A-Z0-9_])", command, re.IGNORECASE):
            return filename
    return None


def decide(payload: dict[str, Any]) -> int:
    """Return the hook status code for one Claude Code PreToolUse payload."""
    tool_input = payload.get("tool_input", {})
    if not isinstance(tool_input, dict):
        return 0
    file_path = tool_input.get("file_path")
    if _protected_path(file_path):
        return _deny(f"Protected ground-truth file write denied: {file_path}")
    command = tool_input.get("command")
    if not isinstance(command, str):
        return 0
    protected_file = _protected_file_in_command(command)
    if protected_file is not None:
        return _deny(f"Protected ground-truth file write denied: {protected_file}")
    if _DESTRUCTIVE_COMMAND.search(command):
        return _deny("Destructive shell command denied by the project safety hook.")
    return 0


def main() -> int:
    """Parse JSON from standard input, allowing empty or malformed unrelated hook input to pass."""
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    if not isinstance(payload, dict):
        return 0
    return decide(payload)


if __name__ == "__main__":
    raise SystemExit(main())
