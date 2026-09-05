---
domain_name: "Model Selection and Optimization"
domain_number: 5
domain_weight: "16.8%"
sub_skills:
  - name: "Technical Fundamentals"
    weight: "6.1%"
  - name: "LLM Fundamentals"
    weight: "5.2%"
  - name: "Cost and Token Management"
    weight: "2.8%"
  - name: "Model Selection and Tradeoffs"
    weight: "2.7%"
---

# Model Selection and Optimization

This domain is 16.8% of the exam, second only to Applications and Integration. Its questions are
mostly tradeoff questions: given a workload, which model, which effort level, which of caching or
batching, and what breaks when you move to a newer model.

One warning before the material. This is the domain where stale knowledge is most dangerous, because
the parameters changed and the old ones now return errors rather than being quietly ignored. A
thinking budget, an assistant prefill, and a temperature setting were all ordinary practice on
earlier models and are all rejected on the current ones. Anything asserted here without a dated row
in `SOURCES.md` should be treated as unverified.

## Technical Fundamentals

The largest sub-skill in this domain, and the one least about Claude specifically: it is ordinary
engineering practice applied to an API that happens to serve a model.

### Scope

Everything reaches the model through one endpoint, `POST /v1/messages`. Tool use, structured output,
caching, thinking, and vision are parameters on that endpoint rather than separate APIs. The
supporting endpoints — Batches, Files, Token Counting, and Models — feed it or describe it.

An official SDK is a typed wrapper over that endpoint, not a different protocol. It supplies things
you would otherwise write yourself: credential resolution, automatic retries with backoff on
connection errors and on 408, 409, 429 and 5xx, a default request timeout, typed exception classes,
and streaming helpers. Reaching for a raw HTTP client inside a project that already has an SDK
installed discards all of that and gains nothing.

Two platform facts matter for infrastructure questions. Claude on Amazon Bedrock, Google Vertex AI,
and Microsoft Foundry is reached through that platform's dedicated client class, not by pointing the
first-party client at a different base URL — and model IDs differ per platform, with Bedrock taking
an `anthropic.` prefix. Feature availability also differs per platform, so "does this work on
Vertex" is a real question with a real answer rather than a formality.

### Decisions

| Decision | Choose this when |
|---|---|
| Official SDK | The project's language has one. This is the default; it carries retries, timeouts, and typed errors |
| Raw HTTP | The language has no SDK, the project is shell or cURL, or the request explicitly asks for REST |
| Streaming | Long input, long output, or a high `max_tokens`. Required in practice above roughly 64K output, because a non-streaming request hits the HTTP timeout first |
| Non-streaming | Short, bounded responses such as classification, where the round trip is quick |
| Platform client class | The workload runs on Bedrock, Vertex, or Foundry. Never a base-URL override of the first-party client |

Error handling is a tradeoff question in disguise. Catching one broad API exception collapses the
distinction that matters operationally: 429 and 5xx and connection failures are retryable, 400 and
404 are not. A most-specific-first chain preserves it.

### Evidence

- SDK retry and timeout defaults, and which status codes are retried.
- That streaming is required for large `max_tokens` rather than merely advisable.
- That platform-specific client classes exist and take different model IDs.

## LLM Fundamentals

The sub-skill where a remembered answer is most likely to be wrong, because the thinking and sampling
parameters changed and the old ones now fail rather than degrade.

### Scope

A token is the unit of both billing and context. The current tokenizer, introduced with Claude Opus
4.7, fits roughly 555,000 English words into a 1M-token context window; models older than it fit
roughly 750,000 words in the same nominal window. That difference matters when migrating: the same
text can produce a materially different token count on a different model, so a token budget carried
across a migration should be re-measured rather than assumed.

Thinking is the part most likely to be remembered wrongly. On current models it is **adaptive**: the
model decides per request whether to think and how deeply. You do not set a token budget for it. The
older manual mode — `thinking.type: "enabled"` with `budget_tokens` — is deprecated on the 4.6
generation and is not accepted on later models at all. Claude Haiku 4.5 is the exception in the
current lineup: it still uses the manual extended-thinking mode.

