"""Tests for explainable task routing and transport-compatible thinking configuration."""

from __future__ import annotations

from lab.config import CLASSIFY_MODEL, DRAFT_MODEL, ESCALATE_MODEL
from lab.router import route_task


def test_each_task_routes_to_its_pinned_model_with_a_reason() -> None:
    """Classification, drafting, and escalation retain their distinct cost-quality tradeoffs."""
    classification = route_task("classification")
    drafting = route_task("drafting")
    escalation = route_task("escalation")

    assert classification.model == CLASSIFY_MODEL
    assert classification.reason
    assert classification.thinking.budget_tokens == 1_024
    assert drafting.model == DRAFT_MODEL
    assert drafting.reason
    assert drafting.thinking.budget_tokens is None
    assert escalation.model == ESCALATE_MODEL
    assert escalation.reason
    assert escalation.thinking.budget_tokens is None
