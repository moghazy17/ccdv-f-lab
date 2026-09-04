# Project Claude Code instructions

This is the project-level Claude Code instruction file. Claude Code composes instructions from the
enterprise, user, project, and subdirectory levels; nearer subdirectory instructions refine the
project rules for their subtree. This file supplies the project-level configuration and does not
override enterprise or user policy.

Follow [AGENTS.md](AGENTS.md) for the repository's content, security, test, and commit rules. Read
[BLUEPRINT.md](BLUEPRINT.md) before changing study material. Keep lab tests keyless, use Python
3.11+ standard-library-first code, and run `ruff check .`, `ruff format --check .`, and `pytest -q`
after changes. Do not run `git add` or `git commit`.

Use `/verify-triage` to run the triage verification sequence. Use the `triage-security` skill when
reviewing the untrusted-input boundary, secret handling, or tool permissions.
