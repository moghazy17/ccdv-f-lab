# Triage lab

`triage` is a reference support-ticket triage assistant for this study kit. It accepts end-user ticket
text, treats that text as untrusted input, requests a structured classification, and validates the
result before a caller can use it. The lab is deliberately limited to the package foundation:
configuration, transport, ingest, and output handling. Tool use, MCP, an agent loop, routing, caching,
batch processing, hooks, security hardening, and evals are outside this module set.

## Run keyless

The default `Settings` transport is `mock`. `MockTransport` uses a recorded deterministic response;
it neither imports the Anthropic SDK nor needs `ANTHROPIC_API_KEY`.

```powershell
python -c "from lab.ingest import Ticket, assemble_triage_request; from lab.transport import MockTransport; from lab.output import parse_triage_response; response = MockTransport().send(assemble_triage_request(Ticket('demo-1', 'I cannot access my account.'))); print(parse_triage_response(response))"
```

Set `TRIAGE_TRANSPORT=anthropic` only when deliberately using the live SDK. The package pins every
model choice in `lab/config.py`; it never selects a provider default. Live use may incur provider
charges, while the default mock path makes no provider request and is suitable for CI.

## Blueprint coverage

| Lab module | Blueprint sub-skill(s) demonstrated |
|---|---|
| `lab/config.py` | Configuration Management; Model Selection and Tradeoffs |
| `lab/transport.py` | Claude API Mechanics; LLM Fundamentals; Debugging and Error Handling |
| `lab/ingest.py` | Claude Application Design; Prompt Engineering; AI Application Security |
| `lab/output.py` | Output Handling; Debugging and Error Handling |

Each module docstring links to the corresponding `notes/` domain directory. The lab keeps model pins
and prompt versions visible, makes provider responses normalised at one transport seam, and parses all
model output defensively.

## Trust boundary

`Ticket.submitted_text` and its metadata are untrusted input. `assemble_triage_request()` constructs
trusted system instructions in `NormalisedRequest.system` and puts the JSON-encoded ticket only in a
separate user message, surrounded by `<untrusted_ticket_data>` delimiters. Ticket text is never
concatenated into the system prompt. The static system instruction identifies the delimited content as
data, but the separate request fields make the boundary a property of the code path too.
