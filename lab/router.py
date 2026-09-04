"""Explainable task routing across the explicitly pinned triage models.

Demonstrates the blueprint sub-skills ``LLM Fundamentals`` and ``Model Selection and Tradeoffs``.
See ``notes/05-model-selection-and-optimization/`` for the associated study notes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from lab.config import CLASSIFY_MODEL, DRAFT_MODEL, ESCALATE_MODEL
from lab.transport import ADAPTIVE_THINKING_MODELS, ThinkingConfig

TaskType = Literal["classification", "drafting", "escalation"]


@dataclass(frozen=True)
class RouteDecision:
    """A selected model, the tradeoff rationale, and compatible thinking configuration."""

    task_type: TaskType
    model: str
    reason: str
    thinking: ThinkingConfig


def route_task(task_type: TaskType, *, max_tokens: int = 2_048) -> RouteDecision:
    """Select a pinned model for a task and make its quality, latency, and cost rationale visible.

    Thinking configuration reuses the model grouping owned by ``lab.transport``. Sonnet and Opus
    use adaptive thinking; Haiku uses a budget strictly below ``max_tokens`` as validated by that
    transport before a live request is sent.
    """
    if max_tokens < 1_025:
        raise ValueError("max_tokens must be at least 1025 when routing thinking-enabled tasks")
    if task_type == "classification":
        model = CLASSIFY_MODEL
        reason = "Classification uses the Haiku pin to favour low latency and lower cost."
    elif task_type == "drafting":
        model = DRAFT_MODEL
        reason = "Drafting uses the Sonnet pin to balance response quality with latency and cost."
    elif task_type == "escalation":
        model = ESCALATE_MODEL
        reason = (
            "Escalation uses the Opus pin when the quality requirement outweighs cost and latency."
        )
    else:
        raise ValueError(f"Unsupported triage task type: {task_type!r}")
    return RouteDecision(
        task_type=task_type,
        model=model,
        reason=reason,
        thinking=_thinking_for_model(model, max_tokens=max_tokens),
    )


def _thinking_for_model(model: str, *, max_tokens: int) -> ThinkingConfig:
    """Use transport's adaptive-model membership and its bounded Haiku request representation."""
    if model in ADAPTIVE_THINKING_MODELS:
        return ThinkingConfig()
    if model == CLASSIFY_MODEL:
        return ThinkingConfig(budget_tokens=min(1_024, max_tokens - 1))
    raise ValueError(f"No thinking configuration exists for unpinned model: {model!r}")
