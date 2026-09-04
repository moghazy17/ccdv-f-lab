"""Client-side custom tools for the ticket-triage lab.

Demonstrates the blueprint sub-skill ``Tool Implementation``. See
``notes/08-tools-and-mcps/`` for the associated study notes.
"""

from lab.tools.dispatcher import TOOL_DEFINITIONS, dispatch_tool_uses
from lab.tools.fixtures import TriageFixture

__all__ = ["TOOL_DEFINITIONS", "TriageFixture", "dispatch_tool_uses"]
