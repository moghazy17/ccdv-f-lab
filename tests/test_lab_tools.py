"""Tests for strict schemas, batched tool results, failures, and approval-gated writes."""

from __future__ import annotations

import json
from typing import Any

from jsonschema import Draft202012Validator

from lab.tools import TOOL_DEFINITIONS, TriageFixture, dispatch_tool_uses


def tool_use(identifier: str, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Build one provider-shaped tool-use content block for dispatcher tests."""
    return {"type": "tool_use", "id": identifier, "name": name, "input": arguments}


def test_every_tool_definition_uses_closed_strict_schema() -> None:
    """Custom tools use top-level strict mode with a valid closed schema and required set."""
    assert {definition["name"] for definition in TOOL_DEFINITIONS} == {
        "search_kb",
        "lookup_customer",
        "create_followup",
        "escalate_ticket",
    }
    for definition in TOOL_DEFINITIONS:
        schema = definition["input_schema"]
        Draft202012Validator.check_schema(schema)
        assert definition["strict"] is True
        assert schema["additionalProperties"] is False
        assert set(schema["required"]) == set(schema["properties"])


def test_dispatcher_batches_parallel_tool_uses_into_one_user_message() -> None:
    """Several tool uses in one assistant turn produce ordered results in exactly one user turn."""
    assistant_message = {
        "role": "assistant",
        "content": [
            {"type": "text", "text": "I will check both sources."},
            tool_use("toolu-kb", "search_kb", {"query": "password recovery", "limit": 2}),
            tool_use("toolu-customer", "lookup_customer", {"customer_id": "customer-100"}),
        ],
    }

    batch = dispatch_tool_uses(assistant_message)

    assert batch["role"] == "user"
    assert len(batch["content"]) == 2
    assert [result["tool_use_id"] for result in batch["content"]] == ["toolu-kb", "toolu-customer"]
    assert all(result["type"] == "tool_result" for result in batch["content"])
    assert all(result["is_error"] is False for result in batch["content"])
    assert json.loads(batch["content"][0]["content"])["excerpts"]
    assert json.loads(batch["content"][1]["content"])["plan_tier"] == "team"


def test_failing_tool_returns_an_actionable_error_result() -> None:
    """An unavailable tool is correlated to its call instead of raising or being omitted."""
    batch = dispatch_tool_uses(
        {"role": "assistant", "content": [tool_use("toolu-bad", "not_a_tool", {})]}
    )

    assert len(batch["content"]) == 1
    result = batch["content"][0]
    assert result["tool_use_id"] == "toolu-bad"
    assert result["is_error"] is True
    assert "not available" in result["content"]


def test_handler_failure_returns_an_actionable_error_result() -> None:
    """A known tool's data failure is returned to the model instead of crossing the dispatcher."""
    batch = dispatch_tool_uses(
        {
            "role": "assistant",
            "content": [
                tool_use("toolu-customer", "lookup_customer", {"customer_id": "customer-999"})
            ],
        }
    )

    result = batch["content"][0]
    assert result["tool_use_id"] == "toolu-customer"
    assert result["is_error"] is True
    assert "No customer exists" in result["content"]


def test_write_tool_requires_approval_and_executes_after_approval() -> None:
    """Missing or denied approval has no side effect, while an explicit true decision permits it."""
    fixture = TriageFixture()
    request = {
        "role": "assistant",
        "content": [
            tool_use(
                "toolu-followup",
                "create_followup",
                {
                    "ticket_id": "ticket-100",
                    "summary": "Confirm account recovery details.",
                    "assignee": "support-tier-2",
                },
            )
        ],
    }

    missing = dispatch_tool_uses(request, fixture=fixture)
    denied = dispatch_tool_uses(
        request,
        approval_decisions={"toolu-followup": False},
        fixture=fixture,
    )
    approved = dispatch_tool_uses(
        request,
        approval_decisions={"toolu-followup": True},
        fixture=fixture,
    )

    assert missing["content"][0]["is_error"] is True
    assert "Approval missing" in missing["content"][0]["content"]
    assert denied["content"][0]["is_error"] is True
    assert "Approval denied" in denied["content"][0]["content"]
    assert len(fixture.followups) == 1
    assert approved["content"][0]["is_error"] is False
    assert json.loads(approved["content"][0]["content"])["status"] == "created"
