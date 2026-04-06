/**
 * Vercel serverless: proxy to GitHub Models so the PAT stays off the client.
 * Set GITHUB_MODELS_PAT in Vercel → Environment Variables (Production / Preview).
 * Falls back to VITE_GITHUB_TOKEN if present on the server (not recommended).
 *
 * IMPORTANT: Do not import from ../src here — some deploy bundles only include /api,
 * which would break the function and yield 404/HTML from the static host.
 */

const UPSTREAM = 'https://models.github.ai/inference/chat/completions'
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

/**
 * Vercel / Node sometimes leave POST body as a string or Buffer instead of a parsed object.
 * @param {import('http').IncomingMessage & { body?: unknown }} req
 */
/** Vercel — allow long GitHub Models completions (see project Functions settings too). */
export const config = {
  maxDuration: 300,
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
          'GitHub PAT missing on the server. In Vercel add GITHUB_MODELS_PAT (recommended) under Environment Variables for this environment, then redeploy.',
      })
    }

    const body = parseJsonBody(req)
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        error:
          'Expected JSON object body (application/json). If you use curl or a proxy, send a JSON object with model and messages.',
      })
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
      console.error('github-models proxy upstream fetch error', err)
      return res.status(502).json({ error: 'Upstream GitHub Models request failed' })
    }

    const text = await upstreamRes.text()
    res.status(upstreamRes.status)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.send(text)
  } catch (err) {
    console.error('github-models handler error', err)
    return res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Unexpected error in /api/github-models',
    })
  }
}
