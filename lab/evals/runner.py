"""Keyless CLI runner for triage golden evals and origin-aware debugging traces.

Demonstrates the blueprint sub-skill ``Debugging and Error Handling``. It runs synthetic fixtures
through ``MockTransport`` and reports integration-origin and model-origin failures separately.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from dataclasses import dataclass, replace
from typing import Any, Sequence

from lab.evals.failure_modes import FAILURE_TAXONOMY, FailureMode, classify_trace
from lab.evals.golden import GoldenCase, load_golden_cases
from lab.evals.tracing import Origin, TraceRecord, TraceRecorder, TraceStage
from lab.ingest import Ticket, assemble_triage_request
from lab.output import TriageValidation, parse_triage_response
from lab.security import TicketTrustLevel, build_ticket_guardrails
from lab.tools import TriageFixture, dispatch_tool_uses
from lab.transport import (
    Message,
    MockTransport,
    NormalisedRequest,
    NormalisedResponse,
    ProviderConnectionError,
    RateLimitedError,
    TransportError,
)


@dataclass(frozen=True)
class ActualOutcome:
    """The grader-visible result of one case, independent of its trace representation."""

    category: str | None
    severity: str | None
    needs_human: bool
    tools_called: tuple[str, ...]
    tools_denied: tuple[str, ...]
    failure_mode: FailureMode | None


@dataclass(frozen=True)
class EvalCaseResult:
    """One completed deterministic evaluation and the assertions it did not satisfy."""

    case: GoldenCase
    actual: ActualOutcome
    trace: tuple[TraceRecord, ...]
    assertion_errors: tuple[str, ...]

    @property
    def passed(self) -> bool:
        """Return whether every deterministic expected assertion matched."""
        return not self.assertion_errors


def run_case(case: GoldenCase) -> EvalCaseResult:
    """Execute one golden fixture through every triage layer without network access or a key."""
    recorder = TraceRecorder(known_secrets=case.known_secrets)
    ticket = _ingest_ticket(case, recorder)
    if ticket is None:
        return _finish(case, recorder, None, (), ())

    secured_ticket = _inspect_ticket(ticket, case.trust_level, recorder)
    request = assemble_triage_request(ticket)
    current_request = request
    fixture = TriageFixture()
    tools_called: list[str] = []
    tools_denied: list[str] = []
    last_response: NormalisedResponse | None = None
    response_index = 0
    turn = 0

    while response_index < len(case.responses):
        if turn >= case.max_turns:
            started_at = recorder.started_at()
            recorder.record(
                stage=TraceStage.MODEL_CALL,
                origin=Origin.INTEGRATION,
                inputs={"next_turn": turn + 1, "max_turns": case.max_turns},
                outcome=FailureMode.TURN_CEILING_REACHED.value,
                started_at=started_at,
                error="The configured turn ceiling prevented another model call.",
            )
            break

        response_fixture = case.responses[response_index]
        response_index += 1
        turn += 1
        response = _send_model_response(
            case,
            response_fixture.to_response(),
            current_request,
            turn,
            recorder,
        )
        if response is None:
            break
        last_response = response

        if response.stop_reason != "tool_use":
            break

        tool_message = _assistant_message(response)
        batch = dispatch_tool_uses(
            tool_message,
            approval_decisions=case.approval_decisions,
            fixture=fixture,
            tool_policy=secured_ticket.tool_policy,
        )
        requested_tools = [
            block
            for block in tool_message["content"]
            if isinstance(block, dict) and block.get("type") == "tool_use"
        ]
        tool_results = batch["content"]
        for tool_use, tool_result in zip(requested_tools, tool_results, strict=True):
            name = str(tool_use.get("name", "missing-tool-name"))
            tools_called.append(name)
            failure = _tool_failure(tool_result)
            if failure in {FailureMode.APPROVAL_DENIED, FailureMode.LEAST_PRIVILEGE_DENIAL}:
                tools_denied.append(name)
            started_at = recorder.started_at()
            recorder.record(
                stage=TraceStage.TOOL_DISPATCH,
                origin=FAILURE_TAXONOMY[failure].origin
                if failure is not None
                else Origin.INTEGRATION,
                inputs={"name": name, "input": tool_use.get("input", {})},
                outcome=failure.value if failure is not None else "completed",
                started_at=started_at,
                error=_result_error(tool_result),
            )
        current_request = _request_with_tool_results(current_request, batch)

    if (
        last_response is not None
        and response_index >= len(case.responses)
        and turn >= case.max_turns
    ):
        if last_response.stop_reason == "tool_use":
            started_at = recorder.started_at()
            recorder.record(
                stage=TraceStage.MODEL_CALL,
                origin=Origin.INTEGRATION,
                inputs={"next_turn": turn + 1, "max_turns": case.max_turns},
                outcome=FailureMode.TURN_CEILING_REACHED.value,
                started_at=started_at,
                error="The configured turn ceiling prevented another model call.",
            )

    validation = _validate_output(case, last_response, recorder)
    return _finish(case, recorder, validation, tuple(tools_called), tuple(tools_denied))


def run_golden_set() -> tuple[EvalCaseResult, ...]:
    """Run every checked-in golden case in file order."""
    return tuple(run_case(case) for case in load_golden_cases())


def failure_modes_exercised_by_origin(results: Sequence[EvalCaseResult]) -> dict[Origin, int]:
    """Count observed taxonomy modes, including modes correctly handled by passing cases."""
    counts: Counter[Origin] = Counter()
    for result in results:
        if result.actual.failure_mode is not None:
            counts[FAILURE_TAXONOMY[result.actual.failure_mode].origin] += 1
    return {origin: counts[origin] for origin in Origin}


def failed_cases_by_origin(results: Sequence[EvalCaseResult]) -> dict[Origin | None, int]:
    """Count broken assertions by classified origin, retaining unclassified gate failures too."""
    counts: Counter[Origin | None] = Counter()
    for result in results:
        if not result.passed:
            origin = (
                FAILURE_TAXONOMY[result.actual.failure_mode].origin
                if result.actual.failure_mode is not None
                else None
            )
            counts[origin] += 1
    return {origin: counts[origin] for origin in (*Origin, None)}


def format_report(results: Sequence[EvalCaseResult]) -> str:
    """Render separate build-gate failures and exercised taxonomy modes without conflating them."""
    lines = ["Triage golden eval report"]
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        mode = (
            result.actual.failure_mode.value if result.actual.failure_mode is not None else "none"
        )
        origin = (
            FAILURE_TAXONOMY[result.actual.failure_mode].origin.value
            if result.actual.failure_mode is not None
            else "none"
        )
        detail = (
            "; ".join(result.assertion_errors) if result.assertion_errors else "all assertions met"
        )
        lines.append(f"{status} {result.case.identifier}: failure={mode} origin={origin}; {detail}")
    failed_cases = failed_cases_by_origin(results)
    exercised_modes = failure_modes_exercised_by_origin(results)
    lines.extend(
        (
            f"Cases: {len(results)}; passed: {sum(result.passed for result in results)}; "
            f"failed: {sum(not result.passed for result in results)}",
            "Failed cases by origin:",
            f"  integration: {failed_cases[Origin.INTEGRATION]}",
            f"  model: {failed_cases[Origin.MODEL]}",
            f"  unattributed: {failed_cases[None]}",
            "Failure modes exercised by origin:",
            f"  integration: {exercised_modes[Origin.INTEGRATION]}",
            f"  model: {exercised_modes[Origin.MODEL]}",
        )
    )
    return "\n".join(lines)


def format_trace(result: EvalCaseResult) -> str:
    """Render one full stored trace after its redaction pass for debugging replay."""
    recovery = (
        FAILURE_TAXONOMY[result.actual.failure_mode].recovery.value
        if result.actual.failure_mode is not None
        else "none"
    )
    header = (
        f"Trace for {result.case.identifier}: failure="
        f"{result.actual.failure_mode.value if result.actual.failure_mode else 'none'} "
        f"recovery={recovery}"
    )
    records = [json.dumps(record.as_dict(), sort_keys=True) for record in result.trace]
    return "\n".join((header, *records))


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CI-gating command or one of the non-gating inspection commands."""
    parser = argparse.ArgumentParser(description="Run deterministic, keyless triage evaluations.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser(
        "run", help="run the golden set as a build gate; exits non-zero for failed assertions"
    )
    subparsers.add_parser("report", help="inspect assertions and origin counts; always exits zero")
    trace_parser = subparsers.add_parser(
        "trace", help="inspect one replayed case trace; always exits zero"
    )
    trace_parser.add_argument("case_id", help="golden case identifier to replay")
    arguments = parser.parse_args(argv)

    if arguments.command in {"run", "report"}:
        results = run_golden_set()
        print(format_report(results))
        return (
            1 if arguments.command == "run" and any(not result.passed for result in results) else 0
        )

    case = next(
        (item for item in load_golden_cases() if item.identifier == arguments.case_id), None
    )
    if case is None:
        parser.error(f"unknown golden case: {arguments.case_id}")
    print(format_trace(run_case(case)))
    return 0


