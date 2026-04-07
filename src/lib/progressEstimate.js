import {
  POST_ROUND1_MODEL_CALLS,
  TOTAL_MODEL_CALLS,
} from './debateConstants.js'

/**
 * @param {Record<string, unknown>} state
 */
export function computeProgressUi(state) {
  const completed = Math.min(
    TOTAL_MODEL_CALLS,
    Math.max(0, Number(state.progressCallsCompleted) || 0)
  )
  const pct =
    TOTAL_MODEL_CALLS > 0 ? (completed / TOTAL_MODEL_CALLS) * 100 : 0

  const timers = state.agentTimers ?? {}
  const elapsed = (/** @type {'a' | 'b' | 'c'} */ k) => {
    const t = timers[k]
    if (
      !t ||
      t.startTime == null ||
      t.endTime == null ||
      typeof t.startTime !== 'number' ||
      typeof t.endTime !== 'number'
    ) {
      return null
    }
    return Math.max(0, t.endTime - t.startTime)
  }
  const ea = elapsed('a')
  const eb = elapsed('b')
  const ec = elapsed('c')
  const avgRound1Ms =
    ea != null && eb != null && ec != null ? (ea + eb + ec) / 3 : null

  const status = state.status
  const round1Done =
    ea != null && eb != null && ec != null

  let estimatedMinutesRemaining = null
  if (
    avgRound1Ms != null &&
    round1Done &&
    status === 'running' &&
    completed < TOTAL_MODEL_CALLS
  ) {
    const remainingCalls = Math.max(0, TOTAL_MODEL_CALLS - completed)
    const estMin = (remainingCalls * avgRound1Ms) / 1000 / 60
    estimatedMinutesRemaining = Math.round(estMin * 2) / 2
  }

  let label = ''
  if (status === 'complete') {
    label = 'Debate complete'
  } else if (status === 'running' && estimatedMinutesRemaining != null) {
    label = `~${estimatedMinutesRemaining} min remaining`
  } else if (status === 'running' && round1Done) {
    label = '~… min remaining'
  } else if (status === 'running') {
    label = ''
  } else {
    label = ''
  }

  return {
    percent: pct,
    estimatedMinutesRemaining,
    label,
    avgRound1Ms,
    completedCalls: completed,
    totalCalls: TOTAL_MODEL_CALLS,
    postRound1Calls: POST_ROUND1_MODEL_CALLS,
  }
}
