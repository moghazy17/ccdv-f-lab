# Model Selection and Optimization cheat sheet

## Blueprint allocation

| Domain weight | Approximate items in a 53-item mock | Allocated mock items |
|---:|---:|---:|
| 16.8% | 8.9 | 9 |

## Sub-skills

| Sub-skill | Weight |
|---|---:|
| Technical Fundamentals | 6.1% |
| LLM Fundamentals | 5.2% |
| Cost and Token Management | 2.8% |
| Model Selection and Tradeoffs | 2.7% |

## Authored note extracts

### Decision tables

Each table answers one question: given a situation, which option, and when not to reach for it. The
exam is tradeoff-driven, so this is the shape most likely to be tested directly.

Source note: `notes/05-model-selection-and-optimization/decision-tables.md`

### Technical Fundamentals

| Option | Choose this when | Do not choose it when |
|---|---|---|
| Official SDK | The project's language has one. Carries credential resolution, retries on 408/409/429/5xx and connection errors, timeouts, typed errors, streaming helpers | Never, if an SDK exists — a raw client discards all of the above |
| Raw HTTP | No SDK for the language, a shell or cURL project, or REST was explicitly requested | An SDK is installed and you reached for `requests` or `fetch` because it felt lighter |
| Streaming | Long input, long output, or high `max_tokens`. Above roughly 64K output it is required, not advisory | Short bounded responses where the round trip is quick |
| Platform client class | Running on Bedrock, Vertex, or Foundry | Ever as a base-URL override of the first-party client — model IDs and available features differ too |
| Specific-first error chain | Always. Retryable and non-retryable failures need different handling | A single broad catch loses the 429-versus-400 distinction that operations depends on |

Source note: `notes/05-model-selection-and-optimization/decision-tables.md`

### LLM Fundamentals

| Option | Choose this when | Do not choose it when |
|---|---|---|
| Adaptive thinking | Any current model — it is the only mode they accept | Never on a current model; there is no alternative |
| Extended thinking with `budget_tokens` | The model still takes it, such as Claude Haiku 4.5, or legacy 4.6-generation code | On a current model. It returns a 400 rather than being ignored |
| Effort `low` | Simple or high-volume work, subagents, latency-sensitive routes | Intelligence-sensitive work where reasoning changes the answer |
| Effort `medium` | Measurement shows quality holds one step below the default | You have not measured; guessing downward costs quality invisibly |
| Effort `high` | The default. Intelligence-sensitive work and the usual balance point | Cost is the binding constraint and a lower level has been shown to hold |
| Effort `xhigh` | Coding and long-horizon agentic work on models that support it | Chat, classification, or other routine traffic — it buys little there |
| Effort `max` | Correctness matters more than cost, and there is measured headroom above the level below | As a default. It earns its cost only on genuinely hard problems |
| Fast mode | Output throughput is the binding constraint on a supporting model, and the premium is acceptable | On the Batches API or a third-party platform — it is unavailable there |

Source note: `notes/05-model-selection-and-optimization/decision-tables.md`

### Cost and Token Management

| Option | Choose this when | Do not choose it when |
|---|---|---|
| Prompt caching | A large stable prefix repeats across requests. The first lever to reach for, because it trades nothing | The prefix is shorter than the model's minimum — it will silently fail to cache |
| Batch API | Results are not needed immediately. Half price | A user is waiting, or the output feeds the next step of an interactive flow |
| Lower effort | Caching is in place and cost must still come down | Before caching. Effort is the first lever that trades quality; caching trades none |
| A cheaper model | Measurement shows a smaller model holds quality on this route | On instinct. Lower effort on a capable model often beats a weaker model at high effort, and keeps one cache namespace |
| Raise `max_tokens` | Responses stop at `max_tokens` and the reasoning was needed | The responses were over-thought — lower the effort instead |

**Where volatile content goes.** Render order is tools, then system, then messages. Stable content
first, volatile content — timestamps, request identifiers, the user's question — after the last
cache breakpoint. Four breakpoints per request is the ceiling.

Source note: `notes/05-model-selection-and-optimization/decision-tables.md`

### Model Selection and Tradeoffs

| Model | Choose this when | Watch out for |
|---|---|---|
| Claude Opus 5 | The default for most workloads, including complex agentic coding | Nothing specific — start here and move only with a reason |
| Claude Fable 5.1 | Demanding reasoning or long-horizon agentic work, or evals on Opus at higher effort still fall short | Highest price per token in the lineup |
| Claude Sonnet 5 | Speed and intelligence both matter at lower cost; high-volume production traffic | Less capable than Opus on the hardest reasoning |
| Claude Haiku 4.5 | Speed is the binding constraint and the task is simple | Three differences at once: 200K context not 1M, extended thinking not adaptive, and no effort support |

