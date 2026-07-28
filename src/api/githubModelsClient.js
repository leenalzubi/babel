/**
 * GitHub Models: OpenAI-compatible chat completions.
 *
 * - Local dev: set VITE_GITHUB_TOKEN (GitHub PAT with Models access).
 * - Production (e.g. Vercel): prefer GITHUB_MODELS_PAT on the server; the client calls
 *   /api/github-models so the token is never embedded in static JS.
 */

import { API_ERROR, isLikelyNetworkError } from '../lib/apiErrors.js'
import { compactChatMessages } from '../lib/clipInferenceText.js'
import {
  GITHUB_MODELS_CHAT_URL,
  githubModelsFetchHeaders,
} from '../lib/githubModelsHttp.js'

const PROXY_PATH = '/api/github-models'

const RETRYABLE_STATUS = new Set([429, 500, 502, 503])
/** Max automatic retries after the first attempt (spec: two automatic retries). */
const MAX_AUTO_RETRIES = 2
const TOTAL_ATTEMPTS = 1 + MAX_AUTO_RETRIES

/**
 * @typedef {{
 *   stage?: string,
 *   round?: number,
 *   type: string,
 *   agent: string,
 *   title: string,
 *   detail: string,
 *   suggestion: string,
 * }} ClassifiedModelError
 */

/**
 * @param {Response} response
 * @param {string} agentName
 * @returns {Promise<ClassifiedModelError>}
 */
export async function classifyError(response, agentName) {
  const status = response.status

  let body = {}
  try {
    body = await response.json()
  } catch {
    body = {}
  }

  const rawMessage =
    (typeof body?.error === 'string' && body.error) ||
    body?.error?.message ||
    body?.message ||
    ''
  const message = typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? '')
  const messageLower = message.toLowerCase()

  if (status === 400 && messageLower.includes('content management policy')) {
    return {
      type: 'content_filter',
      agent: agentName,
      scope: 'voice',
      retryMode: 'after_edit',
      title: 'Content filter triggered',
      detail: `${agentName} was blocked by Azure's content filter. This usually happens with prompts containing sensitive, ambiguous, or politically charged language.`,
      suggestion:
        'Try rephrasing your prompt. Avoid loaded language, explicit hypotheticals, or topics that could be interpreted as harmful.',
    }
  }

  if (status === 429) {
    const retryAfter = response.headers.get('retry-after') || '60'
    const retryAfterMs = Math.max(1, Number(retryAfter) || 60) * 1000
    return {
      type: 'rate_limit',
      agent: agentName,
      scope: 'voice',
      retryMode: 'delayed',
      retryAfterMs,
      title: 'Rate limit reached',
      detail: `GitHub Models free tier rate limit hit on ${agentName}. Retry after ${retryAfter} seconds.`,
      suggestion: `Wait ${retryAfter} seconds and try again. If this keeps happening, space out your debates.`,
    }
  }

  if (status === 400 && messageLower.includes('token')) {
    return {
      type: 'token_limit',
      agent: agentName,
      scope: 'voice',
      retryMode: 'after_edit',
      title: 'Prompt too long',
      detail: `${agentName} received more text than it can process. This can happen in later rounds when the full debate context is passed.`,
      suggestion:
        'Try a shorter initial prompt. The debate context grows with each round.',
    }
  }

  if (status === 401 || status === 403) {
    return {
      type: 'auth',
      agent: agentName,
      scope: 'infrastructure',
      retryMode: 'after_configuration',
      title: 'Authentication failed',
      detail: import.meta.env.PROD
        ? 'GitHub Models rejected the server credentials for this deployment (missing, expired, or without Models access).'
        : 'Your GitHub token was rejected. It may have expired or have insufficient permissions.',
      suggestion: import.meta.env.PROD
        ? 'In Vercel, set GITHUB_MODELS_PAT (Production and Preview), confirm Models access on that token, then redeploy.'
        : 'Generate a new fine-grained GitHub token with Models access and update VITE_GITHUB_TOKEN in .env.local, then restart the dev server.',
    }
  }

  if (status === 404) {
    return {
      type: 'model_unavailable',
      agent: agentName,
      scope: 'voice',
      retryMode: 'not_retryable',
      title: 'Model unavailable',
      detail: `${agentName} is not available on your GitHub Models tier or the model ID has changed.`,
      suggestion:
        'Check https://github.com/marketplace?type=models to confirm the model is available on your account.',
    }
  }

  if (status === 500 || status === 502 || status === 503) {
    if (
      status === 503 &&
      (messageLower.includes('pat missing') ||
        messageLower.includes('github_token_missing') ||
        body?.code === 'GITHUB_TOKEN_MISSING')
    ) {
      return {
        type: 'auth',
        agent: agentName,
        scope: 'infrastructure',
        retryMode: 'after_configuration',
        title: 'Authentication failed',
        detail:
          'The model service is not configured for this deployment. Add GITHUB_MODELS_PAT in Vercel, then redeploy.',
        suggestion:
          'Vercel → Project → Settings → Environment Variables → GITHUB_MODELS_PAT (Production and Preview), then Redeploy.',
      }
    }
    return {
      type: 'server_error',
      agent: agentName,
      scope: 'voice',
      retryMode: 'delayed',
      title: 'GitHub Models server error',
      detail: `GitHub Models returned a ${status} error for ${agentName}. This is usually temporary.`,
      suggestion:
        'Wait a moment and try again. Check https://www.githubstatus.com if it keeps happening.',
    }
  }

  return {
    type: 'unknown',
    agent: agentName,
    scope: 'voice',
    retryMode: 'immediate',
    title: 'Unexpected error',
    detail: `${agentName} failed with status ${status}${message ? `: ${message}` : ''}`,
    suggestion: 'Retry this voice, or continue with available responses.',
  }
}

