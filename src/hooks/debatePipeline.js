import { callGitHubModel } from '../api/githubModelsClient.js'
import {
  FINAL_POSITION_SYSTEM,
  ROUND2_COMBINED_SYSTEM,
  SYNTHESIS_SYSTEM,
  SYNTHESIS_VALIDATION_SYSTEM,
} from '../api/systemPrompts.js'
import { runAudit } from '../lib/auditDebate.js'
import {
  buildDivergenceRowsFromAudit,
  computeClaimDivergence,
} from '../lib/claimDivergence.js'
import { AGENT_TIMEOUT_MESSAGE } from '../lib/debateConstants.js'
import {
  aggregateSynthesisWinner,
  buildCrossReviewEvalUserMessage,
  CROSS_REVIEW_EVAL_SYSTEM,
  parseCrossReviewEvalResponse,
} from '../lib/crossReviewCompetition.js'
import { isModelCallTimeoutError } from '../lib/modelCallErrors.js'
import { clipInferenceText } from '../lib/clipInferenceText.js'
import { runInfluenceAnalysis } from '../lib/influenceAnalysis.js'
import { logDebate } from '../lib/logDebate.js'
import { parseSynthesisOutput } from '../lib/parseSynthesisOutput.js'
import {
  buildSynthesisValidationUserMessage,
  computeValidationStatus,
  fallbackFlaggedValidation,
  normalizeValidationRecord,
  parseValidationJson,
} from '../lib/synthesisValidation.js'

/**
 * @param {import('react').Dispatch<unknown>} dispatch
 * @param {Parameters<typeof runAudit>[0]} snapshot
 * @param {Record<string, unknown> | null | undefined} logState When set, logDebate runs after audit with claim divergence scores.
 */
