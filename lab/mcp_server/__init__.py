"""Reusable MCP server for triage knowledge-base and customer-service capabilities.

Demonstrates the blueprint sub-skill ``MCP Server Development``. See
``notes/08-tools-and-mcps/`` for the associated study notes.
"""

from lab.mcp_server.server import RESOURCE_URI_PREFIX, create_server, server

__all__ = ["RESOURCE_URI_PREFIX", "create_server", "server"]
