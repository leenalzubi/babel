# Conclusion stability check

Optional post-debate sensitivity test. It does **not** prove a recommendation is true.

## What version 1 does

1. **Repeat synthesis**: re-run synthesis on the same completed evidence (new attempt; same arbiter by default).
2. **Leave-one-out**: re-run synthesis once per successful voice with that voice’s R1/R2/R3 replaced by an exclusion stub (claims omitted from the claim catalog).
3. **Alternate arbiter**: only when another configured model id differs from the primary arbiter.

Version 1 does **not** re-run debate rounds and does **not** expose role permutation / full panel reruns.

## Entry

Shown under the synthesis when the debate is `complete` or `complete_with_gaps`, at least two voices have usable material, and synthesis input exists.

## Storage

Session-scoped on forge state:

- `stabilityReports: StabilityReport[]`
- `activeStabilityReportId`
- `debateId` (set when a debate starts)

Canonical `state.synthesis` is never replaced by a stability run.

**Persistence:** session-level only in v1. Reports are not written to Supabase yet (document this limitation rather than pretend they are saved).

## Comparison

Deterministic comparison of structured recommendations (`verdict`, condition sets, presence of recommendation). Heuristic extraction from decision-artifact sections when `---RECOMMENDATION-JSON---` is absent.

Outcomes: stable / stable with condition changes / sensitive to voices / mixed / insufficient checks.

## Future (not exposed)

`panel_rerun`, role-model permutation, temperature sweeps: gated by `STABILITY_FUTURE_FLAGS` and not rendered in the UI.

## Approximate call count (3 successful voices)

`1` repeat + `3` leave-one-out + `1` alternate arbiter (if models differ) = **5** additional synthesis calls, sequential with ~700ms pause.
