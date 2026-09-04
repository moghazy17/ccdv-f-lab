"""Prompt-cache breakpoints and cache-effectiveness reporting for stable triage prefixes.

Demonstrates the blueprint sub-skills ``Claude API Mechanics`` and ``Cost and Token Management``.
See ``notes/02-applications-and-integration/`` and
``notes/05-model-selection-and-optimization/`` for the associated study notes.

Caching is a byte-for-byte prefix match. Common silent invalidators are a timestamp or UUID in the
system prompt, unsorted JSON serialisation, and a tool list whose order changes between requests.
The API permits at most four cache breakpoints per request.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

MAX_CACHE_BREAKPOINTS = 4


@dataclass(frozen=True)
class CacheEffectivenessReport:
    """Usage totals and a diagnostic for repeated prefixes with no cache reads."""

    input_tokens: int
    cache_read_input_tokens: int
    cache_creation_input_tokens: int
    repeated_prefixes: tuple[str, ...]
    silent_invalidator_detected: bool
    reason: str | None


def render_cacheable_request(
    *,
    tools: Sequence[Mapping[str, Any]],
    system: Sequence[Mapping[str, Any]],
    messages: Sequence[Mapping[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Render stable tools then system before volatile messages, with a final stable breakpoint.

    The final system block holds the default ``cache_control={"type": "ephemeral"}`` breakpoint,
    so the complete tools-and-system prefix is cacheable. Volatile user messages must appear after
    it and may not define a cache breakpoint of their own.
    """
    if not system:
        raise ValueError("A cacheable triage request requires at least one stable system block")
    rendered_tools = [dict(tool) for tool in tools]
    rendered_system = [dict(block) for block in system]
    rendered_messages = [dict(message) for message in messages]
    if any(_contains_breakpoint(message) for message in rendered_messages):
        raise ValueError("Volatile messages must follow the final cache breakpoint")

    existing_breakpoints = sum(
        _contains_breakpoint(block) for block in [*rendered_tools, *rendered_system]
    )
    if not _contains_breakpoint(rendered_system[-1]):
        rendered_system[-1]["cache_control"] = {"type": "ephemeral"}
        existing_breakpoints += 1
    if existing_breakpoints > MAX_CACHE_BREAKPOINTS:
        raise ValueError(f"A request may contain at most {MAX_CACHE_BREAKPOINTS} cache breakpoints")
    return {"tools": rendered_tools, "system": rendered_system, "messages": rendered_messages}


def report_cache_effectiveness(
    usages: Sequence[object], prefixes: Sequence[str]
) -> CacheEffectivenessReport:
    """Report cache usage and flag repeated identical prefixes that produced zero cache reads."""
    if len(usages) != len(prefixes):
        raise ValueError("usages and prefixes must have the same length")
    repeated_prefixes = tuple(
        sorted(prefix for prefix, count in Counter(prefixes).items() if count > 1)
    )
    input_tokens = sum(_usage_value(usage, "input_tokens") for usage in usages)
    cache_read_input_tokens = sum(
        _usage_value(usage, "cache_read_input_tokens") for usage in usages
    )
    cache_creation_input_tokens = sum(
        _usage_value(usage, "cache_creation_input_tokens") for usage in usages
    )
    silent_invalidator_detected = bool(repeated_prefixes) and cache_read_input_tokens == 0
    reason = None
    if silent_invalidator_detected:
        reason = (
            "Repeated identical prefixes had zero cache-read input tokens; inspect timestamps, "
            "UUIDs, JSON ordering, and tool ordering."
        )
    return CacheEffectivenessReport(
        input_tokens=input_tokens,
        cache_read_input_tokens=cache_read_input_tokens,
        cache_creation_input_tokens=cache_creation_input_tokens,
        repeated_prefixes=repeated_prefixes,
        silent_invalidator_detected=silent_invalidator_detected,
        reason=reason,
    )


def _contains_breakpoint(value: Mapping[str, Any]) -> bool:
    """Return whether one provider-shaped block contains an ephemeral cache checkpoint."""
    return value.get("cache_control") == {"type": "ephemeral"}


def _usage_value(usage: object, field: str) -> int:
    """Read a named usage field from an SDK object or an equivalent test mapping."""
    if isinstance(usage, Mapping):
        value = usage.get(field, 0)
    else:
        value = getattr(usage, field, 0)
    return int(value or 0)
