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

# Self-check

Answer from memory before looking. A prompt you can answer only by rereading is a prompt you have
not learned yet.

## Technical Fundamentals

1. Which single endpoint carries tool use, structured output, caching, thinking, and vision? Name
   the supporting endpoints that feed or describe it.
2. Name four things an official SDK gives you that a raw HTTP client does not.
3. Which HTTP status codes does the SDK retry by default, and which does it deliberately not retry?
4. At roughly what output size does streaming stop being a preference and become a requirement, and
   what fails if you ignore that?
5. A workload moves to Amazon Bedrock. What changes besides the credentials?
6. Why does catching a single broad API exception cause an operational problem rather than merely
   being untidy?

## LLM Fundamentals

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

## Cost and Token Management

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

## Model Selection and Tradeoffs

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

## Cross-cutting

1. This domain is 16.8% of the exam, roughly 9 items. Which of its four sub-skills carries the most
   weight, and does your study time reflect that?
2. For each claim you just recited, could you point to the row in `SOURCES.md`
   that backs it? An unsourced claim you are confident about is the most dangerous kind.
