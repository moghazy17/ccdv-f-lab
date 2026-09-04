"""Tests for structured triage output validation and defensive parsing."""

from __future__ import annotations

import copy
import json

from lab.output import (
    parse_triage_response,
    structured_output_config,
    validate_triage_payload,
)
from lab.transport import ContentBlock, NormalisedResponse, Usage

GOOD_PAYLOAD = {
    "category": "account_access",
    "severity": "medium",
    "suggested_action": "Verify the account recovery details.",
    "confidence": 0.72,
    "needs_human": False,
}


def response_for(payload: object, *, stop_reason: str = "end_turn") -> NormalisedResponse:
    """Build a normalised text response without involving a provider SDK."""
    return NormalisedResponse(
        content=(ContentBlock(type="text", text=json.dumps(payload)),),
        stop_reason=stop_reason,
        usage=Usage(),
    )


def test_schema_accepts_a_good_payload_and_uses_output_config_format() -> None:
    """A complete payload passes, using the current output_config.format request location."""
    validation = validate_triage_payload(GOOD_PAYLOAD)
    output_config = structured_output_config()

    assert validation.is_valid
    assert validation.result is not None
    assert not validation.should_route_to_human
    assert "format" in output_config
    assert "output_format" not in output_config


def test_schema_rejects_malformed_shapes() -> None:
    """Missing, extra, non-object, wrongly typed, and out-of-range fields all fail validation."""
    malformed: list[object] = [[], {**GOOD_PAYLOAD, "unexpected": "field"}]
    for field in GOOD_PAYLOAD:
        payload = copy.deepcopy(GOOD_PAYLOAD)
        payload.pop(field)
        malformed.append(payload)
    malformed.extend(
        [
            {**GOOD_PAYLOAD, "category": ""},
            {**GOOD_PAYLOAD, "severity": 3},
            {**GOOD_PAYLOAD, "suggested_action": None},
            {**GOOD_PAYLOAD, "confidence": "certain"},
            {**GOOD_PAYLOAD, "confidence": 1.1},
            {**GOOD_PAYLOAD, "needs_human": "false"},
        ]
    )

    for payload in malformed:
        validation = validate_triage_payload(payload)
        assert not validation.is_valid, payload
        assert validation.should_route_to_human


def test_parser_iterates_content_and_rejects_non_text_completed_responses() -> None:
    """Parser success comes from a text block, not an assumption about response content layout."""
    valid = parse_triage_response(response_for(GOOD_PAYLOAD))
    no_text = parse_triage_response(
        NormalisedResponse(
            content=(ContentBlock(type="thinking", text=None),),
            stop_reason="end_turn",
            usage=Usage(),
        )
    )

    assert valid.is_valid
    assert not no_text.is_valid
    assert "text content block" in no_text.errors[0]


def test_parser_handles_truncation_refusal_and_tool_use_explicitly() -> None:
    """Incomplete, refused, and tool-use responses are invalid and remain human-routed."""
    truncated = parse_triage_response(response_for(GOOD_PAYLOAD, stop_reason="max_tokens"))
    refused = parse_triage_response(
        NormalisedResponse(
            content=(ContentBlock(type="text", text="No."),),
            stop_reason="refusal",
            usage=Usage(),
            stop_details={"reason": "safety"},
        )
    )
    tool_request = parse_triage_response(response_for(GOOD_PAYLOAD, stop_reason="tool_use"))

    assert not truncated.is_valid
    assert "truncated" in truncated.errors[0]
    assert not refused.is_valid
    assert refused.refusal_details == {"reason": "safety"}
    assert not tool_request.is_valid
    assert "does not execute tools" in tool_request.errors[0]
