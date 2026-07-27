/**
 * Babel Lab evaluation schema: JSDoc types + runtime validation.
 * No fabricated defaults for scores or metrics.
 */

/** @typedef {'single_model' | 'side_by_side' | 'babel'} EvaluationCondition */
/** @typedef {'human' | 'llm_judge' | 'deterministic' | 'not_evaluated'} EvaluationMethod */
/** @typedef {'draft' | 'published' | 'archived'} CaseStatus */
/** @typedef {'product' | 'policy' | 'operations' | 'strategy' | 'ethics' | 'other'} CaseDomain */

/** @typedef {'central_disagreement' | 'hidden_assumptions' | 'dissent_preservation' | 'substantive_revision' | 'evidence_honesty' | 'actionability' | 'traceability' | 'reading_burden'} EvaluationCriterion */

export const EVALUATION_CONDITIONS = /** @type {const} */ ([
  'single_model',
  'side_by_side',
  'babel',
])

export const EVALUATION_CRITERIA = /** @type {const} */ ([
  'central_disagreement',
  'hidden_assumptions',
  'dissent_preservation',
  'substantive_revision',
  'evidence_honesty',
  'actionability',
  'traceability',
  'reading_burden',
])

export const CONDITION_LABELS = {
  single_model: 'Single model',
  side_by_side: 'Side by side',
  babel: 'Babel',
}

export const CRITERION_LABELS = {
  central_disagreement: 'Central disagreement',
  hidden_assumptions: 'Hidden assumptions',
  dissent_preservation: 'Dissent preservation',
  substantive_revision: 'Substantive revision',
  evidence_honesty: 'Evidence honesty',
  actionability: 'Actionability',
  traceability: 'Traceability',
  reading_burden: 'Reading burden',
}

export const METHOD_LABELS = {
  human: 'Human evaluation',
  llm_judge: 'Automated evaluation (LLM judge)',
  deterministic: 'Deterministic metric',
  not_evaluated: 'Not evaluated',
}

export const DATASET_VERSION = '2026-07-26'
export const RUBRIC_VERSION = 'v1'
/** Human-facing methodology version derived from rubric id. */
export const METHODOLOGY_VERSION_LABEL = '1.0'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * Format ISO date or dataset version (YYYY-MM-DD) for display.
 * @param {string | undefined | null} isoOrVersion
 * @returns {string | null}
 */
export function formatHumanDate(isoOrVersion) {
  if (!isoOrVersion || typeof isoOrVersion !== 'string') return null
  const m = isoOrVersion.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return isoOrVersion.trim() || null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return isoOrVersion.trim()
  }
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

/**
 * @param {string | undefined | null} datasetVersion
 */
export function formatLastUpdatedLabel(datasetVersion) {
  const d = formatHumanDate(datasetVersion)
  return d ? `Last updated ${d}` : null
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isObj(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: import('./labTypes.js').EvaluationScore } | { ok: false, error: string }}
 */
export function validateScore(raw) {
  if (!isObj(raw)) return { ok: false, error: 'score must be an object' }
  const criterion = String(raw.criterion ?? '')
  if (!EVALUATION_CRITERIA.includes(/** @type {any} */ (criterion))) {
    return { ok: false, error: `unknown criterion: ${criterion}` }
  }
  const method = String(raw.method ?? 'not_evaluated')
  if (
    method !== 'human' &&
    method !== 'llm_judge' &&
    method !== 'deterministic' &&
    method !== 'not_evaluated'
  ) {
    return { ok: false, error: `unknown method: ${method}` }
  }
  /** @type {import('./labTypes.js').EvaluationScore} */
  const score = {
    criterion: /** @type {EvaluationCriterion} */ (criterion),
    method: /** @type {EvaluationMethod} */ (method),
  }
  if (raw.score != null && raw.score !== '') {
    const n = Number(raw.score)
    if (Number.isFinite(n)) score.score = n
  }
  if (raw.scaleMin != null && Number.isFinite(Number(raw.scaleMin))) {
    score.scaleMin = Number(raw.scaleMin)
  }
  if (raw.scaleMax != null && Number.isFinite(Number(raw.scaleMax))) {
    score.scaleMax = Number(raw.scaleMax)
  }
  if (raw.evaluatorCount != null && Number.isFinite(Number(raw.evaluatorCount))) {
    score.evaluatorCount = Number(raw.evaluatorCount)
  }
  if (Array.isArray(raw.evaluatorModelIds)) {
    score.evaluatorModelIds = raw.evaluatorModelIds.map(String)
  }
  if (typeof raw.rationale === 'string') score.rationale = raw.rationale
  if (typeof raw.limitations === 'string') score.limitations = raw.limitations
  if (typeof raw.rubricVersion === 'string') score.rubricVersion = raw.rubricVersion
  if (typeof raw.blinded === 'boolean') score.blinded = raw.blinded
  if (typeof raw.judgePromptVersion === 'string') {
    score.judgePromptVersion = raw.judgePromptVersion
  }
  return { ok: true, value: score }
}

