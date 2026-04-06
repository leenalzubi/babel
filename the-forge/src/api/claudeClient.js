/**
 * Browser-side Anthropic Messages API client using `fetch`.
 *
 * ⚠️ **Security:** `VITE_*` env vars are embedded in the client bundle. Anyone can read your
 * API key from the network tab or built JS. Use **only** for local demos / development.
 * In production, proxy requests through your own backend and keep keys server-side.
 */

import { API_ERROR, isLikelyNetworkError } from '../lib/apiErrors.js'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

/**
 * @param {number} status
 */
function classifyAnthropicStatus(status) {
  if (status === 401 || status === 403) {
    return API_ERROR.ANTHROPIC_KEY_MISSING
  }
  if (status === 429) {
    return API_ERROR.RATE_LIMIT
  }
  return `Anthropic API error: ${status}`
}

/**
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages
 * @param {string} systemPrompt
 * @returns {Promise<string>}
 */
export async function callClaude(messages, systemPrompt) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error(API_ERROR.ANTHROPIC_KEY_MISSING)
  }

  if (typeof systemPrompt !== 'string') {
    throw new Error('callClaude: systemPrompt must be a string.')
  }

  if (!Array.isArray(messages)) {
    throw new Error('callClaude: messages must be an array.')
  }

  let res
  try {
    res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: systemPrompt,
        messages,
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
    data = await res.json()
  } catch {
    if (!res.ok) {
      throw new Error(classifyAnthropicStatus(res.status))
    }
    throw new Error(API_ERROR.NETWORK)
  }

  if (!res.ok) {
    throw new Error(classifyAnthropicStatus(res.status))
  }

  const block = data?.content?.[0]
  if (!block || block.type !== 'text' || typeof block.text !== 'string') {
    throw new Error(
      'Anthropic API response missing text block at content[0]. Check the Messages API response shape.'
    )
  }

  return block.text
}
