"""Strict custom-tool definitions and one-turn result batching for ticket triage.

Demonstrates the blueprint sub-skill ``Tool Implementation``. See
``notes/08-tools-and-mcps/`` for the associated study notes.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any

from jsonschema import Draft202012Validator

from lab.tools.fixtures import TriageFixture, lookup_customer_record, search_knowledge_base

ToolDefinition = dict[str, Any]
ApprovalDecisions = Mapping[str, bool]


TOOL_DEFINITIONS: tuple[ToolDefinition, ...] = (
    # Names query and count units, output scope, and exclusions so the model selects it for
    # research.
    {
        "name": "search_kb",
        "description": (
            "Use this read-only tool to find support knowledge-base excerpts when a ticket needs "
            "documented troubleshooting or policy guidance. Provide query as a plain-text phrase "
            "and limit as a count from 1 through 5. It returns matching article IDs, titles, and "
            "short excerpts; it does not retrieve full articles, customer data, or change a "
            "ticket. "
            "Do not use it when an exact customer record is required."
        ),
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["query", "limit"],
            "properties": {
                "query": {"type": "string", "minLength": 1},
                "limit": {"type": "integer", "minimum": 1, "maximum": 5},
            },
        },
        "strict": True,
        "requires_approval": False,
    },
    # Names the identifier format and deliberately narrow record fields to prevent a vague data
    # lookup.
    {
        "name": "lookup_customer",
        "description": (
            "Use this read-only tool when triage needs the plan tier and current number of open "
            "tickets for one known customer. Provide customer_id in the customer-### format. It "
            "returns only the ID, plan tier, and open-ticket count; it does not search by name, "
            "return contact details, or modify customer records. Do not use it to create a "
            "follow-up."
        ),
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["customer_id"],
            "properties": {"customer_id": {"type": "string", "minLength": 1}},
        },
        "strict": True,
        "requires_approval": False,
    },
    # Makes the human approval precondition and one recorded side effect explicit before the model
    # acts.
    {
        "name": "create_followup",
        "description": (
            "Use this write tool only after an explicit human approval to create a follow-up for "
            "an "
            "existing ticket. Provide ticket_id in the ticket-### format, a concise summary in "
            "plain text, and assignee as a team or person identifier. It creates one follow-up and "
            "returns its ID and status; it does not change ticket priority or escalate the ticket. "
            "Do not use it merely to suggest a next step."
        ),
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["ticket_id", "summary", "assignee"],
            "properties": {
                "ticket_id": {"type": "string", "minLength": 1},
                "summary": {"type": "string", "minLength": 1},
                "assignee": {"type": "string", "minLength": 1},
            },
        },
        "strict": True,
        "requires_approval": True,
    },
    # Distinguishes this approved escalation side effect from follow-up creation and routine
    # diagnosis.
    {
        "name": "escalate_ticket",
        "description": (
            "Use this write tool only after an explicit human approval when an existing ticket "
            "must "
            "be escalated. Provide ticket_id in the ticket-### format and reason as a concise "
            "plain-text justification. It records an escalation and returns the resulting status; "
            "it does not create a follow-up, contact the customer, or resolve the ticket. Do not "
            "use it for routine troubleshooting."
        ),
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["ticket_id", "reason"],
            "properties": {
                "ticket_id": {"type": "string", "minLength": 1},
                "reason": {"type": "string", "minLength": 1},
            },
        },
        "strict": True,
        "requires_approval": True,
    },
)

_DEFINITIONS_BY_NAME = {definition["name"]: definition for definition in TOOL_DEFINITIONS}


def dispatch_tool_uses(
    assistant_message: Mapping[str, Any],
    *,
    approval_decisions: ApprovalDecisions | None = None,
    fixture: TriageFixture | None = None,
) -> dict[str, Any]:
    """Execute every tool-use block and return all corresponding results in one user message.

    A provider can put parallel tool calls in one assistant response. Results must remain in one
    user turn: splitting them into several user messages teaches the model to stop making parallel
    calls. Handler and validation failures become ``is_error`` results so no tool-use ID is dropped.
    """
    resolved_fixture = TriageFixture() if fixture is None else fixture
    decisions = {} if approval_decisions is None else approval_decisions
    try:
        content = assistant_message.get("content", ())
    except AttributeError:
        content = ()

    if not _is_block_sequence(content):
        return _result_batch(
            [
                _tool_result(
                    "unknown-tool-use", "Assistant tool-use content must be a list.", is_error=True
                )
            ]
        )

    results = [
        _dispatch_one(block, decisions, resolved_fixture)
        for block in content
        if isinstance(block, Mapping) and block.get("type") == "tool_use"
    ]
    return _result_batch(results)


def _dispatch_one(
    tool_use: Mapping[str, Any],
    approval_decisions: ApprovalDecisions,
    fixture: TriageFixture,
) -> dict[str, Any]:
    """Return one result for one tool use, converting every dispatch-path failure into an error."""
    tool_use_id = str(tool_use.get("id", "missing-tool-use-id"))
    try:
        name = tool_use.get("name")
        if not isinstance(name, str):
            return _tool_result(
                tool_use_id, "Tool use is missing a string tool name.", is_error=True
            )
        definition = _DEFINITIONS_BY_NAME.get(name)
        if definition is None:
            return _tool_result(
                tool_use_id,
                f"Tool {name!r} is not available. Choose one of: {_available_tool_names()}.",
                is_error=True,
            )

        arguments = tool_use.get("input")
        if not isinstance(arguments, Mapping):
            return _tool_result(tool_use_id, "Tool input must be a JSON object.", is_error=True)
        validation_errors = _validation_errors(definition["input_schema"], arguments)
        if validation_errors:
            return _tool_result(
                tool_use_id,
                f"Tool input is invalid: {validation_errors[0]}. Correct the input and retry.",
                is_error=True,
            )

        if definition["requires_approval"]:
            approval = approval_decisions.get(tool_use_id)
            if approval is not True:
                state = "denied" if approval is False else "missing"
                return _tool_result(
                    tool_use_id,
                    (
                        f"Approval {state} for write tool {name!r}. Ask for explicit human "
                        "approval "
                        f"and pass approval_decisions[{tool_use_id!r}] = True before retrying."
                    ),
                    is_error=True,
                )

        result = _call_handler(name, arguments, fixture)
        return _tool_result(tool_use_id, json.dumps(result, sort_keys=True))
    except Exception as error:
        return _tool_result(
            tool_use_id,
            f"{type(error).__name__}: {error}. Check the arguments and retry if appropriate.",
            is_error=True,
        )


def _call_handler(
    name: str, arguments: Mapping[str, Any], fixture: TriageFixture
) -> dict[str, object]:
    """Map a validated tool name to its local handler without a network dependency."""
    if name == "search_kb":
        return {
            "query": arguments["query"],
            "excerpts": search_knowledge_base(arguments["query"], arguments["limit"]),
        }
    if name == "lookup_customer":
        return lookup_customer_record(arguments["customer_id"])
    if name == "create_followup":
        return fixture.create_followup(
            arguments["ticket_id"], arguments["summary"], arguments["assignee"]
        )
    if name == "escalate_ticket":
        return fixture.escalate_ticket(arguments["ticket_id"], arguments["reason"])
    raise RuntimeError(f"No handler is registered for {name!r}.")


def _validation_errors(schema: Mapping[str, Any], arguments: Mapping[str, Any]) -> tuple[str, ...]:
    """Validate direct dispatcher calls even though strict mode validates model tool input."""
    validator = Draft202012Validator(schema)
    return tuple(error.message for error in validator.iter_errors(dict(arguments)))


def _tool_result(tool_use_id: str, content: str, *, is_error: bool = False) -> dict[str, Any]:
    """Build the result shape that keeps every requested tool use correlated to its response."""
    return {
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "content": content,
        "is_error": is_error,
    }


def _result_batch(results: list[dict[str, Any]]) -> dict[str, Any]:
    """Place every tool result from an assistant turn into its sole following user message."""
    return {"role": "user", "content": results}


def _is_block_sequence(value: object) -> bool:
    """Accept provider content arrays while rejecting a string, which is also a sequence."""
    return isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray))


def _available_tool_names() -> str:
    """Render available tool names in a deterministic recovery message."""
    return ", ".join(definition["name"] for definition in TOOL_DEFINITIONS)