export function scheduleDebateAudit(dispatch, snapshot, logState) {
  dispatch({ type: 'SET_AUDIT_LOADING', payload: true })
  dispatch({ type: 'SET_AUDIT_ERROR', payload: null })
  void (async () => {
    try {
      const result = await runAudit(snapshot)
      dispatch({ type: 'SET_AUDIT', payload: result })
      const positions = buildDivergenceRowsFromAudit(result)
      const claimScores = computeClaimDivergence(positions)
      dispatch({
        type: 'SET_DIVERGENCE',
        payload: {
          ...claimScores,
          mode: logState ? 'append' : 'replaceLast',
        },
      })
      if (logState && typeof logState === 'object') {
        void logDebate({
          ...logState,
          divergenceScores: [claimScores],
          audit: result,
        })
      }
    } catch (err) {
      dispatch({
        type: 'SET_AUDIT_ERROR',
        payload:
          err instanceof Error ? err.message : `Audit failed: ${String(err)}`,
      })
      if (logState && typeof logState === 'object') {
        const emptyScores = computeClaimDivergence([])
        dispatch({
          type: 'SET_DIVERGENCE',
          payload: { ...emptyScores, mode: 'append' },
        })
        void logDebate({
          ...logState,
          divergenceScores: [emptyScores],
        })
      }
    } finally {
      dispatch({ type: 'SET_AUDIT_LOADING', payload: false })
      dispatch({ type: 'INCREMENT_PROGRESS_CALLS', payload: 3 })
      dispatch({
        type: 'SET_LAST_COMPLETED_STAGE',
        payload: { stage: 'audit' },
      })
    }
  })()
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @param {'A' | 'B' | 'C'} forKey
 * @param {{ agentA: string, agentB: string, agentC: string }} responses
 * @param {{ agentA: { name: string }, agentB: { name: string }, agentC: { name: string } }} config
 */
function buildRound2CombinedUserMessage(
  forKey,
  { agentA: a, agentB: b, agentC: c },
  config
) {
  const { agentA, agentB, agentC } = config

  if (forKey === 'A') {
    return `Your original response was:\n${a}\n\nHere is how ${agentB.name} answered:\n${b}\n\nHere is how ${agentC.name} answered:\n${c}`
  }
  if (forKey === 'B') {
    return `Your original response was:\n${b}\n\nHere is how ${agentA.name} answered:\n${a}\n\nHere is how ${agentC.name} answered:\n${c}`
  }
  return `Your original response was:\n${c}\n\nHere is how ${agentA.name} answered:\n${a}\n\nHere is how ${agentB.name} answered:\n${b}`
}

function buildFinalPositionUserMessage(
  prompt,
  ra,
  rb,
  rc,
  aRev,
  bRev,
  cRev,
  config
) {
  const { agentA, agentB, agentC } = config
  return [
    `Original prompt:\n${prompt}`,
    `=== ${agentA.name} (round 1) ===\n${ra}`,
    `=== ${agentB.name} (round 1) ===\n${rb}`,
    `=== ${agentC.name} (round 1) ===\n${rc}`,
    `=== ${agentA.name} (round 2 — cross-review & rebuttal) ===\n${aRev}`,
    `=== ${agentB.name} (round 2 — cross-review & rebuttal) ===\n${bRev}`,
    `=== ${agentC.name} (round 2 — cross-review & rebuttal) ===\n${cRev}`,
  ].join('\n\n')
}

function buildFullSynthesisUserMessage(
  prompt,
  ra,
  rb,
  rc,
  aRev,
  bRev,
  cRev,
  fa,
  fb,
  fc,
  config
) {
  const { agentA, agentB, agentC } = config
  return [
    `Original prompt:\n${prompt}`,
    `=== ${agentA.name} (round 1) ===\n${ra}`,
    `=== ${agentB.name} (round 1) ===\n${rb}`,
    `=== ${agentC.name} (round 1) ===\n${rc}`,
    `=== ${agentA.name} (round 2) ===\n${aRev}`,
    `=== ${agentB.name} (round 2) ===\n${bRev}`,
    `=== ${agentC.name} (round 2) ===\n${cRev}`,
    `=== ${agentA.name} (final position) ===\n${fa}`,
    `=== ${agentB.name} (final position) ===\n${fb}`,
    `=== ${agentC.name} (final position) ===\n${fc}`,
  ].join('\n\n')
}

/** Audit / logging: neutral summary when synthesis was skipped */
function auditSynthesisFallback(fa, fb, fc) {
  const parts = [fa, fb, fc].filter(
    (x) => typeof x === 'string' && x.trim().length > 0
  )
  if (!parts.length) return '(No synthesis; final positions unavailable.)'
  return `No unified synthesis was generated for this run. Final positions follow for trace context:\n\n${parts.join('\n\n---\n\n')}`
}

/**
 * @param {import('react').Dispatch<unknown>} dispatch
 */
function bump(dispatch) {
  dispatch({ type: 'INCREMENT_PROGRESS_CALLS', payload: 1 })
}

/**
 * @param {import('react').Dispatch<unknown>} dispatch
 */
function bumpTimeout(dispatch) {
  dispatch({ type: 'INCREMENT_TIMEOUT_COUNT' })
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ ok: true, value: T } | { ok: false, timeout: true }>}
 */
async function tryModel(fn) {
  try {
    const value = await fn()
    return { ok: true, value }
  } catch (e) {
    if (isModelCallTimeoutError(e)) {
      return { ok: false, timeout: true }
    }
    throw e
  }
}

/**
 * Each model evaluates the other two cross-reviews (parallel).
 * @param {import('react').Dispatch<unknown>} dispatch
 * @param {{
 *   agentA: { name: string, model: string },
 *   agentB: { name: string, model: string },
 *   agentC: { name: string, model: string },
 * }} config
 */
