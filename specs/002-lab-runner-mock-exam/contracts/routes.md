# Contract: addresses

Feature 001 reserved these addresses and shipped each as a short "arrives in a later feature" page.
This feature fills them. **No address moves, and none is removed** — SC-010 of feature 001 is
verified by filling a reserved place without disturbing an existing page.

## Filled by this feature

| Address | Was | Becomes |
|---|---|---|
| `/labs/` | Reserved notice | Catalogue of the thirteen labs, each showing its concept and whether it runs |
| `/labs/<module>/` | Reserved notice | One lab: editable pane, Run, Stop, Restore, output, note link, source link |
| `/mock/` | Reserved notice | The weighted mock exam under a wall-clock countdown |
| `/mock/report/` | Reserved notice | Per-domain figures, explanations, readiness; printable |
| `/domains/<domain>/quiz/` | Reserved notice | The domain's scored quiz, at that domain's quota |
| `/flashcards/` | Reserved notice | The deck, with its coverage stated |

## The lab address set

Feature 001 generated `/labs/<module>/` from the top-level `.py` files in `lab/`, which produced
eleven addresses. This feature keeps all eleven and adds two for the packages the concept list
needs:

```text
/labs/batch/        /labs/caching/      /labs/config/
/labs/context/      /labs/ingest/       /labs/loop/
/labs/output/       /labs/router/       /labs/secrets/
/labs/security/     /labs/transport/
/labs/mcp-server/   ← new; the package at lab/mcp_server/
/labs/evals/        ← new; the package at lab/evals/
```

Adding an address is additive and breaks nothing. Every address feature 001 published still
resolves.

## Left reserved, untouched

These belong to feature 003 and keep their reserved notice:

```text
/claude-code/terminal/
/claude-code/config/
/playground/
```

## Concept coverage

The nine concepts named in the specification must each be reachable from `/labs/`. They map onto
modules; modules without one of the nine get an accurate label of what they do rather than a
manufactured concept.

| Concept | Lab |
|---|---|
| Pinned model versions | `/labs/config/` |
| Adaptive thinking | `/labs/transport/` |
| Structured output | `/labs/output/` |
| Tool use and dispatch | `/labs/router/` |
| The MCP server | `/labs/mcp-server/` — read-only, see below |
| Prompt caching | `/labs/caching/` |
| The batch path | `/labs/batch/` |
| Guardrails | `/labs/security/` |
| The eval harness | `/labs/evals/` |

## The read-only lab

`/labs/mcp-server/` is a full page and appears in the catalogue. It shows its source read-only,
names the concept, states that `mcp` is absent from the browser runtime distribution and that an MCP
server has no transport to serve over inside a tab, and says how to run it locally. It offers no Run
control that would fail.

Which labs are read-only is decided by an import probe at build time, not by this table. If a future
runtime adds `mcp`, this page starts offering Run with no roster to edit.

## Search

Feature 001 built search over typed content records and left room for further types. This feature
adds `lab` and `flashcard` records. Practice items are **not** indexed — putting an item's stem and
its correct answer into a search result would defeat the surface it belongs to.
