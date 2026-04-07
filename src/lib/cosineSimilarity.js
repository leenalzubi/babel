/**
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
export function cosineSimilarity(vecA, vecB) {
  if (
    !Array.isArray(vecA) ||
    !Array.isArray(vecB) ||
    vecA.length === 0 ||
    vecA.length !== vecB.length
  ) {
    return Number.NaN
  }
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
  if (magA === 0 || magB === 0) return Number.NaN
  const raw = dotProduct / (magA * magB)
  return Math.min(1, Math.max(-1, raw))
}

/**
 * Semantic divergence in [0, 1]: 0 = same meaning, 1 = maximally different direction.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number | null}
 */
export function semanticDivergence(vecA, vecB) {
  const sim = cosineSimilarity(vecA, vecB)
  if (Number.isNaN(sim)) return null
  const d = 1 - sim
  const clamped = Math.min(1, Math.max(0, d))
  return Math.round(clamped * 10000) / 10000
}
