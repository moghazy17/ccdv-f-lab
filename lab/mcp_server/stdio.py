"""Run the triage MCP server as a local subprocess over standard input and output.

Demonstrates the blueprint sub-skill ``MCP Server Development``. See
``notes/08-tools-and-mcps/`` for the associated study notes.
"""

from lab.mcp_server.server import server


def main() -> None:
    """Run one MCP server process whose client communicates through stdin and stdout."""
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
