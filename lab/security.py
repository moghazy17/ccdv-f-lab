"""Layered security controls for untrusted ticket triage.

Demonstrates the blueprint sub-skills ``AI Application Security`` and ``Guardrails and Safe
Deployment``. The layers are deliberately separate: input inspection records suspicious patterns,
``lab.ingest`` creates the structural data boundary, this module's policy limits exposed tools, and
the output check rejects leaked trusted content. Pattern matching is a signal, not a control: it
flags and records possible injection without blocking a ticket. The structural boundary and least
privilege are the controls that constrain what an untrusted ticket can cause.

PII is redacted before logs or traces. The model receives the original ticket inside its structural
boundary unless a product requirement explicitly calls for model-side minimisation; log redaction
must not silently rewrite the customer text the model is asked to classify.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum
from typing import Iterable

from lab.ingest import Ticket, TicketDataBoundary, render_ticket_data

READ_ONLY_TOOLS = frozenset({"search_kb", "lookup_customer"})
WRITE_TOOLS = frozenset({"create_followup", "escalate_ticket"})

_INJECTION_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "instruction_override",
        re.compile(
            r"\b(?:ignore|disregard|forget)\b.{0,80}\b(?:prior|previous|all)\b"
            r".{0,80}\b(?:instructions?|rules?)\b",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    (
        "system_prompt_exfiltration",
        re.compile(
            r"\b(?:reveal|show|print|repeat)\b.{0,80}\b(?:system prompt|system instructions?)\b",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    (
        "role_override",
        re.compile(r"\b(?:you are now|act as|jailbreak)\b", re.IGNORECASE),
    ),
)
_EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_CARD_PATTERN = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
_PHONE_PATTERN = re.compile(
    r"(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2}\d{3,4}(?!\d)"
)
_API_KEY_PATTERN = re.compile(r"\bsk-ant-[A-Za-z0-9_-]+\b")


class TicketTrustLevel(StrEnum):
    """The trust level used to select a capability set before dispatch."""

    UNTRUSTED = "untrusted"
    TRUSTED = "trusted"


@dataclass(frozen=True)
class SecurityFinding:
    """A non-blocking input or output signal suitable for an audit record."""

    kind: str
    detail: str


@dataclass(frozen=True)
class PiiInspection:
    """The log-safe representation of text and the PII classes removed from it."""

    redacted_text: str
    kinds: tuple[str, ...]


@dataclass(frozen=True)
class InputInspection:
    """Input-layer result that retains model text but returns log-safe text separately."""

    model_text: str
    log_text: str
    findings: tuple[SecurityFinding, ...]
    pii: PiiInspection

    @property
    def flagged(self) -> bool:
        """Return whether input inspection recorded one or more injection signals."""
        return bool(self.findings)

    @property
    def blocked(self) -> bool:
        """Return false because pattern detection is intentionally not the enforcement layer."""
        return False


@dataclass(frozen=True)
class ToolExposurePolicy:
    """Bind one ticket trust level to the exact tools the dispatcher may expose."""

    trust_level: TicketTrustLevel
    allowed_tools: frozenset[str]

    @classmethod
    def for_ticket(cls, trust_level: TicketTrustLevel) -> ToolExposurePolicy:
        """Create the least-privilege capability set for a ticket trust level."""
        if trust_level is TicketTrustLevel.UNTRUSTED:
            return cls(trust_level=trust_level, allowed_tools=READ_ONLY_TOOLS)
        return cls(trust_level=trust_level, allowed_tools=READ_ONLY_TOOLS | WRITE_TOOLS)

    def permits(self, tool_name: str) -> bool:
        """Return whether the tool is a capability exposed to this ticket."""
        return tool_name in self.allowed_tools


UNTRUSTED_TOOL_POLICY = ToolExposurePolicy.for_ticket(TicketTrustLevel.UNTRUSTED)


@dataclass(frozen=True)
class SecuredTicket:
    """The visible input, boundary, and capability layers for a single ticket."""

    input_inspection: InputInspection
    structural_boundary: TicketDataBoundary
    tool_policy: ToolExposurePolicy


@dataclass(frozen=True)
class OutputSafetyCheck:
    """Output-layer result; unsafe output must not be returned to the caller."""

    allowed: bool
    findings: tuple[SecurityFinding, ...]


class OutputLeakageError(ValueError):
    """Raised when output inspection finds trusted material in a model response."""


def inspect_untrusted_input(text: str) -> InputInspection:
    """Flag injection patterns and produce a PII-redacted log representation without blocking."""
    if not isinstance(text, str):
        raise TypeError("Untrusted input must be text")
    findings = tuple(
        SecurityFinding(kind=kind, detail="Pattern matched in untrusted ticket text.")
        for kind, pattern in _INJECTION_PATTERNS
        if pattern.search(text)
    )
    pii = inspect_pii(text)
    return InputInspection(model_text=text, log_text=pii.redacted_text, findings=findings, pii=pii)


def inspect_pii(text: str) -> PiiInspection:
    """Detect supported PII classes and redact them for logging or tracing."""
    if not isinstance(text, str):
        raise TypeError("PII inspection requires text")
    redacted, card_count = _CARD_PATTERN.subn("[REDACTED_CARD]", text)
    redacted, email_count = _EMAIL_PATTERN.subn("[REDACTED_EMAIL]", redacted)
    redacted, phone_count = _PHONE_PATTERN.subn("[REDACTED_PHONE]", redacted)
    kinds = tuple(
        kind
        for kind, count in (("email", email_count), ("phone", phone_count), ("card", card_count))
        if count
    )
    return PiiInspection(redacted_text=redacted, kinds=kinds)


def redact_pii(text: str) -> str:
    """Return a log-safe version of text with supported PII values replaced by type markers."""
    return inspect_pii(text).redacted_text


def build_ticket_guardrails(ticket: Ticket, trust_level: TicketTrustLevel) -> SecuredTicket:
    """Apply the input, structural-boundary, and least-privilege layers before model dispatch."""
    return SecuredTicket(
        input_inspection=inspect_untrusted_input(ticket.submitted_text),
        structural_boundary=render_ticket_data(ticket),
        tool_policy=ToolExposurePolicy.for_ticket(trust_level),
    )


def check_model_output(
    response_text: str,
    *,
    system_prompt: str,
    credentials: Iterable[str] = (),
) -> OutputSafetyCheck:
    """Return a data-leakage result for system-prompt echoes or credential-like output."""
    if not isinstance(response_text, str) or not isinstance(system_prompt, str):
        raise TypeError("Output and system prompt must be text")
    findings: list[SecurityFinding] = []
    if system_prompt.strip() and system_prompt.strip() in response_text:
        findings.append(
            SecurityFinding("system_prompt_echo", "Model output contains the system prompt.")
        )
    if any(secret and secret in response_text for secret in credentials):
        findings.append(
            SecurityFinding("credential_echo", "Model output contains a supplied credential.")
        )
    if _API_KEY_PATTERN.search(response_text):
        findings.append(
            SecurityFinding("credential_pattern", "Model output contains an API-key shape.")
        )
    return OutputSafetyCheck(allowed=not findings, findings=tuple(findings))


def require_safe_model_output(
    response_text: str,
    *,
    system_prompt: str,
    credentials: Iterable[str] = (),
) -> str:
    """Enforce the output layer by refusing to pass detected leaked content to a caller."""
    check = check_model_output(
        response_text,
        system_prompt=system_prompt,
        credentials=credentials,
    )
    if not check.allowed:
        kinds = ", ".join(finding.kind for finding in check.findings)
        raise OutputLeakageError(f"Model output failed data-leakage checks: {kinds}.")
    return response_text
