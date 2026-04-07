/**
 * GitHub Models — OpenAI-compatible chat completions.
 *
 * - Local dev: set VITE_GITHUB_TOKEN (GitHub PAT with Models access).
 * - Production (e.g. Vercel): prefer GITHUB_MODELS_PAT on the server; the client calls
 *   /api/github-models so the token is never embedded in static JS.
 */

import { API_ERROR, isLikelyNetworkError } from '../lib/apiErrors.js'
import { TIMEOUT_ERROR_MESSAGE } from '../lib/debateConstants.js'
import {
  GITHUB_MODELS_CHAT_URL,
  githubModelsFetchHeaders,
} from '../lib/githubModelsHttp.js'

const PROXY_PATH = '/api/github-models'

const RETRYABLE_STATUS = new Set([429, 500, 502, 503])

/**
 * @returns {{ url: string, authorization: string | null }}
 */
function resolveGithubChatRequest() {
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
  if (import.meta.env.PROD) {
    return { url: PROXY_PATH, authorization: null }
  }
  return { url: '', authorization: null }
}

/**
 * @param {number} status
 */
function classifyGitHubModelsStatus(status) {
  if (status === 401 || status === 403) {
    return API_ERROR.GITHUB_TOKEN_REJECTED
  }
  if (status === 404) {
    return API_ERROR.GITHUB_MODEL_NOT_FOUND
  }
  if (status === 429) {
    return API_ERROR.RATE_LIMIT
  }
  if (status === 500 || status === 502 || status === 503) {
    return API_ERROR.GITHUB_MODELS_UPSTREAM_ERROR
  }
  return `GitHub Models error: ${status}`
}

/** @param {unknown} data */
function upstreamErrorText(data) {
  if (!data || typeof data !== 'object') return ''
  if ('message' in data && typeof data.message === 'string') {
    return data.message
  }
  const err = 'error' in data ? data.error : undefined
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const m = err.message
    if (typeof m === 'string') return m
  }
  if (Array.isArray(data.detail)) {
    const parts = []
    for (const d of data.detail) {
      if (d && typeof d === 'object' && 'msg' in d && typeof d.msg === 'string') {
        parts.push(d.msg)
      }
    }
    if (parts.length) return parts.join('; ')
  }
  try {
    const raw = JSON.stringify(data)
    if (raw && raw !== '{}') {
      return raw.length > 900 ? `${raw.slice(0, 900)}…` : raw
    }
  } catch {
    /* ignore */
  }
  return ''
}

/**
 * @param {Response} response
 * @param {string} fallback
 */
async function errorMessageFromResponse(response, fallback) {
  try {
    const data = await response.clone().json()
    const t = upstreamErrorText(data)
    if (t) return t
  } catch {
    /* use fallback */
  }
  return fallback
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const DEFAULT_MODEL_CALL_TIMEOUT_MS = 120_000

/**
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fetchWithSignal
 * @param {number} [timeoutMs]
 * @returns {Promise<T>}
 */
async function callWithTimeout(fetchWithSignal, timeoutMs = DEFAULT_MODEL_CALL_TIMEOUT_MS) {
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
      throw new Error(TIMEOUT_ERROR_MESSAGE)
    }
    throw err
  }
}

/** User-facing prefix; ErrorBanner treats messages containing "Content filter" specially. */
export const CONTENT_FILTER_MESSAGE_PREFIX = 'Content filter:'

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isContentFilterError(err) {
  return (
    err instanceof Error &&
    err.message.includes(CONTENT_FILTER_MESSAGE_PREFIX)
  )
}

const CONTENT_POLICY_MARK = 'content management policy'

/**
 * Azure/GitHub Models may return 400 with this phrase when the prompt is blocked.
 * @param {number} status
 * @param {unknown} data
 * @param {{ agentName?: string } | undefined} options
 */
function throwIfContentPolicyBlocked(status, data, options) {
  if (status !== 400) return
  let blob = ''
  if (data && typeof data === 'object') {
    blob = `${upstreamErrorText(data)} ${JSON.stringify(data)}`
  } else if (typeof data === 'string') {
    blob = data
  }
  if (!blob.toLowerCase().includes(CONTENT_POLICY_MARK)) return
  const name =
    options &&
    typeof options.agentName === 'string' &&
    options.agentName.trim()
      ? options.agentName.trim()
      : 'the model'
  throw new Error(
    `${CONTENT_FILTER_MESSAGE_PREFIX} this prompt was blocked by Azure's safety filter on ${name}. Try rephrasing.`
  )
}

/**
 * @param {string} model
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages
 * @param {string} systemPrompt
 * @param {{ maxTokens?: number, agentName?: string } | undefined} [options]
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

  return callWithTimeout(async (signal) => {
    let lastError = new Error('GitHub Models request failed')

    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal.aborted) {
        throw new Error(TIMEOUT_ERROR_MESSAGE)
      }
      if (attempt > 0) {
        await sleep(1500 * attempt)
      }
      if (signal.aborted) {
        throw new Error(TIMEOUT_ERROR_MESSAGE)
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
        const name = err && typeof err === 'object' && 'name' in err ? err.name : ''
        if (name === 'AbortError' || signal.aborted) {
          throw new Error(TIMEOUT_ERROR_MESSAGE)
        }
        if (isLikelyNetworkError(err)) {
          lastError = new Error(API_ERROR.NETWORK)
          if (attempt < 2) continue
          throw lastError
        }
        throw err instanceof Error ? err : new Error(String(err))
      }

    if (
      isProxyRequest &&
      response.status === 404 &&
      !(response.headers.get('content-type') ?? '').includes('application/json')
    ) {
      throw new Error(API_ERROR.GITHUB_PROXY_404)
    }

    let data
    try {
      data = await response.json()
    } catch {
      if (!response.ok) {
        let textFallback = ''
        try {
          textFallback = await response.clone().text()
        } catch {
          /* ignore */
        }
        throwIfContentPolicyBlocked(response.status, textFallback, options)
        const msg = await errorMessageFromResponse(
          response,
          classifyGitHubModelsStatus(response.status)
        )
        lastError = new Error(msg)
        if (RETRYABLE_STATUS.has(response.status) && attempt < 2) continue
        throw lastError
      }
      throw new Error(API_ERROR.NETWORK)
    }

    if (response.ok) {
      const content = data?.choices?.[0]?.message?.content
      if (typeof content !== 'string') {
        throw new Error(
          'GitHub Models response missing choices[0].message.content string.'
        )
      }
      return content
    }

    throwIfContentPolicyBlocked(response.status, data, options)

    const detail = upstreamErrorText(data)
    const base = classifyGitHubModelsStatus(response.status)
    const msg = detail ? `${base}\n\n${detail}` : base
    lastError = new Error(msg)
    if (RETRYABLE_STATUS.has(response.status) && attempt < 2) {
      continue
    }
    throw lastError
  }

    throw lastError
  })
}

/**
 * Whether the browser has a direct VITE token (local / legacy client-only prod).
 * @returns {boolean}
 */
export function hasGithubModelsClientToken() {
  const v = import.meta.env.VITE_GITHUB_TOKEN
  return typeof v === 'string' && Boolean(v.trim())
}

/**
 * GET /api/github-models — production server token probe (Vercel).
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