Effort is the steering lever for thinking, set at `output_config.effort` — a sibling of `thinking`,
not a field inside it. Two properties of effort are examinable and easy to get wrong: `high` is the
default, so setting it explicitly is identical to omitting it; and the resolved effort value is
rendered into the prompt, so changing effort mid-conversation invalidates the prompt cache.

Fast mode is a separate axis from effort. It runs the same model at higher output throughput for
premium pricing, and it is narrow: a research preview on the top Opus tier only, requiring the beta
messages endpoint, a beta flag, and a top-level `speed` parameter. It is not available on the
Batches API or on third-party platforms.

Sampling controls are gone on current models. `temperature`, `top_p`, and `top_k` are removed and
return a 400. Non-determinism has not gone away — the same prompt can still produce different output
— but it is no longer something you tune with a temperature dial.

### Decisions

| Decision | Choose this when |
|---|---|
| Adaptive thinking | Any current model. It is the only thinking mode they accept |
| Extended thinking with `budget_tokens` | Only on a model that still takes it, such as Claude Haiku 4.5, or legacy code on the 4.6 generation |
| Effort `low` | Simple or high-volume work, subagents, latency-sensitive routes where reasoning adds little |
| Effort `medium` | A cost step-down from the default where measurement shows quality holds |
| Effort `high` | The default. Intelligence-sensitive work, and the usual balance point |
| Effort `xhigh` | Coding and long-horizon agentic work on models that support it |
| Effort `max` | Correctness matters more than cost, and measurement shows headroom above the level below |
| Fast mode | Output throughput is the binding constraint, the workload is on a supporting model, and the premium is acceptable |

The instinct to reach for a cheaper model first is usually wrong on cost grounds alone. Lower effort
on a more capable model often matches or beats a weaker model at high effort, and it keeps one cache
namespace rather than splitting traffic across two.

### Evidence

- The effort levels, their behavior, and that `high` is the default.
- That effort lives at `output_config.effort`, and that changing it invalidates the cache.
- That `budget_tokens` is deprecated on the 4.6 generation and rejected on later models.
- That sampling parameters are removed on current models.
- The tokenizer change and its effect on words per context window.
- Fast mode's model, endpoint, and platform restrictions.

## Cost and Token Management

Largely mechanical: two structural discounts, one prefix-matching cache, and an output budget that
reasoning now shares with the answer.

### Scope

Cost is driven by four numbers: input tokens, output tokens, what fraction of input is served from
cache, and whether the request went through the synchronous or the batch path.

Two discounts are structural rather than negotiated. Batch requests cost 50% of the synchronous
price. Cache reads cost 10% of the base input price on current models. They compose: a cached prefix
inside a batch request pays both reductions.

Prompt caching is a **prefix match**, and that single fact explains most of its failure modes. The
render order is tools, then system, then messages. Any byte that changes anywhere in the prefix
invalidates everything after it. Stable content therefore belongs first and volatile content — a
timestamp, a per-request identifier, the user's actual question — belongs after the last cache
breakpoint. A request is capped at four breakpoints, and a prefix shorter than the model's minimum
simply will not cache, silently.

Thinking complicates the token budget in a way worth stating plainly. Thinking tokens are billed as
output tokens and count toward `max_tokens`, so a `max_tokens` sized for an answer without thinking
is often too small once the model starts thinking. There is no separate thinking budget to raise.
Two controls bound the cost: `max_tokens` is a hard ceiling the model is unaware of, and `effort` is
soft guidance that shapes how much of that ceiling goes to reasoning.

Verification is a measurement, not an assumption. `usage.cache_read_input_tokens` staying at zero
across repeated identical-prefix requests means something in the prefix is changing — the usual
culprits are a clock reading in the system prompt, an unsorted JSON serialization, or a tool list
whose order varies. `usage.output_tokens_details.thinking_tokens` reports how much of the billed
output was reasoning.

