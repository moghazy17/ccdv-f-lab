"""Keyless tests for unordered Message Batches outcomes and delivery-path decisions."""

from __future__ import annotations

from dataclasses import dataclass

from lab.batch import BatchRequest, MockBatchTransport, choose_processing_path, run_batch


@dataclass(frozen=True)
class ResultBody:
    """The documented result discriminator carried by one mock batch result."""

    type: str


@dataclass(frozen=True)
class StreamResult:
    """A provider-shaped unordered stream item."""

    custom_id: str
    result: ResultBody


def test_batch_results_are_keyed_by_custom_id_when_streamed_out_of_order() -> None:
    """All documented result types survive an intentionally scrambled result stream."""
    transport = MockBatchTransport(
        results=(
            StreamResult("ticket-3", ResultBody("canceled")),
            StreamResult("ticket-1", ResultBody("succeeded")),
            StreamResult("ticket-4", ResultBody("expired")),
            StreamResult("ticket-2", ResultBody("errored")),
        ),
        processing_statuses=("in_progress", "ended"),
    )
    requests = [
        BatchRequest(f"ticket-{number}", {"model": "claude-haiku-4-5"}) for number in range(1, 5)
    ]

    run = run_batch(requests, transport=transport)

    assert run.polls == 2
    assert list(run.outcomes) == ["ticket-3", "ticket-1", "ticket-4", "ticket-2"]
    assert run.outcomes["ticket-1"].result_type == "succeeded"
    assert run.outcomes["ticket-2"].result_type == "errored"
    assert run.outcomes["ticket-3"].result_type == "canceled"
    assert run.outcomes["ticket-4"].result_type == "expired"
    assert [request["custom_id"] for request in transport.submitted_requests] == [
        "ticket-1",
        "ticket-2",
        "ticket-3",
        "ticket-4",
    ]


def test_delivery_path_uses_latency_tolerance_and_volume() -> None:
    """Deferred multi-request work uses batch; immediate work uses realtime."""
    batch = choose_processing_path(latency_tolerant=True, volume=20)
    realtime = choose_processing_path(latency_tolerant=False, volume=20)

    assert batch.path == "batch"
    assert "tolerate delay" in batch.reason
    assert realtime.path == "realtime"
    assert "immediate" in realtime.reason