/**
 * @returns {{ url: string, authorization: string | null }}
 */
function resolveGithubChatRequest() {
  // Production always uses the server proxy so a Vercel VITE_* token is not
  // required in the browser bundle (and a stale baked-in token cannot bypass
  // GITHUB_MODELS_PAT on the server).
  if (import.meta.env.PROD) {
    return { url: PROXY_PATH, authorization: null }
  }

  const vite =
    typeof import.meta.env.VITE_GITHUB_TOKEN === 'string'
      ? import.meta.env.VITE_GITHUB_TOKEN.trim()
      : ''
  if (vite) {
    return {
      url: GITHUB_MODELS_CHAT_URL,
      authorization: `Bearer ${vite}`,
    }
  }
  return { url: '', authorization: null }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Backoff for rate limits / server errors: Retry-After when present, else 2s then 6s + jitter.
 * @param {number} attemptIndex zero-based attempt that just failed
 * @param {Response | null} [response]
 */
function retryWaitMs(attemptIndex, response = null) {
  const jitter = () => 250 + Math.floor(Math.random() * 1250)
  if (response && response.status === 429) {
    const raw = response.headers.get('retry-after')
    if (raw) {
      const asNum = Number(raw)
      if (Number.isFinite(asNum) && asNum >= 0) {
        return Math.min(120_000, Math.max(500, asNum * 1000)) + jitter()
      }
      const asDate = Date.parse(raw)
      if (Number.isFinite(asDate)) {
        return Math.min(120_000, Math.max(500, asDate - Date.now())) + jitter()
      }
    }
  }
  const base = attemptIndex <= 0 ? 2000 : 6000
  return base + jitter()
}

const DEFAULT_MODEL_CALL_TIMEOUT_MS = 120_000

/**
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fetchWithSignal
 * @param {number} [timeoutMs]
 * @param {{ agentName?: string, errorContext?: { stage?: string, round?: number } }} [meta]
 * @returns {Promise<T>}
 */
async function callWithTimeout(
  fetchWithSignal,
  timeoutMs = DEFAULT_MODEL_CALL_TIMEOUT_MS,
  meta = {}
) {
  const agentName = meta.agentName?.trim() || 'Model'
  const errorContext =
    meta.errorContext && typeof meta.errorContext === 'object'
      ? meta.errorContext
      : {}
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const result = await fetchWithSignal(controller.signal)
    clearTimeout(timeout)
    return result
  } catch (err) {
    clearTimeout(timeout)
    const name = err && typeof err === 'object' && 'name' in err ? err.name : ''
    if (name === 'AbortError') {
      throw {
        type: 'timeout',
        scope: 'voice',
        retryMode: 'immediate',
        agent: agentName,
        title: 'Model timed out',
        detail: `${agentName} did not answer in time.`,
        suggestion: `Retry ${agentName}, or continue without it.`,
        ...errorContext,
      }
    }
    throw err
  }
}

