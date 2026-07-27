/** ~chars budget for one chat request user content (leave room for system + overhead vs ~128k token limits). */
const DEFAULT_MAX_USER_CHARS = 72_000

/** Aggressive budget used after a token_limit soft retry. */
const COMPACT_MAX_USER_CHARS = 28_000

/**
 * @param {string} text
 * @param {number} [maxChars]
 */
export function clipInferenceText(text, maxChars = DEFAULT_MAX_USER_CHARS) {
  if (typeof text !== 'string' || !text) return ''
  if (text.length <= maxChars) return text
  return (
    text.slice(0, maxChars) +
    '\n\n[Truncated by Babel to stay within GitHub Models input limits.]'
  )
}

/**
 * Compact chat messages after a token_limit failure (strip redundancy, hard-cap user content).
 * @param {Array<{ role?: string, content?: string }>} messages
 * @param {number} [maxChars]
 * @returns {Array<{ role: string, content: string }>}
 */
export function compactChatMessages(messages, maxChars = COMPACT_MAX_USER_CHARS) {
  if (!Array.isArray(messages)) return []
  return messages.map((m) => {
    const role = typeof m?.role === 'string' ? m.role : 'user'
    let content = typeof m?.content === 'string' ? m.content : String(m?.content ?? '')
    // Drop duplicated blank lines / trim noisy whitespace
    content = content.replace(/\n{3,}/g, '\n\n').trim()
    if (role === 'user' || role === 'system') {
      content = clipInferenceText(content, maxChars)
    }
    return { role, content }
  })
}
