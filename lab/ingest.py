"""Ticket intake that isolates untrusted end-user content from trusted instructions.

Demonstrates the blueprint sub-skills ``Claude Application Design``, ``Prompt Engineering``, and
``AI Application Security``. See ``notes/02-applications-and-integration/``,
``notes/06-prompt-and-context-engineering/``, and ``notes/07-security-and-safety/`` for the
associated study notes.
"""

from __future__ import annotations

import json
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass

from lab.config import Settings, resolve_prompt
from lab.output import structured_output_config
from lab.transport import ContentBlock, Message, NormalisedRequest

MAX_TICKET_CHARACTERS = 12_000
UNTRUSTED_TICKET_START = "<untrusted_ticket_data>"
UNTRUSTED_TICKET_END = "</untrusted_ticket_data>"


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


def ticket_data_content(ticket: Ticket) -> str:
    """Encode all untrusted ticket fields inside the explicit user-turn data delimiter."""
    payload = {
        "id": ticket.id,
        "submitted_text": ticket.submitted_text,
        "metadata": dict(ticket.metadata) if ticket.metadata is not None else None,
    }
    return (
        f"{UNTRUSTED_TICKET_START}\n"
        f"{json.dumps(payload, ensure_ascii=False, sort_keys=True)}\n"
        f"{UNTRUSTED_TICKET_END}"
    )


def assemble_triage_request(ticket: Ticket, settings: Settings | None = None) -> NormalisedRequest:
    """Assemble static trusted instructions separately from the ticket's untrusted user content.

    Ticket text is never concatenated into the system prompt. System and user fields are distinct;
    the request construction path enforces the boundary.
    """
    resolved_settings = Settings.from_env() if settings is None else settings
    prompt = resolve_prompt(resolved_settings.prompt_name, resolved_settings.prompt_version)
    return NormalisedRequest(
        model=resolved_settings.model,
        max_tokens=resolved_settings.max_tokens,
        system=(ContentBlock(type="text", text=prompt.system_instruction),),
        messages=(
            Message(
                role="user",
                content=(ContentBlock(type="text", text=ticket_data_content(ticket)),),
            ),
        ),
        output_config=structured_output_config(),
    )
