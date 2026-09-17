"""Export the Claude Code simulator's repository-owned behavioural data."""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import re
import runpy
import sys
import traceback
from pathlib import Path
from typing import Any

import yaml

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
COMMAND_DATA_PATH = REPOSITORY_ROOT / "claude-code" / "commands.yml"
SOURCES_PATH = REPOSITORY_ROOT / "SOURCES.md"
BLUEPRINT_PATH = REPOSITORY_ROOT / "BLUEPRINT.md"
HOOK_PATH = REPOSITORY_ROOT / ".claude" / "hooks" / "prevent_destructive_actions.py"
OUTPUT_PATH = REPOSITORY_ROOT / "site" / "src" / "data" / "claude-code.json"

TEACHING_COMPONENT_TYPES = frozenset({"rules", "settings", "command", "skill", "agent", "hook"})
NOTE_ANCHORS = {
    "rules": "rules-and-instruction-hierarchy",
    "settings": "settings-and-permissions",
    "command": "custom-slash-commands",
    "skill": "skills",
    "agent": "subagents",
    "hook": "hooks-as-safety-controls",
    "documentation": "worked-example-inventory",
    "unrecognized": "worked-example-inventory",
}


class ClaudeCodeDataError(ValueError):
    """Raised when source data cannot safely be published."""


def load_command_data(path: Path = COMMAND_DATA_PATH) -> dict[str, Any]:
    """Load the YAML source and require its three top-level collections."""
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise ClaudeCodeDataError(f"Cannot read Claude Code command data: {path}.") from error
    if not isinstance(data, dict):
        raise ClaudeCodeDataError("Claude Code command data must be a mapping.")
    for name in ("commands", "scopes", "fragments"):
        if not isinstance(data.get(name), list):
            raise ClaudeCodeDataError(f"Claude Code command data needs a {name!r} list.")
    return data


def source_anchors(path: Path = SOURCES_PATH) -> set[str]:
    """Return link-reference anchors published by the repository source register."""
    return set(re.findall(r"^\[([^]]+)\]:\s", path.read_text(encoding="utf-8"), re.MULTILINE))


def source_urls(path: Path = SOURCES_PATH) -> dict[str, str]:
    """Return dated-source destinations indexed by their registered anchors."""
    return dict(
        re.findall(r"^\[([^]]+)\]:\s+(\S+)", path.read_text(encoding="utf-8"), re.MULTILINE)
    )


def validate_citations(commands: list[dict[str, Any]], anchors: set[str]) -> None:
    """Require every command behaviour to cite a known source anchor."""
    for command in commands:
        identifier = command.get("id", "<unknown>")
        anchor = command.get("source_anchor")
        if not isinstance(anchor, str) or anchor not in anchors:
            raise ClaudeCodeDataError(
                f"Command {identifier!r} cites missing SOURCES.md anchor {anchor!r}."
            )


def claude_code_blueprint_features(path: Path = BLUEPRINT_PATH) -> set[str]:
    """Extract the named Claude Code Operation features from the blueprint row."""
    row = next(
        (
            line
            for line in path.read_text(encoding="utf-8").splitlines()
            if "Claude Code Operation" in line
        ),
        None,
    )
    if row is None:
        raise ClaudeCodeDataError("BLUEPRINT.md has no Claude Code Operation row.")
    measured = [cell.strip() for cell in row.strip().strip("|").split("|")][-1]
    match = re.fullmatch(
        r"Core components \((?P<components>.+)\); features \((?P<features>.+)\); "
        r"the \*\*(?P<hierarchy>.+)\*\*; (?P<initialization>.+); `(?P<settings>.+)`",
        measured,
    )
    if match is None:
        raise ClaudeCodeDataError("Claude Code Operation row has an unexpected feature format.")
    return {
        *[item.strip() for item in match.group("components").split(",")],
        *[item.strip() for item in match.group("features").split(",")],
        match.group("hierarchy"),
        match.group("initialization"),
        match.group("settings"),
    }


def validate_blueprint_coverage(commands: list[dict[str, Any]], blueprint_path: Path) -> None:
    """Require command data to claim every feature named by the Claude Code blueprint row."""
    claimed = {
        item.get("blueprint_feature")
        for item in commands
        if isinstance(item.get("blueprint_feature"), str)
    }
    uncovered = sorted(claude_code_blueprint_features(blueprint_path) - claimed)
    if uncovered:
        raise ClaudeCodeDataError(
            "Claude Code blueprint features have no sourced command entry: "
            + ", ".join(uncovered)
            + "."
        )


