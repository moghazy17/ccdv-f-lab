"""A bounded tool-use agent loop with an isolated research-subagent path.

Demonstrates the blueprint sub-skills ``Agent Construction with Claude``, ``Agent Patterns and
Frameworks``, ``Agent Architecture``, and ``Context Engineering``. See
``notes/01-agents-and-workflows/`` and ``notes/06-prompt-and-context-engineering/`` for the
associated study notes.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, replace
from typing import Any, Literal

from lab.security import UNTRUSTED_TOOL_POLICY, ToolExposurePolicy
from lab.tools import TriageFixture, dispatch_tool_uses
from lab.transport import (
    ContentBlock,
    Message,
    MockTransport,
    NormalisedRequest,
    NormalisedResponse,
    Transport,
)

LoopOutcome = Literal[
    "completed",
    "max_turns",
    "max_tokens",
    "refusal",
    "unsupported_stop_reason",
]


@dataclass(frozen=True)
class AgentLoopResult:
    """The terminal state and provider-shaped transcript of one bounded parent loop."""

    outcome: LoopOutcome
    turns: int
    transcript: tuple[dict[str, Any], ...]
    final_response: NormalisedResponse | None
    refusal_details: dict[str, Any] | None = None
    subagent_summary: str | None = None


@dataclass(frozen=True)
class SubagentResearchResult:
    """The bounded result owned by a research subagent, including its isolated transcript."""

    summary: str
    outcome: LoopOutcome
    turns: int
    transcript: tuple[dict[str, Any], ...]


def run_agent_loop(
    request: NormalisedRequest,
    *,
    transport: Transport | None = None,
    max_turns: int = 5,
    approval_decisions: Mapping[str, bool] | None = None,
    fixture: TriageFixture | None = None,
    tool_policy: ToolExposurePolicy = UNTRUSTED_TOOL_POLICY,
    deep_research_query: str | None = None,
    subagent_transport: Transport | None = None,
    subagent_max_turns: int = 3,
) -> AgentLoopResult:
    """Run a bounded parent loop and dispatch all tool uses through the shared dispatcher.

    The default transport is ``MockTransport``, so this entry point has no API-key or network
    requirement. A tool-use response is recorded as an assistant turn and is followed by exactly
    one user message containing every result returned from ``dispatch_tool_uses``.
    ``tool_policy`` defaults to the untrusted read-only capability set; human approval cannot add a
    capability the policy does not expose.

    When ``deep_research_query`` is supplied, its work is run in a separate request and transcript.
    The parent receives only the final summary as a user message; no intermediate subagent turn is
    copied into the parent's transcript.
    """
    if max_turns < 1:
        raise ValueError("max_turns must be at least 1")

    resolved_transport = MockTransport() if transport is None else transport
    transcript = [_message_to_mapping(message) for message in request.messages]
    messages = list(request.messages)
    subagent_summary: str | None = None

    if deep_research_query is not None:
        research = run_deep_knowledge_base_research(
            deep_research_query,
            request=request,
            transport=subagent_transport,
            max_turns=subagent_max_turns,
        )
        subagent_summary = research.summary
        summary_message = _subagent_summary_message(subagent_summary)
        transcript.append(summary_message)
        messages.append(_message_from_mapping(summary_message))

    current_request = replace(request, messages=tuple(messages))
    last_response: NormalisedResponse | None = None
    for turn in range(1, max_turns + 1):
        response = resolved_transport.send(current_request)
        last_response = response
        assistant_message = _assistant_message(response)
        transcript.append(assistant_message)

        if response.stop_reason == "end_turn":
            return AgentLoopResult(
                outcome="completed",
                turns=turn,
                transcript=tuple(transcript),
                final_response=response,
                subagent_summary=subagent_summary,
            )
        if response.stop_reason == "tool_use":
            tool_result_message = dispatch_tool_uses(
                assistant_message,
                approval_decisions=approval_decisions,
                fixture=fixture,
                tool_policy=tool_policy,
            )
            transcript.append(tool_result_message)
            messages.append(_message_from_mapping(tool_result_message))
            current_request = replace(request, messages=tuple(messages))
            continue
        if response.stop_reason == "max_tokens":
            return AgentLoopResult(
                outcome="max_tokens",
                turns=turn,
                transcript=tuple(transcript),
                final_response=response,
                subagent_summary=subagent_summary,
            )
        if response.stop_reason == "refusal":
            # The provider populates stop_details only for a refusal. Do not inspect it otherwise.
            refusal_details = (
                dict(response.stop_details) if response.stop_details is not None else None
            )
            return AgentLoopResult(
                outcome="refusal",
                turns=turn,
                transcript=tuple(transcript),
                final_response=response,
                refusal_details=refusal_details,
                subagent_summary=subagent_summary,
            )
        return AgentLoopResult(
            outcome="unsupported_stop_reason",
            turns=turn,
            transcript=tuple(transcript),
            final_response=response,
            subagent_summary=subagent_summary,
        )

    # The loop has no unbounded retry path: a tool-use response on the final allowed turn ends here.
    return AgentLoopResult(
        outcome="max_turns",
        turns=max_turns,
        transcript=tuple(transcript),
        final_response=last_response,
        subagent_summary=subagent_summary,
    )


def run_deep_knowledge_base_research(
    query: str,
    *,
    request: NormalisedRequest,
    transport: Transport | None = None,
    max_turns: int = 3,
) -> SubagentResearchResult:
    """Run bounded knowledge-base research in a request with no parent transcript.

    This function constructs a fresh system instruction and a single query message instead of
    accepting the parent's messages. That structural boundary makes context isolation testable:
    the parent can receive the returned summary, but cannot receive this function's transcript.
    """
    isolated_request = NormalisedRequest(
        model=request.model,
        max_tokens=request.max_tokens,
        system=(
            ContentBlock(
                type="text",
                text=(
                    "Research the support knowledge base for the supplied query. Use available "
                    "read-only research tools when needed, then provide a concise factual summary."
                ),
            ),
        ),
        messages=(
            Message(
                role="user",
                content=(ContentBlock(type="text", text=f"Knowledge-base query: {query}"),),
            ),
        ),
        output_config=request.output_config,
        thinking=request.thinking,
        effort=request.effort,
        scenario=request.scenario,
    )
    isolated_result = run_agent_loop(
        isolated_request,
        transport=transport,
        max_turns=max_turns,
    )
    return SubagentResearchResult(
        summary=_summarise_research(isolated_result),
        outcome=isolated_result.outcome,
        turns=isolated_result.turns,
        transcript=isolated_result.transcript,
    )


def _assistant_message(response: NormalisedResponse) -> dict[str, Any]:
    """Copy provider-neutral or provider-shaped content into the dispatcher input shape."""
    return {
        "role": "assistant",
        "content": [_content_to_mapping(block) for block in response.content],
    }


def _message_to_mapping(message: Message) -> dict[str, Any]:
    """Copy a normalised request message into the teaching transcript shape."""
    return {
        "role": message.role,
        "content": [_content_to_mapping(block) for block in message.content],
    }


def _content_to_mapping(block: object) -> dict[str, Any]:
    """Retain tool-use metadata supplied by a scripted keyless transport for dispatch."""
    if isinstance(block, Mapping):
        return dict(block)
    content: dict[str, Any] = {"type": str(getattr(block, "type", "unknown"))}
    text = getattr(block, "text", None)
    if text is not None:
        content["text"] = text
    for field in ("id", "name", "input"):
        value = getattr(block, field, None)
        if value is not None:
            content[field] = value
    return content


def _message_from_mapping(message: Mapping[str, Any]) -> Message:
    """Carry a dispatcher batch through the normalised request seam for keyless transports.

    ``NormalisedRequest`` intentionally validates roles, but its content is provider-shaped only
    at send time. Keeping the batch as blocks lets mock or test transports inspect the exact tool
    result correlation without creating a second dispatcher.
    """
    content = message.get("content", ())
    if not isinstance(content, list):
        raise ValueError("Tool-result content must be a list")
    return Message(role="user", content=tuple(content))  # type: ignore[arg-type]


def _subagent_summary_message(summary: str) -> dict[str, Any]:
    """Create the only subagent-derived parent turn: its final summary."""
    return {
        "role": "user",
        "content": [{"type": "text", "text": f"Research subagent summary:\n{summary}"}],
        "source": "isolated_subagent_summary",
    }


def _summarise_research(result: AgentLoopResult) -> str:
    """Return a bounded final summary without replaying private intermediate turns to the parent."""
    response = result.final_response
    if response is None:
        return f"Research stopped with outcome: {result.outcome}."
    text = " ".join(
        block.get("text", "")
        for block in _assistant_message(response)["content"]
        if block.get("type") == "text" and isinstance(block.get("text"), str)
    ).strip()
    if not text:
        return f"Research stopped with outcome: {result.outcome}."
    return text[:800]
