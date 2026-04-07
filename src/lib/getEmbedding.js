import {
  githubModelsFetchHeaders,
  GITHUB_MODELS_EMBEDDINGS_URL,
} from './githubModelsHttp.js'

const PROXY_PATH = '/api/github-models-embeddings'

const EMBEDDING_MODEL = 'text-embedding-3-small'

/**
 * @param {unknown} data
 * @returns {number[] | null}
 */
function pickEmbedding(data) {
  if (!data || typeof data !== 'object') return null
  const row = data.data?.[0]
  const emb = row?.embedding
  return Array.isArray(emb) && emb.every((x) => typeof x === 'number')
    ? emb
    : null
}

/**
 * GitHub Models text embedding (1536 dims for text-embedding-3-small).
 * Returns null on any failure (network, auth, shape).
 *
 * @param {string} text
 * @returns {Promise<number[] | null>}
 */
export async function getEmbedding(text) {
  try {
    const raw = typeof text === 'string' ? text : String(text ?? '')
    const input = raw.substring(0, 8000)
    if (!input.trim()) return null

    const vite =
      typeof import.meta.env.VITE_GITHUB_TOKEN === 'string'
        ? import.meta.env.VITE_GITHUB_TOKEN.trim()
        : ''

    const useProxy = import.meta.env.PROD && !vite
    const url = useProxy ? PROXY_PATH : GITHUB_MODELS_EMBEDDINGS_URL
    if (!url) return null

    const headers = githubModelsFetchHeaders({
      'Content-Type': 'application/json',
    })
    if (vite) {
      headers.Authorization = `Bearer ${vite}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input,
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    return pickEmbedding(data)
  } catch {
    return null
  }
}

/**
 * @param {number[] | null | undefined} a
 * @param {number[] | null | undefined} b
 * @returns {number} cosine similarity in [-1, 1], or 0 if invalid
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom > 0 ? dot / denom : 0
}

/**
 * @param {number[][]} vectors same length
 * @returns {number[] | null}
 */
export function meanEmbedding(vectors) {
  const ok = vectors.filter(
    (v) => Array.isArray(v) && v.length === vectors[0]?.length
  )
  if (ok.length === 0) return null
  const dim = ok[0].length
  const out = new Array(dim).fill(0)
  for (const v of ok) {
    for (let i = 0; i < dim; i++) out[i] += v[i]
  }
  for (let i = 0; i < dim; i++) out[i] /= ok.length
  return out
}

/** Semantic “distance” between round 1 and round 3 for one model: 1 − cosine similarity. */
export function embeddingDistanceR1R3(embR1, embR3) {
  const sim = cosineSimilarity(embR1, embR3)
  return Math.max(0, Math.min(1, 1 - sim))
}

/**
 * @param {number} distance 1 − cos(r1, r3)
 * @returns {'held firm' | 'minor shift' | 'shifted' | 'significant change'}
 */
export function classifyEmbeddingDistance(distance) {
  const d = Number(distance)
  if (!Number.isFinite(d)) return 'minor shift'
  if (d <= 0.1) return 'held firm'
  if (d <= 0.25) return 'minor shift'
  if (d <= 0.45) return 'shifted'
  return 'significant change'
}

/**
 * @param {number[] | null} agentR1
 * @param {number[] | null} agentR3
 * @param {number[] | null} other1R1
 * @param {number[] | null} other1R3
 * @param {number[] | null} other2R1
 * @param {number[] | null} other2R3
 * @returns {boolean | null} true if moved toward average of the other two at R3 vs R1
 */
export function movedTowardPairConsensus(
  agentR1,
  agentR3,
  other1R1,
  other1R3,
  other2R1,
  other2R3
) {
  const m1 = meanEmbedding(
    [other1R1, other2R1].filter((v) => Array.isArray(v))
  )
  const m3 = meanEmbedding(
    [other1R3, other2R3].filter((v) => Array.isArray(v))
  )
  if (
    !m1 ||
    !m3 ||
    !Array.isArray(agentR1) ||
    !Array.isArray(agentR3)
  ) {
    return null
  }
  const c1 = cosineSimilarity(agentR1, m1)
  const c3 = cosineSimilarity(agentR3, m3)
  const eps = 0.02
  if (c3 > c1 + eps) return true
  if (c3 + eps < c1) return false
  return null
}