def validate_custom_commands(commands: list[dict[str, Any]], root: Path) -> None:
    """Require every simulated custom command to point at a repository file."""
    for command in commands:
        if command.get("kind") != "custom":
            continue
        identifier = command.get("id", "<unknown>")
        defined_by = command.get("defined_by")
        if not isinstance(defined_by, str) or not (root / defined_by).is_file():
            raise ClaudeCodeDataError(
                f"Custom command {identifier!r} names missing definition {defined_by!r}."
            )


def validate_command_shapes(commands: list[dict[str, Any]]) -> None:
    """Keep typeable simulator input separate from non-typeable reference components."""
    valid_kinds = {"built-in", "custom", "mode", "component"}
    for command in commands:
        identifier = command.get("id", "<unknown>")
        kind = command.get("kind")
        invocation = command.get("invocation")
        where = command.get("where")
        if kind not in valid_kinds:
            raise ClaudeCodeDataError(f"Command {identifier!r} has an invalid kind {kind!r}.")
        if kind == "component":
            if invocation is not None:
                raise ClaudeCodeDataError(
                    f"Reference component {identifier!r} must not have a typeable invocation."
                )
            if not isinstance(where, str) or not where:
                raise ClaudeCodeDataError(
                    f"Reference component {identifier!r} needs a where field."
                )
        elif not isinstance(invocation, str) or not invocation:
            raise ClaudeCodeDataError(f"Command {identifier!r} needs a typeable invocation.")


def validate_guided_tasks(commands: list[dict[str, Any]]) -> None:
    """Require a nonempty, unambiguous order for the guided terminal journey."""
    positions: list[int] = []
    for command in commands:
        identifier = command.get("id", "<unknown>")
        position = command.get("guided_task")
        if position is None:
            continue
        if isinstance(position, bool) or not isinstance(position, int) or position <= 0:
            raise ClaudeCodeDataError(
                f"Command {identifier!r} has invalid guided_task position {position!r}."
            )
        if command.get("kind") == "component":
            raise ClaudeCodeDataError(
                f"Reference component {identifier!r} cannot be a guided terminal task."
            )
        positions.append(position)
    if not positions:
        raise ClaudeCodeDataError("Command data needs at least one guided terminal task.")
    if sorted(positions) != list(range(1, len(positions) + 1)):
        raise ClaudeCodeDataError("Guided task positions must be unique and consecutive.")


def validate_scope_exercise(scopes: list[dict[str, Any]], fragments: list[dict[str, Any]]) -> None:
    """Require the documented hierarchy and both misconceptions the exercise must expose."""
    expected = [
        ("managed-policy", "managed policy", 1),
        ("user", "user", 2),
        ("project", "project", 3),
        ("local", "local", 4),
    ]
    actual = [(scope.get("id"), scope.get("name"), scope.get("order")) for scope in scopes]
    if actual != expected:
        raise ClaudeCodeDataError(
            "Scopes must be the four documented scopes in documented load order."
        )
    scope_ids = {scope[0] for scope in actual}
    for fragment in fragments:
        scope_id = fragment.get("scope_id")
        if scope_id not in scope_ids:
            raise ClaudeCodeDataError(
                f"Fragment {fragment.get('id', '<unknown>')!r} names unknown scope {scope_id!r}."
            )
    ids = {fragment.get("id") for fragment in fragments}
    by_id = {fragment.get("id"): fragment for fragment in fragments}
    conflicts = [
        fragment
        for fragment in fragments
        if isinstance(fragment.get("conflicts_with"), str)
        and fragment["conflicts_with"] in ids
        and by_id[fragment["conflicts_with"]].get("scope_id") != fragment.get("scope_id")
    ]
    if not conflicts:
        raise ClaudeCodeDataError("Fragments need a conflicting pair across scopes.")
    if not any(
        fragment.get("enforceable") is False and fragment.get("enforced_by") in {"settings", "hook"}
        for fragment in fragments
    ):
        raise ClaudeCodeDataError(
            "Fragments need a rule an instruction file cannot enforce, named with settings or hook."
        )


def validate_command_data(
    data: dict[str, Any],
    root: Path = REPOSITORY_ROOT,
    sources_path: Path = SOURCES_PATH,
    blueprint_path: Path = BLUEPRINT_PATH,
) -> None:
    """Run publication gates for citations, blueprint coverage, and custom-command definitions."""
    commands = data["commands"]
    if not all(isinstance(command, dict) for command in commands):
        raise ClaudeCodeDataError("Each command must be a mapping.")
    typed_commands = [command for command in commands if isinstance(command, dict)]
    validate_command_shapes(typed_commands)
    validate_guided_tasks(typed_commands)
    validate_citations(typed_commands, source_anchors(sources_path))
    validate_blueprint_coverage(typed_commands, blueprint_path)
    validate_custom_commands(typed_commands, root)
    if not all(isinstance(scope, dict) for scope in data["scopes"]):
        raise ClaudeCodeDataError("Each scope must be a mapping.")
    if not all(isinstance(fragment, dict) for fragment in data["fragments"]):
        raise ClaudeCodeDataError("Each fragment must be a mapping.")
    validate_scope_exercise(data["scopes"], data["fragments"])


