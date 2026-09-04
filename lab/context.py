"""Local context-window editing and compaction for a bounded agent transcript.

Demonstrates the blueprint sub-skills ``Agent Patterns and Frameworks`` and ``Context
Engineering``. See ``notes/01-agents-and-workflows/`` and
``notes/06-prompt-and-context-engineering/`` for the associated study notes.

Context editing and compaction are distinct. Editing clears or truncates old *tool results* while
retaining the surrounding turns; compaction replaces older turns with a summary. The real API also
offers ``client.messages.count_tokens``. This module deliberately uses a local estimate so it works
without an API key or network access.
"""

from __future__ import annotations

import json
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ToolOutputPruningRecord:
    """An auditable record of one tool result shortened before transcript insertion."""

    message_index: int
    tool_use_id: str
    original_characters: int
    retained_characters: int


@dataclass(frozen=True)
class PruningResult:
    """A copied transcript and every tool-output edit made to it."""

    messages: tuple[dict[str, Any], ...]
    records: tuple[ToolOutputPruningRecord, ...]


@dataclass(frozen=True)
class CompactionResult:
    """A copied transcript with an optional summary replacing older non-required turns."""

    messages: tuple[dict[str, Any], ...]
    triggered: bool
    before_tokens: int
    after_tokens: int
    compacted_message_count: int


def estimate_tokens(value: object) -> int:
    """Estimate tokens locally from serialised characters; this is not provider token counting.

    ``client.messages.count_tokens`` is the real API option when a live client is available. The
    four-character approximation here is intentionally local and conservative enough to trigger
    teaching examples without a provider call.
    """
    if isinstance(value, str):
        text = value
    else:
        text = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    return max(1, (len(text) + 3) // 4)


def prune_tool_outputs(
    messages: Sequence[Mapping[str, Any]], *, max_characters: int = 1_000
) -> PruningResult:
    """Truncate oversized tool-result content and return records instead of editing silently."""
    if max_characters < 1:
        raise ValueError("max_characters must be at least 1")

    copied_messages: list[dict[str, Any]] = []
    records: list[ToolOutputPruningRecord] = []
    for message_index, message in enumerate(messages):
        copied = _copy_message(message)
        content = copied.get("content")
        if isinstance(content, list):
            for block in content:
                if not isinstance(block, dict) or block.get("type") != "tool_result":
                    continue
                raw_content = block.get("content")
                if not isinstance(raw_content, str) or len(raw_content) <= max_characters:
                    continue
                original_characters = len(raw_content)
                retained = raw_content[:max_characters]
                block["content"] = (
                    f"{retained}\n[tool output pruned: {original_characters} original characters]"
                )
                records.append(
                    ToolOutputPruningRecord(
                        message_index=message_index,
                        tool_use_id=str(block.get("tool_use_id", "unknown-tool-use")),
                        original_characters=original_characters,
                        retained_characters=len(retained),
                    )
                )
        copied_messages.append(copied)
    return PruningResult(messages=tuple(copied_messages), records=tuple(records))


def compact_transcript(
    messages: Sequence[Mapping[str, Any]],
    *,
    token_limit: int,
    preserve_recent_turns: int = 2,
    required_indices: Sequence[int] = (),
) -> CompactionResult:
    """Replace older non-required turns with one compact summary when the estimate exceeds a limit.

    The newest ``preserve_recent_turns`` and indices explicitly required for correctness remain as
    original turns. A message can also set ``required_for_correctness`` to true, which avoids a
    fragile positional dependency when a transcript is assembled incrementally.
    """
    if token_limit < 1:
        raise ValueError("token_limit must be at least 1")
    if preserve_recent_turns < 0:
        raise ValueError("preserve_recent_turns cannot be negative")

    copied = [_copy_message(message) for message in messages]
    before_tokens = estimate_tokens(copied)
    if before_tokens <= token_limit or not copied:
        return CompactionResult(
            messages=tuple(copied),
            triggered=False,
            before_tokens=before_tokens,
            after_tokens=before_tokens,
            compacted_message_count=0,
        )

    _validate_required_indices(required_indices, len(copied))
    protected = set(required_indices)
    protected.update(range(max(0, len(copied) - preserve_recent_turns), len(copied)))
    protected.update(
        index
        for index, message in enumerate(copied)
        if message.get("required_for_correctness") is True
    )
    compactable = [index for index in range(len(copied)) if index not in protected]
    if not compactable:
        return CompactionResult(
            messages=tuple(copied),
            triggered=False,
            before_tokens=before_tokens,
            after_tokens=before_tokens,
            compacted_message_count=0,
        )

    summary = _summary_message([copied[index] for index in compactable])
    first_compacted = compactable[0]
    compacted_set = set(compactable)
    compacted_messages = [
        summary if index == first_compacted else message
        for index, message in enumerate(copied)
        if index == first_compacted or index not in compacted_set
    ]
    after_tokens = estimate_tokens(compacted_messages)
    return CompactionResult(
        messages=tuple(compacted_messages),
        triggered=True,
        before_tokens=before_tokens,
        after_tokens=after_tokens,
        compacted_message_count=len(compactable),
    )


def _copy_message(message: Mapping[str, Any]) -> dict[str, Any]:
    """Copy nested transcript content so pruning and compaction never mutate caller state."""
    copied = dict(message)
    content = copied.get("content")
    if isinstance(content, Sequence) and not isinstance(content, (str, bytes, bytearray)):
        copied["content"] = [
            dict(block) if isinstance(block, Mapping) else block for block in content
        ]
    return copied


def _validate_required_indices(indices: Sequence[int], message_count: int) -> None:
    """Reject positional correctness markers that cannot refer to this transcript."""
    invalid = [index for index in indices if index < 0 or index >= message_count]
    if invalid:
        raise ValueError(f"required_indices contains invalid message positions: {invalid}")


def _summary_message(messages: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Produce one bounded deterministic summary for replaced historical turns."""
    roles = Counter(str(message.get("role", "unknown")) for message in messages)
    snippets = []
    for message in messages[:6]:
        rendered = json.dumps(message.get("content", ""), ensure_ascii=False, sort_keys=True)
        snippets.append(rendered[:80])
    role_summary = ", ".join(f"{role}: {count}" for role, count in sorted(roles.items()))
    return {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": (
                    "Context compaction summary of older turns "
                    f"({len(messages)} turns; {role_summary}): {' | '.join(snippets)}"
                ),
            }
        ],
        "context_compaction": {"replaced_turns": len(messages)},
    }
