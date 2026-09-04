"""In-memory triage data shared by custom tools and the MCP server.

Demonstrates the blueprint sub-skills ``Tool Implementation`` and ``MCP Server Development``. See
``notes/08-tools-and-mcps/`` for the associated study notes.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class KnowledgeBaseArticle:
    """One short article made available through the local knowledge-base fixture."""

    id: str
    title: str
    excerpt: str
    keywords: tuple[str, ...]


@dataclass(frozen=True)
class Customer:
    """The customer-service facts that read-only lookups may return."""

    id: str
    plan_tier: str
    open_ticket_count: int


KNOWLEDGE_BASE = (
    KnowledgeBaseArticle(
        id="account-access",
        title="Account access recovery",
        excerpt=(
            "Verify the account email and recovery channel before asking the customer to reset "
            "their password."
        ),
        keywords=("account", "access", "password", "sign in", "recovery"),
    ),
    KnowledgeBaseArticle(
        id="billing-invoices",
        title="Billing and invoice questions",
        excerpt=(
            "Confirm the invoice number and billing period, then explain whether the charge is "
            "recurring or usage based."
        ),
        keywords=("billing", "invoice", "charge", "payment", "subscription"),
    ),
    KnowledgeBaseArticle(
        id="service-availability",
        title="Service availability incidents",
        excerpt=(
            "Collect the affected region, start time in UTC, and the feature that is unavailable "
            "before escalating an availability incident."
        ),
        keywords=("availability", "outage", "incident", "region", "unavailable"),
    ),
)

CUSTOMERS = {
    "customer-100": Customer(id="customer-100", plan_tier="team", open_ticket_count=2),
    "customer-200": Customer(id="customer-200", plan_tier="enterprise", open_ticket_count=1),
}

TICKETS = {
    "ticket-100": "customer-100",
    "ticket-200": "customer-200",
}


def search_knowledge_base(query: str, limit: int) -> list[dict[str, object]]:
    """Return at most ``limit`` article excerpts relevant to a plain-text query."""
    terms = {term for term in query.casefold().split() if term}
    if not terms:
        raise ValueError("Search query must contain at least one word.")

    ranked: list[tuple[int, KnowledgeBaseArticle]] = []
    for article in KNOWLEDGE_BASE:
        searchable = " ".join((article.title, article.excerpt, *article.keywords)).casefold()
        score = sum(term in searchable for term in terms)
        if score:
            ranked.append((score, article))

    ranked.sort(key=lambda item: (-item[0], item[1].id))
    return [
        {"article_id": article.id, "title": article.title, "excerpt": article.excerpt}
        for _, article in ranked[:limit]
    ]


def lookup_customer_record(customer_id: str) -> dict[str, object]:
    """Return plan and current open-ticket facts for a fixture customer identifier."""
    try:
        customer = CUSTOMERS[customer_id]
    except KeyError as error:
        raise LookupError(
            f"No customer exists for {customer_id!r}. Check the customer ID and try again."
        ) from error
    return asdict(customer)


class TriageFixture:
    """A per-dispatcher mutable fixture for approved follow-ups and escalations."""

    def __init__(self) -> None:
        """Start with no side effects, so each dispatcher has isolated teaching state."""
        self.followups: list[dict[str, str]] = []
        self.escalations: list[dict[str, str]] = []

    def create_followup(self, ticket_id: str, summary: str, assignee: str) -> dict[str, str]:
        """Record an approved follow-up after confirming that its ticket exists."""
        self._require_ticket(ticket_id)
        followup = {
            "followup_id": f"followup-{len(self.followups) + 1}",
            "ticket_id": ticket_id,
            "summary": summary,
            "assignee": assignee,
            "status": "created",
        }
        self.followups.append(followup)
        return followup

    def escalate_ticket(self, ticket_id: str, reason: str) -> dict[str, str]:
        """Record an approved escalation after confirming that its ticket exists."""
        self._require_ticket(ticket_id)
        escalation = {"ticket_id": ticket_id, "reason": reason, "status": "escalated"}
        self.escalations.append(escalation)
        return escalation

    @staticmethod
    def _require_ticket(ticket_id: str) -> None:
        """Reject an unknown ticket with a recovery instruction for the model."""
        if ticket_id not in TICKETS:
            raise LookupError(
                f"No ticket exists for {ticket_id!r}. Check the ticket ID before retrying."
            )
