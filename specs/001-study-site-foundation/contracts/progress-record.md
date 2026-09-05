# Contract: learner progress record

**Owner**: the candidate. Stored only in their browser, never transmitted.
**Sole accessor**: `site/src/lib/storage.ts`. No other module may touch `localStorage`.
**Storage key**: `ccdv-f:progress`

## Envelope

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-09-05T10:04:11.000Z",
  "namespaces": {
    "foundation": {
      "theme": "system",
      "planMarks": { "3-weeks": [2, 5] },
      "diagnostic": {
        "source": "self-report",
        "experience": { "api": "some", "agents": "none", "tools": "some", "security": "none" },
        "weeksAvailable": 3,
        "hoursPerWeek": 14,
        "recommendedPlan": "3-weeks",
        "reason": "Three weeks at 14 hours matches the 42-hour plan most closely.",
        "completedAt": "2026-09-05T10:04:11.000Z"
      }
    }
  }
}
```

## Versioning rules

These exist because FR-025 makes "your progress survives the next release" a promise to the
candidate, not an implementation detail.

1. `schemaVersion` is a single integer for the whole envelope.
2. A record whose `schemaVersion` is **lower** than the running site understands is migrated forward
   by a pure function per step, and the result is written back once.
3. A record whose `schemaVersion` is **higher** is **refused, never partially applied** — the site
   reports that the data came from a newer version and leaves it untouched, so returning to the newer
   version recovers it intact.
4. An unrecognised namespace is **preserved verbatim** on read and write. This is what lets a
   candidate move between a browser running 001 and one running 002 without either discarding the
   other's data.
5. A namespace the running site does not own is never validated, only carried.

## Failure behaviour

| Condition | Behaviour |
|---|---|
| `localStorage` unavailable (private mode, policy) | Every page stays fully readable; the site states plainly that progress cannot be saved (FR-028). Marks work for the session and are lost on reload — this is stated, not silent. |
| Quota exceeded on write | The write is refused, the prior value is left intact, and the candidate is told |
| Stored value is malformed JSON | Treated as absent; the corrupt value is not overwritten until the candidate acts, so nothing is destroyed silently |
| Record references an unknown plan or domain | Reported, not dropped — the reference may belong to a version the candidate will return to |

## Cross-tab consistency

Two tabs are a supported case (FR-026). `storage.ts` subscribes to the browser `storage` event and
reconciles on change, so a mark made in one tab is not overwritten by a stale write from another.
Reconciliation is last-writer-wins **per mark**, not per record, so two tabs marking different
domains both survive.

## Export and import

The exported file is the envelope exactly as stored, pretty-printed, named
`ccdv-f-progress-YYYY-MM-DD.json`.

On import:

1. Parse. Reject non-JSON with a plain message; existing progress untouched (FR-027).
2. Reject a `schemaVersion` higher than understood; existing progress untouched.
3. Migrate a lower version forward.
4. **Before replacing anything**, show what will be replaced — which plans have marks, and the
   `updatedAt` of both records — and require confirmation (FR-027).
5. Replace wholesale on confirmation. Merging is deliberately not offered: a silent merge of two
   divergent records is harder for a candidate to reason about than an explicit replacement.

## Privacy

The record contains no personal data beyond self-reported study preferences, is never sent anywhere,
and no analytics or cookies exist to observe it (FR-036). Export is a local file download; import is
a local file read. Neither touches the network.
