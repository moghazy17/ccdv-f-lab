# Sources

Every factual claim in this repo about the exam, the Claude API, models, or pricing traces to an entry
here. Each entry carries a **verified on** date, because the credential is valid for only 12 months and
the exam guide is explicitly "subject to change without notice" — an undated claim rots silently.

**When you add a claim, add its source. When you re-check a source, update its date.**

## Primary — the exam

| Source | What it establishes | Verified |
|---|---|---|
| [Claude Certified Developer – Foundations Exam Guide (PDF)][guide] — v1.0, effective July 2026 | The whole of [`BLUEPRINT.md`](BLUEPRINT.md): 8 domains, 25 sub-skills, exact weights, 53 items, 120 min, 720/1000 cut score, $125 fee, 12-month validity, retake ladder, no prerequisites, scoring model, exam-day rules, NDA, renewal | 2026-09-04 |
| [Certification FAQ][faq] — Anthropic Partner Academy | Four certifications and fees; 720 cut score across all four; 120-min format; retake waits; 12-month validity; **registration requires a Partner Network organization email on a recognized company domain** | 2026-09-04 |
| [CCDV-F prep path][path] — Anthropic Partner Academy | The 5 prep modules and their durations; the 9 recommended prerequisite courses | 2026-09-04 |
| [Certification prep courses index][prep] | Which prep track maps to which credential | 2026-09-04 |

## Primary — the technology

Claims about API behavior, model tiers, Claude Code, Skills, and MCP should cite Anthropic's official
documentation rather than a community summary. Add rows as notes are written.

