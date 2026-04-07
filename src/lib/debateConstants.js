/** Shown in UI and stored as the agent response when a model call exceeds the per-call time limit. */
export const AGENT_TIMEOUT_MESSAGE =
  'This model took longer than 2 minutes to respond and was skipped for this stage.'

/** Thrown from `callGitHubModel` when the request is aborted by the timeout controller. */
export const TIMEOUT_ERROR_MESSAGE = 'TIMEOUT'

/**
 * Total model API calls in a full debate (round 1 + pipeline + audit).
 * Used for progress: 3 + 3 + 3 + 3 + 1 + 2 + 3 = 18
 */
export const TOTAL_MODEL_CALLS = 18

/**
 * Calls after round 1 used for "~n min remaining" estimate (cross-review through validation + audit).
 */
export const POST_ROUND1_MODEL_CALLS = 15

/** @param {unknown} text */
export function isAgentTimeoutResponse(text) {
  return typeof text === 'string' && text === AGENT_TIMEOUT_MESSAGE
}
