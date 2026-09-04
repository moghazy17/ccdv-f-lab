"""Failure classification and recovery choices for deterministic triage evals.

Demonstrates the blueprint sub-skill ``Debugging and Error Handling``. This harness assigns SDK
connection and rate-limit exceptions to ``integration``: the app owns the transport boundary and
its retry behavior, even when a remote service causes the exception. Integration failures are
usually retryable or defects to fix; model failures call for a changed prompt or model, or a human.
Misattributing one origin to the other is the debugging error this taxonomy is designed to prevent.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Iterable

from lab.evals.tracing import Origin, TraceRecord


class RecoveryStrategy(StrEnum):
    """The bounded recovery actions exercised by the eval harness."""

    RETRY_WITH_BACKOFF = "retry_with_backoff"
    REPROMPT = "re_prompt"
    ESCALATE_TO_HUMAN = "escalate_to_human"
    FAIL_CLOSED = "fail_closed"
    PRUNE_AND_RETRY = "prune_and_retry"


class FailureMode(StrEnum):
    """The app-specific failures that traces can classify deterministically."""

    TRANSPORT_ERROR = "transport_error"
    RATE_LIMIT = "rate_limit"
    REFUSAL = "refusal"
    TRUNCATION = "truncation"
    MALFORMED_STRUCTURED_OUTPUT = "malformed_structured_output"
    WRONG_CLASSIFICATION = "wrong_classification"
    SCHEMA_INVALID_TOOL_INPUT = "schema_invalid_tool_input"
    TOOL_EXECUTION_FAILURE = "tool_execution_failure"
    APPROVAL_DENIED = "approval_denied"
    LEAST_PRIVILEGE_DENIAL = "least_privilege_denial"
    INJECTION_ATTEMPT_DETECTED = "injection_attempt_detected"
    TURN_CEILING_REACHED = "turn_ceiling_reached"
    CONTEXT_OVERFLOW = "context_overflow"


@dataclass(frozen=True)
class FailureDefinition:
    """The origin and explicit safe recovery for one failure mode."""

    origin: Origin
    recovery: RecoveryStrategy


FAILURE_TAXONOMY: dict[FailureMode, FailureDefinition] = {
    FailureMode.TRANSPORT_ERROR: FailureDefinition(
        Origin.INTEGRATION, RecoveryStrategy.RETRY_WITH_BACKOFF
    ),
    FailureMode.RATE_LIMIT: FailureDefinition(
        Origin.INTEGRATION, RecoveryStrategy.RETRY_WITH_BACKOFF
    ),
    FailureMode.REFUSAL: FailureDefinition(Origin.MODEL, RecoveryStrategy.ESCALATE_TO_HUMAN),
    FailureMode.TRUNCATION: FailureDefinition(Origin.MODEL, RecoveryStrategy.REPROMPT),
    FailureMode.MALFORMED_STRUCTURED_OUTPUT: FailureDefinition(
        Origin.MODEL, RecoveryStrategy.REPROMPT
    ),
    FailureMode.WRONG_CLASSIFICATION: FailureDefinition(Origin.MODEL, RecoveryStrategy.REPROMPT),
    FailureMode.SCHEMA_INVALID_TOOL_INPUT: FailureDefinition(
        Origin.INTEGRATION, RecoveryStrategy.REPROMPT
    ),
    FailureMode.TOOL_EXECUTION_FAILURE: FailureDefinition(
        Origin.INTEGRATION, RecoveryStrategy.RETRY_WITH_BACKOFF
    ),
    FailureMode.APPROVAL_DENIED: FailureDefinition(
        Origin.INTEGRATION, RecoveryStrategy.FAIL_CLOSED
    ),
    FailureMode.LEAST_PRIVILEGE_DENIAL: FailureDefinition(
        Origin.INTEGRATION, RecoveryStrategy.FAIL_CLOSED
    ),
    FailureMode.INJECTION_ATTEMPT_DETECTED: FailureDefinition(
        Origin.INTEGRATION, RecoveryStrategy.FAIL_CLOSED
    ),
    FailureMode.TURN_CEILING_REACHED: FailureDefinition(
        Origin.INTEGRATION, RecoveryStrategy.PRUNE_AND_RETRY
    ),
    FailureMode.CONTEXT_OVERFLOW: FailureDefinition(
        Origin.INTEGRATION, RecoveryStrategy.PRUNE_AND_RETRY
    ),
}


def recovery_for(failure_mode: FailureMode) -> RecoveryStrategy:
    """Return the recovery strategy explicitly assigned to one taxonomy member."""
    return FAILURE_TAXONOMY[failure_mode].recovery


def classify_trace(records: Iterable[TraceRecord]) -> FailureMode | None:
    """Classify the latest origin-consistent failure visible in an observed trace.

    Runner events use the taxonomy value as their outcome. The fallback recognizers make traces
    from the ordinary parser and transport exceptions useful even when an event was not pre-labeled.
    A matching outcome with the wrong origin is intentionally ignored instead of silently changing
    the attribution.
    """
    trace = tuple(records)
    for record in reversed(trace):
        failure = _failure_from_record(record)
        if failure is not None and FAILURE_TAXONOMY[failure].origin is record.origin:
            return failure
    return None


def _failure_from_record(record: TraceRecord) -> FailureMode | None:
    """Map a single stage record to a taxonomy member without inspecting provider-only fields."""
    try:
        return FailureMode(record.outcome)
    except ValueError:
        pass

    error = record.error or ""
    if "RateLimitedError" in error:
        return FailureMode.RATE_LIMIT
    if "TransportError" in error or "ProviderConnectionError" in error:
        return FailureMode.TRANSPORT_ERROR
    if "not valid JSON" in error or "Expected exactly one text" in error:
        return FailureMode.MALFORMED_STRUCTURED_OUTPUT
    return None