| Source | What it establishes | Verified |
|---|---|---|
| [Models overview][models] — Anthropic | The current lineup with model IDs, context windows, max output, and per-MTok pricing; which models take adaptive versus extended thinking; the default effort level, and that Claude Haiku 4.5 does not support effort at all; that every model ID is a pinned snapshot, including the dateless ones; batch at 50% of synchronous price and cache reads at 10% of base input; the published retirement commitments | 2026-09-05 |
| [Steering thinking][steering] — Anthropic | The effort levels and what each does, with `high` as the default; that effort is set at `output_config.effort` rather than inside `thinking`; that changing effort mid-conversation invalidates the prompt cache while restating the default does not; that thinking counts toward `max_tokens` and there is no separate thinking budget; that billing covers the full reasoning regardless of the `display` setting; `usage.output_tokens_details.thinking_tokens` | 2026-09-05 |
| [How Claude remembers your project][memory] — Anthropic (Claude Code docs) | CLAUDE.md and auto memory are both loaded as context, not enforced configuration — "Claude treats them as context, not enforced configuration. To block an action regardless of what Claude decides, use a PreToolUse hook instead"; the CLAUDE.md scope table and its load order (managed policy, then user, then project, then local); that discovered files are concatenated into context rather than overriding each other, ordered from the filesystem root down to the working directory; that settings rules are enforced by the client regardless of what Claude decides, while CLAUDE.md instructions only shape behavior | 2026-09-08 |
| [Custom slash commands][slash] — Anthropic (Claude Code docs) | Personal commands live under `~/.claude/commands/` (or `~/.claude/skills/`) and are available on that machine across all projects; project commands live under `.claude/commands/` (or `.claude/skills/`) at the repo root, are shared with teammates via source control, and load for anyone who clones the repository; the command-name derivation from file/directory name; the scope priority order when names collide (enterprise, personal, project, nested, plugin, bundled) | 2026-09-08 |
| [Claude API errors][errors] — Anthropic | The HTTP error taxonomy (400 `invalid_request_error`, 401 `authentication_error`, 429 `rate_limit_error`, 500 `api_error`, 529 `overloaded_error`, etc.) as integration/transport-layer failures, each with its own retry guidance (for example, retry 500s with exponential backoff; honor `retry-after` on 429s); that a stream can still fail mid-response after an initial 200, which does not follow these HTTP-level error mechanics | 2026-09-08 |
| [Messages API reference][messages-api] — Anthropic | That the Messages API is stateless, so each request is independent and prior turns must be resent in full; the `stop_reason` field and its values, in particular that `stop_reason: "max_tokens"` means the response was cut off because it hit the request's `max_tokens` limit and is therefore incomplete, distinct from `end_turn` (natural completion) or `stop_sequence` (custom stop string matched) | 2026-09-08 |
| [Self-hosted sandboxes][managed-self-hosted] — Anthropic | Managed Agents' two deployment models: the default Anthropic-hosted cloud sandbox runs tool execution, filesystem, and network egress on Anthropic's infrastructure, while self-hosted sandboxes move tool execution to the customer's own infrastructure while the model and orchestration stay on Anthropic's control plane | 2026-09-08 |
| [Agent SDK overview][agent-sdk-overview] — Anthropic (Claude Code docs) | What the Agent SDK is; its comparison table against the CLI, Client SDK, and Managed Agents; that it bundles the same agent loop, hooks, subagents, and context management as Claude Code | 2026-09-08 |
| [How the agent loop works][agent-loop] — Anthropic (Claude Code docs) | The turn and message lifecycle; that `max_turns` bounds tool-use turns independent of model behavior and yields an `error_max_turns` result subtype; the hooks table; that subagents start with a fresh context and return only a summary to the parent | 2026-09-08 |
| [Control execution with hooks][agent-hooks] — Anthropic (Claude Code docs) | Hooks as callbacks that run in the harness's own process to block dangerous operations before they execute, independent of what the model decided | 2026-09-08 |
| [Handle tool calls][handle-tool-calls] — Anthropic | That every `tool_use` block from one assistant turn must be answered by `tool_result` blocks in the single immediately following user message, each correlated by `tool_use_id`, with no messages in between | 2026-09-08 |
| [Context editing][context-editing] — Anthropic | The `clear_tool_uses` strategy selectively clears stale tool results in place while preserving the rest of the conversation, distinct from compaction, which summarizes and replaces the full history it covers | 2026-09-08 |
| [Building effective agents][effective-agents] — Anthropic | The workflow ("predefined code paths") versus agent ("dynamically directs its own process") definitions; that frameworks simplify low-level tasks but add abstraction that obscures debugging, and the recommendation to start with direct API use and the simplest solution | 2026-09-08 |
| [Subagents][sub-agents] — Anthropic (Claude Code docs) | That a subagent runs in its own separate context window and returns only a summary to the main conversation, keeping intermediate work out of the parent's context | 2026-09-08 |
| [Mitigate jailbreaks and prompt injections][mitigate-jailbreaks] — Anthropic | Direct versus indirect prompt injection threat models; JSON-encoding untrusted content with explicit delimiters so an attacker cannot break out into an instruction context; stating in the system prompt that delimited content is data, not commands; applying least privilege to limit what a successful injection can do; that pattern-based input screening is one layer among several, not a complete safeguard on its own | 2026-09-08 |
| [API key best practices][api-key-practices] — Anthropic | Resolving API keys from environment variables rather than hardcoding or committing them; that committing plaintext keys to a repository is a leading cause of key leaks; storing secrets in encrypted secret management in production rather than shared repository files | 2026-09-08 |
| [Python SDK][python-sdk] — Anthropic | Default automatic retries (connection errors, 408, 409, 429, and 5xx) with exponential backoff and a configurable `max_retries`; the default ten-minute timeout; the warning against a large `max_tokens` without streaming and the recommendation to stream long-running requests; the platform-specific client classes bundled in the base package | 2026-09-09 |
| [Claude in Amazon Bedrock][bedrock] — Anthropic | That Bedrock model IDs carry an `anthropic.` provider prefix and are reached through the platform's dedicated client class rather than a base-URL override of the first-party client | 2026-09-09 |
| [Prompting best practices][prompting-best-practices] — Anthropic | Setting a role in the system prompt to focus behavior and tone; using several diverse examples wrapped in `<example>` tags for a consistent output format; placing a long document above the query, instructions, and examples | 2026-09-09 |
| [Tool use with Claude][tool-use-overview] — Anthropic | That Claude selects a tool from the request and the tool's own description, so description scope and exclusions are what resolve selection ambiguity; the client-tool versus server-tool execution split; the built-in tool catalog | 2026-09-09 |
| [Agent Skills][skills-docs] — Anthropic (Claude Code docs) | What a Skill is — a loaded, prompt-based markdown bundle Claude orchestrates with its own tools — and how its scope and lifecycle differ from a custom tool or an MCP server | 2026-09-09 |
| [Structured outputs][structured-outputs] — Anthropic | That structured outputs guarantee schema conformance only, not factual accuracy: a validly shaped payload carrying a high self-reported confidence can still be wrong, so validation and an explicit escalation flag are the trustworthy signals | 2026-09-09 |
| [Transports][mcp-transports] — Model Context Protocol specification (not Anthropic documentation) | stdio as newline-delimited messages over a client-launched subprocess's standard streams, versus Streamable HTTP as one networked endpoint any client can reach — the choice a shared deployment turns on | 2026-09-09 |
| [Resources][mcp-resources] — Model Context Protocol specification (not Anthropic documentation) | MCP resources as a standardized way for a server to expose contextual data to any connecting client, distinct from tools and from prompts | 2026-09-09 |
| [Prompt caching][prompt-caching] — Anthropic | Up to four explicit cache breakpoints per request, with a fifth returning a 400; that a cache write happens at the marked breakpoint as a prefix hash; that non-deterministic content such as a timestamp placed at or before a breakpoint silently prevents a cache hit with no error returned | 2026-09-09 |
| [API overview][api-overview] — Anthropic | The direct Claude API versus cloud-platform comparison (Amazon Bedrock, Google Cloud, Microsoft Foundry); that feature availability varies by platform rather than being automatically at parity; that cloud-platform authentication integrates with the provider's own identity system | 2026-09-09 |
| [Batch processing][batch-processing] — Anthropic | The Message Batches submit, poll, and retrieve lifecycle; that results can return in any order and must be matched to requests by `custom_id` rather than by position; the halved cost and the typical completion window | 2026-09-09 |

