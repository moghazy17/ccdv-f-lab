"""In-process and stdio MCP SDK tests for the reusable triage service."""

from __future__ import annotations

import sys
from pathlib import Path

import anyio
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp.shared.memory import create_connected_server_and_client_session

from lab.mcp_server import create_server

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


def test_mcp_server_exposes_resources_tools_and_prompts_in_process() -> None:
    """A memory-stream client can discover and exercise every required MCP primitive."""

    async def exercise() -> None:
        async with create_connected_server_and_client_session(create_server()) as session:
            resources = await session.list_resources()
            resource_uris = {str(resource.uri) for resource in resources.resources}
            assert resource_uris == {
                "triage://knowledge-base/account-access",
                "triage://knowledge-base/billing-invoices",
                "triage://knowledge-base/service-availability",
            }

            article = await session.read_resource("triage://knowledge-base/account-access")
            assert "Account access recovery" in article.contents[0].text

            tools = await session.list_tools()
            assert {tool.name for tool in tools.tools} == {"search_kb", "lookup_customer"}
            customer = await session.call_tool("lookup_customer", {"customer_id": "customer-200"})
            assert customer.isError is False
            assert customer.structuredContent == {
                "id": "customer-200",
                "open_ticket_count": 1,
                "plan_tier": "enterprise",
            }

            prompts = await session.list_prompts()
            assert [prompt.name for prompt in prompts.prompts] == ["triage_ticket"]
            prompt = await session.get_prompt(
                "triage_ticket",
                {"customer_id": "customer-100", "ticket_text": "I cannot sign in."},
            )
            assert "I cannot sign in." in prompt.messages[0].content.text

    anyio.run(exercise)


def test_mcp_stdio_round_trip_smoke_test() -> None:
    """The documented subprocess entry point completes MCP initialization and a tool call."""

    async def exercise() -> None:
        parameters = StdioServerParameters(
            command=sys.executable,
            args=["-m", "lab.mcp_server.stdio"],
            cwd=REPOSITORY_ROOT,
        )
        async with stdio_client(parameters) as (read_stream, write_stream):
            from mcp.client.session import ClientSession

            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                result = await session.call_tool(
                    "search_kb", {"query": "service availability", "limit": 1}
                )
                assert result.isError is False
                assert result.structuredContent is not None

    anyio.run(exercise)
