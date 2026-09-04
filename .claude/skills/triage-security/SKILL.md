---
name: triage-security
description: >-
  Use when reviewing or changing triage untrusted-input boundaries, PII redaction, output leakage
  checks, API-key handling, or tool exposure policy.
---

# Triage security review

Read `AGENTS.md`, `BLUEPRINT.md`, `lab/ingest.py`, `lab/security.py`, and `lab/secrets.py` before
making a security change. Preserve the four layers: input inspection is a recorded signal;
`lab.ingest` provides the nonce-bound JSON data boundary; `ToolExposurePolicy` is the capability
boundary; output checking prevents trusted-content leakage.

Do not treat pattern matching or approval as a substitute for least privilege. Untrusted tickets
must keep read-only tool exposure even when an approval decision is present. Redact PII before logs
or traces, resolve live credentials only from the environment, and never add a secret to fixtures,
prompts, exception text, or documentation.

Run `/verify-triage` after changes. For hook changes, also execute
`python .claude/hooks/prevent_destructive_actions.py` with representative `PreToolUse` JSON input.