def _ingest_ticket(case: GoldenCase, recorder: TraceRecorder) -> Ticket | None:
    """Construct the existing ticket type and trace an integration-layer input failure if any."""
    started_at = recorder.started_at()
    try:
        ticket = Ticket(id=case.ticket_id, submitted_text=case.ticket_text)
    except (TypeError, ValueError) as error:
        recorder.record(
            stage=TraceStage.INGEST,
            origin=Origin.INTEGRATION,
            inputs={"ticket_id": case.ticket_id, "submitted_text": case.ticket_text},
            outcome=FailureMode.CONTEXT_OVERFLOW.value,
            started_at=started_at,
            error=f"{type(error).__name__}: {error}",
        )
        return None
    recorder.record(
        stage=TraceStage.INGEST,
        origin=Origin.INTEGRATION,
        inputs={"ticket_id": ticket.id, "submitted_text": ticket.submitted_text},
        outcome="accepted",
        started_at=started_at,
    )
    return ticket


def _inspect_ticket(ticket: Ticket, trust_level: TicketTrustLevel, recorder: TraceRecorder) -> Any:
    """Apply the existing security controls and preserve their signal in a trace event."""
    started_at = recorder.started_at()
    secured_ticket = build_ticket_guardrails(ticket, trust_level)
    flagged = secured_ticket.input_inspection.flagged
    recorder.record(
        stage=TraceStage.SECURITY_INSPECTION,
        origin=Origin.INTEGRATION,
        inputs={
            "ticket_id": ticket.id,
            "ticket_text": ticket.submitted_text,
            "trust_level": trust_level.value,
            "findings": [finding.kind for finding in secured_ticket.input_inspection.findings],
        },
        outcome=FailureMode.INJECTION_ATTEMPT_DETECTED.value if flagged else "clear",
        started_at=started_at,
        error="Untrusted input matched an injection detection pattern." if flagged else None,
    )
    return secured_ticket


