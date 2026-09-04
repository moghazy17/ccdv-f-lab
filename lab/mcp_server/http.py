"""Run the triage MCP server through local Streamable HTTP.

Demonstrates the blueprint sub-skill ``MCP Server Development``. See
``notes/08-tools-and-mcps/`` for the associated study notes.
"""

from __future__ import annotations

import os

from lab.mcp_server.server import create_server


def main() -> None:
    """Run a separately deployed MCP server at the configured local HTTP host and port."""
    host = os.environ.get("TRIAGE_MCP_HOST", "127.0.0.1")
    port = _port_from_environment(os.environ.get("TRIAGE_MCP_PORT", "8000"))
    create_server(host=host, port=port).run(transport="streamable-http")


def _port_from_environment(value: str) -> int:
    """Parse a valid TCP port with an explicit error instead of accepting an accidental value."""
    try:
        port = int(value)
    except ValueError as error:
        raise ValueError("TRIAGE_MCP_PORT must be an integer from 1 through 65535") from error
    if not 1 <= port <= 65535:
        raise ValueError("TRIAGE_MCP_PORT must be an integer from 1 through 65535")
    return port


if __name__ == "__main__":
    main()
