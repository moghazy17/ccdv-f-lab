# Contract: exported blueprint data

**Producer**: `tools/export_site_data.py` (Python 3.11+, standard library only)
**Consumers**: `site/src/lib/blueprint.ts` is the only module that reads the file to render from.
`astro.config.mjs` additionally reads its `sourceDigest` at build time to enforce staleness — a
second reader by necessity, since the staleness check cannot live in the module it guards. Nothing
else reads it.
**Artifact**: `site/src/data/blueprint.json` — generated, committed, never hand-edited

## Shape

```json
{
  "sourceDigest": "<sha256 of BLUEPRINT.md at generation time>",
  "generatedFrom": "BLUEPRINT.md",
  "examFacts": {
    "items": 53,
    "timeLimitMinutes": 120,
    "passingScore": 720,
    "scaleMin": 100,
    "scaleMax": 1000,
    "feeUsd": 125,
    "validityMonths": 12
  },
  "domains": [
    {
      "number": 2,
      "slug": "02-applications-and-integration",
      "name": "Applications and Integration",
      "weight": 33.1,
      "approximateItems": 17,
      "mockItems": 17,
      "subSkills": [
        {
          "name": "Claude Application Design",
          "weight": 8.6,
          "approximateItems": 4.6,
          "measured": "How Claude interprets instructions across interfaces; content boundaries; schema design; session hygiene; plugin management"
        }
      ]
    }
  ]
}
```

## Rules

1. **Every field is derived.** No value in this file may be typed by a person. The exporter reads
   `BLUEPRINT.md` and nothing else.
2. **`sourceDigest` is the staleness mechanism.** `astro.config.mjs` recomputes the digest of
   `BLUEPRINT.md` at build time and fails the build when it differs from `sourceDigest`. This is what
   makes FR-002 enforceable at the moment of publication rather than at review time.
3. **Domains are emitted in blueprint order**, not weight order. Ordering for display is the site's
   concern, so the data stays a faithful transcription.
3a. **`approximateItems` is read, never recomputed.** `BLUEPRINT.md` publishes it as a rounded
   integer in the domain table (`~17`) and to one decimal in the sub-skill table (`~4.6`). Emit each
   as published. Recomputing it as `weight × 53 ÷ 100` would yield 17.5 for domain 2 and contradict
   the published figure, which Principle I forbids. `mockItems` remains the separate
   largest-remainder allocation.
4. **`name` is byte-identical to `BLUEPRINT.md`.** Tooling across this repository joins on these
   strings; normalising whitespace or punctuation here would break those joins.
5. **`slug` matches the `notes/` directory name exactly.** The build fails when a slug has no
   directory, or a directory has no slug (FR-008).
6. **`mockItems` uses largest-remainder apportionment** and the eight values sum to exactly 53,
   matching `drills/engine`. Feature 002's mock exam reads these same values rather than recomputing
   them.
7. **The file is committed.** CI does not regenerate it before building; it verifies it. A stale
   committed file is a failing build, which is the point.

## Verification

| Check | Where | Fails when |
|---|---|---|
| Emitted data equals `BLUEPRINT.md` | `tests/test_site_data_export.py` | The exporter's parse drifts |
| Committed file is current | `tools/check_blueprint_consistency.py` | The file was not regenerated after a blueprint change |
| Digest matches at build | `astro.config.mjs` | A blueprint edit reaches a build without regeneration |
| Weights sum to 100; mock items sum to 53 | `tests/test_site_data_export.py` | Arithmetic drift |

## Stability

Feature 002 reads this file for the mock exam's domain allocation. Fields may be **added**; existing
field names and types are fixed. Removing or renaming a field is a breaking change requiring both
consumers to be updated in the same commit.
