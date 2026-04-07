/** @type {readonly string[]} */
export const CONFLICT_SIGNALS = [
  'however',
  'but',
  'contrary',
  'incorrect',
  'fails',
  'overlooks',
  'missing',
  'disagree',
  'challenge',
  'problematic',
  'wrong',
  'oversimplifies',
  'ignores',
  'neglects',
  'flawed',
  'misleading',
  'incomplete',
  'contradicts',
  'misses',
  'unfortunately',
]

const SIGNAL_SET = new Set(CONFLICT_SIGNALS)

/** @param {string} text */
function countSignals(text) {
  if (typeof text !== 'string' || !text) return 0
  const tokens = text.toLowerCase().match(/[a-z']+/g)
  if (!tokens) return 0
  let n = 0
  for (const t of tokens) {
    if (SIGNAL_SET.has(t)) n += 1
  }
  return n
}

/** @param {number} count */
function normalizeConflictScore(count) {
  return Math.min(1, (count * 0.5) / 10)
}

/** @param {string} text */
function jaccardOverlap(text1, text2) {
  const a = typeof text1 === 'string' ? text1 : ''
  const b = typeof text2 === 'string' ? text2 : ''
  const set1 = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const set2 = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  const intersection = new Set([...set1].filter((w) => set2.has(w)))
  const union = new Set([...set1, ...set2])
  if (union.size === 0) return 0
  return intersection.size / union.size
}

/** @param {string} text */
function hasNamedReferences(text) {
  if (typeof text !== 'string' || !text) return false
  const lower = text.toLowerCase()
  return (
    lower.includes('gpt') ||
    lower.includes('phi') ||
    lower.includes('mistral')
  )
}

/**
 * @param {string[]} lines
 * @param {{
 *   agentA?: { name?: string },
 *   agentB?: { name?: string },
 *   agentC?: { name?: string },
 * }} config
 */
function countFlexibleSignals(lines, config) {
  const counts = { a: 0, b: 0, c: 0 }
  if (!Array.isArray(lines) || !config) return counts
  const aN = config.agentA?.name?.toLowerCase() ?? ''
  const bN = config.agentB?.name?.toLowerCase() ?? ''
  const cN = config.agentC?.name?.toLowerCase() ?? ''
  for (const line of lines) {
    if (typeof line !== 'string' || !line.trim()) continue
    const lower = line.toLowerCase()
    let assigned = false
    if (aN && lower.includes(aN.slice(0, Math.min(12, aN.length)))) {
      counts.a += 1
      assigned = true
    } else if (bN && lower.includes(bN.slice(0, Math.min(12, bN.length)))) {
      counts.b += 1
      assigned = true
    } else if (cN && lower.includes(cN.slice(0, Math.min(12, cN.length)))) {
      counts.c += 1
      assigned = true
    }
    if (!assigned) {
      if (/\b(agent[_\s]?a|gpt-4o)\b/i.test(line)) counts.a += 1
      else if (/\b(agent[_\s]?b|phi-4)\b/i.test(line)) counts.b += 1
      else if (/\b(agent[_\s]?c|mistral)\b/i.test(line)) counts.c += 1
    }
  }
  return counts
}

/** @param {string} s */
function wordCount(s) {
  if (typeof s !== 'string' || !s.trim()) return 0
  return s.trim().split(/\s+/).length
}

/**
 * @param {string | null | undefined} out
 * @returns {boolean}
 */
function isSynthesisSkippedOrEmpty(out) {
  if (typeof out !== 'string' || !out.trim()) return true
  return /\bsynthesis\s+skipped\b/i.test(out)
}

/**
 * Analyse a completed debate snapshot for logging / findings.
 * Safe on partial state; never throws.
 *
 * @param {Record<string, unknown>} state
 */
export function analyseDebate(state) {
  const rounds = Array.isArray(state?.rounds) ? state.rounds : []
  const round0 = rounds[0] && typeof rounds[0] === 'object' ? rounds[0] : {}

  const agentA = typeof round0.agentA === 'string' ? round0.agentA : ''
  const agentB = typeof round0.agentB === 'string' ? round0.agentB : ''
  const agentC = typeof round0.agentC === 'string' ? round0.agentC : ''

  const reviews = Array.isArray(state?.reviews) ? state.reviews : []
  const rev0 =
    reviews[0] && typeof reviews[0] === 'object' ? reviews[0] : {}
  const aReviews = typeof rev0.aReviews === 'string' ? rev0.aReviews : ''
  const bReviews = typeof rev0.bReviews === 'string' ? rev0.bReviews : ''
  const cReviews = typeof rev0.cReviews === 'string' ? rev0.cReviews : ''

  const synth =
    state?.synthesis && typeof state.synthesis === 'object'
      ? state.synthesis
      : {}
  const synthesisOut =
    typeof synth.output === 'string' ? synth.output : ''

  const response_length_a = wordCount(agentA)
  const response_length_b = wordCount(agentB)
  const response_length_c = wordCount(agentC)

  const conflict_score_ab = normalizeConflictScore(countSignals(aReviews))
  const conflict_score_bc = normalizeConflictScore(countSignals(bReviews))
  const conflict_score_ac = normalizeConflictScore(countSignals(cReviews))

  const named_references_a = hasNamedReferences(aReviews)
  const named_references_b = hasNamedReferences(bReviews)
  const named_references_c = hasNamedReferences(cReviews)

  const attacks_on_a = countSignals(bReviews) + countSignals(cReviews)
  const attacks_on_b = countSignals(aReviews) + countSignals(cReviews)
  const attacks_on_c = countSignals(aReviews) + countSignals(bReviews)

  const scores = [
    { k: /** @type {'a'|'b'|'c'} */ ('a'), v: attacks_on_a },
    { k: 'b', v: attacks_on_b },
    { k: 'c', v: attacks_on_c },
  ]
  const maxAtt = Math.max(attacks_on_a, attacks_on_b, attacks_on_c)
  const topKeys = scores.filter((x) => x.v === maxAtt).map((x) => x.k)
  const challenged_most =
    topKeys.length !== 1 || maxAtt === 0 ? 'tied' : topKeys[0]

  const combative_a = countSignals(aReviews)
  const combative_b = countSignals(bReviews)
  const combative_c = countSignals(cReviews)
  const combativeScores = [
    { k: /** @type {'a'|'b'|'c'} */ ('a'), v: combative_a },
    { k: 'b', v: combative_b },
    { k: 'c', v: combative_c },
  ]
  const maxComb = Math.max(combative_a, combative_b, combative_c)
  const combTop = combativeScores.filter((x) => x.v === maxComb).map((x) => x.k)
  const most_combative =
    combTop.length !== 1 || maxComb === 0 ? 'tied' : combTop[0]

  const synthObj =
    state?.synthesis && typeof state.synthesis === 'object'
      ? state.synthesis
      : {}
  const concessionLines = Array.isArray(synthObj.concessions)
    ? synthObj.concessions
    : []

  const flexCounts = countFlexibleSignals(concessionLines, {
    agentA: state?.config?.agentA,
    agentB: state?.config?.agentB,
    agentC: state?.config?.agentC,
  })
  const flexVals = [
    { k: /** @type {'a'|'b'|'c'} */ ('a'), v: flexCounts.a },
    { k: 'b', v: flexCounts.b },
    { k: 'c', v: flexCounts.c },
  ]
  const maxFlex = Math.max(flexCounts.a, flexCounts.b, flexCounts.c)
  const flexTop = flexVals.filter((x) => x.v === maxFlex).map((x) => x.k)
  const most_flexible =
    concessionLines.length === 0
      ? 'tied'
      : flexTop.length !== 1 || maxFlex === 0
        ? 'tied'
        : flexTop[0]

  let synthesis_overlap_a = null
  let synthesis_overlap_b = null
  let synthesis_overlap_c = null
  let dominant_agent = null

  if (!isSynthesisSkippedOrEmpty(synthesisOut)) {
    synthesis_overlap_a = jaccardOverlap(agentA, synthesisOut)
    synthesis_overlap_b = jaccardOverlap(agentB, synthesisOut)
    synthesis_overlap_c = jaccardOverlap(agentC, synthesisOut)

    const ov = [
      { k: /** @type {'a'|'b'|'c'} */ ('a'), v: synthesis_overlap_a },
      { k: 'b', v: synthesis_overlap_b },
      { k: 'c', v: synthesis_overlap_c },
    ].sort((x, y) => y.v - x.v)

    const d0 = ov[0].v - ov[1].v
    dominant_agent = d0 <= 0.02 ? 'tied' : ov[0].k
  }

  return {
    response_length_a,
    response_length_b,
    response_length_c,
    conflict_score_ab,
    conflict_score_ac,
    conflict_score_bc,
    named_references_a,
    named_references_b,
    named_references_c,
    challenged_most,
    most_combative,
    most_flexible,
    synthesis_overlap_a,
    synthesis_overlap_b,
    synthesis_overlap_c,
    dominant_agent,
  }
}