## Deliberately not sources

- **Third-party practice-test vendors and exam-dump sites.** Not cited here at any point. They are
  frequently wrong, and the ones claiming real exam questions are trading in material every candidate
  is contractually barred from disclosing.
- **Other community study repos.** Useful for gauging what already exists; not evidence for a factual
  claim. If a claim only traces to another community repo, it is not sourced.

[guide]: https://everpath-course-content.s3-accelerate.amazonaws.com/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public/1783542875/Claude+Certified+Developer+%E2%80%93+Foundations+Exam+Guide.pdf
[faq]: https://anthropic-partners.skilljar.com/page/faq-certifications
[path]: https://anthropic-partners.skilljar.com/path/claude-certified-developer-foundations
[prep]: https://anthropic-partners.skilljar.com/page/claude-certification-exam-prep-courses
[models]: https://platform.claude.com/docs/en/about-claude/models/overview
[steering]: https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost
[memory]: https://code.claude.com/docs/en/memory
[slash]: https://code.claude.com/docs/en/slash-commands
[errors]: https://platform.claude.com/docs/en/api/errors
[messages-api]: https://platform.claude.com/docs/en/api/messages
[managed-self-hosted]: https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes
[agent-sdk-overview]: https://code.claude.com/docs/en/agent-sdk/overview
[agent-loop]: https://code.claude.com/docs/en/agent-sdk/agent-loop
[agent-hooks]: https://code.claude.com/docs/en/agent-sdk/hooks
[handle-tool-calls]: https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
[context-editing]: https://platform.claude.com/docs/en/build-with-claude/context-editing
[effective-agents]: https://www.anthropic.com/engineering/building-effective-agents
[sub-agents]: https://code.claude.com/docs/en/sub-agents
[mitigate-jailbreaks]: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks
[api-key-practices]: https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure
[python-sdk]: https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/python
[bedrock]: https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock
[prompting-best-practices]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
[tool-use-overview]: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
[skills-docs]: https://code.claude.com/docs/en/skills
[structured-outputs]: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
[mcp-transports]: https://modelcontextprotocol.io/docs/concepts/transports
[mcp-resources]: https://modelcontextprotocol.io/docs/concepts/resources
[prompt-caching]: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
[api-overview]: https://platform.claude.com/docs/en/api/overview
[batch-processing]: https://platform.claude.com/docs/en/build-with-claude/batch-processing