async function runCrossReviewPeerEvaluations(
  dispatch,
  config,
  aRev,
  bRev,
  cRev
) {
  const specs = [
    {
      key: /** @type {const} */ ('gpt'),
      model: config.agentA.model,
      name: config.agentA.name,
    },
    {
      key: /** @type {const} */ ('phi'),
      model: config.agentB.model,
      name: config.agentB.name,
    },
    {
      key: /** @type {const} */ ('mistral'),
      model: config.agentC.model,
      name: config.agentC.name,
    },
  ]
  const results = await Promise.all(
    specs.map(async ({ key, model, name }) => {
      const user = clipInferenceText(
        buildCrossReviewEvalUserMessage(key, config, aRev, bRev, cRev),
        56_000
      )
      const r = await tryModel(() =>
        callGitHubModel(
          model,
          [{ role: 'user', content: user }],
          CROSS_REVIEW_EVAL_SYSTEM,
          {
            agentName: name,
            maxTokens: 2048,
            errorContext: { stage: 'cross-review-eval', round: 2 },
          }
        )
      )
      if (!r.ok) {
        bumpTimeout(dispatch)
        return { key, scores: [] }
      }
      const { scores } = parseCrossReviewEvalResponse(
        'value' in r ? r.value : ''
      )
      bump(dispatch)
      return { key, scores }
    })
  )
  const evaluations = {
    gpt: { scores: results.find((x) => x.key === 'gpt')?.scores ?? [] },
    phi: { scores: results.find((x) => x.key === 'phi')?.scores ?? [] },
    mistral: {
      scores: results.find((x) => x.key === 'mistral')?.scores ?? [],
    },
  }
  return aggregateSynthesisWinner(evaluations)
}

/**
 * Finals → synthesis/validation → audit.
 * @param {object} ctx
 * @param {boolean} [ctx.skipFinalModelCalls] When true, use `precomputedFinals` (resume).
 * @param {{ a: string, b: string, c: string }} [ctx.precomputedFinals]
 */
