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

# Decision tables

Each table answers one question: given a situation, which option, and when not to reach for it. The
exam is tradeoff-driven, so this is the shape most likely to be tested directly.

## Technical Fundamentals

| Option | Choose this when | Do not choose it when |
|---|---|---|
| Official SDK | The project's language has one. Carries credential resolution, retries on 408/409/429/5xx and connection errors, timeouts, typed errors, streaming helpers | Never, if an SDK exists — a raw client discards all of the above |
| Raw HTTP | No SDK for the language, a shell or cURL project, or REST was explicitly requested | An SDK is installed and you reached for `requests` or `fetch` because it felt lighter |
| Streaming | Long input, long output, or high `max_tokens`. Above roughly 64K output it is required, not advisory | Short bounded responses where the round trip is quick |
| Platform client class | Running on Bedrock, Vertex, or Foundry | Ever as a base-URL override of the first-party client — model IDs and available features differ too |
| Specific-first error chain | Always. Retryable and non-retryable failures need different handling | A single broad catch loses the 429-versus-400 distinction that operations depends on |

## LLM Fundamentals

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

## Cost and Token Management

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

## Model Selection and Tradeoffs

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
