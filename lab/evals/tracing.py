"""Redacted structured traces for the triage eval harness.

Demonstrates the blueprint sub-skill ``Debugging and Error Handling``. Every stored record names
whether the observed behavior belongs to the integration layer or model output, so an evaluator can
group failures by origin instead of treating all failures as prompt problems.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from enum import StrEnum
from time import perf_counter
from typing import Any

from lab.secrets import redact_trace_record
from lab.security import redact_pii


class Origin(StrEnum):
    """The accountable layer for a trace event or classified failure."""

    INTEGRATION = "integration"
    MODEL = "model"


class TraceStage(StrEnum):
    """The stable triage stages recorded by the eval harness."""

    INGEST = "ingest"
    SECURITY_INSPECTION = "security_inspection"
    MODEL_CALL = "model_call"
    TOOL_DISPATCH = "tool_dispatch"
    OUTPUT_VALIDATION = "output_validation"


@dataclass(frozen=True)
class TraceRecord:
    """One redacted, timed trace event emitted during an eval case."""

    stage: TraceStage
    origin: Origin
    inputs: dict[str, Any]
    outcome: str
    elapsed_ms: float
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """Return a JSON-ready representation for CLI replay output."""
        return asdict(self)


class TraceRecorder:
    """Append only secret- and PII-redacted trace records for one eval case."""

    def __init__(self, *, known_secrets: tuple[str, ...] = ()) -> None:
        """Keep known fixture secrets available to the existing secret redactor."""
        self._known_secrets = known_secrets
        self._records: list[TraceRecord] = []

    @property
    def records(self) -> tuple[TraceRecord, ...]:
        """Expose the immutable trace collected so far."""
        return tuple(self._records)

    @staticmethod
    def started_at() -> float:
        """Capture a monotonic start time for one stage operation."""
        return perf_counter()

    def record(
        self,
        *,
        stage: TraceStage,
        origin: Origin,
        inputs: dict[str, Any],
        outcome: str,
        started_at: float,
        error: str | None = None,
    ) -> TraceRecord:
        """Store one trace event after routing all fields through existing redactors.

        ``lab.secrets.redact_trace_record`` removes known or API-key-shaped credentials. Its
        result is serialized and passed through ``lab.security.redact_pii`` so PII in nested
        values, exception messages, and inputs is removed before a record is retained.
        """
        raw = {
            "inputs": inputs,
            "error": error,
        }
        secret_safe = redact_trace_record(raw, known_secrets=self._known_secrets)
        pii_safe = redact_pii(json.dumps(secret_safe, default=str, sort_keys=True))
        stored = json.loads(pii_safe)
        record = TraceRecord(
            stage=stage,
            origin=origin,
            inputs=stored["inputs"],
            outcome=outcome,
            elapsed_ms=round((perf_counter() - started_at) * 1000, 3),
            error=stored["error"],
        )
        self._records.append(record)
        return record
