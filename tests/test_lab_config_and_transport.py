"""Tests for the lab's pinned configuration and keyless recorded transport."""

from __future__ import annotations

from lab.config import (
    CLASSIFY_MODEL,
    DEFAULT_PROMPT_NAME,
    DEFAULT_PROMPT_VERSION,
    DRAFT_MODEL,
    Settings,
    compare_prompt_versions,
    resolve_prompt,
)
from lab.ingest import Ticket, assemble_triage_request
from lab.transport import MockTransport


def test_settings_resolve_defaults_and_explicit_environment_values() -> None:
    """Settings document and resolve the keyless default plus a deliberately live selection."""
    default = Settings.from_env({})
    live = Settings.from_env(
        {
            "TRIAGE_TRANSPORT": "anthropic",
            "TRIAGE_MODEL": DRAFT_MODEL,
            "TRIAGE_MAX_TOKENS": "768",
            "TRIAGE_PROMPT_NAME": DEFAULT_PROMPT_NAME,
            "TRIAGE_PROMPT_VERSION": DEFAULT_PROMPT_VERSION,
        }
    )

    assert default.transport == "mock"
    assert default.model == CLASSIFY_MODEL
    assert default.max_tokens == 512
    assert live.transport == "anthropic"
    assert live.model == DRAFT_MODEL
    assert live.max_tokens == 768


def test_prompt_version_lookup_and_comparison_are_explicit() -> None:
    """A caller can resolve a named prompt version and compare dotted version values."""
    prompt = resolve_prompt(DEFAULT_PROMPT_NAME, DEFAULT_PROMPT_VERSION)

    assert prompt.name == DEFAULT_PROMPT_NAME
    assert prompt.version == DEFAULT_PROMPT_VERSION
    assert compare_prompt_versions("1.0", "1.0.0") == 0
    assert compare_prompt_versions("1.0.0", "1.0.1") == -1
    assert compare_prompt_versions("2.0.0", "1.99.99") == 1


def test_mock_transport_is_deterministic_and_keyless(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """The default path needs neither an API key nor an SDK import to return a recorded response."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    request = assemble_triage_request(Ticket(id="ticket-1", submitted_text="Cannot sign in."))
    transport = MockTransport()

    first = transport.send(request)
    second = transport.send(request)

    assert first == second
    assert first.stop_reason == "end_turn"
    assert first.usage.input_tokens == 42
