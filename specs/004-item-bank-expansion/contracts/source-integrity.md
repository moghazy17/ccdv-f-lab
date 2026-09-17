# Contract: the source-integrity gate

Satisfies FR-018, FR-019, and FR-020. It is the check that makes sourcing mechanical instead of a
reviewer's diligence.

## Invocation

```powershell
python tools/check_source_integrity.py
```

Standard library only. It reads `drills/bank/**/*.yaml` and `SOURCES.md` from disk and **makes no
network request** — a cited page's reachability is `tools/check_links.py`'s business, and that
checker deliberately skips external links. Exit 0 when every citation is recorded and consistent;
exit 1 with one line per problem otherwise.

Wired into `.github/workflows/ci.yml` beside the link checker, and added to the gate list in
`AGENTS.md`.

## Parsing `SOURCES.md`

**Line by line, never as one document.** Reference definitions build a label-to-URL map; each table
row contributes the URLs cited in its first cell, carrying that row's verified date. Both
`[Title][label]` and `[Title](https://…)` forms resolve.

This is not a style preference. A single anchored `re.findall` across the whole file silently loses
rows — a trailing `\s*$` runs past a line ending and swallows the next row — and the prototype that
did so reported 15 problems where 3 exist, including a false failure against the models overview
page that is plainly in the table. A gate whose failures are not trustworthy gets weakened rather
than obeyed.

## Checks

| Check | Failure message shape |
|---|---|
| Every cited URL has a row | `<item path>: cited URL has no row in SOURCES.md: <url>` |
| No citation predates its row | `<item path>: verified_on <date> is earlier than the SOURCES.md row's <date> for <url>` |

Both apply to every item in the bank with no exemption list, including items authored before this
feature and including the format demonstration (FR-020).

**Why the date rule runs in that direction**: the record's date is when the repository last checked
the page. An item claiming an *earlier* check is citing a page state nobody verified; an item with a
*later* date read the page more recently than the record, which is fine and is how the record gets
re-dated.

## Conformance work this gate requires

Three citations fail today, and fixing them is part of this feature:

| Item | Citation | Fix |
|---|---|---|
| `deriving-schema-validation-requirement-from-business-rule` | `lab/output.py` | Row in the new this-repository table |
| `prompt-version-bump-for-reproducible-ab-test` | `lab/config.py` | Row in the new this-repository table |
| `streaming-required-above-large-max-tokens` | the streaming documentation page | Row in the technology table |

A repository source file is cited and recorded exactly like an external page, rather than being
exempted from the check. One uniform rule is enforceable; a category exemption is a hole that grows.

## What it deliberately does not check

- **Whether the cited page still says what the row claims.** No check can read prose for meaning.
  That is what the read-during-authoring rule and review are for.
- **Whether the source is authoritative.** FR-017 draws that line, and it is a judgment. The gate
  enforces that every citation is *recorded*, which is what makes an unauthoritative one visible in
  review rather than buried in a YAML file.
