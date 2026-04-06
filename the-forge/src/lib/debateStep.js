/**
 * Which long-running debate phase is active (only meaningful when `status === 'running'`).
 * @param {{ status: string, rounds: { roundNum: number }[], reviews: { roundNum: number }[], synthesis: unknown }} state
 * @returns {'round1' | 'crossReview' | 'synthesis' | null}
 */
export function deriveCurrentStep(state) {
  if (state.status !== 'running') return null

  const round1Done = state.rounds.some((r) => r.roundNum === 1)
  const reviewDone = state.reviews.some((r) => r.roundNum === 1)

  if (!round1Done) return 'round1'
  if (!reviewDone) return 'crossReview'
  if (state.synthesis == null) return 'synthesis'
  return null
}
