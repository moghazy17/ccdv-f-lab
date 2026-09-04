"""MCP resources, read-only tools, and a prompt for reusable triage services.

Demonstrates the blueprint sub-skills ``MCP Server Development`` and ``Tool Implementation``. See
``notes/08-tools-and-mcps/`` for the associated study notes.
"""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from lab.tools.fixtures import KNOWLEDGE_BASE, lookup_customer_record, search_knowledge_base

RESOURCE_URI_PREFIX = "triage://knowledge-base/"


def create_server(*, host: str = "127.0.0.1", port: int = 8000) -> FastMCP:
    """Create the reusable triage MCP server for either local stdio or Streamable HTTP."""
    triage_server = FastMCP(
        name="Triage knowledge and customer service",
        instructions=(
            "Use the knowledge-base resources and read-only customer-service tools to help triage "
            "support tickets."
        ),
        host=host,
        port=port,
    )

    for article in KNOWLEDGE_BASE:
        _register_article_resource(triage_server, article.id, article.title, article.excerpt)

    @triage_server.tool(
        name="search_kb",
        description=(
            "Search the triage knowledge base by a plain-text query and return at most limit short "
            "article excerpts. This is read-only and does not return customer information."
        ),
    )
    def search_kb(query: str, limit: int) -> dict[str, Any]:
        """Expose the shared read-only knowledge-base capability through MCP."""
        return {"query": query, "excerpts": search_knowledge_base(query, limit)}

    @triage_server.tool(
        name="lookup_customer",
        description=(
            "Look up one customer by customer ID and return plan tier plus current open-ticket "
            "count. This is read-only and does not create or update customer records."
        ),
    )
    def lookup_customer(customer_id: str) -> dict[str, object]:
        """Expose the shared read-only customer-service capability through MCP."""
        return lookup_customer_record(customer_id)

    @triage_server.prompt(
        name="triage_ticket",
        description=(
            "Create a consistent triage instruction for a supplied customer ID and support-ticket "
            "text."
        ),
    )
    def triage_ticket(customer_id: str, ticket_text: str) -> str:
        """Return a reusable prompt template for a client that is triaging one ticket."""
        return (
            "Triage the support ticket for the customer below. Use available read-only knowledge "
            "and customer-service capabilities only when they clarify a triage decision.\n\n"
            f"Customer ID: {customer_id}\n"
            f"Ticket text:\n{ticket_text}"
        )

    return triage_server


def _register_article_resource(
    triage_server: FastMCP, article_id: str, title: str, excerpt: str
) -> None:
    """Register each fixture article as a directly addressable MCP resource URI."""
    uri = f"{RESOURCE_URI_PREFIX}{article_id}"

    @triage_server.resource(
        uri,
        name=article_id,
        title=title,
        description="A read-only support knowledge-base article excerpt.",
        mime_type="text/plain",
    )
    def article_resource() -> str:
        """Return this article's immutable text when a client reads its URI."""
        return f"{title}\n\n{excerpt}"


server = create_server()
