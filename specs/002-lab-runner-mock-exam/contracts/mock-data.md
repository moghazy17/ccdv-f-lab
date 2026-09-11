# Contract: exported mock data

Two generated files under `site/src/data/`, beside the existing `blueprint.json`. Both are written
by Python in `tools/`, both are covered by the repository's consistency gate, and neither is ever
edited by hand.

## `mock.json` — quotas from the engine

Written by `tools/export_mock_data.py`, which **imports the repository's own
`drills.engine.mock.apportion_items`**. The site does not implement apportionment.

```jsonc
{
  "sourceDigest": "…",          // Same digest discipline as blueprint.json
  "generatedFrom": "BLUEPRINT.md",
  "fullMockSize": 53,           // From BLUEPRINT.md, not typed here
  "timeLimitMinutes": 120,      // From BLUEPRINT.md, not typed here
  "quotas": {
    "Applications and Integration": 17,
    "Model Selection and Optimization": 9,
    "Agents and Workflows": 8,
    "Prompt and Context Engineering": 6,
    "Tools and MCPs": 6,
    "Security and Safety": 4,
    "Claude Code": 2,
    "Eval, Testing, and Debugging": 1
  }
}
```

**Gate**: `tools/check_blueprint_consistency.py` gains coverage of this file, so a change to
`BLUEPRINT.md` without regeneration fails the same gate that already guards the notes, the drills,
and `blueprint.json`.

**Test**: `tests/test_export_mock_data.py` asserts the emitted quotas equal `apportion_items` for
the published size — the FR-024 requirement that equality be verified rather than asserted.

A domain's quiz length is read from this same `quotas` map, so quiz lengths and mock composition can
never disagree.

## `items.json` — the bank, ready for the browser

Written by `tools/export_item_bank.py` from `drills/bank/**/*.yaml`.

```jsonc
{
  "generatedFrom": "drills/bank/",
  "available": { "Applications and Integration": 17, "…": 0 },
  "items": [
    {
      "id": "…",
      "domain": "Applications and Integration",   // Exact BLUEPRINT.md name
      "subSkill": "…",                            // Exact BLUEPRINT.md name
      "difficulty": "application",
      "select": 2,
      "stem": "…",
      "options": [
        { "id": "a", "text": "…", "correct": true,  "rationale": "…" },
        { "id": "c", "text": "…", "correct": false, "rationale": "…", "trapType": "bigger-model" }
      ],
      "sources": [{ "title": "…", "url": "…", "verifiedOn": "2026-09-04" }]
    }
  ]
}
```

**Exclusion**: an item carrying `format_demonstration: true` is dropped by the exporter and never
appears in this file. Asserted by `tests/test_export_item_bank.py`, so no future surface can
accidentally include one.

**Validation**: the export runs only after `python -m drills.engine validate` passes. A malformed
item blocks publication rather than reaching a candidate.

**Note on `available`**: this is what the site compares against `quotas` to produce the shortfall
notice (FR-035) and the no-surplus notice (FR-036). With the bank authored to exactly the quota,
every domain reports `available == quota`, and the mock page states that repeated attempts draw the
same items.

## What the site is not allowed to do

- Compute a quota. It reads one.
- Type a domain name. It reads the exact strings the exporters emit.
- Substitute an item from another domain to reach the mock's size.
- Show an item flagged as a format demonstration.
