/**
 * Best-effort extract the "### On {peerName}" block from a structured cross-review.
 * Falls back to full text if no section header matches.
 *
 * @param {string} fullReview
 * @param {string} peerName
 * @returns {string}
 */
export function extractReviewSectionAboutPeer(fullReview, peerName) {
  const s = typeof fullReview === 'string' ? fullReview : ''
  const name = typeof peerName === 'string' ? peerName.trim() : ''
  if (!s.trim() || !name) return s.trim()

  const parts = s.split(/\n(?=###\s)/)
  for (const part of parts) {
    const head = part.split('\n')[0] ?? ''
    const lower = head.toLowerCase()
    const needle = name.toLowerCase()
    if (lower.includes('on ') && lower.includes(needle)) {
      return part.trim()
    }
  }

  const idx = s.toLowerCase().indexOf(name.toLowerCase())
  if (idx !== -1) {
    const slice = s.slice(Math.max(0, idx - 80), idx + name.length + 400)
    if (/###\s*on/i.test(slice)) {
      const start = s.lastIndexOf('###', idx)
      if (start !== -1) return s.slice(start).split(/\n(?=###\s)/)[0]?.trim() ?? s.trim()
    }
  }

  return s.trim()
}