| Migration check | Why it matters |
|---|---|
| Remove `budget_tokens` | Rejected on current models |
| Remove assistant prefill | Returns a 400; use structured output or a system instruction |
| Remove `temperature`, `top_p`, `top_k` | Removed on current models |
| Move `output_format` to `output_config.format` | The old parameter is superseded |
| Re-measure token counts | The tokenizer changed with Claude Opus 4.7; the same text can cost differently |
| Re-tune effort | Effort matters more on newer models than on their predecessors |

Source note: `notes/05-model-selection-and-optimization/decision-tables.md`

### Pitfalls

Each entry states the mistake, then the correction. Most are stale-knowledge errors rather than
reasoning errors: the parameter used to work, and now returns an error instead of being ignored.

Source note: `notes/05-model-selection-and-optimization/pitfalls.md`

### Technical Fundamentals

**Reaching for a raw HTTP client inside an SDK project.** It looks lighter and costs you credential
resolution, automatic retries with backoff, sensible timeouts, typed exceptions, and streaming
helpers. The correction: use the SDK the language has, and drop to raw HTTP only when there is none.

**Catching one broad API exception.** A single catch treats a 400 and a 429 identically, so
non-retryable failures get retried and retryable ones get surfaced as bugs. The correction: a
most-specific-first chain, because the retryable set — connection errors, 408, 409, 429, 5xx — is
exactly the set the SDK already retries for you.

**Pointing the first-party client at a cloud provider's base URL.** Bedrock, Vertex, and Foundry
each have a dedicated client class. Model IDs differ per platform, and so does feature availability,
so a base-URL override produces confusing failures rather than a working integration.

**Assuming a non-streaming request can return a very large response.** Above roughly 64K output
tokens the request hits the HTTP timeout before the model finishes. Streaming is the mechanism, not
a preference.

Source note: `notes/05-model-selection-and-optimization/pitfalls.md`

### LLM Fundamentals

**Setting a thinking budget.** This is the single most likely stale answer in the domain.
`thinking.type: "enabled"` with `budget_tokens` was ordinary practice, is deprecated on the 4.6
generation, and is rejected on later models. The correction: adaptive thinking, steered by effort.
Claude Haiku 4.5 is the current-lineup exception that still uses the manual mode.

**Putting `effort` inside the `thinking` object.** It belongs at `output_config.effort`, a sibling
of `thinking`. This is a shape error, and shape errors fail at the API rather than degrading
quietly.

**Treating effort as free to change mid-conversation.** The resolved effort value is rendered into
the prompt, so changing it invalidates the prompt cache. Setting effort explicitly to the model's
default is equivalent to omitting it and does not break the cache — the invalidation comes from
changing the value, not from stating it.

**Assuming every assistant turn contains a thinking block.** Under adaptive thinking the model
decides per request, so a conversation can mix turns with and without reasoning. Application logic
that indexes into the first content block expecting a thinking block will break on the turns where
the model chose not to think.

**Reaching for temperature to control variability.** Sampling parameters are removed on current
models and return a 400. Non-determinism still exists; the dial does not.

**Confusing fast mode with effort.** They are different axes. Effort steers how much the model
thinks; fast mode runs the same model at higher output throughput for premium pricing, and only on
specific models, through the beta endpoint, and not on Batches or third-party platforms.

Source note: `notes/05-model-selection-and-optimization/pitfalls.md`

### Cost and Token Management

**Sizing `max_tokens` for the answer alone.** Thinking tokens bill as output and count toward
`max_tokens`. A ceiling that was right for an unthinking response truncates once the model starts
reasoning, and the symptom is `stop_reason: "max_tokens"`. Whether to raise the ceiling or lower the
effort depends on whether the reasoning was needed.

**Believing the visible thinking text is what you paid for.** Billing covers the full reasoning the
model generated, regardless of the `display` setting. `display` changes what you see, not what you
are charged. `usage.output_tokens_details.thinking_tokens` reports the real figure.

**Assuming caching is on because `cache_control` is present.** A prefix shorter than the model's
minimum silently does not cache. The correction: read `usage.cache_read_input_tokens`. If it stays
at zero across repeated identical-prefix requests, something in the prefix is changing.

**Putting volatile content early in the prompt.** Caching is a prefix match, so a clock reading, a
per-request identifier, or an unsorted JSON serialization near the front invalidates everything
after it. Stable content first; volatile content after the last breakpoint.

**Optimizing per request instead of per completed task.** A cheaper request that needs an extra turn
or a retry to finish the job is not cheaper.

