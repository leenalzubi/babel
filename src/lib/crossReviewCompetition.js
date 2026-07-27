export const CROSS_REVIEW_EVAL_SYSTEM = `You are evaluating two cross-review responses from other AI models in a debate. Score each one on two criteria only:

1. Specificity: did they reference specific arguments from the responses they reviewed, or did they speak in generalities?
2. Accuracy: were their challenges fair and well-founded, or did they misrepresent the other positions?

Return ONLY valid JSON:
{
  "scores": [
    {
      "model": "gpt" | "phi" | "mistral",
      "specificity": 1-10,
      "accuracy": 1-10,
      "total": (specificity + accuracy) / 2,
      "note": "one sentence justification"
    },
    {
      "model": "gpt" | "phi" | "mistral",
      ...
    }
  ]
}`

/** @param {unknown} v */
export function normModelKey(v) {
  const s = String(v ?? '')
    .toLowerCase()
    .trim()
  if (s === 'gpt' || s.includes('gpt')) return 'gpt'
  if (s === 'phi' || s.includes('phi')) return 'phi'
  if (s === 'mistral' || s.includes('mistral')) return 'mistral'
  return null
}

/** @param {string} text */
function extractJsonObject(text) {
  let t = typeof text === 'string' ? text.trim() : ''
  const fence = /```(?:json)?\s*([\s\S]*?)```/im
  const fm = t.match(fence)
  if (fm) t = fm[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('Eval: no JSON object')
  }
  return JSON.parse(t.slice(start, end + 1))
}

/** @param {unknown} n @param {number} lo @param {number} hi */
function clampNum(n, lo, hi) {
  const x = Number(n)
  if (!Number.isFinite(x)) return (lo + hi) / 2
  return Math.min(hi, Math.max(lo, x))
}

/**
 * @param {{
 *   agentA: { name: string },
 *   agentB: { name: string },
 *   agentC: { name: string },
 * }} config
 * @param {'gpt' | 'phi' | 'mistral'} evaluatorKey
 * @param {string} aRev
 * @param {string} bRev
 * @param {string} cRev
 */
export function buildCrossReviewEvalUserMessage(
  evaluatorKey,
  config,
  aRev,
  bRev,
  cRev
) {
  const { agentA, agentB, agentC } = config
  /** @param {'gpt' | 'phi' | 'mistral'} key */
  const label = (key) =>
    key === 'gpt' ? agentA.name : key === 'phi' ? agentB.name : agentC.name
  const parts = []
  if (evaluatorKey === 'gpt') {
    parts.push(
      `=== ${label('phi')} (model key: phi): cross-review ===\n${bRev}`,
      `=== ${label('mistral')} (model key: mistral): cross-review ===\n${cRev}`
    )
  } else if (evaluatorKey === 'phi') {
    parts.push(
      `=== ${label('gpt')} (model key: gpt): cross-review ===\n${aRev}`,
      `=== ${label('mistral')} (model key: mistral): cross-review ===\n${cRev}`
    )
  } else {
    parts.push(
      `=== ${label('gpt')} (model key: gpt): cross-review ===\n${aRev}`,
      `=== ${label('phi')} (model key: phi): cross-review ===\n${bRev}`
    )
  }
  return parts.join('\n\n')
}

/**
 * @param {unknown} raw
 * @returns {{ scores: Array<{ model: string, specificity: number, accuracy: number, total: number, note: string }> }}
 */
export function parseCrossReviewEvalResponse(raw) {
  try {
    const parsed = extractJsonObject(raw)
    const arr = Array.isArray(parsed.scores) ? parsed.scores : []
    const scores = arr
      .map((row) => {
        if (!row || typeof row !== 'object') return null
        const o = /** @type {Record<string, unknown>} */ (row)
        const mk = normModelKey(o.model)
        if (!mk) return null
        const specificity = clampNum(o.specificity, 1, 10)
        const accuracy = clampNum(o.accuracy, 1, 10)
        let total = Number(o.total)
        if (!Number.isFinite(total)) {
          total = (specificity + accuracy) / 2
        }
        const note =
          typeof o.note === 'string' && o.note.trim() ? o.note.trim() : ''
        return { model: mk, specificity, accuracy, total, note }
      })
      .filter(Boolean)
    return { scores: /** @type {NonNullable<(typeof scores)[number]>[]} */ (scores) }
  } catch {
    return { scores: [] }
  }
}

/**
 * @param {{
 *   gpt: { scores: unknown[] },
 *   phi: { scores: unknown[] },
 *   mistral: { scores: unknown[] },
 * }} evaluations
 */
