"""Load synthetic, deterministic golden fixtures for the triage eval harness.

Demonstrates the blueprint sub-skill ``Debugging and Error Handling``. Fixtures represent local
mocked behavior only; they are test inputs for the harness, not exam or production-support content.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from lab.evals.failure_modes import FailureMode
from lab.security import TicketTrustLevel
from lab.transport import ContentBlock, NormalisedResponse, Usage

GOLDEN_SET_PATH = Path(__file__).with_name("golden_cases.yaml")


@dataclass(frozen=True)
class ExpectedAssertions:
    """The deterministic checks and optional reference label for one eval outcome.

    ``assert_model_output`` is false for a fixture that deliberately supplies an incorrect but
    schema-valid model output. Its category remains the reference label used to detect the mismatch,
    while the grader asserts the detected failure mode instead of incorrectly expecting equality.
    """

    category: str | None
    severity: str | None
    needs_human: bool
    assert_model_output: bool
    tools_called: tuple[str, ...]
    tools_denied: tuple[str, ...]
    failure_mode: FailureMode | None


@dataclass(frozen=True)
class ResponseFixture:
    """One provider-neutral response returned through a case-local ``MockTransport``."""

    stop_reason: str
    content: tuple[dict[str, Any], ...]
    stop_details: dict[str, Any] | None = None

    def to_response(self) -> NormalisedResponse:
        """Build the existing transport response type without an SDK or network call."""
        content: list[ContentBlock | dict[str, Any]] = []
        for block in self.content:
            if block.get("type") in {"text", "thinking"}:
                content.append(
                    ContentBlock(type=str(block["type"]), text=_optional_text(block.get("text")))
                )
            else:
                content.append(dict(block))
        return NormalisedResponse(  # type: ignore[arg-type]
            content=tuple(content),
            stop_reason=self.stop_reason,
            usage=Usage(input_tokens=42, output_tokens=31),
            stop_details=self.stop_details,
        )


@dataclass(frozen=True)
class GoldenCase:
    """One synthetic ticket, mock response script, and deterministic expected result."""

    identifier: str
    ticket_id: str
    ticket_text: str
    trust_level: TicketTrustLevel
    responses: tuple[ResponseFixture, ...]
    expected: ExpectedAssertions
    approval_decisions: dict[str, bool]
    max_turns: int
    seeded_failure: FailureMode | None
    known_secrets: tuple[str, ...]


def load_golden_cases(path: Path = GOLDEN_SET_PATH) -> tuple[GoldenCase, ...]:
    """Load and validate the checked-in YAML fixtures in stable file order."""
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(loaded, Mapping) or not isinstance(loaded.get("cases"), list):
        raise ValueError("Golden set must be a mapping containing a 'cases' list")
    cases = tuple(_parse_case(raw) for raw in loaded["cases"])
    identifiers = [case.identifier for case in cases]
    if len(identifiers) < 12:
        raise ValueError("Golden set must contain at least 12 cases")
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("Golden case identifiers must be unique")
    return cases


def _parse_case(raw: object) -> GoldenCase:
    """Validate the small YAML schema before the runner receives a case."""
    if not isinstance(raw, Mapping):
        raise ValueError("Each golden case must be a mapping")
    ticket = _mapping(raw.get("ticket"), "ticket")
    expected = _mapping(raw.get("expected"), "expected")
    responses_raw = raw.get("responses", [])
    if not isinstance(responses_raw, list):
        raise ValueError("Golden case responses must be a list")
    approval_raw = raw.get("approval_decisions", {})
    if not isinstance(approval_raw, Mapping):
        raise ValueError("approval_decisions must be a mapping")
    secrets_raw = raw.get("known_secrets", [])
    if not isinstance(secrets_raw, list) or not all(isinstance(item, str) for item in secrets_raw):
        raise ValueError("known_secrets must be a list of strings")
    return GoldenCase(
        identifier=_string(raw.get("id"), "id"),
        ticket_id=_string(ticket.get("id"), "ticket.id"),
        ticket_text=_string(ticket.get("submitted_text"), "ticket.submitted_text"),
        trust_level=TicketTrustLevel(_string(raw.get("trust_level", "untrusted"), "trust_level")),
        responses=tuple(_parse_response(item) for item in responses_raw),
        expected=_parse_expected(expected),
        approval_decisions={
            _string(key, "approval_decisions key"): _bool(value, "approval_decisions value")
            for key, value in approval_raw.items()
        },
        max_turns=_positive_int(raw.get("max_turns", 5), "max_turns"),
        seeded_failure=_optional_failure(raw.get("seeded_failure")),
        known_secrets=tuple(secrets_raw),
    )


def _parse_response(raw: object) -> ResponseFixture:
    """Validate a recorded response without assuming SDK-only response fields."""
    mapping = _mapping(raw, "response")
    content_raw = mapping.get("content", [])
    if not isinstance(content_raw, list):
        raise ValueError("response.content must be a list")
    content = tuple(_mapping(block, "response content block") for block in content_raw)
    stop_details = mapping.get("stop_details")
    if stop_details is not None:
        stop_details = _mapping(stop_details, "response.stop_details")
    return ResponseFixture(
        stop_reason=_string(mapping.get("stop_reason"), "response.stop_reason"),
        content=content,
        stop_details=stop_details,
    )


def _parse_expected(raw: Mapping[str, Any]) -> ExpectedAssertions:
    """Parse every field that the deterministic grader must compare."""
    return ExpectedAssertions(
        category=_optional_string(raw.get("category"), "expected.category"),
        severity=_optional_string(raw.get("severity"), "expected.severity"),
        needs_human=_bool(raw.get("needs_human"), "expected.needs_human"),
        assert_model_output=_bool(
            raw.get("assert_model_output", True), "expected.assert_model_output"
        ),
        tools_called=_string_tuple(raw.get("tools_called", []), "expected.tools_called"),
        tools_denied=_string_tuple(raw.get("tools_denied", []), "expected.tools_denied"),
        failure_mode=_optional_failure(raw.get("failure_mode")),
    )


def _mapping(value: object, name: str) -> dict[str, Any]:
    """Copy a string-keyed YAML mapping or explain the invalid fixture field."""
    if not isinstance(value, Mapping) or not all(isinstance(key, str) for key in value):
        raise ValueError(f"{name} must be a string-keyed mapping")
    return dict(value)


def _string(value: object, name: str) -> str:
    """Return a non-empty string fixture value."""
    if not isinstance(value, str) or not value:
        raise ValueError(f"{name} must be a non-empty string")
    return value


def _optional_string(value: object, name: str) -> str | None:
    """Return a nullable string fixture assertion."""
    if value is None:
        return None
    return _string(value, name)


def _optional_text(value: object) -> str | None:
    """Accept only the text type accepted by the normalised content block."""
    if value is None or isinstance(value, str):
        return value
    raise ValueError("response text must be a string or null")


def _bool(value: object, name: str) -> bool:
    """Reject YAML truthy values that are not actual booleans."""
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be a boolean")
    return value


def _positive_int(value: object, name: str) -> int:
    """Return a positive integer without accepting boolean fixture values."""
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ValueError(f"{name} must be a positive integer")
    return value


def _string_tuple(value: object, name: str) -> tuple[str, ...]:
    """Convert a YAML string list into an immutable grader expectation."""
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValueError(f"{name} must be a list of strings")
    return tuple(value)


def _optional_failure(value: object) -> FailureMode | None:
    """Parse a nullable taxonomy identifier from a fixture assertion."""
    if value is None:
        return None
    return FailureMode(_string(value, "failure_mode"))