def _component_type(path: Path, root: Path, claude_root: Path) -> str:
    """Classify a repository configuration file without a teaching-type fall-through."""
    if path == root / "CLAUDE.md":
        return "rules"
    relative = path.relative_to(claude_root)
    if relative == Path("README.md"):
        return "documentation"
    if relative.name == "settings.json":
        return "settings"
    first_part = relative.parts[0] if relative.parts else ""
    return {
        "commands": "command",
        "skills": "skill",
        "agents": "agent",
        "hooks": "hook",
    }.get(first_part, "unrecognized")


def _readme_referenced_files(root: Path, claude_root: Path) -> set[Path]:
    """Resolve repository files named by the configuration README."""
    readme_path = claude_root / "README.md"
    if not readme_path.is_file():
        return set()
    text = readme_path.read_text(encoding="utf-8")
    references = {
        *re.findall(r"`([^`]+)`", text),
        *re.findall(r"\]\(([^)]+)\)", text),
    }
    resolved: set[Path] = set()
    for reference in references:
        candidate = (claude_root / reference).resolve()
        if candidate.is_file() and candidate.is_relative_to(root.resolve()):
            resolved.add(candidate)
    return resolved


def _representative_paths(paths: list[Path], root: Path, claude_root: Path) -> set[Path]:
    """Choose one deterministic displayed file per teaching component type."""
    readme_references = _readme_referenced_files(root, claude_root)
    representatives: set[Path] = set()
    for component_type in sorted(TEACHING_COMPONENT_TYPES):
        candidates = [
            path for path in paths if _component_type(path, root, claude_root) == component_type
        ]
        if not candidates:
            continue
        preferred = sorted(path for path in candidates if path.resolve() in readme_references)
        representatives.add((preferred or sorted(candidates))[0])
    return representatives


def worked_example(root: Path = REPOSITORY_ROOT) -> list[dict[str, str]]:
    """Discover every configuration file and embed one representative per teaching type."""
    claude_root = root / ".claude"
    if not claude_root.is_dir():
        raise ClaudeCodeDataError("The repository .claude directory is missing.")
    instruction_path = root / "CLAUDE.md"
    if not instruction_path.is_file():
        raise ClaudeCodeDataError("The repository project instruction file is missing: CLAUDE.md.")
    paths = [instruction_path, *(path for path in claude_root.rglob("*") if path.is_file())]
    paths = sorted(paths, key=lambda path: path.relative_to(root).as_posix())
    representatives = _representative_paths(paths, root, claude_root)
    components = []
    for path in paths:
        component_type = _component_type(path, root, claude_root)
        component = {
            "path": path.relative_to(root).as_posix(),
            "componentType": component_type,
            "noteAnchor": NOTE_ANCHORS[component_type],
        }
        if path in representatives:
            component["contents"] = path.read_text(encoding="utf-8")
        components.append(component)
    return components


def _markdown_heading_anchors(notes_root: Path) -> set[str]:
    """Return GitHub-style anchors for headings in the Claude Code notes."""
    anchors: set[str] = set()
    for path in sorted(notes_root.rglob("*.md")):
        in_fence = False
        for line in path.read_text(encoding="utf-8").splitlines():
            if re.match(r"^\s*(```|~~~)", line):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            match = re.match(r"^#{1,6}\s+(.+?)\s*#*\s*$", line)
            if match is None:
                continue
            heading = re.sub(r"[`*_~]", "", match.group(1)).lower()
            anchor = re.sub(r"[^\w\s-]", "", heading, flags=re.UNICODE)
            anchors.add(re.sub(r"[\s-]+", "-", anchor).strip("-"))
    return anchors


def validate_note_anchors(components: list[dict[str, str]], notes_root: Path) -> None:
    """Require every worked-example note anchor to resolve to an authored heading."""
    available = _markdown_heading_anchors(notes_root)
    for component in components:
        anchor = component["noteAnchor"]
        if anchor not in available:
            raise ClaudeCodeDataError(
                f"Worked-example component {component['path']!r} cites unresolved note anchor "
                f"{anchor!r} under {notes_root}."
            )


def validate_worked_example_targets(
    components: list[dict[str, str]], root: Path, notes_root: Path
) -> None:
    """Require every worked-example repository and explanatory-note target to resolve."""
    resolved_root = root.resolve()
    for component in components:
        path = component["path"]
        candidate = (root / path).resolve()
        if not candidate.is_relative_to(resolved_root) or not candidate.is_file():
            raise ClaudeCodeDataError(
                f"Worked-example component {path!r} names a missing repository file."
            )
    validate_note_anchors(components, notes_root)


