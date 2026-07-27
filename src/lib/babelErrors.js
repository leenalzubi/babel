/**
 * Babel debate error taxonomy (see product error-handling spec).
 */

/** @typedef {'content_filter' | 'rate_limit' | 'token_limit' | 'auth' | 'model_unavailable' | 'server_error' | 'timeout' | 'network' | 'proxy_configuration' | 'unknown'} ErrorType */

/** @typedef {'voice' | 'round' | 'synthesis' | 'audit' | 'debate' | 'infrastructure'} ErrorScope */

/** @typedef {'immediate' | 'delayed' | 'after_edit' | 'after_configuration' | 'not_retryable'} RetryMode */

/** @typedef {'round_1' | 'peer_evaluation' | 'round_2' | 'final_answers' | 'synthesis' | 'influence_analysis' | 'audit'} DebateStage */

/**
 * @typedef {{
 *   id: string,
 *   type: ErrorType,
 *   scope: ErrorScope,
 *   stage: DebateStage,
 *   agentId?: string,
 *   agent?: string,
 *   retryMode: RetryMode,
 *   retryAfterMs?: number,
 *   userMessage: string,
 *   technicalMessage?: string,
 *   title: string,
 *   detail: string,
 *   suggestion: string,
 *   attempt: number,
 *   maxAttempts: number,
 *   preservePartialResults: true,
 *   occurredAt: string,
 *   round?: number,
 * }} BabelError
 */

/** @typedef {'idle' | 'running' | 'degraded' | 'blocked' | 'complete' | 'complete_with_gaps' | 'failed' | 'error' | 'partial'} ForgeStatus */

let errorSeq = 0

/** @returns {string} */
export function nextErrorId() {
  errorSeq += 1
  const n = errorSeq.toString(16).toUpperCase().padStart(4, '0')
  return `BABEL-${n}`
}

/**
 * Map legacy / API stage strings onto DebateStage.
 * @param {unknown} stage
 * @param {unknown} round
 * @returns {DebateStage}
 */
export function normalizeDebateStage(stage, round) {
  const s = String(stage ?? '').toLowerCase()
  if (s === 'round1' || s === 'round_1' || round === 1) return 'round_1'
  if (s.includes('cross-review-eval') || s === 'peer_evaluation') {
    return 'peer_evaluation'
  }
  if (
    s === 'reviews' ||
    s === 'round2' ||
    s === 'round_2' ||
    s.includes('cross-review') ||
    round === 2
  ) {
    return 'round_2'
  }
  if (
    s === 'finalpositions' ||
    s === 'final-positions' ||
    s === 'final_answers' ||
    round === 3
  ) {
    return 'final_answers'
  }
  if (s === 'synthesis') return 'synthesis'
  if (s.includes('influence')) return 'influence_analysis'
  if (s === 'audit' || s === 'validation') return 'audit'
  return 'round_1'
}

/**
 * @param {ErrorType} type
 * @returns {RetryMode}
 */
export function defaultRetryModeForType(type) {
  switch (type) {
    case 'rate_limit':
    case 'server_error':
    case 'timeout':
    case 'network':
      return 'delayed'
    case 'content_filter':
    case 'token_limit':
      return 'after_edit'
    case 'auth':
    case 'proxy_configuration':
      return 'after_configuration'
    case 'model_unavailable':
      return 'not_retryable'
    default:
      return 'immediate'
  }
}

/**
 * @param {ErrorType} type
 * @param {ErrorScope} [preferredScope]
 * @returns {ErrorScope}
 */
export function defaultScopeForType(type, preferredScope) {
  if (preferredScope) return preferredScope
  switch (type) {
    case 'auth':
    case 'proxy_configuration':
    case 'network':
      return 'infrastructure'
    default:
      return 'voice'
  }
}

/**
 * @param {Partial<BabelError> & { type: ErrorType, title?: string, detail?: string, suggestion?: string, agent?: string }} partial
 * @returns {BabelError}
 */
export function enrichBabelError(partial) {
  const type = partial.type || 'unknown'
  const scope = defaultScopeForType(type, partial.scope)
  const stage = partial.stage
    ? normalizeDebateStage(partial.stage, partial.round)
    : normalizeDebateStage(partial.round != null ? null : 'round1', partial.round)
  const title =
    typeof partial.title === 'string' && partial.title
      ? partial.title
      : 'Unexpected problem'
  const detail =
    typeof partial.detail === 'string' && partial.detail
      ? partial.detail
      : typeof partial.userMessage === 'string'
        ? partial.userMessage
        : 'Babel encountered an unexpected problem while running this stage.'
  const suggestion =
    typeof partial.suggestion === 'string' && partial.suggestion
      ? partial.suggestion
      : 'Continue with available responses, or retry this stage.'

  return {
    id: partial.id || nextErrorId(),
    type,
    scope,
    stage,
    agentId: partial.agentId,
    agent: partial.agent,
    retryMode: partial.retryMode || defaultRetryModeForType(type),
    retryAfterMs: partial.retryAfterMs,
    userMessage: partial.userMessage || detail,
    technicalMessage: partial.technicalMessage,
    title,
    detail,
    suggestion,
    attempt: typeof partial.attempt === 'number' ? partial.attempt : 1,
    maxAttempts: typeof partial.maxAttempts === 'number' ? partial.maxAttempts : 3,
    preservePartialResults: true,
    occurredAt: partial.occurredAt || new Date().toISOString(),
    round: partial.round,
  }
}

