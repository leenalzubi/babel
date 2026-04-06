/** DeepSeek R1-style chain-of-thought wrapper from some GitHub Models responses. */
const REDACTED_TAG = /<redacted_thinking>([\s\S]*?)<\/redacted_thinking>/gi

/**
 * @param {string | undefined | null} text
 * @returns {{ answer: string, thinking: string | null }}
 */
export function splitRedactedThinking(text) {
  if (text == null) return { answer: '', thinking: null }
  if (typeof text !== 'string') return { answer: '', thinking: null }

  const thinkingChunks = []
  const execRe = new RegExp(REDACTED_TAG.source, 'gi')
  let m
  while ((m = execRe.exec(text)) !== null) {
    const inner = m[1].trim()
    if (inner) thinkingChunks.push(inner)
  }

  const answer = text
    .replace(new RegExp(REDACTED_TAG.source, 'gi'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const thinking =
    thinkingChunks.length > 0 ? thinkingChunks.join('\n\n—\n\n') : null

  return { answer, thinking }
}