def _send_model_response(
    case: GoldenCase,
    response_fixture: NormalisedResponse,
    request: NormalisedRequest,
    turn: int,
    recorder: TraceRecorder,
) -> NormalisedResponse | None:
    """Use a per-call ``MockTransport`` or seed the documented integration exceptions."""
    started_at = recorder.started_at()
    inputs = {"turn": turn, "ticket_text": case.ticket_text, "message_count": len(request.messages)}
    try:
        _raise_seeded_transport_failure(case.seeded_failure)
        response = MockTransport({"golden-eval": response_fixture}).send(
            replace(request, scenario="golden-eval")
        )
    except RateLimitedError as error:
        recorder.record(
            stage=TraceStage.MODEL_CALL,
            origin=Origin.INTEGRATION,
            inputs=inputs,
            outcome=FailureMode.RATE_LIMIT.value,
            started_at=started_at,
            error=f"{type(error).__name__}: {error}",
        )
        return None
    except TransportError as error:
        recorder.record(
            stage=TraceStage.MODEL_CALL,
            origin=Origin.INTEGRATION,
            inputs=inputs,
            outcome=FailureMode.TRANSPORT_ERROR.value,
            started_at=started_at,
            error=f"{type(error).__name__}: {error}",
        )
        return None
    except ValueError as error:
        recorder.record(
            stage=TraceStage.MODEL_CALL,
            origin=Origin.INTEGRATION,
            inputs=inputs,
            outcome=FailureMode.CONTEXT_OVERFLOW.value,
            started_at=started_at,
            error=f"{type(error).__name__}: {error}",
        )
        return None

    failure = _model_failure(response)
    recorder.record(
        stage=TraceStage.MODEL_CALL,
        origin=FAILURE_TAXONOMY[failure].origin if failure is not None else Origin.MODEL,
        inputs=inputs,
        outcome=failure.value if failure is not None else "completed",
        started_at=started_at,
        error=None,
    )
    return response


def _raise_seeded_transport_failure(failure: FailureMode | None) -> None:
    """Model remote failure fixtures with existing transport exception types where appropriate."""
    if failure is FailureMode.RATE_LIMIT:
        raise RateLimitedError("Synthetic recorded rate limit.", retry_after="1")
    if failure is FailureMode.TRANSPORT_ERROR:
        raise ProviderConnectionError("Synthetic recorded connection failure.")
    if failure is FailureMode.CONTEXT_OVERFLOW:
        raise ValueError("Synthetic request context exceeds the configured limit.")


def _model_failure(response: NormalisedResponse) -> FailureMode | None:
    """Identify stop reasons that are explicitly model-origin outcomes."""
    if response.stop_reason == "max_tokens":
        return FailureMode.TRUNCATION
    if response.stop_reason == "refusal":
        return FailureMode.REFUSAL
    return None


