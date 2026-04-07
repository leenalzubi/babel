import { TIMEOUT_ERROR_MESSAGE } from './debateConstants.js'

/**
 * @param {unknown} e
 * @returns {boolean}
 */
export function isModelCallTimeoutError(e) {
  return (
    (e instanceof Error && e.message === TIMEOUT_ERROR_MESSAGE) ||
    (Boolean(e) &&
      typeof e === 'object' &&
      /** @type {{ type?: string }} */ (e).type === 'timeout')
  )
}

/**
 * Rich error object for SET_ERROR / ErrorBanner, or normalized unknown shape.
 * @param {unknown} err
 * @returns {{
 *   type: string,
 *   agent?: string,
 *   title: string,
 *   detail: string,
 *   suggestion: string,
 *   stage?: string,
 *   round?: number,
 * }}
 */
export function normalizeDebateFailure(err) {
  if (
    err &&
    typeof err === 'object' &&
    typeof /** @type {{ type?: unknown }} */ (err).type === 'string' &&
    typeof /** @type {{ title?: unknown }} */ (err).title === 'string' &&
    typeof /** @type {{ detail?: unknown }} */ (err).detail === 'string' &&
    typeof /** @type {{ suggestion?: unknown }} */ (err).suggestion === 'string'
  ) {
    return /** @type {{ type: string, agent?: string, title: string, detail: string, suggestion: string, stage?: string, round?: number }} */ (
      err
    )
  }
  const detail =
    err instanceof Error ? err.message : `Request failed: ${String(err)}`
  return {
    type: 'unknown',
    agent: 'Debate',
    title: 'Unexpected error',
    detail,
    suggestion: 'Try again or edit your prompt.',
  }
}
