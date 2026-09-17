# Phase 1 data model: item-bank expansion

Two of these entities exist already and are described so that the additions sit correctly against
them. Four are added by this feature, and none of them is persisted: the coverage entities are
computed on demand, because a stored count is a count that goes stale.

## Existing — practice item

One YAML file under `drills/bank/<NN>-<domain-slug>/`. Governed by `drills/schema.json`, whose
required fields do not move (FR-022).

| Field | Type | Rule |
|---|---|---|
| `id` | string | Lowercase kebab slug, unique bank-wide. Stable once published (FR-013). |
| `domain` | string | Exactly a blueprint domain name (FR-009). |
| `sub_skill` | string | Exactly a blueprint sub-skill, belonging to that domain (FR-009). |
| `difficulty` | enum | `recall`, `application`, or `analysis`. Every covered domain holds all three (FR-005). |
| `select` | integer | Equals the count of correct options; validation already enforces the equality. |
| `stem` | string | States the select count when above one (FR-014). Answerable from text alone (FR-016). |
| `options` | list | Four or more. Each has `id`, `text`, `correct`, `rationale`; each incorrect one also has `trap_type` (FR-010, FR-011). |
| `sources` | list | One or more `{title, url, verified_on}` (FR-017 through FR-021). |
| `format_demonstration` | literal `true` | Present on exactly one item. Excluded from every count and from publication. |

## Existing — source record row

One row in a `SOURCES.md` table: a cited title, what the page establishes, and a verified date. The
URL arrives either as a reference label resolved from the definition list at the foot of the file,
or inline. This feature adds a table for source files in this repository, so that a citation to
`lab/output.py` is recorded the same way a citation to an Anthropic page is.

| Field | Type | Rule |
|---|---|---|
| `url` | string | Resolved from the row, by label or inline. |
| `establishes` | string | Prose; not machine-checked. |
| `verified_on` | date | `YYYY-MM-DD`. An item citing this URL may not claim an earlier date (FR-019). |

## Added — coverage target

Computed, never stored.

| Field | Type | Derivation |
|---|---|---|
| `domain` | string | From the blueprint. |
| `quota` | integer | `apportion_items(blueprint, blueprint.exam_item_count)[domain]`. |
| `target` | integer | `max(quota * TARGET_MULTIPLE, DOMAIN_FLOOR)` with the multiple 3 and the floor 6 (FR-001, FR-002). |

**Invariant**: the sum of `quota` across domains equals the blueprint's exam item count. The sum of
`target` is not constrained to any published figure, because the floor lifts the lightest domains
above proportionality by design.

## Added — sub-skill target

| Field | Type | Derivation |
|---|---|---|
| `sub_skill` | string | From the blueprint, in published order. |
| `target` | integer | Largest-remainder apportionment of the domain target across the domain's sub-skill weights (FR-003). |

**Invariant**: sub-skill targets within a domain sum exactly to that domain's target. This is the
property a test asserts, and it is the reason apportionment is shared rather than reimplemented.

**Floor interaction**: where the domain target came from the floor rather than from the quota, the
apportionment still runs over the real weights, so a one-sub-skill domain receives the whole floor
and a four-sub-skill domain splits it by weight.

## Added — coverage shortfall

The report's unit of work.

| Field | Type | Rule |
|---|---|---|
| `held` | integer | Eligible items counted from the bank; the format demonstration is excluded. |
| `target` | integer | From the entities above. |
| `shortfall` | integer | `max(target - held, 0)`. Zero means the level is met; a surplus is not an error. |

Reported at domain level and at sub-skill level. Sub-skill shortfalls are what an authoring pass
consumes, because a domain can reach its number while a light sub-skill still stands alone (FR-004).

## Added — citation problem

What the integrity gate reports. Each carries the item path so the failure names a file.

| Kind | Condition | Disposition |
|---|---|---|
| `unrecorded` | A cited URL has no row in the source record | Fails the gate (FR-019) |
| `stale` | An item's `verified_on` is earlier than the record row's date | Fails the gate (FR-019) |

The gate reads local files only. It does not fetch a cited page — reachability is
`tools/check_links.py`'s business, and it deliberately skips external links.

## Added — near-duplicate advisory

Reported by `validate`, never failing it (FR-012 is a review judgment, not a threshold).

| Field | Type | Rule |
|---|---|---|
| `items` | pair of ids | Two items in the same domain. |
| `basis` | string | Which text the overlap was seen in — the stems, or the correct options' rationales. |

Cross-domain pairs are not reported: shared vocabulary between, say, a security item and a tools
item is expected, and reporting it would train an author to ignore the advisory.