export async function runPipelineFromFinalsOnward(ctx) {
  const {
    dispatch,
    userPrompt,
    config,
    ra,
    rb,
    rc,
    aRev,
    bRev,
    cRev,
    rebA = '',
    rebB = '',
    rebC = '',
    skipFinalModelCalls,
    precomputedFinals,
    synthesisEnabled = false,
    synthesisWinner = null,
  } = ctx

  let fa
  let fb
  let fc

  if (
    skipFinalModelCalls &&
    precomputedFinals &&
    typeof precomputedFinals.a === 'string' &&
    typeof precomputedFinals.b === 'string' &&
    typeof precomputedFinals.c === 'string'
  ) {
    fa = precomputedFinals.a
    fb = precomputedFinals.b
    fc = precomputedFinals.c
    dispatch({
      type: 'SET_LAST_COMPLETED_STAGE',
      payload: { stage: 'finalPositions' },
    })
  } else {
  const finalUserBase = clipInferenceText(
    buildFinalPositionUserMessage(
      userPrompt,
      ra,
      rb,
      rc,
      aRev,
      bRev,
      cRev,
      config
    )
  )

  await pause(700)
  dispatch({
    type: 'SET_FINAL_THINKING',
    payload: { agent: 'a', startTime: Date.now() },
  })
  fa = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentA.model,
        [{ role: 'user', content: finalUserBase }],
        FINAL_POSITION_SYSTEM,
        {
          agentName: config.agentA.name,
          errorContext: { stage: 'final-positions', round: 3 },
        }
      )
    )
    if (r.ok) {
      fa = r.value
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'a', position: fa, endTime: Date.now() },
      })
    } else {
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'a', position: AGENT_TIMEOUT_MESSAGE, endTime: Date.now() },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  await pause(700)
  dispatch({
    type: 'SET_FINAL_THINKING',
    payload: { agent: 'b', startTime: Date.now() },
  })
  fb = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentB.model,
        [{ role: 'user', content: finalUserBase }],
        FINAL_POSITION_SYSTEM,
        {
          agentName: config.agentB.name,
          errorContext: { stage: 'final-positions', round: 3 },
        }
      )
    )
    if (r.ok) {
      fb = r.value
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'b', position: fb, endTime: Date.now() },
      })
    } else {
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'b', position: AGENT_TIMEOUT_MESSAGE, endTime: Date.now() },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  await pause(700)
  dispatch({
    type: 'SET_FINAL_THINKING',
    payload: { agent: 'c', startTime: Date.now() },
  })
  fc = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentC.model,
        [{ role: 'user', content: finalUserBase }],
        FINAL_POSITION_SYSTEM,
        {
          agentName: config.agentC.name,
          errorContext: { stage: 'final-positions', round: 3 },
        }
      )
    )
    if (r.ok) {
      fc = r.value
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'c', position: fc, endTime: Date.now() },
      })
    } else {
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'c', position: AGENT_TIMEOUT_MESSAGE, endTime: Date.now() },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  dispatch({
    type: 'SET_LAST_COMPLETED_STAGE',
    payload: { stage: 'finalPositions' },
  })

  }

  await pause(2000)

  dispatch({ type: 'SET_INFLUENCE_LOADING', payload: true })
  let influenceReport = null
  try {
    influenceReport = await runInfluenceAnalysis(dispatch, {
      config,
      ra,
      rb,
      rc,
      fa,
      fb,
      fc,
      aRev,
      bRev,
      cRev,
    })
  } catch {
    influenceReport = null
  }
  dispatch({ type: 'SET_INFLUENCE_REPORT', payload: influenceReport })
  dispatch({ type: 'SET_INFLUENCE_LOADING', payload: false })

  /** @type {Record<string, unknown>} */
  const logBase = {
    prompt: userPrompt.trim(),
    rounds: [{ roundNum: 1, agentA: ra, agentB: rb, agentC: rc }],
    reviews: [{ aReviews: aRev, bReviews: bRev, cReviews: cRev }],
    rebuttals: { a: rebA, b: rebB, c: rebC },
    finalPositions: { a: fa, b: fb, c: fc },
    config,
    synthesisWinner: synthesisWinner ?? null,
    influenceReport,
  }

  if (!synthesisEnabled) {
    dispatch({ type: 'SET_STATUS', payload: 'complete' })
    scheduleDebateAudit(
      dispatch,
      {
        config,
        prompt: userPrompt.trim(),
        round1: { agentA: ra, agentB: rb, agentC: rc },
        reviews: { aReviews: aRev, bReviews: bRev, cReviews: cRev },
        rebuttals: { a: rebA, b: rebB, c: rebC },
        finalPositions: { agentA: fa, agentB: fb, agentC: fc },
        synthesis: {
          output: clipInferenceText(auditSynthesisFallback(fa, fb, fc), 48_000),
        },
      },
      { ...logBase, synthesis: null, validation: null }
    )
    return
  }

  const synthesisUser = clipInferenceText(
    buildFullSynthesisUserMessage(
      userPrompt,
      ra,
      rb,
      rc,
      aRev,
      bRev,
      cRev,
      fa,
      fb,
      fc,
      config
    )
  )

  await pause(700)
  let synthesisRaw = ''
  {
    const w =
      synthesisWinner &&
      typeof synthesisWinner === 'object' &&
      synthesisWinner.winner
        ? String(synthesisWinner.winner).toLowerCase()
        : 'gpt'
    const synthAgent =
      w === 'phi'
        ? config.agentB
        : w === 'mistral'
          ? config.agentC
          : config.agentA
    const r = await tryModel(() =>
      callGitHubModel(
        synthAgent.model,
        [{ role: 'user', content: synthesisUser }],
        SYNTHESIS_SYSTEM,
        {
          agentName: synthAgent.name,
          errorContext: { stage: 'synthesis', round: 3 },
        }
      )
    )
    if (r.ok) {
      synthesisRaw = r.value
    } else {
      synthesisRaw = AGENT_TIMEOUT_MESSAGE
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  const parsed = parseSynthesisOutput(synthesisRaw, config)

  dispatch({
    type: 'SET_SYNTHESIS',
    payload: {
      output: parsed.output,
      attributions: parsed.attributions,
      rationale: parsed.rationale,
      concessions: parsed.concessions,
      heldFirm: parsed.heldFirm,
    },
  })

  dispatch({
    type: 'SET_LAST_COMPLETED_STAGE',
    payload: { stage: 'synthesis' },
  })

  dispatch({
    type: 'SET_VALIDATION',
    payload: { status: 'pending', b: null, c: null },
  })

  const msgB = clipInferenceText(
    buildSynthesisValidationUserMessage(userPrompt.trim(), rb, parsed.output),
    48_000
  )
  const msgC = clipInferenceText(
    buildSynthesisValidationUserMessage(userPrompt.trim(), rc, parsed.output),
    48_000
  )

  const rawBResult = await tryModel(() =>
    callGitHubModel(
      config.agentB.model,
      [{ role: 'user', content: msgB }],
      SYNTHESIS_VALIDATION_SYSTEM,
      {
        agentName: config.agentB.name,
        maxTokens: 1024,
        errorContext: { stage: 'synthesis', round: 3 },
      }
    )
  )
  const rawCResult = await tryModel(() =>
    callGitHubModel(
      config.agentC.model,
      [{ role: 'user', content: msgC }],
      SYNTHESIS_VALIDATION_SYSTEM,
      {
        agentName: config.agentC.name,
        maxTokens: 1024,
        errorContext: { stage: 'synthesis', round: 3 },
      }
    )
  )

  let rawB =
    rawBResult.ok && 'value' in rawBResult ? rawBResult.value : AGENT_TIMEOUT_MESSAGE
  let rawC =
    rawCResult.ok && 'value' in rawCResult ? rawCResult.value : AGENT_TIMEOUT_MESSAGE
  if (!rawBResult.ok && rawBResult.timeout) bumpTimeout(dispatch)
  if (!rawCResult.ok && rawCResult.timeout) bumpTimeout(dispatch)
  bump(dispatch)
  bump(dispatch)

  const normB =
    normalizeValidationRecord(parseValidationJson(rawB)) ??
    fallbackFlaggedValidation()
  const normC =
    normalizeValidationRecord(parseValidationJson(rawC)) ??
    fallbackFlaggedValidation()
  const validationStatus = computeValidationStatus(normB, normC)

  dispatch({
    type: 'SET_VALIDATION',
    payload: {
      b: normB,
      c: normC,
      status: validationStatus,
    },
  })

  dispatch({
    type: 'SET_LAST_COMPLETED_STAGE',
    payload: { stage: 'validation' },
  })

  dispatch({ type: 'SET_STATUS', payload: 'complete' })
  scheduleDebateAudit(
    dispatch,
    {
      config,
      prompt: userPrompt.trim(),
      round1: { agentA: ra, agentB: rb, agentC: rc },
      reviews: { aReviews: aRev, bReviews: bRev, cReviews: cRev },
      rebuttals: { a: rebA, b: rebB, c: rebC },
      finalPositions: { agentA: fa, agentB: fb, agentC: fc },
      synthesis: { output: parsed.output },
    },
    {
      ...logBase,
      synthesis: {
        output: parsed.output,
        attributions: parsed.attributions,
        rationale: parsed.rationale,
        concessions: parsed.concessions,
        heldFirm: parsed.heldFirm,
      },
      validation: {
        b: normB,
        c: normC,
        status: validationStatus,
      },
    }
  )
}

/**
 * @param {{
 *   dispatch: import('react').Dispatch<unknown>,
 *   uiSettings: { synthesisMode: string },
 *   userPrompt: string,
 *   config: {
 *     agentA: { name: string, model: string, color?: string },
 *     agentB: { name: string, model: string, color?: string },
 *     agentC: { name: string, model: string, color?: string },
 *   },
 *   ra: string,
 *   rb: string,
 *   rc: string,
 * }} ctx
 */
export async function runPipelineAfterRound1(ctx) {
  const {
    dispatch,
    uiSettings,
    userPrompt,
    config,
    ra,
    rb,
    rc,
    synthesisEnabled = false,
  } = ctx

  const aReviewMsg = clipInferenceText(
    buildRound2CombinedUserMessage(
      'A',
      { agentA: ra, agentB: rb, agentC: rc },
      config
    )
  )
  const bReviewMsg = clipInferenceText(
    buildRound2CombinedUserMessage(
      'B',
      { agentA: ra, agentB: rb, agentC: rc },
      config
    )
  )
  const cReviewMsg = clipInferenceText(
    buildRound2CombinedUserMessage(
      'C',
      { agentA: ra, agentB: rb, agentC: rc },
      config
    )
  )

  dispatch({
    type: 'SET_REVIEW_THINKING',
    payload: { agent: 'a', startTime: Date.now() },
  })
  let aRev = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentA.model,
        [{ role: 'user', content: aReviewMsg }],
        ROUND2_COMBINED_SYSTEM,
        {
          agentName: config.agentA.name,
          errorContext: { stage: 'cross-review', round: 2 },
        }
      )
    )
    if (r.ok) {
      aRev = r.value
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'a', review: aRev, endTime: Date.now() },
      })
    } else {
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'a', review: AGENT_TIMEOUT_MESSAGE, endTime: Date.now() },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  await pause(700)
  dispatch({
    type: 'SET_REVIEW_THINKING',
    payload: { agent: 'b', startTime: Date.now() },
  })
  let bRev = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentB.model,
        [{ role: 'user', content: bReviewMsg }],
        ROUND2_COMBINED_SYSTEM,
        {
          agentName: config.agentB.name,
          errorContext: { stage: 'cross-review', round: 2 },
        }
      )
    )
    if (r.ok) {
      bRev = r.value
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'b', review: bRev, endTime: Date.now() },
      })
    } else {
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'b', review: AGENT_TIMEOUT_MESSAGE, endTime: Date.now() },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  await pause(700)
  dispatch({
    type: 'SET_REVIEW_THINKING',
    payload: { agent: 'c', startTime: Date.now() },
  })
  let cRev = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentC.model,
        [{ role: 'user', content: cReviewMsg }],
        ROUND2_COMBINED_SYSTEM,
        {
          agentName: config.agentC.name,
          errorContext: { stage: 'cross-review', round: 2 },
        }
      )
    )
    if (r.ok) {
      cRev = r.value
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'c', review: cRev, endTime: Date.now() },
      })
    } else {
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'c', review: AGENT_TIMEOUT_MESSAGE, endTime: Date.now() },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  dispatch({
    type: 'SET_LAST_COMPLETED_STAGE',
    payload: { stage: 'reviews' },
  })

  const competition = await runCrossReviewPeerEvaluations(
    dispatch,
    config,
    aRev,
    bRev,
    cRev
  )
  dispatch({ type: 'SET_SYNTHESIS_WINNER', payload: competition })

  await pause(2000)

  await runPipelineFromFinalsOnward({
    dispatch,
    uiSettings,
    userPrompt,
    config,
    ra,
    rb,
    rc,
    aRev,
    bRev,
    cRev,
    rebA: '',
    rebB: '',
    rebC: '',
    synthesisEnabled,
    synthesisWinner: competition,
  })
}

