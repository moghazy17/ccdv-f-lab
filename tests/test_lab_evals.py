"""Keyless tests for origin-aware triage evals and debugging traces."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import lab.evals.runner as runner
from lab.evals.failure_modes import (
    FAILURE_TAXONOMY,
    FailureMode,
    RecoveryStrategy,
    classify_trace,
    recovery_for,
)
from lab.evals.golden import load_golden_cases
from lab.evals.runner import EvalCaseResult, format_report, run_case, run_golden_set
from lab.evals.tracing import Origin, TraceRecord, TraceStage

ROOT = Path(__file__).resolve().parents[1]


def test_every_golden_case_runs_and_grades_deterministically() -> None:
    """Fixtures are stable and pass when they correctly detect their expected failure modes."""
    first = run_golden_set()
    second = run_golden_set()

    assert len(first) >= 12
    assert _outcomes(first) == _outcomes(second)
    assert all(result.passed for result in first)
    wrong_classification = _result_for(first, "wrong_classification")
    assert not wrong_classification.case.expected.assert_model_output
    assert wrong_classification.actual.failure_mode is FailureMode.WRONG_CLASSIFICATION
    assert wrong_classification.assertion_errors == ()


def test_report_separates_build_failures_from_exercised_failure_modes() -> None:
    """A clean suite describes its handled faults without calling them broken cases."""
    report = format_report(run_golden_set())

    assert "Cases: 16; passed: 16; failed: 0" in report
    assert "Failed cases by origin:" in report
    assert "  integration: 0" in report
    assert "  model: 0" in report
    assert "Failure modes exercised by origin:" in report
    assert "  integration: 9" in report
    assert "  model: 4" in report


def test_seeded_integration_and_model_failures_keep_distinct_origins() -> None:
    """A transport failure and truncation cannot be incorrectly attributed to the other layer."""
    cases = {case.identifier: case for case in load_golden_cases()}
    integration = run_case(cases["transport_error"])
    model = run_case(cases["truncation"])

    assert integration.actual.failure_mode is FailureMode.TRANSPORT_ERROR
    assert model.actual.failure_mode is FailureMode.TRUNCATION
    assert FAILURE_TAXONOMY[integration.actual.failure_mode].origin is Origin.INTEGRATION
    assert FAILURE_TAXONOMY[model.actual.failure_mode].origin is Origin.MODEL
    assert _record_for(integration, FailureMode.TRANSPORT_ERROR).origin is Origin.INTEGRATION
    assert _record_for(model, FailureMode.TRUNCATION).origin is Origin.MODEL


def test_classifier_and_recovery_mapping_cover_every_taxonomy_entry() -> None:
    """Every classified failure has the explicit recovery strategy selected for this app."""
    expected_recoveries = {
        FailureMode.TRANSPORT_ERROR: RecoveryStrategy.RETRY_WITH_BACKOFF,
        FailureMode.RATE_LIMIT: RecoveryStrategy.RETRY_WITH_BACKOFF,
        FailureMode.REFUSAL: RecoveryStrategy.ESCALATE_TO_HUMAN,
        FailureMode.TRUNCATION: RecoveryStrategy.REPROMPT,
        FailureMode.MALFORMED_STRUCTURED_OUTPUT: RecoveryStrategy.REPROMPT,
        FailureMode.WRONG_CLASSIFICATION: RecoveryStrategy.REPROMPT,
        FailureMode.SCHEMA_INVALID_TOOL_INPUT: RecoveryStrategy.REPROMPT,
        FailureMode.TOOL_EXECUTION_FAILURE: RecoveryStrategy.RETRY_WITH_BACKOFF,
        FailureMode.APPROVAL_DENIED: RecoveryStrategy.FAIL_CLOSED,
        FailureMode.LEAST_PRIVILEGE_DENIAL: RecoveryStrategy.FAIL_CLOSED,
        FailureMode.INJECTION_ATTEMPT_DETECTED: RecoveryStrategy.FAIL_CLOSED,
        FailureMode.TURN_CEILING_REACHED: RecoveryStrategy.PRUNE_AND_RETRY,
        FailureMode.CONTEXT_OVERFLOW: RecoveryStrategy.PRUNE_AND_RETRY,
    }

    assert set(FAILURE_TAXONOMY) == set(expected_recoveries)
    for mode, recovery in expected_recoveries.items():
        definition = FAILURE_TAXONOMY[mode]
        record = TraceRecord(
            stage=TraceStage.MODEL_CALL,
            origin=definition.origin,
            inputs={},
            outcome=mode.value,
            elapsed_ms=0.0,
        )
        assert recovery_for(mode) is recovery
        assert classify_trace((record,)) is mode


def test_sensitive_ticket_trace_has_no_unredacted_secret_or_pii() -> None:
    """Stored traces use the existing secret and PII redaction helpers at every stage."""
    cases = {case.identifier: case for case in load_golden_cases()}
    result = run_case(cases["sensitive_trace_redaction"])
    stored_trace = json.dumps([record.as_dict() for record in result.trace], sort_keys=True)

    assert "internal-eval-secret" not in stored_trace
    assert "sara@example.com" not in stored_trace
    assert "4111 1111 1111 1111" not in stored_trace
    assert "[REDACTED_API_KEY]" in stored_trace
    assert "[REDACTED_EMAIL]" in stored_trace
    assert "[REDACTED_CARD]" in stored_trace


def test_trace_records_every_triage_stage_for_a_tool_case() -> None:
    """A scripted tool failure leaves an inspectable trace across all required stages."""
    cases = {case.identifier: case for case in load_golden_cases()}
    result = run_case(cases["tool_execution_failure"])
    stages = {record.stage for record in result.trace}

    assert stages == {
        TraceStage.INGEST,
        TraceStage.SECURITY_INSPECTION,
        TraceStage.MODEL_CALL,
        TraceStage.TOOL_DISPATCH,
        TraceStage.OUTPUT_VALIDATION,
    }


def test_clean_cli_subcommands_exit_zero_without_an_api_key() -> None:
    """The clean golden suite passes its gate while both inspection commands remain successful."""
    environment = dict(os.environ)
    environment.pop("ANTHROPIC_API_KEY", None)
    commands = (
        ("run",),
        ("report",),
        ("trace", "tool_execution_failure"),
    )

    for command in commands:
        completed = subprocess.run(
            [sys.executable, "-m", "lab.evals", *command],
            cwd=ROOT,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )
        assert completed.returncode == 0, completed.stderr
        assert completed.stdout


def test_run_exits_nonzero_for_a_genuine_assertion_failure(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """Only run gates a broken suite; report and trace remain usable inspection commands."""
    assert runner.main(("run",)) == 0
    happy_case = next(
        case for case in load_golden_cases() if case.identifier == "happy_account_access"
    )
    failing_case = replace(
        happy_case,
        expected=replace(happy_case.expected, tools_called=("lookup_customer",)),
    )
    failed_result = run_case(failing_case)

    assert not failed_result.passed
    monkeypatch.setattr(runner, "run_golden_set", lambda: (failed_result,))
    assert runner.main(("run",)) == 1
    assert runner.main(("report",)) == 0
    assert runner.main(("trace", "wrong_classification")) == 0


def _outcomes(results: tuple[EvalCaseResult, ...]) -> tuple[tuple[object, ...], ...]:
    """Keep timing out of the deterministic comparison while retaining every graded field."""
    return tuple(
        (
            result.case.identifier,
            result.actual,
            result.assertion_errors,
        )
        for result in results
    )


def _result_for(results: tuple[EvalCaseResult, ...], identifier: str) -> EvalCaseResult:
    """Return the named result while making a changed fixture ID fail clearly."""
    return next(result for result in results if result.case.identifier == identifier)


def _record_for(result: EvalCaseResult, mode: FailureMode) -> TraceRecord:
    """Return the trace event that reports the requested classified failure mode."""
    return next(record for record in result.trace if record.outcome == mode.value)
