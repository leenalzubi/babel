# Synthesis lineage

Inspectable lineage lets a reader open any synthesis finding and walk back to the stored claims, critiques, revisions, and raw model responses that support or challenge it.

## Where stable IDs are created

| ID | When created | Form |
| --- | --- | --- |
| `responseId` | When a voice reply is stored in forge state | `voice-r{1\|2\|3}-{a\|b\|c}` |
| Round 1 claim IDs | Model output / structured extraction (`parseRound1Structure`) | e.g. `A-C1` |
| Round 2 challenge IDs | Claim registry (`buildClaimRegistry`) | e.g. `A-CP1` |
| Round 3 revised IDs | Model / extraction (`revisedId`, often `A-C1′`) | New claim row; R1 text is never overwritten |
| `findingId` | Synthesis parse (`parseDecisionArtifact`) | Section keys such as `agreement`, `disagreement` |

IDs are assigned when data enters the app (pipeline + parsers), not during React render. Array indexes are not used as persistent IDs for findings or Round 1 claims.

## Raw vs structured responses

- **Raw** (`rounds` / `reviews` / `finalPositions` strings, and `RawVoiceResponse.rawText`): exact model text. Immutable for lineage purposes.
- **Structured** (`structures.round1|2|3`): best-effort interpretation (`parseStructuredResponse.js`). Overlay only.
- Extraction failure sets `structureStatus` to `structure_failed` / `raw_only`. The voice remains successful; the UI can say “Claim structure was unavailable. View the original response.”

## How synthesis claim references are validated

1. Arbiter prompt receives a **known claim catalog** (R1 + parseable R2/R3 IDs) and must only cite those IDs in `---FINDINGS-JSON---`.
2. `parseDecisionArtifact` merges section markers with FINDINGS-JSON.
3. `enrichSynthesisFindings` checks every cited ID against `buildClaimRegistry`:
   - Unknown IDs are **removed** and logged (`[babel:lineage]`).
   - **Withdrawn** claims are moved to `relatedClaimIds` (not supporting).
   - Round 2 challenges cited directly are treated as challenging.
4. Finding `lineageStatus` becomes `complete`, `partial`, or `unavailable` from what actually resolved, never from guessed keyword matches.

If structured synthesis parsing fails, `parseSynthesisOutput` keeps the existing fallback (markdown / delimiters) so the debate is not lost.

## Lineage status meanings

| Status | Meaning |
| --- | --- |
| **complete** | Cited IDs resolve to stored claims; withdrawn claims were not counted as support |
| **partial** | Some IDs invalid, withdrawn, or incomplete: finding still shown with limitations |
| **unavailable** | No claim structure / no usable IDs for this finding or debate |

## Evidence labels

Babel does **not** independently verify citations. Allowed wording includes:

- Citation supplied by model
- Not independently verified
- Source retrieved but not verified / Source inaccessible (only if recorded)
- Claim presented as inference / Challenged by one voice / Retained after critique

Do **not** label claims “Verified”, “Fact checked”, or “True” unless the product records an actual independent verification process (it currently does not).

## Older debates

History aggregates do not restore full transcripts. In-session older runs without `structures` or FINDINGS-JSON:

- Synthesis prose still renders
- UI shows **Lineage unavailable for this debate**
- No client-side inference of claim links
- Optional `decisionArtifact` / `lineage` fields on `synthesis` are nullable

## UI entry points

- `SynthesisPanel`: “Trace this finding” per finding
- `LineageDrawer`: Finding, Supported by, Challenged by, What changed, Limitations, Original response
- `buildLineageBundle(state)`: single builder used by the panel (no surprise network call on click)

## Key modules

- `src/lib/synthesisLineage.js`: registry, enrichment, traces, evidence labels
- `src/lib/parseDecisionArtifact.js`: findings + FINDINGS-JSON
- `src/components/LineageDrawer.jsx`: lineage panel
- `src/api/systemPrompts.js`: `SYNTHESIS_SYSTEM` contract
