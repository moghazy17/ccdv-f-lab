"""Environment-only credential handling and secret-safe diagnostic helpers.

Demonstrates the blueprint sub-skill ``Identity, Secrets, and Key Management``. Development uses
an explicitly injected process environment value only when a live transport is selected; keyless
tests use the mock transport. Production injects a managed runtime secret into the process
environment and rotates it outside the repository. Neither path reads a repository file, logs a
credential, or includes one in a prompt.

Authorized access monitoring here means recording the requesting identity, credential reference,
requested scope, and decision without recording the credential value. It makes access decisions
auditable while preserving secret confidentiality.
"""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY"
REDACTED_API_KEY = "[REDACTED_API_KEY]"
_API_KEY_PATTERN = re.compile(r"\bsk-ant-[A-Za-z0-9_-]+\b")


@dataclass(frozen=True)
class AuthorizedAccessRecord:
    """A secret-free audit record for one identity and access decision."""

    principal: str
    credential_environment: str
    requested_scope: str
    granted: bool


def resolve_anthropic_api_key(environ: Mapping[str, str] | None = None) -> str:
    """Resolve the live API credential from an environment mapping and nowhere else."""
    values = os.environ if environ is None else environ
    key = values.get(ANTHROPIC_API_KEY_ENV)
    if not key:
        raise RuntimeError(f"{ANTHROPIC_API_KEY_ENV} must be set for the live transport")
    return key


def redact_secret_text(text: str, *, known_secrets: tuple[str, ...] = ()) -> str:
    """Remove known credential values and Anthropic API-key shapes from diagnostic text."""
    if not isinstance(text, str):
        raise TypeError("Secret redaction requires text")
    redacted = text
    for secret in sorted((secret for secret in known_secrets if secret), key=len, reverse=True):
        redacted = redacted.replace(secret, REDACTED_API_KEY)
    return _API_KEY_PATTERN.sub(REDACTED_API_KEY, redacted)


def redact_exception_message(error: BaseException, *, known_secrets: tuple[str, ...] = ()) -> str:
    """Return a secret-safe exception description suitable for a log or trace event."""
    return f"{type(error).__name__}: {redact_secret_text(str(error), known_secrets=known_secrets)}"


def redact_trace_record(
    record: Mapping[str, Any], *, known_secrets: tuple[str, ...] = ()
) -> dict[str, Any]:
    """Copy a nested trace record while redacting every string value that may contain a key."""
    return {
        str(key): _redact_trace_value(value, known_secrets=known_secrets)
        for key, value in record.items()
    }


def authorized_access_record(
    *,
    principal: str,
    requested_scope: str,
    granted: bool,
    credential_environment: str = ANTHROPIC_API_KEY_ENV,
) -> AuthorizedAccessRecord:
    """Build the no-secret audit event used for authorized access monitoring."""
    return AuthorizedAccessRecord(
        principal=principal,
        credential_environment=credential_environment,
        requested_scope=requested_scope,
        granted=granted,
    )


def _redact_trace_value(value: Any, *, known_secrets: tuple[str, ...]) -> Any:
    """Recursively retain trace structure while treating strings as untrusted diagnostics."""
    if isinstance(value, str):
        return redact_secret_text(value, known_secrets=known_secrets)
    if isinstance(value, Mapping):
        return {
            str(key): _redact_trace_value(item, known_secrets=known_secrets)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_trace_value(item, known_secrets=known_secrets) for item in value]
    if isinstance(value, tuple):
        return tuple(_redact_trace_value(item, known_secrets=known_secrets) for item in value)
    return value
