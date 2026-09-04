"""Batch submission, polling, unordered-result handling, and realtime decision support.

Demonstrates the blueprint sub-skills ``Claude API Mechanics`` and ``Cost and Token Management``.
See ``notes/02-applications-and-integration/`` and
``notes/05-model-selection-and-optimization/`` for the associated study notes.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from time import sleep
from typing import Any, Literal, Protocol

BatchResultType = Literal["succeeded", "errored", "canceled", "expired"]
ProcessingPath = Literal["batch", "realtime"]


@dataclass(frozen=True)
class BatchRequest:
    """One independently correlated Message Batches request."""

    custom_id: str
    params: Mapping[str, Any]


@dataclass(frozen=True)
class BatchOutcome:
    """One result retained without assuming a message payload for non-success outcomes."""

    custom_id: str
    result_type: BatchResultType
    raw_result: object


@dataclass(frozen=True)
class BatchRun:
    """Completed batch metadata and outcomes indexed by custom ID, never result position."""

    batch_id: str
    outcomes: Mapping[str, BatchOutcome]
    polls: int


@dataclass(frozen=True)
class ProcessingDecision:
    """The selected delivery path and its latency/volume explanation."""

    path: ProcessingPath
    reason: str


class BatchTransport(Protocol):
    """The batch transport seam implemented by mock and live adapters."""

    def create_batch(self, requests: Sequence[Mapping[str, Any]]) -> object:
        """Submit provider-shaped requests and return an object with ``id``."""

    def retrieve_batch(self, batch_id: str) -> object:
        """Return a batch object with ``processing_status``."""

    def stream_batch_results(self, batch_id: str) -> Iterable[object]:
        """Yield results with ``custom_id`` and ``result.type`` in provider-selected order."""


class BatchPollingTimeout(RuntimeError):
    """The batch did not reach its terminal processing status within the configured poll bound."""


class MockBatchTransport:
    """A keyless batch transport whose supplied results can intentionally arrive out of order."""

    def __init__(
        self,
        results: Iterable[object] = (),
        *,
        processing_statuses: Sequence[str] = ("ended",),
        batch_id: str = "mock-batch-1",
    ) -> None:
        """Store deterministic status and result streams without an SDK import or network call."""
        if not processing_statuses:
            raise ValueError("processing_statuses must not be empty")
        self._results = tuple(results)
        self._processing_statuses = tuple(processing_statuses)
        self._batch_id = batch_id
        self.submitted_requests: tuple[dict[str, Any], ...] = ()
        self._retrieve_count = 0

    def create_batch(self, requests: Sequence[Mapping[str, Any]]) -> object:
        """Record the exact provider-shaped batch payload and return its mock identifier."""
        self.submitted_requests = tuple(dict(request) for request in requests)
        return _MockBatch(id=self._batch_id, processing_status=self._processing_statuses[0])

    def retrieve_batch(self, batch_id: str) -> object:
        """Advance through configured statuses for the requested mock batch."""
        if batch_id != self._batch_id:
            raise ValueError(f"Unknown mock batch ID: {batch_id!r}")
        index = min(self._retrieve_count, len(self._processing_statuses) - 1)
        self._retrieve_count += 1
        return _MockBatch(id=batch_id, processing_status=self._processing_statuses[index])

    def stream_batch_results(self, batch_id: str) -> Iterable[object]:
        """Yield the configured results unchanged, including their intentionally arbitrary order."""
        if batch_id != self._batch_id:
            raise ValueError(f"Unknown mock batch ID: {batch_id!r}")
        return iter(self._results)


class AnthropicBatchTransport:
    """A live batch adapter that imports the SDK only when explicitly constructed."""

    def __init__(self) -> None:
        """Construct the real client lazily; the default mock path never reaches this code."""
        try:
            import anthropic
        except ImportError as error:
            raise RuntimeError(
                "Install the 'anthropic' dependency to use AnthropicBatchTransport"
            ) from error
        self._client = anthropic.Anthropic()

    def create_batch(self, requests: Sequence[Mapping[str, Any]]) -> object:
        """Call the real Message Batches create path with correlated request objects."""
        return self._client.messages.batches.create(requests=list(requests))

    def retrieve_batch(self, batch_id: str) -> object:
        """Retrieve the current real batch status."""
        return self._client.messages.batches.retrieve(batch_id)

    def stream_batch_results(self, batch_id: str) -> Iterable[object]:
        """Yield the real result stream without imposing an order on provider output."""
        return self._client.messages.batches.results(batch_id)


@dataclass(frozen=True)
class _MockBatch:
    """The minimal batch state exposed by the keyless mock adapter."""

    id: str
    processing_status: str


def run_batch(
    requests: Sequence[BatchRequest],
    *,
    transport: BatchTransport | None = None,
    max_polls: int = 20,
    poll_interval_seconds: float = 0.0,
) -> BatchRun:
    """Submit, poll to ``ended``, then index every unordered result by ``custom_id``.

    Results can arrive in ANY order. They are deliberately keyed by ``custom_id`` below, never by
    position in the result stream, because positional matching can assign one customer's result to
    another customer's request.
    """
    if max_polls < 1:
        raise ValueError("max_polls must be at least 1")
    if poll_interval_seconds < 0:
        raise ValueError("poll_interval_seconds cannot be negative")
    _validate_requests(requests)
    resolved_transport = MockBatchTransport() if transport is None else transport
    wire_requests = [
        {"custom_id": request.custom_id, "params": dict(request.params)} for request in requests
    ]
    submitted = resolved_transport.create_batch(wire_requests)
    batch_id = str(getattr(submitted, "id"))

    for polls in range(1, max_polls + 1):
        batch = resolved_transport.retrieve_batch(batch_id)
        if getattr(batch, "processing_status", None) == "ended":
            return BatchRun(
                batch_id=batch_id,
                outcomes=_index_outcomes(resolved_transport.stream_batch_results(batch_id)),
                polls=polls,
            )
        if poll_interval_seconds:
            sleep(poll_interval_seconds)
    raise BatchPollingTimeout(f"Batch {batch_id!r} did not reach processing_status 'ended'.")


def choose_processing_path(*, latency_tolerant: bool, volume: int) -> ProcessingDecision:
    """Choose batch for multiple independent requests that may wait; otherwise choose realtime."""
    if volume < 1:
        raise ValueError("volume must be at least 1")
    if latency_tolerant and volume > 1:
        return ProcessingDecision(
            path="batch",
            reason=(
                "The volume has multiple independent requests and the caller can tolerate delay."
            ),
        )
    if not latency_tolerant:
        return ProcessingDecision(
            path="realtime",
            reason="The caller needs an immediate response, so realtime delivery takes priority.",
        )
    return ProcessingDecision(
        path="realtime",
        reason=(
            "A single request does not need a deferred batch path when realtime latency is "
            "acceptable."
        ),
    )


def _validate_requests(requests: Sequence[BatchRequest]) -> None:
    """Require a non-empty unique correlation key for every submission."""
    custom_ids = [request.custom_id for request in requests]
    if any(not isinstance(custom_id, str) or not custom_id for custom_id in custom_ids):
        raise ValueError("Each batch request requires a non-empty custom_id")
    if len(set(custom_ids)) != len(custom_ids):
        raise ValueError("Batch custom_id values must be unique")


def _index_outcomes(results: Iterable[object]) -> dict[str, BatchOutcome]:
    """Normalise all documented result types while preserving the opaque provider result payload."""
    outcomes: dict[str, BatchOutcome] = {}
    supported_types = {"succeeded", "errored", "canceled", "expired"}
    for item in results:
        custom_id = str(getattr(item, "custom_id"))
        result = getattr(item, "result")
        result_type = str(getattr(result, "type"))
        if result_type not in supported_types:
            raise ValueError(f"Unsupported batch result type: {result_type!r}")
        if custom_id in outcomes:
            raise ValueError(f"Duplicate batch result custom_id: {custom_id!r}")
        outcomes[custom_id] = BatchOutcome(
            custom_id=custom_id,
            result_type=result_type,  # type: ignore[arg-type]
            raw_result=result,
        )
    return outcomes
