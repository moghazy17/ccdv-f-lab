---
description: Run the triage lab's keyless lint, format, and test gates
allowed-tools:
  ["Bash(ruff check .)", "Bash(ruff format --check .)", "Bash(pytest -q)"]
---

Run these commands from the repository root, in order:

1. `ruff check .`
2. `ruff format --check .`
3. `pytest -q`

Report each command's outcome. Do not change files while this command is running; use the normal
editing workflow to fix a failure, then invoke `/verify-triage` again.
