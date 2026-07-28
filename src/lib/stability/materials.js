/**
 * Read debate materials without importing the full pipeline module.
 * @param {Record<string, unknown>} state
 */
export function materialsFromState(state) {
  const rounds = Array.isArray(state.rounds) ? state.rounds : []
  const reviews = Array.isArray(state.reviews) ? state.reviews : []
  const r1 =
    /** @type {{ agentA?: string, agentB?: string, agentC?: string }} */ (
      rounds.find((r) => r && r.roundNum === 1) || {}
    )
  const rev =
    /** @type {{ aReviews?: string, bReviews?: string, cReviews?: string }} */ (
      reviews.find((r) => r && r.roundNum === 1) || {}
    )
  const ar =
    /** @type {{ a?: string|null, b?: string|null, c?: string|null }} */ (
      state.agentResponses || {}
    )
  const rr =
    /** @type {{ a?: string|null, b?: string|null, c?: string|null }} */ (
      state.reviewResponses || {}
    )
  const fp =
    /** @type {{ a?: string|null, b?: string|null, c?: string|null }} */ (
      state.finalPositions || {}
    )

  return {
    ra: String(ar.a ?? r1.agentA ?? ''),
    rb: String(ar.b ?? r1.agentB ?? ''),
    rc: String(ar.c ?? r1.agentC ?? ''),
    aRev: String(rr.a ?? rev.aReviews ?? ''),
    bRev: String(rr.b ?? rev.bReviews ?? ''),
    cRev: String(rr.c ?? rev.cReviews ?? ''),
    fa: String(fp.a ?? ''),
    fb: String(fp.b ?? ''),
    fc: String(fp.c ?? ''),
  }
}
