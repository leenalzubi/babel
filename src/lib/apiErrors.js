/** User-facing messages (keep in sync across API clients). */
export const API_ERROR = {
  ANTHROPIC_KEY_MISSING:
    'API key not set — add VITE_ANTHROPIC_API_KEY to .env.local',
  OPENAI_KEY_MISSING:
    'API key not set — add VITE_OPENAI_API_KEY to .env.local',
  GITHUB_TOKEN_MISSING:
    'No GitHub PAT for requests — dev: VITE_GITHUB_TOKEN in .env.local. Production: add GITHUB_MODELS_PAT in Vercel (server-only; see /api/github-models) and redeploy, or use VITE_GITHUB_TOKEN only if you accept it being baked into static JS.',
  GITHUB_TOKEN_REJECTED:
    'GitHub Models rejected this token (401/403) — use a PAT with Models access, confirm it is not expired, and that your account can use GitHub Models. Connecting the repo to Vercel does not inject a token into the app.',
  GITHUB_MODEL_NOT_FOUND:
    'GitHub Models returned 404 — invalid model id, or your token cannot access that model (e.g. tier is "custom"). Use ids from https://models.github.ai/catalog/models; prefer rate_limit_tier "low" models if you see this often.',
  GITHUB_PROXY_404:
    '404 from /api/github-models — the serverless route is missing (redeploy with api/github-models.js at repo root) or the host returned an HTML error page instead of JSON. For local npm run dev, use VITE_GITHUB_TOKEN (direct API) or run npx vercel dev.',
  RATE_LIMIT: 'Rate limit reached — wait a moment and retry',
  GITHUB_MODELS_UPSTREAM_ERROR:
    'GitHub Models returned 500/502/503 — usually temporary (outage or overloaded model). Retry shortly; check https://www.githubstatus.com. If a detail message appears above the status code, use that first.',
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
