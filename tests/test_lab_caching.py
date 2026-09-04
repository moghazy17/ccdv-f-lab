"""Tests for stable-prefix cache rendering and repeated-prefix effectiveness diagnostics."""

from __future__ import annotations

from dataclasses import dataclass

from lab.caching import render_cacheable_request, report_cache_effectiveness


@dataclass(frozen=True)
class ProviderUsage:
    """A small SDK-shaped usage record including cache creation accounting."""

    input_tokens: int
    cache_read_input_tokens: int
    cache_creation_input_tokens: int


def test_cache_breakpoint_follows_stable_prefix_and_precedes_volatile_messages() -> None:
    """Tools and system are stable before the final breakpoint; ticket content follows it."""
    rendered = render_cacheable_request(
        tools=[{"name": "search_kb"}],
        system=[{"type": "text", "text": "stable instruction"}],
        messages=[{"role": "user", "content": "volatile ticket"}],
    )

    assert list(rendered) == ["tools", "system", "messages"]
    assert rendered["system"][-1]["cache_control"] == {"type": "ephemeral"}
    assert "cache_control" not in rendered["messages"][0]


def test_cache_report_flags_zero_reads_for_repeated_identical_prefixes() -> None:
    """Repeated stable inputs without any read tokens expose a likely silent invalidator."""
    report = report_cache_effectiveness(
        [
            ProviderUsage(100, 0, 100),
            ProviderUsage(100, 0, 100),
            ProviderUsage(80, 0, 80),
        ],
        ["same-prefix", "same-prefix", "other-prefix"],
    )

    assert report.cache_creation_input_tokens == 280
    assert report.silent_invalidator_detected
    assert report.reason is not None