HOOK_FIXTURES: tuple[tuple[str, object], ...] = (
    (
        "a write to a protected ground-truth file",
        {"tool_name": "Write", "tool_input": {"file_path": "LICENSE"}},
    ),
    (
        "a write to an ordinary source file",
        {"tool_name": "Write", "tool_input": {"file_path": "lab/security.py"}},
    ),
    (
        "a destructive shell command",
        {"tool_name": "Bash", "tool_input": {"command": "git reset --hard"}},
    ),
    ("an ordinary shell command", {"tool_name": "Bash", "tool_input": {"command": "python -V"}}),
    (
        "a shell command that only mentions a protected filename",
        {"tool_name": "Bash", "tool_input": {"command": "echo LICENSE"}},
    ),
    ("a malformed or empty payload", []),
)


def run_hook(path: Path, payload: object) -> tuple[int, str, str]:
    """Execute a hook through the validated stdin, runpy, and SystemExit recording driver."""
    stdout, stderr = io.StringIO(), io.StringIO()
    saved_stdin, saved_argv = sys.stdin, sys.argv
    sys.stdin = io.StringIO(json.dumps(payload))
    sys.argv = [str(path)]
    code = 0
    try:
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            runpy.run_path(str(path), run_name="__main__")
    except SystemExit as exit_signal:
        code = exit_signal.code if isinstance(exit_signal.code, int) else 1
    except Exception:
        traceback.print_exc(file=stderr)
        code = 1
    finally:
        sys.stdin, sys.argv = saved_stdin, saved_argv
    return code, stdout.getvalue(), stderr.getvalue()


def hook_recording(root: Path = REPOSITORY_ROOT) -> dict[str, object]:
    """Record the repository hook's decisions across the required fixture battery."""
    hook_path = root / ".claude" / "hooks" / "prevent_destructive_actions.py"
    recorded_cases = []
    for label, payload in HOOK_FIXTURES:
        exit_code, stdout, stderr = run_hook(hook_path, payload)
        recorded_cases.append(
            {
                "label": label,
                "payload": payload,
                "exitCode": exit_code,
                "decision": "allow" if exit_code == 0 else "deny",
                "message": stderr,
                "stdout": stdout,
            }
        )
    return {"hookPath": hook_path.relative_to(root).as_posix(), "recordedCases": recorded_cases}


def export_claude_code_data(root: Path = REPOSITORY_ROOT) -> dict[str, object]:
    """Build the generated document without weakening the separately invoked publication gates."""
    data = load_command_data(root / "claude-code" / "commands.yml")
    urls = source_urls(root / "SOURCES.md")
    commands = []
    for command in data["commands"]:
        if not isinstance(command, dict):
            raise ClaudeCodeDataError("Each command must be a mapping.")
        commands.append(
            {
                "id": command.get("id"),
                "guidedTask": command.get("guided_task"),
                "invocation": command.get("invocation"),
                "kind": command.get("kind"),
                "where": command.get("where"),
                "scope": command.get("scope"),
                "definedBy": command.get("defined_by"),
                "blueprintFeature": command.get("blueprint_feature"),
                "explanation": command.get("explanation"),
                "sourceAnchor": command.get("source_anchor"),
                "sourceUrl": urls.get(command.get("source_anchor")),
                "transcript": command.get("transcript"),
            }
        )
    return {
        "commands": commands,
        "scopes": data["scopes"],
        "fragments": data["fragments"],
        "workedExample": worked_example(root),
        "hookRecording": hook_recording(root),
    }


def render_export(data: dict[str, object]) -> str:
    """Render deterministic JSON for the committed generated artifact."""
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def check_freshness(root: Path = REPOSITORY_ROOT) -> None:
    """Require the committed generated file to exactly equal a fresh export."""
    actual_path = root / "site" / "src" / "data" / "claude-code.json"
    if not actual_path.is_file():
        raise ClaudeCodeDataError(f"Derived Claude Code data is missing: {actual_path}.")
    if actual_path.read_text(encoding="utf-8") != render_export(export_claude_code_data(root)):
        raise ClaudeCodeDataError(
            "Derived Claude Code data is stale against its source and hook recording."
        )


def main(argv: list[str] | None = None) -> int:
    """Write the generated data used by the static site build."""
    parser = argparse.ArgumentParser(description="Export Claude Code simulator data.")
    parser.add_argument("--root", type=Path, default=REPOSITORY_ROOT)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args(argv)
    root = arguments.root.resolve()
    output = (
        arguments.output.resolve()
        if arguments.output
        else root / "site" / "src" / "data" / "claude-code.json"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render_export(export_claude_code_data(root)), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