/**
 * Whether this error should pause the whole debate (blocked / failed path).
 * @param {BabelError | null | undefined} err
 */
export function isInfrastructureBlocker(err) {
  if (!err) return false
  if (err.scope === 'infrastructure') return true
  if (err.type === 'auth' || err.type === 'proxy_configuration') return true
  if (err.scope === 'debate' && err.type === 'content_filter') return true
  return false
}

/**
 * Voice-scoped failures that should not end the debate.
 * @param {BabelError | null | undefined} err
 */
export function isVoiceSoftFail(err) {
  if (!err) return false
  if (isInfrastructureBlocker(err)) return false
  if (err.scope === 'voice' || err.scope === 'round') return true
  if (
    err.type === 'timeout' ||
    err.type === 'content_filter' ||
    err.type === 'model_unavailable' ||
    err.type === 'token_limit' ||
    err.type === 'server_error' ||
    err.type === 'rate_limit'
  ) {
    return err.scope !== 'infrastructure' && err.scope !== 'debate'
  }
  return false
}

/**
 * Map API / thrown errors onto BabelError.
 * @param {unknown} err
 * @param {{
 *   scope?: ErrorScope,
 *   stage?: DebateStage | string,
 *   agentId?: string,
 *   agent?: string,
 *   round?: number,
 *   attempt?: number,
 * }} [ctx]
 * @returns {BabelError}
 */
export function toBabelError(err, ctx = {}) {
  const API = {
    NETWORK: 'network',
    PROXY: 'proxy',
  }

  if (
    err &&
    typeof err === 'object' &&
    typeof /** @type {{ type?: unknown }} */ (err).type === 'string' &&
    (typeof /** @type {{ title?: unknown }} */ (err).title === 'string' ||
      typeof /** @type {{ detail?: unknown }} */ (err).detail === 'string')
  ) {
    const e = /** @type {Record<string, unknown>} */ (err)
    const type = /** @type {ErrorType} */ (String(e.type))
    return enrichBabelError({
      type,
      title: typeof e.title === 'string' ? e.title : undefined,
      detail: typeof e.detail === 'string' ? e.detail : undefined,
      suggestion: typeof e.suggestion === 'string' ? e.suggestion : undefined,
      agent: typeof e.agent === 'string' ? e.agent : ctx.agent,
      agentId: ctx.agentId,
      scope: ctx.scope || /** @type {ErrorScope | undefined} */ (e.scope),
      stage: /** @type {any} */ (ctx.stage || e.stage),
      round:
        typeof e.round === 'number'
          ? e.round
          : typeof ctx.round === 'number'
            ? ctx.round
            : undefined,
      attempt: ctx.attempt,
      retryAfterMs:
        typeof e.retryAfterMs === 'number' ? e.retryAfterMs : undefined,
    })
  }

  const msg = err instanceof Error ? err.message : String(err ?? 'Unknown error')
  const lower = msg.toLowerCase()

  if (
    lower.includes('github models proxy') ||
    lower.includes('/api/github-models') ||
    lower.includes('proxy') && lower.includes('404')
  ) {
    return enrichBabelError({
      type: 'proxy_configuration',
      scope: 'infrastructure',
      title: 'Model proxy unavailable',
      detail:
        'This deployment cannot reach its GitHub Models proxy. Completed responses are preserved.',
      suggestion: 'Retry connection after the deployment is fixed.',
      agent: ctx.agent,
      agentId: ctx.agentId,
      stage: ctx.stage,
      round: ctx.round,
      technicalMessage: msg,
    })
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('load failed')
  ) {
    return enrichBabelError({
      type: 'network',
      scope: ctx.scope || 'infrastructure',
      title: 'Connection lost',
      detail:
        'Babel could not reach the model service. Your completed responses are preserved.',
      suggestion: 'Retry connection when you are back online.',
      agent: ctx.agent,
      agentId: ctx.agentId,
      stage: ctx.stage,
      round: ctx.round,
      technicalMessage: msg,
    })
  }

  if (lower.includes('token') && (lower.includes('missing') || lower.includes('pat'))) {
    return enrichBabelError({
      type: 'auth',
      scope: 'infrastructure',
      title: 'Authentication failed',
      detail: import.meta.env.PROD
        ? 'The model service is not configured for this deployment.'
        : 'Babel could not authenticate with GitHub Models. Add a valid GitHub token and try again.',
      suggestion: import.meta.env.PROD
        ? 'Retry connection or contact the site operator.'
        : 'Open setup instructions and add VITE_GITHUB_TOKEN.',
      agent: ctx.agent,
      agentId: ctx.agentId,
      stage: ctx.stage,
      round: ctx.round,
      technicalMessage: msg,
    })
  }

  if (lower.includes('all three models timed out')) {
    return enrichBabelError({
      type: 'timeout',
      scope: 'debate',
      stage: 'round_1',
      title: 'Round 1 timed out',
      detail:
        'None of the selected models answered in time, so Babel cannot continue this debate.',
      suggestion: 'Retry Round 1, edit the prompt, or change models.',
      retryMode: 'immediate',
      technicalMessage: msg,
    })
  }

  void API
  return enrichBabelError({
    type: 'unknown',
    scope: ctx.scope || 'debate',
    title: 'Unexpected problem',
    detail:
      'Babel encountered an unexpected problem while running this stage. Completed responses are preserved.',
    suggestion: 'Retry this stage, or continue with available responses.',
    agent: ctx.agent,
    agentId: ctx.agentId,
    stage: ctx.stage,
    round: ctx.round,
    technicalMessage: msg,
  })
}

