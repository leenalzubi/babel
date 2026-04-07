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
 *   rebuttals?: { a?: string | null, b?: string | null, c?: string | null },
 *   rebuttalTimers?: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
 *   finalPositions?: { a?: string | null, b?: string | null, c?: string | null },
 *   finalPositionTimers?: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
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

  const rebuttals = state.rebuttals ?? {}
  const rebuttalDone =
    String(rebuttals.a ?? '').length > 0 &&
    String(rebuttals.b ?? '').length > 0 &&
    String(rebuttals.c ?? '').length > 0

  const finals = state.finalPositions ?? {}
  const finalDone =
    String(finals.a ?? '').length > 0 &&
    String(finals.b ?? '').length > 0 &&
    String(finals.c ?? '').length > 0

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
  const rebuttalTimers = state.rebuttalTimers ?? {
    a: { startTime: null, endTime: null },
    b: { startTime: null, endTime: null },
    c: { startTime: null, endTime: null },
  }
  const finalPositionTimers = state.finalPositionTimers ?? {
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
      agents: order.map((k, i) => {
        const spec = specs[k]
        const tm = agentTimers[k]
        const done = Boolean(agentResponses[k])
        const working = tm.startTime != null && tm.endTime == null
        /** @type {'active' | 'done' | 'waiting'} */
        const phase = done ? 'done' : working ? 'active' : 'waiting'
        return {
          spec,
          rollIndex: i + 1,
          phase,
          activeLine: working ? 'Thinking…' : null,
        }
      }),
    }
  }

  if (!reviewDone) {
    return {
      agents: order.map((k, i) => {
        const spec = specs[k]
        const tm = reviewTimers[k]
        const done = Boolean(reviewResponses[k])
        const working = tm.startTime != null && tm.endTime == null
        const phase = done ? 'done' : working ? 'active' : 'waiting'
        return {
          spec,
          rollIndex: i + 1,
          phase,
          activeLine: working ? 'Reviewing…' : null,
        }
      }),
    }
  }

  if (!rebuttalDone) {
    return {
      agents: order.map((k, i) => {
        const spec = specs[k]
        const tm = rebuttalTimers[k]
        const done = Boolean(String(rebuttals[k] ?? '').length)
        const working = tm.startTime != null && tm.endTime == null
        const phase = done ? 'done' : working ? 'active' : 'waiting'
        return {
          spec,
          rollIndex: i + 1,
          phase,
          activeLine: working ? 'Rebutting…' : null,
        }
      }),
    }
  }

  if (!finalDone) {
    return {
      agents: order.map((k, i) => {
        const spec = specs[k]
        const tm = finalPositionTimers[k]
        const done = Boolean(String(finals[k] ?? '').length)
        const working = tm.startTime != null && tm.endTime == null
        const phase = done ? 'done' : working ? 'active' : 'waiting'
        return {
          spec,
          rollIndex: i + 1,
          phase,
          activeLine: working ? 'Final position…' : null,
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
          rollIndex: 1,
          phase: /** @type {const} */ ('active'),
          activeLine: 'Synthesizing full debate…',
        },
        {
          spec: cfg.agentB,
          rollIndex: 2,
          phase: 'waiting',
          waitingNote: 'Standing by',
        },
        {
          spec: cfg.agentC,
          rollIndex: 3,
          phase: 'waiting',
          waitingNote: 'Standing by',
        },
      ],
    }
  }

  return {
    agents: order.map((k, i) => ({
      spec: specs[k],
      rollIndex: i + 1,
      phase: /** @type {const} */ ('done'),
      activeLine: null,
    })),
  }
}
