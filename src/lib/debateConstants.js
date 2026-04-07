/** Shown in UI and stored as the agent response when a model call exceeds the per-call time limit. */
export const AGENT_TIMEOUT_MESSAGE =
  'This model took longer than 2 minutes to respond and was skipped for this stage.'

/** Thrown from `callGitHubModel` when the request is aborted by the timeout controller. */
export const TIMEOUT_ERROR_MESSAGE = 'TIMEOUT'

/**
 * Total model API calls in a full debate with synthesis + validation + audit.
 * Round 1–3: 9; synthesis + validation: 3; audit: 3 → max 15
 */
export const TOTAL_MODEL_CALLS = 15

/**
 * Calls after round 1 used for "~n min remaining" estimate (through validation + audit).
 */
export const POST_ROUND1_MODEL_CALLS = 12

/** @param {unknown} text */
export function isAgentTimeoutResponse(text) {
  return typeof text === 'string' && text === AGENT_TIMEOUT_MESSAGE
}
