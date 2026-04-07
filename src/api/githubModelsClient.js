/**
 * GitHub Models — OpenAI-compatible chat completions.
 *
 * - Local dev: set VITE_GITHUB_TOKEN (GitHub PAT with Models access).
 * - Production (e.g. Vercel): prefer GITHUB_MODELS_PAT on the server; the client calls
 *   /api/github-models so the token is never embedded in static JS.
 */

import { API_ERROR, isLikelyNetworkError } from '../lib/apiErrors.js'
import {
  GITHUB_MODELS_CHAT_URL,
  githubModelsFetchHeaders,
} from '../lib/githubModelsHttp.js'

const PROXY_PATH = '/api/github-models'

const RETRYABLE_STATUS = new Set([429, 500, 502, 503])

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

  const rawMessage = body?.error?.message || body?.message || ''
  const message = typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? '')
  const messageLower = message.toLowerCase()

  if (status === 400 && messageLower.includes('content management policy')) {
    return {
      type: 'content_filter',
      agent: agentName,
      title: 'Content filter triggered',
      detail: `${agentName} was blocked by Azure's content filter. This usually happens with prompts containing sensitive, ambiguous, or politically charged language.`,
      suggestion:
        'Try rephrasing your prompt. Avoid loaded language, explicit hypotheticals, or topics that could be interpreted as harmful.',
    }
  }

  if (status === 429) {
    const retryAfter = response.headers.get('retry-after') || '60'
    return {
      type: 'rate_limit',
      agent: agentName,
      title: 'Rate limit reached',
      detail: `GitHub Models free tier rate limit hit on ${agentName}. Retry after ${retryAfter} seconds.`,
      suggestion: `Wait ${retryAfter} seconds and try again. If this keeps happening, space out your debates.`,
    }
  }

  if (status === 400 && messageLower.includes('token')) {
    return {
      type: 'token_limit',
      agent: agentName,
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
      title: 'Authentication failed',
      detail:
        'Your GitHub token was rejected. It may have expired or have insufficient permissions.',
      suggestion:
        'Generate a new fine-grained GitHub token with Models: Read-only permission and update your environment variables.',
    }
  }

  if (status === 404) {
    return {
      type: 'model_unavailable',
      agent: agentName,
      title: 'Model unavailable',
      detail: `${agentName} is not available on your GitHub Models tier or the model ID has changed.`,
      suggestion:
        'Check https://github.com/marketplace?type=models to confirm the model is available on your account.',
    }
  }

  if (status === 500 || status === 502 || status === 503) {
    return {
      type: 'server_error',
      agent: agentName,
      title: 'GitHub Models server error',
      detail: `GitHub Models returned a ${status} error for ${agentName}. This is usually temporary.`,
      suggestion:
        'Wait a moment and try again. Check https://www.githubstatus.com if it keeps happening.',
    }
  }

  return {
    type: 'unknown',
    agent: agentName,
    title: 'Unexpected error',
    detail: `${agentName} failed with status ${status}${message ? `: ${message}` : ''}`,
    suggestion: 'Try again. If it keeps failing, try a different prompt.',
  }
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
        agent: agentName,
        title: 'Model timed out',
        detail: `${agentName} took longer than 2 minutes to respond.`,
        suggestion:
          'Try again. Phi-4 Reasoning sometimes takes longer on complex prompts.',
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
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages
 * @param {string} systemPrompt
 * @param {{ maxTokens?: number, agentName?: string, errorContext?: { stage?: string, round?: number } } | undefined} [options]
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

  return callWithTimeout(
    async (signal) => {
      let lastError = new Error('GitHub Models request failed')

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await sleep(1500 * attempt)
        }
        if (signal.aborted) {
          throw {
            type: 'timeout',
            agent: agentName,
            title: 'Model timed out',
            detail: `${agentName} took longer than 2 minutes to respond.`,
            suggestion:
              'Try again. Phi-4 Reasoning sometimes takes longer on complex prompts.',
            ...errorContext,
          }
        }
        if (attempt > 0) {
          await sleep(1500 * attempt)
        }
        if (signal.aborted) {
          throw {
            type: 'timeout',
            agent: agentName,
            title: 'Model timed out',
            detail: `${agentName} took longer than 2 minutes to respond.`,
            suggestion:
              'Try again. Phi-4 Reasoning sometimes takes longer on complex prompts.',
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
              agent: agentName,
              title: 'Model timed out',
              detail: `${agentName} took longer than 2 minutes to respond.`,
              suggestion:
                'Try again. Phi-4 Reasoning sometimes takes longer on complex prompts.',
              ...errorContext,
            }
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

        if (!response.ok) {
          if (RETRYABLE_STATUS.has(response.status) && attempt < 2) {
            try {
              await response.text()
            } catch {
              /* ignore */
            }
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
