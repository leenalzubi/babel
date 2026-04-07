const CONCEDE = [
  'concede',
  'you are correct',
  'i was wrong',
  'valid point',
  'i agree that',
  'i must acknowledge',
]

const HOLD = [
  'maintain',
  'still believe',
  'disagree',
  'my position',
  'however',
  'respectfully',
]

const MODIFY = [
  'partially',
  'nuance',
  'refine',
  'more precisely',
  'to clarify',
]

/**
 * @param {string} text
 * @returns {'conceded' | 'held' | 'modified'}
 */
export function classifyRebuttalStance(text) {
  const s = typeof text === 'string' ? text.toLowerCase() : ''
  if (!s.trim()) return 'modified'

  let c = 0
  let h = 0
  let m = 0
  for (const w of CONCEDE) {
    if (s.includes(w)) c += 1
  }
  for (const w of HOLD) {
    if (s.includes(w)) h += 1
  }
  for (const w of MODIFY) {
    if (s.includes(w)) m += 1
  }

  const max = Math.max(c, h, m)
  if (max === 0) return 'modified'
  if (c === max && c >= h && c >= m) return 'conceded'
  if (h === max && h >= c && h >= m) return 'held'
  return 'modified'
}
