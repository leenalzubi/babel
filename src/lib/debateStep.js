/**
 * Which long-running debate phase is active (only meaningful when `status === 'running'`).
 * @param {{
 *   status: string,
 *   rounds: { roundNum: number, agentA?: string, agentB?: string, agentC?: string }[],
 *   reviews: { roundNum: number, aReviews?: string, bReviews?: string, cReviews?: string }[],
 *   synthesis: unknown,
 *   agentResponses?: { a?: string | null, b?: string | null, c?: string | null },
 *   reviewResponses?: { a?: string | null, b?: string | null, c?: string | null },
 * }} state
 * @returns {'round1' | 'crossReview' | 'synthesis' | null}
 */
export function deriveCurrentStep(state) {
  if (state.status !== 'running') return null

  const round1Done =
    (state.agentResponses?.a &&
      state.agentResponses?.b &&
      state.agentResponses?.c) ||
    state.rounds.some(
      (r) =>
        r.roundNum === 1 &&
        String(r.agentA ?? '').length > 0 &&
        String(r.agentB ?? '').length > 0 &&
        String(r.agentC ?? '').length > 0
    )

  const reviewDone =
    (state.reviewResponses?.a &&
      state.reviewResponses?.b &&
      state.reviewResponses?.c) ||
    state.reviews.some(
      (r) =>
        r.roundNum === 1 &&
        String(r.aReviews ?? '').length > 0 &&
        String(r.bReviews ?? '').length > 0 &&
        String(r.cReviews ?? '').length > 0
    )

  if (!round1Done) return 'round1'
  if (!reviewDone) return 'crossReview'
  if (state.synthesis == null) return 'synthesis'
  return null
}
