/** User-facing messages (keep in sync across API clients). */
export const API_ERROR = {
  ANTHROPIC_KEY_MISSING:
    'API key not set — add VITE_ANTHROPIC_API_KEY to .env.local',
  OPENAI_KEY_MISSING:
    'API key not set — add VITE_OPENAI_API_KEY to .env.local',
  GITHUB_TOKEN_MISSING:
    'API key not set — add VITE_GITHUB_TOKEN to .env.local',
  RATE_LIMIT: 'Rate limit reached — wait a moment and retry',
  NETWORK: 'Network error — check your connection',
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isLikelyNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator && !navigator.onLine) {
    return true
  }
  const m =
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return /failed to fetch|networkerror|load failed|network request failed|aborted|ECONNREFUSED|ENOTFOUND/i.test(
    m
  )
}
