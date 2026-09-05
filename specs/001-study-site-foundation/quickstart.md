# Quickstart: Study site foundation and content pipeline

Everything here runs with no API key. The site is static and the study content it renders is the
markdown already in this repository.

## First run

```bash
# Generate the derived exam data (standard library only, no dependencies)
python tools/export_site_data.py

# Install the site toolchain with exact, locked versions
cd site
npm ci

# Serve the site with live reload
npm run dev
```

The dev server reads `../notes`, `../guide`, `../study-plans`, and `../cheatsheets` in place. Editing
a note and saving it updates the page. If you find yourself editing a file under `site/` to change
study text, stop — that is the duplication the build is designed to reject.

## The gates

Run all of these before finishing a change. They are the same checks CI runs.

```bash
# Python, from the repository root
ruff check .
ruff format --check .
pytest -q
python tools/check_blueprint_consistency.py
python tools/check_content_single_source.py
python tools/check_links.py

# Site, from site/
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:e2e        # Playwright, includes axe on every page type
```

## What each new piece does

| Path | Purpose |
|---|---|
| `tools/export_site_data.py` | Parses `BLUEPRINT.md` and writes `site/src/data/blueprint.json`. Run it after any blueprint change. |
| `tools/check_content_single_source.py` | Fails if study prose from the content directories has been copied under `site/`. |
| `site/src/lib/content-status.ts` | Decides authored versus scaffold, mirroring `tools/note_content.py`. A shared fixture keeps the two identical. |
| `site/src/lib/storage.ts` | The only module permitted to touch `localStorage`. |
| `site/src/data/blueprint.json` | Generated. Never edit it; the build rejects a stale or hand-edited copy. |

## Failures you should expect to see, and what they mean

| Symptom | Cause | Fix |
|---|---|---|
| Build fails: blueprint data is stale | `BLUEPRINT.md` changed without regenerating | `python tools/export_site_data.py` |
| Build fails: study content duplicated under `site/` | Markdown was copied instead of referenced | Delete the copy; point the collection at the source |
| Build fails: domain directory missing | A `notes/` directory was renamed or removed | Restore it, or update `BLUEPRINT.md` and regenerate |
| Dev server cannot read `../notes` | Vite's filesystem allow-list | Confirm `vite.server.fs.allow` includes the repository root in `astro.config.mjs` |
| All eight domain pages look sparse | Correct — every domain is a scaffold today | Not a bug; see the scaffold state in the spec, FR-013 |
| Playwright reports an external request | A webfont or asset is being fetched off-origin | Self-host it; Principle III forbids third-party runtime requests |

## Verifying the feature is actually done

The spec's success criteria are the definition of done. The two that catch the most:

- **SC-009** — the eight domain pages and eight cheatsheets must be complete and honest *in the
  repository's current, fully-scaffolded state*. Do not evaluate this against a populated tree.
- **SC-008** — publication must be blocked by a deliberate failing case for each of: blueprint drift,
  duplicated content, a missing domain, and a broken internal link. Prove each one, do not assume it.

## Deployment

Pushing to `main` builds the site and deploys it to GitHub Pages, but only after every gate passes.
A failed gate leaves the previously published site in place. The base path defaults to `/ccdv-f-lab/`
for a project page and is read from configuration, so moving to a custom domain is a one-line change.
