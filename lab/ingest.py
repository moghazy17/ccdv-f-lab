"""Ticket intake that isolates untrusted end-user content from trusted instructions.

Demonstrates the blueprint sub-skills ``Claude Application Design``, ``Prompt Engineering``, and
``AI Application Security``. See ``notes/02-applications-and-integration/``,
``notes/06-prompt-and-context-engineering/``, and ``notes/07-security-and-safety/`` for the
associated study notes. The structural defence that does the work is a per-request cryptographic
nonce in each data delimiter: ticket text cannot predict the closing boundary. Delimiter-like text
is JSON-escaped and recorded while preserving the value a JSON parser recovers.
"""

from __future__ import annotations

import json
import re
import secrets
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass

from lab.config import Settings, resolve_prompt
from lab.output import structured_output_config
from lab.transport import ContentBlock, Message, NormalisedRequest

MAX_TICKET_CHARACTERS = 12_000
UNTRUSTED_TICKET_NAME = "untrusted_ticket_data"
_DELIMITER_LIKE_TOKEN = re.compile(r"</?untrusted_ticket_data(?:\s[^>]*)?>", re.IGNORECASE)


def normalize_ticket_text(submitted_text: str) -> str:
    """Apply NFC and newline normalisation, then reject blank, NUL-containing, or oversized text."""
    if not isinstance(submitted_text, str):
        raise TypeError("Ticket text must be a string")
    normalized = (
        unicodedata.normalize("NFC", submitted_text).replace("\r\n", "\n").replace("\r", "\n")
    )
    if "\x00" in normalized:
        raise ValueError("Ticket text cannot contain NUL characters")
    normalized = normalized.strip()
    if not normalized:
        raise ValueError("Ticket text cannot be blank")
    if len(normalized) > MAX_TICKET_CHARACTERS:
        raise ValueError(f"Ticket text exceeds the {MAX_TICKET_CHARACTERS}-character limit")
    return normalized


@dataclass(frozen=True)
class Ticket:
    """One end-user submission; its text and optional metadata are always untrusted input."""

    id: str
    submitted_text: str
    metadata: Mapping[str, str] | None = None

    def __post_init__(self) -> None:
        """Normalise submitted text at the model boundary rather than relying on every caller."""
        if not isinstance(self.id, str) or not self.id.strip():
            raise ValueError("Ticket id must be a non-empty string")
        object.__setattr__(self, "submitted_text", normalize_ticket_text(self.submitted_text))
        if self.metadata is not None:
            if not all(
                isinstance(key, str) and isinstance(value, str)
                for key, value in self.metadata.items()
            ):
                raise TypeError("Ticket metadata keys and values must be strings")
            object.__setattr__(self, "metadata", dict(self.metadata))


@dataclass(frozen=True)
class TicketDataBoundary:
    """One rendered untrusted-data region and its non-secret security record."""

    content: str
    nonce: str
    escaped_delimiter_like_tokens: int


def render_ticket_data(ticket: Ticket) -> TicketDataBoundary:
    """Render untrusted fields as JSON in an unpredictable, delimiter-safe region.

    ``\\u003c`` is a JSON escape for ``<``. It prevents a delimiter-like token from appearing in
    the raw model context without changing the submitted value a JSON parser receives.
    """
    nonce = secrets.token_urlsafe(32)
    payload = {
        "id": ticket.id,
        "submitted_text": ticket.submitted_text,
        "metadata": dict(ticket.metadata) if ticket.metadata is not None else None,
    }
    initial_payload = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    escaped_count = len(_DELIMITER_LIKE_TOKEN.findall(initial_payload))
    payload["delimiter_like_token_escapes"] = escaped_count
    final_payload = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    final_payload, escaped_count = _escape_delimiter_like_tokens(final_payload)
    start = f'<{UNTRUSTED_TICKET_NAME} nonce="{nonce}">'
    end = f'</{UNTRUSTED_TICKET_NAME} nonce="{nonce}">'
    return TicketDataBoundary(
        content=f"{start}\n{final_payload}\n{end}",
        nonce=nonce,
        escaped_delimiter_like_tokens=escaped_count,
    )


def ticket_data_content(ticket: Ticket) -> str:
    """Return the request-specific delimited JSON content for one untrusted ticket."""
    return render_ticket_data(ticket).content


def _escape_delimiter_like_tokens(encoded_payload: str) -> tuple[str, int]:
    """Replace a raw leading ``<`` in delimiter-like JSON string content with a JSON escape."""
    escaped_count = 0

    def escape(match: re.Match[str]) -> str:
        nonlocal escaped_count
        escaped_count += 1
        return "\\u003c" + match.group(0)[1:]

    return _DELIMITER_LIKE_TOKEN.sub(escape, encoded_payload), escaped_count


def assemble_triage_request(ticket: Ticket, settings: Settings | None = None) -> NormalisedRequest:
    """Assemble static trusted instructions separately from the ticket's untrusted user content.

    Ticket text is never concatenated into the system prompt. System and user fields are distinct;
    the request construction path enforces the boundary. The system instruction also names the
    delimited region as a JSON object and ``submitted_text`` as its ticket field so the encoding is
    unambiguous to the model.
    """
    resolved_settings = Settings.from_env() if settings is None else settings
    prompt = resolve_prompt(resolved_settings.prompt_name, resolved_settings.prompt_version)
    return NormalisedRequest(
        model=resolved_settings.model,
        max_tokens=resolved_settings.max_tokens,
        system=(
            ContentBlock(
                type="text",
                text=(
                    f"{prompt.system_instruction} The delimited region is a JSON object; "
                    "the ticket text is its submitted_text field. Its opening and closing "
                    "delimiters share a per-request nonce."
                ),
            ),
        ),
        messages=(
            Message(
                role="user",
                content=(ContentBlock(type="text", text=ticket_data_content(ticket)),),
            ),
        ),
        output_config=structured_output_config(),
    )
