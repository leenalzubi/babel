/**
 * Privacy helpers for evaluation import / publish.
 */

const SECRET_KEY_RE =
  /^(authorization|api[_-]?key|token|secret|password|cookie|set-cookie)$/i

/**
 * Remove secrets and private identifiers from a plain object tree.
 * @param {unknown} input
 * @returns {unknown}
 */
export function scrubPrivateFields(input) {
  if (Array.isArray(input)) {
    return input.map(scrubPrivateFields)
  }
  if (input == null || typeof input !== 'object') return input
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [k, v] of Object.entries(input)) {
    if (SECRET_KEY_RE.test(k)) continue
    if (
      k === 'userId' ||
      k === 'user_id' ||
      k === 'email' ||
      k === 'authorization' ||
      k === 'githubToken' ||
      k === 'supabaseKey' ||
      k === 'privateHistoryId'
    ) {
      continue
    }
    // Public Lab never shows private debate row IDs
    if (k === 'sourceDebateId' || k === 'debateId' || k === 'historyId') {
      continue
    }
    out[k] = scrubPrivateFields(v)
  }
  return out
}

/**
 * Heuristic flags for prompts that may contain personal data.
 * @param {string} prompt
 * @returns {string[]}
 */
export function flagPersonalDataRisks(prompt) {
  const flags = []
  const text = String(prompt ?? '')
  if (/\b[\w.+-]+@[\w.-]+\.\w+\b/.test(text)) {
    flags.push('Possible email address in prompt')
  }
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text)) {
    flags.push('Possible phone number in prompt')
  }
  if (/\b(ssn|social security|passport)\b/i.test(text)) {
    flags.push('Possible sensitive identity term in prompt')
  }
  return flags
}

/**
 * Required metadata checklist for an import.
 * @param {Record<string, unknown>} artifact
 * @returns {{ missing: string[], warnings: string[] }}
 */
export function reportMissingArtifactFields(artifact) {
  /** @type {string[]} */
  const missing = []
  /** @type {string[]} */
  const warnings = []
  if (!artifact.condition) missing.push('condition')
  if (!Array.isArray(artifact.modelIds) || !artifact.modelIds.length) {
    missing.push('modelIds')
  }
  if (!artifact.promptVersion) missing.push('promptVersion')
  if (!artifact.metrics || typeof artifact.metrics !== 'object') {
    warnings.push('metrics object missing; durations/tokens will show Not recorded')
  } else {
    const m = /** @type {Record<string, unknown>} */ (artifact.metrics)
    for (const k of [
      'durationMs',
      'inputTokens',
      'outputTokens',
      'estimatedCostUsd',
      'callsAttempted',
      'callsSucceeded',
    ]) {
      if (m[k] == null) warnings.push(`metrics.${k} not recorded`)
    }
  }
  if (!Array.isArray(artifact.scores) || !artifact.scores.length) {
    warnings.push('scores empty; criteria will show Not evaluated')
  }
  if (!artifact.outputText && !artifact.sideBySideOutputs && !artifact.babelRounds) {
    warnings.push('no output text recorded for this condition')
  }
  return { missing, warnings }
}