### Decisions

| Decision | Choose this when |
|---|---|
| Prompt caching | A large stable prefix is reused across requests. Try this before any quality tradeoff |
| Batch API | Results are not needed immediately. Half price, asynchronous, results return in any order |
| Synchronous | A user is waiting, or the result feeds the next step of an interactive flow |
| Lower effort | Caching is already in place and cost still needs to come down. This is the first lever that trades quality |
| A cheaper model | Measurement shows a smaller model holds quality on this specific route |

Judge cost per completed task rather than per request. A cheaper request that needs more turns or a
retry to finish the job is not cheaper.

### Evidence

- Batch at 50% of synchronous price; cache reads at 10% of base input price.
- The four-breakpoint limit and the tools, system, messages render order.
- That thinking tokens bill as output and count toward `max_tokens`.
- The `usage` fields that verify caching and report thinking tokens.

## Model Selection and Tradeoffs

The most tradeoff-shaped sub-skill in the domain: four current models, one of which differs from the
others on three axes at once, and a set of migration changes that fail loudly.

### Scope

The current lineup, from most to least capable, is Claude Fable 5.1, Claude Opus 5, Claude Sonnet 5,
and Claude Haiku 4.5. All four take text and image input and support tool use. Where they differ is
the part that gets examined.

Claude Haiku 4.5 is the odd one out in three ways at once, and each is a plausible exam distractor:
it has a 200K context window where the others have 1M, it uses manual extended thinking rather than
adaptive thinking, and it does not support the effort parameter at all. A question that assumes
effort works uniformly across the lineup is testing exactly this.

Model IDs are pinned snapshots. From the 4.6 generation onward the IDs are dateless —
`claude-opus-5` rather than a date-suffixed variant — but dateless does not mean floating. Each is
its own pinned snapshot, which is why pinning explicitly is both possible and expected.

Retirement is a scheduled event with a published commitment per model, not an unannounced removal.
That is what makes version pinning a maintenance practice rather than a one-time decision: pinned
code keeps working until a known date, and the date is the trigger for planned migration work.

The blueprint names "breaking behavior changes across model releases" explicitly, and the current
set is worth memorizing as a group, because each fails loudly rather than degrading quietly:

- `budget_tokens` is rejected on current models; adaptive thinking replaces it.
- Assistant prefill — putting words in the assistant's mouth as the last message — returns a 400.
  Structured output or a system instruction is the replacement.
- `temperature`, `top_p`, and `top_k` are removed.
- `output_format` is superseded by `output_config.format`.

### Decisions

| Decision | Choose this when |
|---|---|
| Claude Opus 5 | The default for most workloads, including complex agentic coding |
| Claude Fable 5.1 | Demanding reasoning or long-horizon agentic work, or evals on Opus at higher effort still fall short |
| Claude Sonnet 5 | Speed and intelligence are both needed at lower cost, typically high-volume production traffic |
| Claude Haiku 4.5 | Speed is the binding constraint and the task is simple. Check the 200K window and the absence of effort support before choosing it |
| Raise effort before changing model | Quality is short on a capable model. Cheaper than a cascade, and keeps one cache namespace |

### Evidence

- The current model IDs, context windows, max output, and per-MTok prices.
- That Claude Haiku 4.5 has a 200K window, uses extended thinking, and does not support effort.
- That model IDs are pinned snapshots, including the dateless ones.
- The published retirement commitments.
- The breaking changes listed above, and that each returns an error rather than being ignored.

## Where the lab demonstrates this

The reference application carries the running-code version of several claims in this domain. See
`lab/config.py` for explicit model pinning,
`lab/transport.py` for the keyless mock boundary that lets the rest of the
suite run without credentials, and `lab/caching.py` and
`lab/batch.py` for the two cost levers described above.
