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
