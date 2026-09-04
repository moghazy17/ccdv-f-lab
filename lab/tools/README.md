# Triage custom tools

This package demonstrates the client-side custom-tool layer for the triage application. The calling
application sends `TOOL_DEFINITIONS` with its model request, receives `tool_use` blocks, and passes
the complete assistant message to `dispatch_tool_uses()`.

| Tool | Capability | Approval |
|---|---|---|
| `search_kb(query, limit)` | Read knowledge-base excerpts from the local fixture | Not required |
| `lookup_customer(customer_id)` | Read a plan tier and open-ticket count | Not required |
| `create_followup(ticket_id, summary, assignee)` | Record a follow-up in the fixture | Required |
| `escalate_ticket(ticket_id, reason)` | Record an escalation in the fixture | Required |

Every custom definition uses top-level `strict: true`, a closed object schema, and required fields.
The dispatcher also validates direct calls so malformed test or integration input becomes an actionable
`tool_result` error instead of an uncaught exception.

## Approval and result batching

Write tools have `requires_approval: true`. A caller must pass a decision keyed by `tool_use.id`; for
example, `approval_decisions={"toolu-1": True}`. A missing or `False` decision produces an
`is_error: true` result and leaves the fixture unchanged.

One assistant turn can contain several `tool_use` blocks. `dispatch_tool_uses()` executes every block
and returns all matching `tool_result` blocks in one `{"role": "user"}` message. This is the client
side of tool use: the triage process owns the definitions, approval policy, and dispatch.

The separately deployed, reusable server-side interface is in [`lab/mcp_server/`](../mcp_server/). It
serves its own resources, tools, and prompt through MCP; it does not execute the write actions above.