/** @deprecated Prefer checking classified error `type === 'content_filter'` */
export const CONTENT_FILTER_MESSAGE_PREFIX = 'Content filter:'

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isContentFilterError(err) {
  if (err && typeof err === 'object' && err.type === 'content_filter') return true
  return (
    err instanceof Error &&
    err.message.includes(CONTENT_FILTER_MESSAGE_PREFIX)
  )
}

/**
 * @param {string} model
 * @param {Array<{ role: string, content: string }>} messages
 * @param {string} systemPrompt
 * @param {{ maxTokens?: number, agentName?: string, errorContext?: { stage?: string, round?: number }, skipCompactRetry?: boolean } | undefined} [options]
 * @returns {Promise<string>}
 */
export async function callGitHubModel(model, messages, systemPrompt, options) {
  const { url, authorization } = resolveGithubChatRequest()
  const isProxyRequest = url === PROXY_PATH

  if (!url) {
    throw new Error(API_ERROR.GITHUB_TOKEN_MISSING)
  }

  if (typeof model !== 'string' || !model.trim()) {
    throw new Error('callGitHubModel: model must be a non-empty string.')
  }

  if (typeof systemPrompt !== 'string') {
    throw new Error('callGitHubModel: systemPrompt must be a string.')
  }

  if (!Array.isArray(messages)) {
    throw new Error('callGitHubModel: messages must be an array.')
  }

  if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
    const agentName =
      options && typeof options.agentName === 'string' && options.agentName.trim()
        ? options.agentName.trim()
        : 'Model'
    throw {
      type: 'network',
      scope: 'infrastructure',
      retryMode: 'delayed',
      agent: agentName,
      title: 'You are offline',
      detail:
        'You are offline. The debate will resume when your connection returns. Completed responses are preserved.',
      suggestion: 'Reconnect to the internet. Babel will resume automatically.',
      ...(options?.errorContext && typeof options.errorContext === 'object'
        ? options.errorContext
        : {}),
    }
  }

  const headers = githubModelsFetchHeaders({ 'Content-Type': 'application/json' })
  if (authorization) {
    headers.Authorization = authorization
  }

  const maxTokens =
    options &&
    typeof options === 'object' &&
    typeof options.maxTokens === 'number' &&
    Number.isFinite(options.maxTokens)
      ? Math.min(32_000, Math.max(256, Math.round(options.maxTokens)))
      : 1024

  const payload = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  }

  const agentName =
    options &&
    typeof options === 'object' &&
    typeof options.agentName === 'string' &&
    options.agentName.trim()
      ? options.agentName.trim()
      : 'Model'
  const errorContext =
    options &&
    typeof options === 'object' &&
    options.errorContext &&
    typeof options.errorContext === 'object'
      ? options.errorContext
      : {}

  try {
    return await callWithTimeout(
      async (signal) => {
        let lastError = /** @type {unknown} */ (
          new Error('GitHub Models request failed')
        )

        for (let attempt = 0; attempt < TOTAL_ATTEMPTS; attempt++) {
          if (signal.aborted) {
            throw {
              type: 'timeout',
              scope: 'voice',
              retryMode: 'immediate',
              agent: agentName,
              title: 'Model timed out',
              detail: `${agentName} did not answer in time.`,
              suggestion: `Retry ${agentName}, or continue without it.`,
              ...errorContext,
            }
          }

          let response
          try {
            response = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
              signal,
            })
          } catch (err) {
            const name =
              err && typeof err === 'object' && 'name' in err ? err.name : ''
            if (name === 'AbortError' || signal.aborted) {
              throw {
                type: 'timeout',
                scope: 'voice',
                retryMode: 'immediate',
                agent: agentName,
                title: 'Model timed out',
                detail: `${agentName} did not answer in time.`,
                suggestion: `Retry ${agentName}, or continue without it.`,
                ...errorContext,
              }
            }
            if (isLikelyNetworkError(err)) {
              lastError = {
                type: 'network',
                scope: 'infrastructure',
                retryMode: 'delayed',
                agent: agentName,
                title: 'Connection lost',
                detail:
                  'Babel could not reach the model service. Your completed responses are preserved.',
                suggestion: 'Retry connection when you are back online.',
                ...errorContext,
              }
              if (attempt < MAX_AUTO_RETRIES) {
                await sleep(retryWaitMs(attempt, null))
                continue
              }
              throw lastError
            }
            throw err instanceof Error ? err : new Error(String(err))
          }

          if (
            isProxyRequest &&
            response.status === 404 &&
            !(response.headers.get('content-type') ?? '').includes(
              'application/json'
            )
          ) {
            throw {
              type: 'proxy_configuration',
              scope: 'infrastructure',
              retryMode: 'after_configuration',
              agent: agentName,
              title: 'Model proxy unavailable',
              detail:
                'This deployment cannot reach its GitHub Models proxy. Completed responses are preserved.',
              suggestion: 'Retry connection after the deployment is fixed.',
              ...errorContext,
            }
          }

          if (!response.ok) {
            if (
              RETRYABLE_STATUS.has(response.status) &&
              attempt < MAX_AUTO_RETRIES
            ) {
              const wait = retryWaitMs(attempt, response)
              try {
                await response.text()
              } catch {
                /* ignore */
              }
              await sleep(wait)
              continue
            }
            const classified = await classifyError(response, agentName)
            throw { ...classified, ...errorContext }
          }

          let data
          try {
            data = await response.json()
          } catch {
            throw new Error(API_ERROR.NETWORK)
          }

          const content = data?.choices?.[0]?.message?.content
          if (typeof content !== 'string') {
            throw new Error(
              'GitHub Models response missing choices[0].message.content string.'
            )
          }
          return content
        }

        throw lastError
      },
      DEFAULT_MODEL_CALL_TIMEOUT_MS,
      { agentName, errorContext }
    )
  } catch (err) {
    const isTokenLimit =
      err &&
      typeof err === 'object' &&
      /** @type {{ type?: string }} */ (err).type === 'token_limit'
    const skipCompact = Boolean(options?.skipCompactRetry)
    if (isTokenLimit && !skipCompact) {
      const compacted = compactChatMessages(messages)
      return callGitHubModel(model, compacted, systemPrompt, {
        ...options,
        skipCompactRetry: true,
      })
    }
    throw err
  }
}


/**
 * Whether the browser should use a direct VITE token (local/dev only).
 * Production always uses `/api/github-models`.
 * @returns {boolean}
 */
export function hasGithubModelsClientToken() {
  if (import.meta.env.PROD) return false
  const v = import.meta.env.VITE_GITHUB_TOKEN
  return typeof v === 'string' && Boolean(v.trim())
}

/**
 * GET /api/github-models: production server token probe (Vercel).
 * @returns {Promise<boolean>}
 */
export async function fetchGithubModelsProxyConfigured() {
  try {
    const r = await fetch(PROXY_PATH, { method: 'GET' })
    if (!r.ok) return false
    const d = await r.json()
    return Boolean(d?.tokenConfigured)
  } catch {
    return false
  }
}
