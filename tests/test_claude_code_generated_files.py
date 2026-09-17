"""Execute representative generated hooks through the same recording driver as the site data."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from unittest.mock import patch

from tools.export_claude_code_data import run_hook

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "site" / "src" / "data" / "generated-hook-fixtures.json"
EXPORT = ROOT / "site" / "scripts" / "export-generated-hook-fixtures.ts"


def test_generated_hook_fixture_is_fresh() -> None:
    """Require the Python test data to remain exported from the TypeScript generator."""
    completed = subprocess.run(
        ["node", "--experimental-strip-types", str(EXPORT), "--check"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr


def test_representative_generated_hooks_deny_and_permit() -> None:
    """Execute each generated hook source with the browser's stdin and exit-code driver."""
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for case in data["cases"]:

        def execute_generated_source(_path: str, run_name: str) -> None:
            namespace = {"__name__": run_name, "__file__": _path}
            exec(compile(case["hook"], _path, "exec"), namespace)

        with patch("tools.export_claude_code_data.runpy.run_path", execute_generated_source):
            for sample in case["samples"]:
                exit_code, stdout, stderr = run_hook(Path(f"{case['name']}.py"), sample["payload"])
                if sample["expected"] == "deny":
                    assert exit_code == 2
                    assert "permissionDecision" in stderr
                else:
                    assert exit_code == 0
                    assert "Action permitted by the hook." in stdout
