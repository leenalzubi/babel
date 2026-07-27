# Babel Lab

Public, mostly read-only evaluation area comparing Babel to single-model and side-by-side baselines.

## Routes

| Path | Content |
| --- | --- |
| `/lab` | Index of **published** cases |
| `/lab/methodology` | Rubric, conditions, no-cherry-picking, privacy |
| `/lab/:caseSlug` | Case detail (published or archived via direct link) |

Routing extends the existing History API tab pattern in `App.jsx` (no React Router). Lab browsing never calls model APIs.

## Data

```text
src/data/evaluations/
  manifest.json
  cases/*.json
```

Cases are versioned JSON validated by `src/lib/lab/schema.js`. Malformed files are skipped and logged; they do not crash the Lab.

### Status

- `draft`: repository scaffolding; hidden from the public index
- `published`: listed on `/lab`
- `archived`: not listed on the index; reachable by direct URL; requires `archiveReason`

### Scores and metrics

- Missing scores → **Not evaluated**
- Missing metrics → **Not recorded**
- Aggregates never treat missing values as zero
- Human vs LLM-judge vs deterministic methods stay labeled separately

## Import workflow

1. Run a debate in Babel (or prepare JSON with the same shape as forge state).
2. Export or save the state JSON locally.
3. Import into a draft case:

```bash
node scripts/import-eval-artifact.mjs \
  --case ai-action-items \
  --condition babel \
  --input ./path/to/debate-state.json
```

4. Review warnings (missing metrics, personal-data heuristics).
5. Manually set `"status": "published"` only after scrubbing and review.
6. Add a changelog note.

The importer **never** auto-publishes.

Programmatic adapter: `debateStateToArtifact` / `addArtifactToDraftCase` in `src/lib/lab/importArtifact.js`.

## Privacy

Before publish: strip tokens, user IDs, private debate IDs, and inspect prompts for personal data (`src/lib/lab/privacy.js`). Public views also drop `sourceDebateId`.

## Adding a case

1. Copy a draft JSON under `cases/`.
2. Fill prompt, criteria, whyThisCase, limitations, `whereBabelDidNotHelp`.
3. Leave `artifacts: []` until real runs exist: do not invent outputs or scores.
4. Register the slug in `manifest.json`.
5. Publish only when artifacts are real or explicitly labeled development fixtures.
