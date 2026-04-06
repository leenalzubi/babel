import { deriveCurrentStep } from './debateStep.js'

/**
 * @param {{
 *   status: string,
 *   rounds: { roundNum: number }[],
 *   reviews: { roundNum: number }[],
 *   synthesis: unknown,
 * }} state
 */
export function getLiveAgentStripModel(state) {
  if (state.status !== 'running' || state.synthesis != null) return null

  const currentStep = deriveCurrentStep(state)
  const round1Done = state.rounds.some((r) => r.roundNum === 1)
  const reviewDone = state.reviews.some((r) => r.roundNum === 1)

  const workingLine = (() => {
    if (!round1Done) return 'Thinking…'
    if (!reviewDone) return 'Reviewing…'
    return 'Synthesizing…'
  })()

  /** @type {{ a: boolean, b: boolean, c: boolean }} */
  let working = { a: true, b: true, c: true }

  if (reviewDone && currentStep === 'synthesis' && state.synthesis == null) {
    working = { a: true, b: false, c: false }
  }

  return {
    agents: [
      { key: 'a', working: working.a, line: working.a ? workingLine : 'Done' },
      { key: 'b', working: working.b, line: working.b ? workingLine : 'Done' },
      { key: 'c', working: working.c, line: working.c ? workingLine : 'Done' },
    ],
  }
}