/**
 * @param {unknown} raw
 * @returns {import('./labTypes.js').RunMetrics}
 */
export function normalizeMetrics(raw) {
  /** @type {import('./labTypes.js').RunMetrics} */
  const m = {}
  if (!isObj(raw)) return m
  const num = (k) => {
    if (raw[k] == null || raw[k] === '') return undefined
    const n = Number(raw[k])
    return Number.isFinite(n) ? n : undefined
  }
  const durationMs = num('durationMs')
  if (durationMs != null) m.durationMs = durationMs
  const inputTokens = num('inputTokens')
  if (inputTokens != null) m.inputTokens = inputTokens
  const outputTokens = num('outputTokens')
  if (outputTokens != null) m.outputTokens = outputTokens
  const estimatedCostUsd = num('estimatedCostUsd')
  if (estimatedCostUsd != null) m.estimatedCostUsd = estimatedCostUsd
  const callsAttempted = num('callsAttempted')
  if (callsAttempted != null) m.callsAttempted = callsAttempted
  const callsSucceeded = num('callsSucceeded')
  if (callsSucceeded != null) m.callsSucceeded = callsSucceeded
  if (typeof raw.completedWithGaps === 'boolean') {
    m.completedWithGaps = raw.completedWithGaps
  }
  return m
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: import('./labTypes.js').EvaluationArtifact } | { ok: false, error: string }}
 */
export function validateArtifact(raw) {
  if (!isObj(raw)) return { ok: false, error: 'artifact must be an object' }
  const condition = String(raw.condition ?? '')
  if (!EVALUATION_CONDITIONS.includes(/** @type {any} */ (condition))) {
    return { ok: false, error: `unknown condition: ${condition}` }
  }
  if (!Array.isArray(raw.modelIds) || raw.modelIds.length === 0) {
    return { ok: false, error: 'artifact.modelIds required' }
  }
  if (typeof raw.promptVersion !== 'string' || !raw.promptVersion.trim()) {
    return { ok: false, error: 'artifact.promptVersion required' }
  }
  const scores = []
  if (Array.isArray(raw.scores)) {
    for (const s of raw.scores) {
      const r = validateScore(s)
      if (!r.ok) return { ok: false, error: r.error }
      scores.push(r.value)
    }
  }
  /** @type {import('./labTypes.js').EvaluationArtifact} */
  const art = {
    condition: /** @type {EvaluationCondition} */ (condition),
    modelIds: raw.modelIds.map(String),
    promptVersion: String(raw.promptVersion),
    metrics: normalizeMetrics(raw.metrics),
    scores,
  }
  if (Array.isArray(raw.roleAssignments)) {
    art.roleAssignments = raw.roleAssignments
      .filter(isObj)
      .map((r) => ({
        roleId: String(r.roleId ?? ''),
        modelId: String(r.modelId ?? ''),
      }))
  }
  if (typeof raw.orchestrationVersion === 'string') {
    art.orchestrationVersion = raw.orchestrationVersion
  }
  if (typeof raw.outputText === 'string') art.outputText = raw.outputText
  if (raw.outputSections != null) art.outputSections = raw.outputSections
  if (typeof raw.sourceDebateId === 'string') {
    art.sourceDebateId = raw.sourceDebateId
  }
  if (Array.isArray(raw.failureNotes)) {
    art.failureNotes = raw.failureNotes.map(String)
  }
  if (Array.isArray(raw.sideBySideOutputs)) {
    art.sideBySideOutputs = raw.sideBySideOutputs
      .filter(isObj)
      .map((o) => ({
        modelId: String(o.modelId ?? ''),
        text: typeof o.text === 'string' ? o.text : undefined,
      }))
  }
  if (isObj(raw.babelRounds)) {
    art.babelRounds = /** @type {any} */ (raw.babelRounds)
  }
  if (typeof raw.developmentFixture === 'boolean') {
    art.developmentFixture = raw.developmentFixture
  }
  return { ok: true, value: art }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: import('./labTypes.js').EvaluationCase } | { ok: false, error: string }}
 */
