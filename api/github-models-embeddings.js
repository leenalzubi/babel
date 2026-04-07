/**
 * Vercel serverless: proxy GitHub Models embeddings (PAT stays on server).
 * Client POSTs the same JSON body as the upstream embeddings API.
 */

const UPSTREAM = 'https://models.github.ai/inference/embeddings'
const GITHUB_MODELS_API_VERSION = '2022-11-28'

function githubModelsFetchHeaders(extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_MODELS_API_VERSION,
    ...extra,
  }
}

function serverToken() {
  return (
    process.env.GITHUB_MODELS_PAT ||
    process.env.VITE_GITHUB_TOKEN ||
    ''
  ).trim()
}

export const config = {
  maxDuration: 120,
}

function parseJsonBody(req) {
  const raw = req.body
  if (raw == null) return null
  if (typeof raw === 'object' && !Buffer.isBuffer(raw) && !Array.isArray(raw)) {
    return raw
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8'))
    } catch {
      return null
    }
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store')

    if (req.method === 'GET') {
      return res.status(200).json({ tokenConfigured: Boolean(serverToken()) })
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const token = serverToken()
    if (!token) {
      return res.status(503).json({
        error:
          'GitHub PAT missing on the server. Add GITHUB_MODELS_PAT in Vercel, then redeploy.',
      })
    }

    const body = parseJsonBody(req)
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Expected JSON object body.' })
    }

    let upstreamRes
    try {
      upstreamRes = await fetch(UPSTREAM, {
        method: 'POST',
        headers: githubModelsFetchHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify(body),
      })
    } catch (err) {
      console.error('github-models-embeddings upstream fetch error', err)
      return res.status(502).json({ error: 'Upstream embeddings request failed' })
    }

    const text = await upstreamRes.text()
    res.status(upstreamRes.status)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.send(text)
  } catch (err) {
    console.error('github-models-embeddings handler error', err)
    return res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Unexpected error in /api/github-models-embeddings',
    })
  }
}