/**
 * Resume from cross-review onward (after round 1 is already in state).
 * @param {{
 *   dispatch: import('react').Dispatch<unknown>,
 *   uiSettings: { synthesisMode: string },
 *   userPrompt: string,
 *   config: Record<string, unknown>,
 *   ra: string,
 *   rb: string,
 *   rc: string,
 * }} ctx
 */
export async function resumeFromRound1(ctx) {
  await runPipelineAfterRound1(ctx)
}

/**
 * @param {{
 *   dispatch: import('react').Dispatch<unknown>,
 *   uiSettings: { synthesisMode: string },
 *   userPrompt: string,
 *   config: Record<string, unknown>,
 *   ra: string,
 *   rb: string,
 *   rc: string,
 *   aRev: string,
 *   bRev: string,
 *   cRev: string,
 *   existingSynthesisWinner?: unknown,
 * }} ctx
 */
export async function resumeFromReviews(ctx) {
  const {
    dispatch,
    uiSettings,
    userPrompt,
    config,
    ra,
    rb,
    rc,
    aRev,
    bRev,
    cRev,
    synthesisEnabled = false,
    existingSynthesisWinner = null,
  } = ctx

  await pause(2000)

  let synthesisWinner = existingSynthesisWinner
  if (
    !synthesisWinner ||
    typeof synthesisWinner !== 'object' ||
    !synthesisWinner.winner
  ) {
    synthesisWinner = await runCrossReviewPeerEvaluations(
      dispatch,
      config,
      aRev,
      bRev,
      cRev
    )
    dispatch({
      type: 'SET_SYNTHESIS_WINNER',
      payload: synthesisWinner,
    })
  }

  await runPipelineFromFinalsOnward({
    dispatch,
    uiSettings,
    userPrompt,
    config,
    ra,
    rb,
    rc,
    aRev,
    bRev,
    cRev,
    rebA: '',
    rebB: '',
    rebC: '',
    synthesisEnabled,
    synthesisWinner,
  })
}