def _assistant_message(response: NormalisedResponse) -> dict[str, list[dict[str, Any]]]:
    """Render response blocks in the existing dispatcher input shape."""
    content: list[dict[str, Any]] = []
    for block in response.content:
        if isinstance(block, dict):
            content.append(dict(block))
        else:
            content.append({"type": block.type, "text": block.text})
    return {"content": content}


def _tool_failure(tool_result: dict[str, Any]) -> FailureMode | None:
    """Classify deterministic dispatcher error text without letting it escape the harness."""
    if not tool_result.get("is_error"):
        return None
    content = str(tool_result.get("content", ""))
    if "Least-privilege" in content:
        return FailureMode.LEAST_PRIVILEGE_DENIAL
    if "Approval denied" in content:
        return FailureMode.APPROVAL_DENIED
    if "Tool input is invalid" in content:
        return FailureMode.SCHEMA_INVALID_TOOL_INPUT
    return FailureMode.TOOL_EXECUTION_FAILURE


def _result_error(tool_result: dict[str, Any]) -> str | None:
    """Keep successful tool results out of the error field while retaining dispatcher failures."""
    return str(tool_result["content"]) if tool_result.get("is_error") else None


def _request_with_tool_results(
    request: NormalisedRequest, batch: dict[str, list[dict[str, Any]]]
) -> NormalisedRequest:
    """Append the shared dispatcher's single result batch to the next model request."""
    tool_result_message = Message(role="user", content=tuple(batch["content"]))  # type: ignore[arg-type]
    return replace(request, messages=(*request.messages, tool_result_message))


def _validate_output(
    case: GoldenCase, response: NormalisedResponse | None, recorder: TraceRecorder
) -> TriageValidation | None:
    """Run the existing parser without inventing response fields, then attribute model output."""
    started_at = recorder.started_at()
    if response is None:
        recorder.record(
            stage=TraceStage.OUTPUT_VALIDATION,
            origin=Origin.INTEGRATION,
            inputs={"response_available": False},
            outcome="skipped",
            started_at=started_at,
            error="Output validation was skipped because the model call did not return a response.",
        )
        return None

    validation = parse_triage_response(response)
    failure: FailureMode | None = None
    if response.stop_reason == "max_tokens":
        failure = FailureMode.TRUNCATION
    elif response.stop_reason == "refusal":
        failure = FailureMode.REFUSAL
    elif response.stop_reason == "tool_use" and any(
        record.outcome == FailureMode.TURN_CEILING_REACHED.value for record in recorder.records
    ):
        failure = FailureMode.TURN_CEILING_REACHED
    elif not validation.is_valid:
        failure = FailureMode.MALFORMED_STRUCTURED_OUTPUT
    elif validation.result is not None and validation.result.category != case.expected.category:
        failure = FailureMode.WRONG_CLASSIFICATION

    recorder.record(
        stage=TraceStage.OUTPUT_VALIDATION,
        origin=FAILURE_TAXONOMY[failure].origin if failure is not None else Origin.INTEGRATION,
        inputs={
            "stop_reason": response.stop_reason,
            "expected_category": case.expected.category,
            "response_available": True,
        },
        outcome=failure.value if failure is not None else "valid",
        started_at=started_at,
        error="; ".join(validation.errors) if validation.errors else None,
    )
    return validation


def _finish(
    case: GoldenCase,
    recorder: TraceRecorder,
    validation: TriageValidation | None,
    tools_called: tuple[str, ...],
    tools_denied: tuple[str, ...],
) -> EvalCaseResult:
    """Construct a grader result only from the specified deterministic assertion fields."""
    result = validation.result if validation is not None else None
    actual = ActualOutcome(
        category=result.category if result is not None else None,
        severity=result.severity if result is not None else None,
        needs_human=validation.should_route_to_human if validation is not None else True,
        tools_called=tools_called,
        tools_denied=tools_denied,
        failure_mode=classify_trace(recorder.records),
    )
    expected = case.expected
    comparisons = [
        (actual.tools_called, expected.tools_called, "tools_called mismatch"),
        (actual.tools_denied, expected.tools_denied, "tools_denied mismatch"),
        (actual.failure_mode, expected.failure_mode, "failure_mode mismatch"),
    ]
    if expected.assert_model_output:
        comparisons[:0] = [
            (actual.category, expected.category, "category mismatch"),
            (actual.severity, expected.severity, "severity mismatch"),
            (actual.needs_human, expected.needs_human, "needs_human mismatch"),
        ]
    assertion_errors = tuple(
        message
        for actual_value, expected_value, message in comparisons
        if actual_value != expected_value
    )
    return EvalCaseResult(
        case=case,
        actual=actual,
        trace=recorder.records,
        assertion_errors=assertion_errors,
    )
