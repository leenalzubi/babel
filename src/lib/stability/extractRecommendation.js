/**
 * Extract a structured recommendation from synthesis text / decision artifact.
 * Interpretation layered over raw synthesis; never overwrites raw text.
 */

import { parseDecisionArtifact } from '../parseDecisionArtifact.js'

const REC_JSON = '---RECOMMENDATION-JSON---'

/**
 * @param {string} text
 * @returns {import('./types.js').VerdictKind}
 */
export function inferVerdictFromText(text) {
  const t = String(text ?? '').toLowerCase()
  if (!t.trim()) return 'no_recommendation'
  if (
    /\b(defer|postpone|wait|do not (decide|ship|launch) yet)\b/.test(t) ||
    /\bhold off\b/.test(t)
  ) {
    return 'defer'
  }
  if (
    /\b(oppose|reject|do not (ship|launch|enable|proceed)|should not)\b/.test(t)
  ) {
    return 'oppose'
  }
  if (
    /\b(conditional|provided that|only if|with (the )?condition|pilot|behind a flag|human approval)\b/.test(
      t
    )
  ) {
    return 'conditional'
  }
  if (/\b(support|proceed|ship|launch|approve|recommend (yes|doing))\b/.test(t)) {
    return 'support'
  }
  if (/\b(unclear|insufficient|cannot recommend|no clear)\b/.test(t)) {
    return 'no_recommendation'
  }
  return 'other'
}

/**
 * @param {string} raw
 * @returns {import('./types.js').StructuredRecommendation | null}
 */
function parseRecommendationJson(raw) {
  const idx = String(raw ?? '').indexOf(REC_JSON)
  if (idx < 0) return null
  const after = raw.slice(idx + REC_JSON.length)
  const start = after.indexOf('{')
  const end = after.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const obj = JSON.parse(after.slice(start, end + 1))
    if (!obj || typeof obj !== 'object') return null
    const verdictRaw = String(obj.verdict ?? 'other').toLowerCase()
    /** @type {import('./types.js').VerdictKind} */
    let verdict = 'other'
    if (
      [
        'support',
        'oppose',
        'conditional',
        'defer',
        'no_recommendation',
        'other',
      ].includes(verdictRaw)
    ) {
      verdict = /** @type {import('./types.js').VerdictKind} */ (verdictRaw)
    }
    return {
      verdict,
      recommendationText: String(
        obj.recommendationText ?? obj.recommendation ?? ''
      ).trim(),
      requiredConditions: Array.isArray(obj.requiredConditions)
        ? obj.requiredConditions.map(String).map((s) => s.trim()).filter(Boolean)
        : [],
      primaryRationale: Array.isArray(obj.primaryRationale)
        ? obj.primaryRationale.map(String).map((s) => s.trim()).filter(Boolean)
        : [],
      keyRisks: Array.isArray(obj.keyRisks)
        ? obj.keyRisks.map(String).map((s) => s.trim()).filter(Boolean)
        : [],
      nextStep: obj.nextStep ? String(obj.nextStep).trim() : undefined,
      extractionMethod: 'structured_json',
    }
  } catch {
    return null
  }
}

/**
 * Normalize condition strings for set comparison.
 * @param {string} s
 */
export function normalizeCondition(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string | null | undefined} rawSynthesis
 * @param {import('../parseDecisionArtifact.js').DecisionArtifact | null | undefined} artifact
 * @returns {import('./types.js').StructuredRecommendation}
 */
export function extractStructuredRecommendation(rawSynthesis, artifact) {
  const fromJson = parseRecommendationJson(rawSynthesis ?? '')
  if (fromJson && fromJson.recommendationText) return fromJson

  const art =
    artifact && typeof artifact === 'object'
      ? artifact
      : parseDecisionArtifact(rawSynthesis ?? '')

  const next = String(art.recommendedNextStep ?? '').trim()
  const framed = String(art.framed ?? '').trim()
  const change = String(art.whatWouldChange ?? '').trim()
  const weak = String(art.weakestAssumptions ?? '').trim()
  const agree = String(art.agreement ?? '').trim()
  const disagree = String(art.disagreement ?? '').trim()

  const recommendationText = next || framed
  if (!recommendationText && !agree) {
    const raw = String(rawSynthesis ?? '').trim()
    if (!raw) {
      return {
        verdict: 'no_recommendation',
        recommendationText: '',
        requiredConditions: [],
        primaryRationale: [],
        keyRisks: [],
        extractionMethod: 'unavailable',
      }
    }
    return {
      verdict: inferVerdictFromText(raw),
      recommendationText: raw.slice(0, 400),
      requiredConditions: [],
      primaryRationale: [],
      keyRisks: [],
      extractionMethod: 'heuristic',
    }
  }

  /** @type {string[]} */
  const conditions = []
  if (change) {
    for (const line of change.split(/\n+/)) {
      const t = line.replace(/^[-*•]\s*/, '').trim()
      if (t) conditions.push(t)
    }
  }

  /** @type {string[]} */
  const rationale = []
  if (agree) rationale.push(agree)
  if (disagree) rationale.push(`Central disagreement: ${disagree}`)

  /** @type {string[]} */
  const risks = []
  if (weak) {
    for (const line of weak.split(/\n+/)) {
      const t = line.replace(/^[-*•]\s*/, '').trim()
      if (t) risks.push(t)
    }
  }

  return {
    verdict: inferVerdictFromText(
      `${recommendationText}\n${framed}\n${change}`
    ),
    recommendationText,
    requiredConditions: conditions,
    primaryRationale: rationale,
    keyRisks: risks,
    nextStep: next || undefined,
    extractionMethod: 'artifact_sections',
  }
}
