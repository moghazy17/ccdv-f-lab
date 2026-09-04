"""Structured triage output validation and defensive response parsing.

Demonstrates the blueprint sub-skills ``Output Handling`` and ``Debugging and Error Handling``. See
``notes/06-prompt-and-context-engineering/`` and ``notes/04-eval-testing-and-debugging/`` for the
associated study notes.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from jsonschema import Draft202012Validator

from lab.transport import NormalisedResponse

TRIAGE_RESULT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["category", "severity", "suggested_action", "confidence", "needs_human"],
    "properties": {
        "category": {"type": "string", "minLength": 1},
        "severity": {"type": "string", "minLength": 1},
        "suggested_action": {"type": "string", "minLength": 1},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "needs_human": {"type": "boolean"},
    },
}


@dataclass(frozen=True)
class TriageResult:
    """A validated ticket classification returned from the model's structured output."""

    category: str
    severity: str
    suggested_action: str
    confidence: float
    needs_human: bool


@dataclass(frozen=True)
class TriageValidation:
    """Validation state a caller can use to route safely without trusting model confidence alone.

    This embodies skepticism toward confident output: route to a person whenever validation fails or
    ``needs_human`` is true, rather than deciding solely from the model's self-reported confidence.
    """

    result: TriageResult | None
    errors: tuple[str, ...]
    stop_reason: str
    refusal_details: dict[str, Any] | None = None

    @property
    def is_valid(self) -> bool:
        """Return whether a complete payload passed the schema and response checks."""
        return self.result is not None and not self.errors

    @property
    def should_route_to_human(self) -> bool:
        """Route on validation status and ``needs_human``, never on confidence alone."""
        return not self.is_valid or self.result.needs_human


def structured_output_config() -> dict[str, Any]:
    """Return the current ``output_config.format`` request shape for the triage JSON schema."""
    return {"format": {"type": "json_schema", "schema": TRIAGE_RESULT_SCHEMA}}


def validate_triage_payload(payload: Any, *, stop_reason: str = "end_turn") -> TriageValidation:
    """Validate one decoded payload and retain readable errors instead of coercing model output."""
    validator = Draft202012Validator(TRIAGE_RESULT_SCHEMA)
    errors = tuple(
        _format_schema_error(error)
        for error in sorted(validator.iter_errors(payload), key=_error_sort_key)
    )
    if errors:
        return TriageValidation(result=None, errors=errors, stop_reason=stop_reason)
    assert isinstance(payload, dict)
    return TriageValidation(
        result=TriageResult(
            category=payload["category"],
            severity=payload["severity"],
            suggested_action=payload["suggested_action"],
            confidence=float(payload["confidence"]),
            needs_human=payload["needs_human"],
        ),
        errors=(),
        stop_reason=stop_reason,
    )


def parse_triage_response(response: NormalisedResponse) -> TriageValidation:
    """Parse only a complete text response and handle each supported stop reason explicitly."""
    if response.stop_reason == "max_tokens":
        return TriageValidation(
            result=None,
            errors=("Response was truncated because stop_reason was 'max_tokens'.",),
            stop_reason=response.stop_reason,
        )
    if response.stop_reason == "tool_use":
        return TriageValidation(
            result=None,
            errors=("Response requested tool use; this lab foundation does not execute tools.",),
            stop_reason=response.stop_reason,
        )
    if response.stop_reason == "refusal":
        details = dict(response.stop_details) if response.stop_details is not None else None
        return TriageValidation(
            result=None,
            errors=("Response was refused by the model.",),
            stop_reason=response.stop_reason,
            refusal_details=details,
        )
    if response.stop_reason != "end_turn":
        return TriageValidation(
            result=None,
            errors=(f"Unsupported stop reason: {response.stop_reason!r}.",),
            stop_reason=response.stop_reason,
        )

    text_blocks = [
        block.text for block in response.content if block.type == "text" and block.text is not None
    ]
    if len(text_blocks) != 1:
        return TriageValidation(
            result=None,
            errors=("Expected exactly one text content block in a completed response.",),
            stop_reason=response.stop_reason,
        )
    try:
        payload = json.loads(text_blocks[0])
    except json.JSONDecodeError as error:
        return TriageValidation(
            result=None,
            errors=(f"Response text is not valid JSON: {error.msg}.",),
            stop_reason=response.stop_reason,
        )
    return validate_triage_payload(payload, stop_reason=response.stop_reason)


def _error_sort_key(error: Any) -> list[str]:
    """Sort schema failures predictably by their JSON location."""
    return [str(part) for part in error.absolute_path]


def _format_schema_error(error: Any) -> str:
    """Render a schema error with its field path when available."""
    location = ".".join(str(part) for part in error.absolute_path) or "payload"
    return f"{location}: {error.message}"