Source note: `notes/05-model-selection-and-optimization/pitfalls.md`

### Model Selection and Tradeoffs

**Assuming the lineup is uniform apart from price.** Claude Haiku 4.5 differs on three axes at once
— a 200K context window rather than 1M, extended thinking rather than adaptive, and no effort
support. A design that assumes effort works everywhere fails specifically there.

**Treating a dateless model ID as a floating alias.** From the 4.6 generation onward the IDs have no
date suffix, but each is its own pinned snapshot. Appending a date you remember from training data
produces an ID that does not exist.

**Dropping to a cheaper model as the first cost lever.** Caching costs nothing in quality and comes
first; effort is the first lever that trades any. A model cascade also splits traffic across two
cache namespaces, forfeiting reuse.

**Expecting a model migration to be a string change.** Removed parameters — thinking budgets,
prefill, sampling — return errors rather than being ignored, and token counts shift with the
tokenizer introduced at Claude Opus 4.7. Migration means re-measuring and re-tuning, not editing one
constant.

**Treating retirement as an unannounced risk.** Each model carries a published retirement
commitment. That is what makes explicit version pinning a maintenance practice with a known deadline
rather than a gamble.

Source note: `notes/05-model-selection-and-optimization/pitfalls.md`

### Model Selection and Optimization

This domain is 16.8% of the exam, second only to Applications and Integration. Its questions are
mostly tradeoff questions: given a workload, which model, which effort level, which of caching or
batching, and what breaks when you move to a newer model.

One warning before the material. This is the domain where stale knowledge is most dangerous, because
the parameters changed and the old ones now return errors rather than being quietly ignored. A
thinking budget, an assistant prefill, and a temperature setting were all ordinary practice on
earlier models and are all rejected on the current ones. Anything asserted here without a dated row
in `SOURCES.md` should be treated as unverified.

Source note: `notes/05-model-selection-and-optimization/README.md`

### Technical Fundamentals

The largest sub-skill in this domain, and the one least about Claude specifically: it is ordinary
engineering practice applied to an API that happens to serve a model.

Source note: `notes/05-model-selection-and-optimization/README.md`

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

Source note: `notes/05-model-selection-and-optimization/README.md`

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

Source note: `notes/05-model-selection-and-optimization/README.md`

### Evidence

- SDK retry and timeout defaults, and which status codes are retried.
- That streaming is required for large `max_tokens` rather than merely advisable.
- That platform-specific client classes exist and take different model IDs.

Source note: `notes/05-model-selection-and-optimization/README.md`

### LLM Fundamentals

The sub-skill where a remembered answer is most likely to be wrong, because the thinking and sampling
parameters changed and the old ones now fail rather than degrade.

Source note: `notes/05-model-selection-and-optimization/README.md`

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

Source note: `notes/05-model-selection-and-optimization/README.md`

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

Source note: `notes/05-model-selection-and-optimization/README.md`

### Evidence

- The effort levels, their behavior, and that `high` is the default.
- That effort lives at `output_config.effort`, and that changing it invalidates the cache.
- That `budget_tokens` is deprecated on the 4.6 generation and rejected on later models.
- That sampling parameters are removed on current models.
- The tokenizer change and its effect on words per context window.
- Fast mode's model, endpoint, and platform restrictions.

Source note: `notes/05-model-selection-and-optimization/README.md`

### Cost and Token Management

Largely mechanical: two structural discounts, one prefix-matching cache, and an output budget that
reasoning now shares with the answer.

Source note: `notes/05-model-selection-and-optimization/README.md`

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

Source note: `notes/05-model-selection-and-optimization/README.md`

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

Source note: `notes/05-model-selection-and-optimization/README.md`

### Evidence

- Batch at 50% of synchronous price; cache reads at 10% of base input price.
- The four-breakpoint limit and the tools, system, messages render order.
- That thinking tokens bill as output and count toward `max_tokens`.
- The `usage` fields that verify caching and report thinking tokens.

Source note: `notes/05-model-selection-and-optimization/README.md`

### Model Selection and Tradeoffs

The most tradeoff-shaped sub-skill in the domain: four current models, one of which differs from the
others on three axes at once, and a set of migration changes that fail loudly.

Source note: `notes/05-model-selection-and-optimization/README.md`

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

Source note: `notes/05-model-selection-and-optimization/README.md`

### Decisions

| Decision | Choose this when |
|---|---|
| Claude Opus 5 | The default for most workloads, including complex agentic coding |
| Claude Fable 5.1 | Demanding reasoning or long-horizon agentic work, or evals on Opus at higher effort still fall short |
| Claude Sonnet 5 | Speed and intelligence are both needed at lower cost, typically high-volume production traffic |
| Claude Haiku 4.5 | Speed is the binding constraint and the task is simple. Check the 200K window and the absence of effort support before choosing it |
| Raise effort before changing model | Quality is short on a capable model. Cheaper than a cascade, and keeps one cache namespace |

