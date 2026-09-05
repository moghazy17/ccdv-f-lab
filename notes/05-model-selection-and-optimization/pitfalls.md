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

# Pitfalls

Each entry states the mistake, then the correction. Most are stale-knowledge errors rather than
reasoning errors: the parameter used to work, and now returns an error instead of being ignored.

## Technical Fundamentals

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

## LLM Fundamentals

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

## Cost and Token Management

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

## Model Selection and Tradeoffs

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
