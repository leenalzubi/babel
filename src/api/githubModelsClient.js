/**
 * GitHub Models — OpenAI-compatible chat completions.
 *
 * GitHub PAT with models:read scope required. Get one at https://github.com/settings/tokens.
 * Demo use only — never expose tokens in production (use a backend proxy instead).
 */

import { API_ERROR, isLikelyNetworkError } from '../lib/apiErrors.js'

const CHAT_COMPLETIONS_URL =
  'https://models.github.ai/inference/chat/completions'

/**
 * @param {number} status
 */
function classifyGitHubModelsStatus(status) {
  if (status === 401 || status === 403) {
    return API_ERROR.GITHUB_TOKEN_MISSING
  }
  if (status === 429) {
    return API_ERROR.RATE_LIMIT
  }
  return `GitHub Models error: ${status}`
}

/**
 * @param {string} model
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages
 * @param {string} systemPrompt
 * @returns {Promise<string>}
 */
export async function callGitHubModel(model, messages, systemPrompt) {
  const token = import.meta.env.VITE_GITHUB_TOKEN

  if (typeof token !== 'string' || !token.trim()) {
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

  let response
  try {
    response = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.trim()}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    })
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      throw new Error(API_ERROR.NETWORK)
    }
    throw err instanceof Error ? err : new Error(String(err))
  }

  let data
  try {
    data = await response.json()
  } catch {
    if (!response.ok) {
      throw new Error(classifyGitHubModelsStatus(response.status))
    }
    throw new Error(API_ERROR.NETWORK)
  }

  if (!response.ok) {
    throw new Error(classifyGitHubModelsStatus(response.status))
  }

  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error(
      'GitHub Models response missing choices[0].message.content string.'
    )
  }

  return content
}
