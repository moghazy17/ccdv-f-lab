"""Tests for recorded tool-output pruning and shrinking transcript compaction."""

from __future__ import annotations

from lab.context import compact_transcript, estimate_tokens, prune_tool_outputs


def text_message(text: str, *, required: bool = False) -> dict[str, object]:
    """Build one transcript turn whose preservation is easy to assert."""
    message: dict[str, object] = {
        "role": "user",
        "content": [{"type": "text", "text": text}],
    }
    if required:
        message["required_for_correctness"] = True
    return message


def test_pruning_truncates_tool_output_and_records_every_edit() -> None:
    """Oversized tool output is visibly shortened without mutating the caller's transcript."""
    source = [
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": "toolu-large",
                    "content": "x" * 80,
                }
            ],
        }
    ]

    result = prune_tool_outputs(source, max_characters=12)

    content = result.messages[0]["content"][0]["content"]
    assert content.startswith("x" * 12)
    assert "tool output pruned" in content
    assert result.records[0].tool_use_id == "toolu-large"
    assert result.records[0].original_characters == 80
    assert source[0]["content"][0]["content"] == "x" * 80


def test_compaction_at_threshold_preserves_recent_and_required_turns_and_shrinks() -> None:
    """Historical bloat becomes one summary while required and recent turns remain exact."""
    transcript = [
        text_message("old-a " + "x" * 1_000),
        text_message("required-fact", required=True),
        text_message("old-b " + "y" * 1_000),
        text_message("recent-one"),
        text_message("recent-two"),
    ]
    before = estimate_tokens(transcript)

    result = compact_transcript(transcript, token_limit=100, preserve_recent_turns=2)

    rendered = str(result.messages)
    assert result.triggered
    assert result.before_tokens == before
    assert result.after_tokens < result.before_tokens
    assert result.compacted_message_count == 2
    assert "Context compaction summary" in rendered
    assert "required-fact" in rendered
    assert "recent-one" in rendered
    assert "recent-two" in rendered
