/** ~chars budget for one chat request user content (leave room for system + overhead vs ~128k token limits). */
const DEFAULT_MAX_USER_CHARS = 72_000

/**
 * @param {string} text
 * @param {number} [maxChars]
 */
export function clipInferenceText(text, maxChars = DEFAULT_MAX_USER_CHARS) {
  if (typeof text !== 'string' || !text) return ''
  if (text.length <= maxChars) return text
  return (
    text.slice(0, maxChars) +
    '\n\n[Truncated by The Forge to stay within GitHub Models input limits.]'
  )
}