export function validateCase(raw) {
  if (!isObj(raw)) return { ok: false, error: 'case must be an object' }
  const id = String(raw.id ?? '').trim()
  const slug = String(raw.slug ?? '').trim()
  const title = String(raw.title ?? '').trim()
  if (!id || !slug || !title) {
    return { ok: false, error: 'case id, slug, and title are required' }
  }
  const status = String(raw.status ?? 'draft')
  if (status !== 'draft' && status !== 'published' && status !== 'archived') {
    return { ok: false, error: `invalid status: ${status}` }
  }
  const domain = String(raw.domain ?? 'other')
  const prompt = String(raw.prompt ?? '').trim()
  if (!prompt) return { ok: false, error: 'case.prompt required' }
  const whyThisCase = String(raw.whyThisCase ?? '').trim()
  if (!whyThisCase) return { ok: false, error: 'case.whyThisCase required' }
  if (!Array.isArray(raw.limitations)) {
    return { ok: false, error: 'case.limitations must be an array' }
  }
  if (typeof raw.datasetVersion !== 'string' || !raw.datasetVersion.trim()) {
    return { ok: false, error: 'case.datasetVersion required' }
  }
  if (typeof raw.createdAt !== 'string' || !raw.createdAt.trim()) {
    return { ok: false, error: 'case.createdAt required' }
  }
  if (status === 'archived' && !String(raw.archiveReason ?? '').trim()) {
    return { ok: false, error: 'archived cases require archiveReason' }
  }

  const artifacts = []
  if (Array.isArray(raw.artifacts)) {
    for (const a of raw.artifacts) {
      const r = validateArtifact(a)
      if (!r.ok) return { ok: false, error: `${slug}: ${r.error}` }
      artifacts.push(r.value)
    }
  }

  /** @type {import('./labTypes.js').EvaluationCase} */
  const c = {
    id,
    slug,
    title,
    status: /** @type {CaseStatus} */ (status),
    domain: /** @type {CaseDomain} */ (domain),
    prompt,
    whyThisCase,
    createdAt: String(raw.createdAt),
    datasetVersion: String(raw.datasetVersion),
    artifacts,
    limitations: raw.limitations.map(String),
  }
  if (Array.isArray(raw.decisionCriteria)) {
    c.decisionCriteria = raw.decisionCriteria.map(String)
  }
  if (typeof raw.knownDifficulty === 'string') {
    c.knownDifficulty = raw.knownDifficulty
  }
  if (Array.isArray(raw.expectedFailureModes)) {
    c.expectedFailureModes = raw.expectedFailureModes.map(String)
  }
  if (typeof raw.publishedAt === 'string') c.publishedAt = raw.publishedAt
  if (typeof raw.caseConclusion === 'string') c.caseConclusion = raw.caseConclusion
  if (typeof raw.whatBabelImproved === 'string') {
    c.whatBabelImproved = raw.whatBabelImproved
  }
  if (typeof raw.whereBabelDidNotHelp === 'string') {
    c.whereBabelDidNotHelp = raw.whereBabelDidNotHelp
  }
  if (typeof raw.archiveReason === 'string') c.archiveReason = raw.archiveReason
  if (Array.isArray(raw.changelog)) {
    c.changelog = raw.changelog
      .filter(isObj)
      .map((e) => ({
        at: String(e.at ?? ''),
        note: String(e.note ?? ''),
      }))
  }
  if (typeof raw.conciseFinding === 'string') {
    c.conciseFinding = raw.conciseFinding
  }
  if (typeof raw.developmentFixture === 'boolean') {
    c.developmentFixture = raw.developmentFixture
  }
  return { ok: true, value: c }
}

/**
 * Format a score for display; never invent zero for missing.
 * @param {import('./labTypes.js').EvaluationScore | null | undefined} s
 */
export function formatScoreDisplay(s) {
  if (!s || s.method === 'not_evaluated' || s.score == null) {
    return 'Not evaluated'
  }
  const min = s.scaleMin ?? 1
  const max = s.scaleMax ?? 5
  return `${s.score} / ${max} (scale ${min}-${max})`
}

/**
 * @param {unknown} v
 * @param {string} [emptyLabel]
 */
export function formatMetricDisplay(v, emptyLabel = 'Not recorded') {
  if (v == null || v === '') return emptyLabel
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string' && v.trim()) return v
  return emptyLabel
}

/**
 * Format duration when recorded.
 * @param {number | undefined} ms
 */
export function formatDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return 'Not recorded'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

/**
 * Format USD cost when recorded.
 * @param {number | undefined} usd
 */
export function formatCostUsd(usd) {
  if (usd == null || !Number.isFinite(usd)) return 'Not recorded'
  return `$${usd.toFixed(4)} USD`
}