export function aggregateSynthesisWinner(evaluations) {
  /** @typedef {'gpt' | 'phi' | 'mistral'} M */
  const keys = /** @type {const} */ (['gpt', 'phi', 'mistral'])

  /** @param {M} target */
  function metricsForTarget(target) {
    let sumT = 0
    let sumS = 0
    let n = 0
    for (const ev of keys) {
      if (ev === target) continue
      const list = evaluations[ev]?.scores
      if (!Array.isArray(list)) continue
      const row = list.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          normModelKey(/** @type {Record<string, unknown>} */ (item).model) ===
            target
      )
      if (!row || typeof row !== 'object') continue
      const r = /** @type {Record<string, unknown>} */ (row)
      const spec = clampNum(r.specificity, 1, 10)
      const acc = clampNum(r.accuracy, 1, 10)
      const total = Number.isFinite(Number(r.total))
        ? Number(r.total)
        : (spec + acc) / 2
      sumT += total
      sumS += spec
      n += 1
    }
    return {
      avgTotal: n > 0 ? sumT / n : 0,
      avgSpec: n > 0 ? sumS / n : 0,
    }
  }

  const byTarget = {
    gpt: metricsForTarget('gpt'),
    phi: metricsForTarget('phi'),
    mistral: metricsForTarget('mistral'),
  }

  /** @type {M} */
  let winner = 'gpt'
  let bestT = byTarget.gpt.avgTotal
  let bestS = byTarget.gpt.avgSpec

  for (const k of keys) {
    const { avgTotal, avgSpec } = byTarget[k]
    if (avgTotal > bestT + 1e-9) {
      winner = k
      bestT = avgTotal
      bestS = avgSpec
    } else if (Math.abs(avgTotal - bestT) < 1e-9 && avgSpec > bestS + 1e-9) {
      winner = k
      bestS = avgSpec
    }
  }

  const round1 = (/** @type {number} */ x) => Math.round(x * 10) / 10

  return {
    winner,
    scores: {
      gpt: round1(byTarget.gpt.avgTotal),
      phi: round1(byTarget.phi.avgTotal),
      mistral: round1(byTarget.mistral.avgTotal),
    },
    evaluations,
  }
}

/**
 * @param {{
 *   winner: string,
 *   scores: { gpt: number, phi: number, mistral: number },
 *   evaluations: {
 *     gpt: { scores: unknown[] },
 *     phi: { scores: unknown[] },
 *     mistral: { scores: unknown[] },
 *   },
 * }} payload
 */
export function buildCompetitionMatrix(payload) {
  const keys = /** @type {const} */ (['gpt', 'phi', 'mistral'])
  const evaluations = payload.evaluations
  /** @type {Record<string, Record<string, number | null>>} */
  const cells = {}
  /** @type {Record<string, Record<string, string | null>>} */
  const notes = {}

  for (const e of keys) {
    cells[e] = { gpt: null, phi: null, mistral: null }
    notes[e] = { gpt: null, phi: null, mistral: null }
    for (const t of keys) {
      if (e === t) continue
      const list = evaluations[e]?.scores
      if (!Array.isArray(list)) continue
      const row = list.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          normModelKey(/** @type {Record<string, unknown>} */ (item).model) === t
      )
      if (!row || typeof row !== 'object') continue
      const r = /** @type {Record<string, unknown>} */ (row)
      const spec = clampNum(r.specificity, 1, 10)
      const acc = clampNum(r.accuracy, 1, 10)
      const total = Number.isFinite(Number(r.total))
        ? Number(r.total)
        : (spec + acc) / 2
      cells[e][t] = Math.round(total * 100) / 100
      const note = typeof r.note === 'string' ? r.note.trim() : ''
      notes[e][t] = note || null
    }
  }

  /** @type {Record<string, number | null>} */
  const avgCol = {}
  for (const t of keys) {
    const vals = keys
      .filter((e) => e !== t)
      .map((e) => cells[e][t])
      .filter((v) => v != null && Number.isFinite(v))
    avgCol[t] =
      vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) /
          100
        : null
  }

  return { cells, notes, avgCol, winner: payload.winner }
}

/**
 * Averaged specificity / accuracy for one target from the two evaluators.
 * @param {'gpt' | 'phi' | 'mistral'} target
 * @param {{
 *   gpt: { scores: unknown[] },
 *   phi: { scores: unknown[] },
 *   mistral: { scores: unknown[] },
 * }} evaluations
 */
export function avgSubscoresForTarget(target, evaluations) {
  const keys = /** @type {const} */ (['gpt', 'phi', 'mistral'])
  let sp = 0
  let ac = 0
  let n = 0
  for (const ev of keys) {
    if (ev === target) continue
    const list = evaluations[ev]?.scores
    if (!Array.isArray(list)) continue
    const row = list.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        normModelKey(/** @type {Record<string, unknown>} */ (item).model) ===
          target
    )
    if (!row || typeof row !== 'object') continue
    const r = /** @type {Record<string, unknown>} */ (row)
    sp += clampNum(r.specificity, 1, 10)
    ac += clampNum(r.accuracy, 1, 10)
    n += 1
  }
  if (n === 0) return { specificity: null, accuracy: null }
  return {
    specificity: Math.round((sp / n) * 10) / 10,
    accuracy: Math.round((ac / n) * 10) / 10,
  }
}
