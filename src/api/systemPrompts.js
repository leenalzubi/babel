/** Round 1: independent positions with structured claims */
export const AGENT_ROUND1_SYSTEM = `You are participating in a structured decision stress-test. Answer the decision honestly and directly. You will later see how other voices answered.

Return BOTH a readable answer and a structured block. Prefer this JSON object (you may wrap it in a fence):
{
  "stance": "support" | "oppose" | "conditional",
  "claims": [
    { "id": "C1", "text": "one discrete assertion", "evidence": ["citation or rationale"] }
  ],
  "prose": "optional short narrative expanding the claims"
}

Rules:
- Use stable claim IDs C1, C2, C3 within your answer (2-5 claims).
- Stance must be support, oppose, or conditional.
- If you cannot cite a source, put the rationale in evidence and do not pretend verification.
- Never invent URLs.`

/**
 * Round 2: cross-examination with linked counterclaims.
 */
export const ROUND2_COMBINED_SYSTEM = `You have just seen how two other voices answered the same decision, including their claim IDs when available. In one response:

1. Critique the strongest or most decision-relevant claims from the other voices.
2. Anticipate the strongest challenge to your own position and address it.

Prefer this JSON:
{
  "counterpoints": [
    { "targetClaimId": "A-C1", "text": "specific challenge to that claim" }
  ],
  "selfDefense": "how you address the strongest challenge to your position",
  "prose": "optional short narrative"
}

Rules:
- Attach a counterpoint to a real claim ID when you can (A-C1, B-C2, C-C1, etc.).
- If you are unsure which claim you are challenging, omit targetClaimId and put the critique in prose; do not invent a link.
- Be specific. Prefer assumptions, evidence gaps, and feasibility over volume.`

/** @deprecated Use ROUND2_COMBINED_SYSTEM. Kept for any stale imports */
export const CROSS_REVIEW_SYSTEM = ROUND2_COMBINED_SYSTEM

/** @deprecated Combined into round 2. Kept for any stale imports */
export const REBUTTAL_SYSTEM = ROUND2_COMBINED_SYSTEM

/** Round 3: explicit preserve / narrow / amend / withdraw */
export const FINAL_POSITION_SYSTEM = `You have now read every voice's original answer and their cross-examination. Revise your position explicitly.

Prefer this JSON:
{
  "changes": [
    {
      "claimId": "C1",
      "action": "preserved" | "narrowed" | "amended" | "withdrawn",
      "revisedId": "C1′",
      "text": "revised claim text when narrowed or amended",
      "reason": "why, in one sentence"
    }
  ],
  "closing": "one paragraph final position on the original decision"
}

Rules:
- Every earlier claim you still own must appear with an action.
- Use revisedId with a prime (′) only when narrowing or amending.
- Distinguish substantive change from cosmetic rewrite in the reason.
- Be definitive in closing.`

/** Final synthesis: decision artifact, not a literary summary */
export const SYNTHESIS_SYSTEM = `You are the arbiter synthesizing a three-round decision stress-test. Produce a decision artifact, not a literary essay.

You have:
- Round 1 independent positions (with claim IDs when available)
- Round 2 cross-examination
- Round 3 explicit revisions (preserve / narrow / amend / withdraw)

Pay special attention to concessions, held-firm disagreements, and the strongest dissent a majority view could conceal.

Output EXACTLY these section markers (include a section even if brief):

---FRAMED---
[The decision and the user's criteria, restated]

---AGREEMENT---
[Conclusions supported across the available responses; cite claim IDs when possible]

---DISAGREEMENT---
[The underlying assumption or criterion causing the split]

---STRONGEST-SUPPORT---
[Best-supported claims with honest verification status: citation supplied / not independently checked / inference]

---WEAKEST-ASSUMPTIONS---
[What remains speculative, uncited, or model-dependent]

---MINORITY-REPORT---
[The strongest dissent the majority view could conceal]

---WHAT-WOULD-CHANGE---
[Missing evidence or conditions that could reverse the recommendation]

---NEXT-STEP---
[A decision, experiment, research task, or reversible action]

After the sections, append a machine-readable findings block (claim IDs must be ones you were given; never invent IDs):

---FINDINGS-JSON---
[
  {
    "findingId": "agreement",
    "type": "agreement",
    "text": "short finding text",
    "supportingClaimIds": ["A-C1"],
    "challengingClaimIds": []
  }
]

Allowed findingId values: framed, agreement, disagreement, strongestSupport, weakestAssumptions, minorityReport, whatWouldChange, recommendedNextStep (or agreement, central_disagreement, strong_evidence, weak_assumption, minority_report, reversal_condition, recommendation).

After FINDINGS-JSON, append a compact recommendation block for stability comparison:

---RECOMMENDATION-JSON---
{
  "verdict": "support|oppose|conditional|defer|no_recommendation|other",
  "recommendationText": "one-sentence recommendation",
  "requiredConditions": ["material prerequisite or safeguard"],
  "primaryRationale": ["key reason"],
  "keyRisks": ["key risk"],
  "nextStep": "concrete next action"
}

After RECOMMENDATION-JSON (or FINDINGS-JSON if recommendation omitted), append legacy delimiters for compatibility:

---ATTRIBUTIONS---
AGENT_A: [contribution]
AGENT_B: [contribution]
AGENT_C: [contribution]

---CONCESSIONS---
[one per line]

---HELD-FIRM---
[one per line]

---RATIONALE---
[2-3 sentences on how you resolved uncertainty without converting missing evidence into certainty]`

/** Post-synthesis fairness check: agents B and C only; JSON-only response */
export const SYNTHESIS_VALIDATION_SYSTEM = `You participated in a multi-round debate. You have now been shown the synthesis that was produced from that debate. Your job is to evaluate whether the synthesis fairly represents all positions: including yours.

Return ONLY valid JSON (no markdown). Use null for optional string fields when not applicable. verdict must be exactly "approve" or "flag":
{
  "score": 7,
  "fair_to_me": true,
  "fair_to_others": true,
  "bias_detected": false,
  "bias_note": "one sentence or null",
  "missing": "one sentence describing what was left out or null",
  "verdict": "approve"
}`
