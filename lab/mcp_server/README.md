# Triage MCP server

This server exposes reusable, read-only triage capabilities with the official `mcp` Python package.
It shares the local fixture data used by `lab/tools/`, but ownership changes at the protocol boundary:
the MCP server exposes capabilities for any connected client, while the triage application owns its
client-side custom-tool definitions, result dispatch, and approval decisions.

| MCP primitive | Exposed capability |
|---|---|
| Resources | `triage://knowledge-base/account-access`, `billing-invoices`, and `service-availability` article excerpts |
| Tools | Read-only `search_kb(query, limit)` and `lookup_customer(customer_id)` |
| Prompt | `triage_ticket(customer_id, ticket_text)` reusable triage instruction |

The MCP tools deliberately expose only read operations. The client-side write tools and their explicit
approval requirement remain in [`lab/tools/`](../tools/README.md), where the caller can show an
approval decision before allowing a side effect.

## Transport choice

| Transport | Choose this when | Deployment shape |
|---|---|---|
| stdio | A local subprocess serves one user or one desktop/client integration. | The client starts `python -m lab.mcp_server.stdio` and communicates through stdin/stdout. |
| Streamable HTTP | A separately deployed service must be reachable by networked, multi-client consumers. | Run `python -m lab.mcp_server.http`; it listens at `http://127.0.0.1:8000/mcp` by default. |

## Run

Both entry points use only local fixture data and require no API key.

```powershell
python -m lab.mcp_server.stdio
```

```powershell
$env:TRIAGE_MCP_HOST = "127.0.0.1"
$env:TRIAGE_MCP_PORT = "8000"
python -m lab.mcp_server.http
```
