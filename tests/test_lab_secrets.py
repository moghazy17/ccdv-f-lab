"""Keyless tests for environment-only credentials and secret-safe diagnostics."""

from __future__ import annotations

from lab.secrets import (
    REDACTED_API_KEY,
    redact_exception_message,
    redact_trace_record,
    resolve_anthropic_api_key,
)


def test_environment_is_the_only_credential_source() -> None:
    """A supplied environment mapping resolves a key without consulting a repository file."""
    key = "sk-ant-api03-example-key-1234567890"

    assert resolve_anthropic_api_key({"ANTHROPIC_API_KEY": key}) == key


def test_api_key_is_redacted_from_exception_and_nested_trace_record() -> None:
    """Diagnostic helpers remove a key-shaped string from both exception and trace paths."""
    key = "sk-ant-api03-example-key-1234567890"
    error = RuntimeError(f"Live request failed with {key}")
    trace = {
        "message": f"Authorization: Bearer {key}",
        "attempts": [{"exception": f"retry used {key}"}],
    }

    safe_exception = redact_exception_message(error, known_secrets=(key,))
    safe_trace = redact_trace_record(trace, known_secrets=(key,))

    assert key not in safe_exception
    assert key not in str(safe_trace)
    assert REDACTED_API_KEY in safe_exception
    assert REDACTED_API_KEY in str(safe_trace)