Source note: `notes/05-model-selection-and-optimization/README.md`

### Evidence

- The current model IDs, context windows, max output, and per-MTok prices.
- That Claude Haiku 4.5 has a 200K window, uses extended thinking, and does not support effort.
- That model IDs are pinned snapshots, including the dateless ones.
- The published retirement commitments.
- The breaking changes listed above, and that each returns an error rather than being ignored.

Source note: `notes/05-model-selection-and-optimization/README.md`

### Where the lab demonstrates this

The reference application carries the running-code version of several claims in this domain. See
`lab/config.py` for explicit model pinning,
`lab/transport.py` for the keyless mock boundary that lets the rest of the
suite run without credentials, and `lab/caching.py` and
`lab/batch.py` for the two cost levers described above.

Source note: `notes/05-model-selection-and-optimization/README.md`

### Self-check

Answer from memory before looking. A prompt you can answer only by rereading is a prompt you have
not learned yet.

Source note: `notes/05-model-selection-and-optimization/self-check.md`

### Technical Fundamentals

1. Which single endpoint carries tool use, structured output, caching, thinking, and vision? Name
   the supporting endpoints that feed or describe it.
2. Name four things an official SDK gives you that a raw HTTP client does not.
3. Which HTTP status codes does the SDK retry by default, and which does it deliberately not retry?
4. At roughly what output size does streaming stop being a preference and become a requirement, and
   what fails if you ignore that?
5. A workload moves to Amazon Bedrock. What changes besides the credentials?
6. Why does catching a single broad API exception cause an operational problem rather than merely
   being untidy?

Source note: `notes/05-model-selection-and-optimization/self-check.md`

### LLM Fundamentals

1. What replaced `budget_tokens` on current models, and what happens if you send it anyway?
2. Which model in the current lineup still uses manual extended thinking?
3. Where exactly is the effort parameter set? Name the field path.
4. Which effort level is the default, and what is the consequence of setting it explicitly?
5. Why does changing effort partway through a conversation cost money beyond the effort change
   itself?
6. You index into `content[0]` expecting a thinking block and it is a text block. What did you
   assume that adaptive thinking does not guarantee?
7. How do you reduce output variability now that `temperature` is removed?
8. State two ways fast mode differs from raising effort.
9. A prompt of fixed length is moved from a pre-4.7 model to a current one. What happens to the
   token count, and what should you do about it?

Source note: `notes/05-model-selection-and-optimization/self-check.md`

### Cost and Token Management

1. What are the two structural discounts, and what does each cost relative to the base price?
2. In what order are `tools`, `system`, and `messages` rendered for caching, and why does the order
   matter?
3. How many cache breakpoints can one request carry?
4. `usage.cache_read_input_tokens` is zero across repeated requests with what you believe is an
   identical prefix. Name three likely causes.
5. Thinking tokens are billed as which kind of token, and which limit do they count against?
6. A response stops with `stop_reason: "max_tokens"`. Name the two remedies and the question that
   decides between them.
7. Does `display: "omitted"` reduce what you are billed? Explain.
8. Which usage field tells you how much of the billed output was reasoning?
9. Why is cost per completed task the right unit rather than cost per request?

Source note: `notes/05-model-selection-and-optimization/self-check.md`

### Model Selection and Tradeoffs

1. Name the four current models in capability order, with their per-MTok input and output prices.
2. Claude Haiku 4.5 differs from the rest of the lineup on three axes at once. Name all three.
3. Which models have a 1M-token context window, and which does not?
4. What is the maximum synchronous output for the 1M-context models?
5. Is `claude-opus-5` an alias or a pinned snapshot? What is the practical consequence?
6. List the four breaking changes that make a model migration more than a string swap.
7. Your evals fall short on Claude Opus 5 at high effort. What are the two next moves, and in which
   order would you try them?
8. Why does a two-model cost cascade forfeit something a single model at lower effort keeps?
9. What does a published retirement commitment let you do that an unannounced removal would not?

Source note: `notes/05-model-selection-and-optimization/self-check.md`

### Cross-cutting

1. This domain is 16.8% of the exam, roughly 9 items. Which of its four sub-skills carries the most
   weight, and does your study time reflect that?
2. For each claim you just recited, could you point to the row in `SOURCES.md`
   that backs it? An unsourced claim you are confident about is the most dangerous kind.

Source note: `notes/05-model-selection-and-optimization/self-check.md`