/**
 * Derive status for SET_STATUS after a voice soft-fail while still running.
 * @param {string} current
 * @returns {'degraded' | 'running'}
 */
export function statusAfterVoiceSoftFail(current) {
  if (
    current === 'blocked' ||
    current === 'failed' ||
    current === 'error' ||
    current === 'complete' ||
    current === 'complete_with_gaps'
  ) {
    return /** @type {typeof current} */ (current)
  }
  return 'degraded'
}

/**
 * Placeholder body when a voice soft-fails (kept visible on the card).
 * @param {BabelError} err
 */
export function softFailPlaceholder(err) {
  const name = err.agent || 'This model'
  switch (err.type) {
    case 'timeout':
      return `${name} did not answer in time.`
    case 'content_filter':
      return `${name} could not respond to this part of the debate because of its content policy.`
    case 'rate_limit':
      return `${name} could not answer because the model service is limiting requests.`
    case 'token_limit':
      return `${name} could not process this round because the context was too long.`
    case 'model_unavailable':
      return `${name} is not available through the current model catalog.`
    case 'server_error':
      return `${name} could not respond because the model service returned an error.`
    default:
      return `${name} could not complete this response.`
  }
}

/**
 * @param {{ a?: BabelError | null, b?: BabelError | null, c?: BabelError | null } | null | undefined} voiceErrors
 * @param {('a'|'b'|'c')[]} [agents]
 */
export function allVoicesRateLimited(voiceErrors, agents = ['a', 'b', 'c']) {
  if (!voiceErrors) return false
  return agents.every((k) => voiceErrors[k]?.type === 'rate_limit')
}

/**
 * Max remaining wait across rate-limited voice errors (ms from now).
 * @param {{ a?: BabelError | null, b?: BabelError | null, c?: BabelError | null } | null | undefined} voiceErrors
 * @returns {number}
 */
export function maxRateLimitWaitMs(voiceErrors) {
  if (!voiceErrors) return 0
  let max = 0
  const now = Date.now()
  for (const k of /** @type {const} */ (['a', 'b', 'c'])) {
    const err = voiceErrors[k]
    if (!err || err.type !== 'rate_limit') continue
    const after =
      typeof err.retryAfterMs === 'number' && err.retryAfterMs > 0
        ? err.retryAfterMs
        : 60_000
    const started = err.occurredAt ? Date.parse(err.occurredAt) : now
    const remaining = Math.max(0, started + after - now)
    if (remaining > max) max = remaining
  }
  return max
}

/**
 * Count usable vs unavailable agent response texts for a partial-round banner.
 * @param {string[]} texts
 */
export function countRoundOutcomes(texts) {
  const list = Array.isArray(texts) ? texts : []
  let ok = 0
  let failed = 0
  for (const t of list) {
    if (typeof t !== 'string' || t.length === 0) continue
    // soft-fail / timeout placeholders share these phrases
    const lower = t.toLowerCase()
    const bad =
      t ===
        'This model took longer than 2 minutes to respond and was skipped for this stage.' ||
      lower.includes('did not answer in time') ||
      lower.includes('content policy') ||
      lower.includes('limiting requests') ||
      lower.includes('context was too long') ||
      lower.includes('is not available through') ||
      lower.includes('model service returned an error') ||
      lower.includes('could not complete this response') ||
      lower.includes('could not process this round') ||
      lower.includes('could not answer') ||
      lower.includes('could not respond')
    if (bad) failed += 1
    else ok += 1
  }
  return { ok, failed, total: ok + failed }
}
