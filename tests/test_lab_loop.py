"""Keyless tests for bounded tool-use loops and isolated research subagents."""

from __future__ import annotations

import json
from dataclasses import dataclass

from lab.ingest import Ticket, assemble_triage_request
from lab.loop import run_agent_loop
from lab.transport import ContentBlock, NormalisedRequest, NormalisedResponse, Usage


@dataclass
class ScriptedTransport:
    """Return a finite response script while retaining every request sent by the loop."""

    responses: list[NormalisedResponse]

    def __post_init__(self) -> None:
        """Keep a separate request trace for assertions about loop state."""
        self.requests: list[NormalisedRequest] = []

    def send(self, request: NormalisedRequest) -> NormalisedResponse:
        """Record one request and return the next keyless scripted response."""
        self.requests.append(request)
        return self.responses.pop(0)


def response(
    stop_reason: str,
    content: tuple[object, ...] = (),
    *,
    stop_details: dict[str, str] | None = None,
) -> NormalisedResponse:
    """Build a provider-neutral response while allowing provider-shaped tool-use blocks in tests."""
    return NormalisedResponse(  # type: ignore[arg-type]
        content=content,
        stop_reason=stop_reason,
        usage=Usage(),
        stop_details=stop_details,
    )


def search_tool_use(identifier: str = "toolu-search") -> dict[str, object]:
    """Build a valid read-only dispatcher request."""
    return {
        "type": "tool_use",
        "id": identifier,
        "name": "search_kb",
        "input": {"query": "account recovery", "limit": 1},
    }


def request() -> NormalisedRequest:
    """Return a normal triage request without an API key or SDK client."""
    return assemble_triage_request(Ticket(id="ticket-100", submitted_text="Cannot sign in."))


def test_loop_terminates_on_end_turn() -> None:
    """A completed response exits after one provider call."""
    transport = ScriptedTransport([response("end_turn", (ContentBlock(type="text", text="done"),))])

    result = run_agent_loop(request(), transport=transport)

    assert result.outcome == "completed"
    assert result.turns == 1
    assert len(transport.requests) == 1


def test_loop_dispatches_tool_use_and_appends_one_batched_user_message() -> None:
    """Parallel-tool protocol stays in one dispatcher-produced user message on the next request."""
    transport = ScriptedTransport(
        [
            response("tool_use", (search_tool_use(),)),
            response("end_turn", (ContentBlock(type="text", text="complete"),)),
        ]
    )

    result = run_agent_loop(request(), transport=transport)

    batches = [
        message
        for message in result.transcript
        if message["role"] == "user"
        and any(block.get("type") == "tool_result" for block in message["content"])
    ]
    assert result.outcome == "completed"
    assert len(batches) == 1
    assert len(batches[0]["content"]) == 1
    assert batches[0]["content"][0]["tool_use_id"] == "toolu-search"
    assert len(transport.requests) == 2
    assert transport.requests[1].messages[-1].role == "user"
    assert len(transport.requests[1].messages[-1].content) == 1


def test_loop_enforces_the_turn_ceiling_after_recording_final_tool_results() -> None:
    """A continuing tool-use response cannot cause an unbounded agent loop."""
    transport = ScriptedTransport([response("tool_use", (search_tool_use(),))])

    result = run_agent_loop(request(), transport=transport, max_turns=1)

    assert result.outcome == "max_turns"
    assert result.turns == 1
    assert result.final_response is not None
    assert len(transport.requests) == 1
    assert any(
        block.get("type") == "tool_result"
        for message in result.transcript
        for block in message["content"]
    )


def test_loop_handles_max_tokens_and_refusal_without_assuming_stop_details() -> None:
    """Terminal response states remain distinct and refusal details stay guarded."""
    truncated = run_agent_loop(request(), transport=ScriptedTransport([response("max_tokens")]))
    refused = run_agent_loop(
        request(),
        transport=ScriptedTransport([response("refusal", stop_details={"reason": "safety"})]),
    )

    assert truncated.outcome == "max_tokens"
    assert truncated.refusal_details is None
    assert refused.outcome == "refusal"
    assert refused.refusal_details == {"reason": "safety"}


def test_subagent_intermediate_turns_do_not_leak_into_parent_transcript() -> None:
    """The parent sees only the research summary despite multiple private subagent turns."""
    subagent_transport = ScriptedTransport(
        [
            response(
                "tool_use",
                (
                    {"type": "text", "text": "private intermediate research turn"},
                    search_tool_use("toolu-private"),
                ),
            ),
            response("end_turn", (ContentBlock(type="text", text="Account recovery summary."),)),
        ]
    )
    parent_transport = ScriptedTransport(
        [response("end_turn", (ContentBlock(type="text", text="parent complete"),))]
    )

    result = run_agent_loop(
        request(),
        transport=parent_transport,
        deep_research_query="account recovery",
        subagent_transport=subagent_transport,
    )

    parent_transcript = json.dumps(result.transcript)
    assert "Account recovery summary." in parent_transcript
    assert "private intermediate research turn" not in parent_transcript
    assert result.subagent_summary == "Account recovery summary."
