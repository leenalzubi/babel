/**
 * Browser-side OpenAI Chat Completions using `fetch` (demo / local only).
 * Never ship API keys in client bundles for production.
 */

import { API_ERROR, isLikelyNetworkError } from '../lib/apiErrors.js'

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'

/**
 * @param {number} status
 */
function classifyOpenAIStatus(status) {
  if (status === 401 || status === 403) {
    return API_ERROR.OPENAI_KEY_MISSING
  }
  if (status === 429) {
    return API_ERROR.RATE_LIMIT
  }
  return `OpenAI API error: ${status}`
}

/**
 * @param {string} model
 * @param {Array<{ role: 'user' | 'assistant' | 'system', content: string }>} messages
 * @param {string} [systemPrompt] optional; prepended as system message
 * @returns {Promise<string>}
 */
export async function callOpenAI(model, messages, systemPrompt = '') {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error(API_ERROR.OPENAI_KEY_MISSING)
  }

  const bodyMessages =
    systemPrompt && typeof systemPrompt === 'string'
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages

  let res
  try {
    res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        messages: bodyMessages,
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
      throw new Error(classifyOpenAIStatus(res.status))
    }
    throw new Error(API_ERROR.NETWORK)
  }

  if (!res.ok) {
    throw new Error(classifyOpenAIStatus(res.status))
  }

  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('OpenAI response missing choices[0].message.content.')
  }

  return content
}
