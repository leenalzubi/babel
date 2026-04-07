import { deriveCurrentStep } from './debateStep.js'

/**
 * @param {{
 *   status: string,
 *   rounds: { roundNum: number }[],
 *   reviews: { roundNum: number }[],
 *   synthesis: unknown,
 *   config: {
 *     agentA: { name: string, model: string, color: string },
 *     agentB: { name: string, model: string, color: string },
 *     agentC: { name: string, model: string, color: string },
 *   },
 *   agentTimers?: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
 *   agentResponses?: { a?: string | null, b?: string | null, c?: string | null },
 *   reviewTimers?: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
 *   reviewResponses?: { a?: string | null, b?: string | null, c?: string | null },
 * }} state
 */
export function getLiveAgentStripModel(state) {
  if (state.status !== 'running' || state.synthesis != null) return null

  const cfg = state.config
  const specs = { a: cfg.agentA, b: cfg.agentB, c: cfg.agentC }
  const order = /** @type {const} */ (['a', 'b', 'c'])

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

  const agentTimers = state.agentTimers ?? {
    a: { startTime: null, endTime: null },
    b: { startTime: null, endTime: null },
    c: { startTime: null, endTime: null },
  }
  const reviewTimers = state.reviewTimers ?? {
    a: { startTime: null, endTime: null },
    b: { startTime: null, endTime: null },
    c: { startTime: null, endTime: null },
  }
  const agentResponses = state.agentResponses ?? {
    a: null,
    b: null,
    c: null,
  }
  const reviewResponses = state.reviewResponses ?? {
    a: null,
    b: null,
    c: null,
  }

  if (!round1Done) {
    return {
      agents: order.map((k) => {
        const spec = specs[k]
        const tm = agentTimers[k]
        const done = Boolean(agentResponses[k])
        const working = tm.startTime != null && tm.endTime == null
        return {
          spec,
          working,
          line: working ? 'Thinking…' : done ? 'Done' : 'Queued…',
        }
      }),
    }
  }

  if (!reviewDone) {
    return {
      agents: order.map((k) => {
        const spec = specs[k]
        const tm = reviewTimers[k]
        const done = Boolean(reviewResponses[k])
        const working = tm.startTime != null && tm.endTime == null
        return {
          spec,
          working,
          line: working ? 'Reviewing…' : done ? 'Done' : 'Queued…',
        }
      }),
    }
  }

  const step = deriveCurrentStep(state)
  if (step === 'synthesis') {
    return {
      agents: [
        {
          spec: cfg.agentA,
          working: true,
          line: 'Synthesizing…',
        },
        {
          spec: cfg.agentB,
          working: false,
          line: '—',
        },
        {
          spec: cfg.agentC,
          working: false,
          line: '—',
        },
      ],
    }
  }

  return {
    agents: order.map((k) => ({
      spec: specs[k],
      working: false,
      line: 'Done',
    })),
  }
}
