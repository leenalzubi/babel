import { callGitHubModel } from '../api/githubModelsClient.js'
import {
  FINAL_POSITION_SYSTEM,
  ROUND2_COMBINED_SYSTEM,
  SYNTHESIS_SYSTEM,
  SYNTHESIS_VALIDATION_SYSTEM,
} from '../api/systemPrompts.js'
import { withRoleSystem } from '../lib/babelRoles.js'
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
import {
  isInfrastructureBlocker,
  toBabelError,
} from '../lib/babelErrors.js'
import { clipInferenceText } from '../lib/clipInferenceText.js'
import { runInfluenceAnalysis } from '../lib/influenceAnalysis.js'
import { logDebate } from '../lib/logDebate.js'
import { parseSynthesisOutput } from '../lib/parseSynthesisOutput.js'
import { collectClaimIds, parseRound1Structure, parseRound2Structure, parseRound3Structure } from '../lib/parseStructuredResponse.js'
import {
  buildSynthesisValidationUserMessage,
  computeValidationStatus,
  fallbackFlaggedValidation,
  normalizeValidationRecord,
  parseValidationJson,
} from '../lib/synthesisValidation.js'
import { tryModelCall } from './tryModelCall.js'

/**
 * @param {import('react').Dispatch<unknown>} dispatch
 * @param {Parameters<typeof runAudit>[0]} snapshot
 * @param {Record<string, unknown> | null | undefined} logState When set, logDebate runs after audit with claim divergence scores.
 */
export function scheduleDebateAudit(dispatch, snapshot, logState) {
  dispatch({ type: 'SET_AUDIT_LOADING', payload: true })
  dispatch({ type: 'SET_AUDIT_ERROR', payload: null })
  dispatch({ type: 'SET_HISTORY_SAVE_ERROR', payload: null })
  dispatch({
    type: 'SET_STAGE_ERROR',
    payload: { stage: 'audit', error: null },
  })
  void (async () => {
    /**
     * @param {Record<string, unknown>} payload
     */
    async function saveHistory(payload) {
      const result = await logDebate(payload)
      if (result && result.ok === false) {
        dispatch({
          type: 'SET_HISTORY_SAVE_ERROR',
          payload:
            result.error ||
            'The debate completed, but it could not be added to your history.',
        })
      } else if (result && result.ok === true) {
        dispatch({ type: 'SET_HISTORY_SAVE_ERROR', payload: null })
      }
    }

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
        await saveHistory({
          ...logState,
          divergenceScores: [claimScores],
          audit: result,
        })
      }
    } catch (err) {
      const babelErr = toBabelError(err, {
        scope: 'audit',
        stage: 'audit',
      })
      dispatch({
        type: 'SET_AUDIT_ERROR',
        payload:
          err instanceof Error ? err.message : `Audit failed: ${String(err)}`,
      })
      dispatch({
        type: 'SET_STAGE_ERROR',
        payload: { stage: 'audit', error: babelErr },
      })
      dispatch({ type: 'SET_STATUS', payload: 'complete_with_gaps' })
      if (logState && typeof logState === 'object') {
        const emptyScores = computeClaimDivergence([])
        dispatch({
          type: 'SET_DIVERGENCE',
          payload: { ...emptyScores, mode: 'append' },
        })
        await saveHistory({
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
  config,
  roles = {}
) {
  const { agentA, agentB, agentC } = config
  const label = (key, agent) => {
    const role = roles[key]
    return role ? `${role} (${agent.name})` : agent.name
  }

  if (forKey === 'A') {
    return `Your original response was:\n${a}\n\nHere is how ${label('b', agentB)} answered (claim IDs may be prefixed B-):\n${b}\n\nHere is how ${label('c', agentC)} answered (claim IDs may be prefixed C-):\n${c}`
  }
  if (forKey === 'B') {
    return `Your original response was:\n${b}\n\nHere is how ${label('a', agentA)} answered (claim IDs may be prefixed A-):\n${a}\n\nHere is how ${label('c', agentC)} answered (claim IDs may be prefixed C-):\n${c}`
  }
  return `Your original response was:\n${c}\n\nHere is how ${label('a', agentA)} answered (claim IDs may be prefixed A-):\n${a}\n\nHere is how ${label('b', agentB)} answered (claim IDs may be prefixed B-):\n${b}`
}

function buildFinalPositionUserMessage(
  prompt,
  ra,
  rb,
  rc,
  aRev,
  bRev,
  cRev,
  config,
  criteria = []
) {
  const { agentA, agentB, agentC } = config
  const criteriaLine =
    criteria.length > 0
      ? `User decision criteria: ${criteria.join('; ')}\n\n`
      : ''
  return [
    `${criteriaLine}Original prompt:\n${prompt}`,
    `=== ${agentA.name} (round 1) ===\n${ra}`,
    `=== ${agentB.name} (round 1) ===\n${rb}`,
    `=== ${agentC.name} (round 1) ===\n${rc}`,
    `=== ${agentA.name} (round 2: cross-examination) ===\n${aRev}`,
    `=== ${agentB.name} (round 2: cross-examination) ===\n${bRev}`,
    `=== ${agentC.name} (round 2: cross-examination) ===\n${cRev}`,
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
  config,
  criteria = [],
  claimCatalog = ''
) {
  const { agentA, agentB, agentC } = config
  const criteriaLine =
    criteria.length > 0
      ? `User decision criteria (do not invent others): ${criteria.join('; ')}\n\n`
      : ''
  const catalogBlock = claimCatalog
    ? `\n\nKnown claim IDs (you may only cite these in FINDINGS-JSON):\n${claimCatalog}\n`
    : ''
  return [
    `${criteriaLine}Original prompt:\n${prompt}${catalogBlock}`,
    `=== ${agentA.name} (round 1) ===\n${ra}`,
    `=== ${agentB.name} (round 1) ===\n${rb}`,
    `=== ${agentC.name} (round 1) ===\n${rc}`,
    `=== ${agentA.name} (round 2) ===\n${aRev}`,
    `=== ${agentB.name} (round 2) ===\n${bRev}`,
    `=== ${agentC.name} (round 2) ===\n${cRev}`,
    `=== ${agentA.name} (round 3 revision) ===\n${fa}`,
    `=== ${agentB.name} (round 3 revision) ===\n${fb}`,
    `=== ${agentC.name} (round 3 revision) ===\n${fc}`,
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
 * Catalog of known claim IDs for the arbiter (never invent IDs).
 * Includes Round 1 claims plus Round 2/3 IDs when parseable from raw text.
 * @param {string} ra
 * @param {string} rb
 * @param {string} rc
 * @param {{ agentA?: { name?: string }, agentB?: { name?: string }, agentC?: { name?: string } }} config
 * @param {{ a?: string, b?: string, c?: string }} [reviews]
 * @param {{ a?: string, b?: string, c?: string }} [finals]
 */
function buildClaimCatalogForSynthesis(
  ra,
  rb,
  rc,
  config,
  reviews = {},
  finals = {}
) {
  const sa = parseRound1Structure(ra, 'a')
  const sb = parseRound1Structure(rb, 'b')
  const sc = parseRound1Structure(rc, 'c')
  const ids = collectClaimIds({ a: sa, b: sb, c: sc })
  const lines = []
  for (const [label, struct] of [
    [config.agentA?.name ?? 'A', sa],
    [config.agentB?.name ?? 'B', sb],
    [config.agentC?.name ?? 'C', sc],
  ]) {
    for (const c of struct.claims ?? []) {
      lines.push(`- ${c.id} (${label}, round 1): ${String(c.text).slice(0, 160)}`)
    }
  }

  const r2Structs = {
    a: parseRound2Structure(reviews.a ?? '', ids),
    b: parseRound2Structure(reviews.b ?? '', ids),
    c: parseRound2Structure(reviews.c ?? '', ids),
  }
  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    const cps = r2Structs[agent]?.counterpoints ?? []
    cps.forEach((cp, i) => {
      const id = `${agent.toUpperCase()}-CP${i + 1}`
      lines.push(
        `- ${id} (round 2 challenge${cp.targetClaimId ? ` → ${cp.targetClaimId}` : ''}): ${String(cp.text).slice(0, 120)}`
      )
    })
  }

  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    const r3 = parseRound3Structure(finals[agent] ?? '')
    for (const ch of r3.changes ?? []) {
      if (ch.revisedId) {
        lines.push(
          `- ${ch.revisedId} (round 3 ${ch.action} of ${ch.claimId}): ${String(ch.text || '').slice(0, 120)}`
        )
      } else if (ch.action === 'withdrawn') {
        lines.push(`- ${ch.claimId} (withdrawn in round 3; do not treat as supporting)`)
      }
    }
  }

  return lines.join('\n')
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
 * Soft-fail voice calls; rethrow infrastructure blockers.
 * @param {() => Promise<string>} fn
 * @param {{
 *   dispatch: import('react').Dispatch<unknown>,
 *   agent: 'a' | 'b' | 'c',
 *   agentName: string,
 *   stage: string,
 *   round?: number,
 *   getStatus?: () => string,
 * }} ctx
 */
async function tryModel(fn, ctx) {
  return tryModelCall(fn, ctx)
}

/**
 * @param {import('react').Dispatch<unknown>} dispatch
 * @param {{ agentA: { name: string }, agentB: { name: string }, agentC: { name: string } }} config
 * @param {'a'|'b'|'c'} agent
 * @param {string} stage
 * @param {number} [round]
 * @param {(() => string) | undefined} getStatus
 */
function voiceCtx(dispatch, config, agent, stage, round, getStatus) {
  const spec =
    agent === 'a' ? config.agentA : agent === 'b' ? config.agentB : config.agentC
  return {
    dispatch,
    agent,
    agentName: spec.name,
    stage,
    round,
    getStatus,
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
 * @param {string} aRev
 * @param {string} bRev
 * @param {string} cRev
 * @param {(() => string) | undefined} [getStatus]
 */
async function runCrossReviewPeerEvaluations(
  dispatch,
  config,
  aRev,
  bRev,
  cRev,
  getStatus
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
      const agentKey =
        key === 'gpt' ? 'a' : key === 'phi' ? 'b' : /** @type {'c'} */ ('c')
      const r = await tryModel(
        () =>
          callGitHubModel(
            model,
            [{ role: 'user', content: user }],
            CROSS_REVIEW_EVAL_SYSTEM,
            {
              agentName: name,
              maxTokens: 2048,
              errorContext: { stage: 'cross-review-eval', round: 2 },
            }
          ),
        voiceCtx(
          dispatch,
          config,
          agentKey,
          'peer_evaluation',
          2,
          getStatus
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
    getStatus,
    roles = { a: 'skeptic', b: 'researcher', c: 'operator' },
    criteria = [],
  } = ctx

  const roleSys = (base, key) => withRoleSystem(base, roles[key], criteria)

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
      config,
      criteria
    )
  )

  await pause(700)
  dispatch({
    type: 'SET_FINAL_THINKING',
    payload: { agent: 'a', startTime: Date.now() },
  })
  fa = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(
      () =>
        callGitHubModel(
          config.agentA.model,
          [{ role: 'user', content: finalUserBase }],
          roleSys(FINAL_POSITION_SYSTEM, 'a'),
          {
            agentName: config.agentA.name,
            errorContext: { stage: 'final-positions', round: 3 },
          }
        ),
      voiceCtx(dispatch, config, 'a', 'final_answers', 3, getStatus)
    )
    if (r.ok) {
      fa = r.value
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'a', position: fa, endTime: Date.now() },
      })
    } else {
      fa = 'placeholder' in r && r.placeholder ? r.placeholder : AGENT_TIMEOUT_MESSAGE
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'a', position: fa, endTime: Date.now() },
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
    const r = await tryModel(
      () =>
        callGitHubModel(
          config.agentB.model,
          [{ role: 'user', content: finalUserBase }],
          roleSys(FINAL_POSITION_SYSTEM, 'b'),
          {
            agentName: config.agentB.name,
            errorContext: { stage: 'final-positions', round: 3 },
          }
        ),
      voiceCtx(dispatch, config, 'b', 'final_answers', 3, getStatus)
    )
    if (r.ok) {
      fb = r.value
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'b', position: fb, endTime: Date.now() },
      })
    } else {
      fb = 'placeholder' in r && r.placeholder ? r.placeholder : AGENT_TIMEOUT_MESSAGE
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'b', position: fb, endTime: Date.now() },
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
    const r = await tryModel(
      () =>
        callGitHubModel(
          config.agentC.model,
          [{ role: 'user', content: finalUserBase }],
          roleSys(FINAL_POSITION_SYSTEM, 'c'),
          {
            agentName: config.agentC.name,
            errorContext: { stage: 'final-positions', round: 3 },
          }
        ),
      voiceCtx(dispatch, config, 'c', 'final_answers', 3, getStatus)
    )
    if (r.ok) {
      fc = r.value
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'c', position: fc, endTime: Date.now() },
      })
    } else {
      fc = 'placeholder' in r && r.placeholder ? r.placeholder : AGENT_TIMEOUT_MESSAGE
      dispatch({
        type: 'SET_FINAL_DONE',
        payload: { agent: 'c', position: fc, endTime: Date.now() },
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
    dispatch({
      type: 'SET_STAGE_ERROR',
      payload: { stage: 'influence', error: null },
    })
  } catch (err) {
    influenceReport = null
    const babelErr = toBabelError(err, {
      scope: 'voice',
      stage: 'influence_analysis',
    })
    if (isInfrastructureBlocker(babelErr)) {
      dispatch({ type: 'SET_INFLUENCE_LOADING', payload: false })
      throw babelErr
    }
    dispatch({
      type: 'SET_STAGE_ERROR',
      payload: {
        stage: 'influence',
        error: {
          ...babelErr,
          title: 'Influence analysis unavailable',
          detail:
            babelErr.detail ||
            'Position-change metrics could not be computed. Final answers remain available.',
          suggestion: 'Retry influence analysis, or continue without these metrics.',
          userMessage:
            'Position-change metrics could not be computed. Final answers remain available.',
        },
      },
    })
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
      config,
      criteria,
      buildClaimCatalogForSynthesis(
        ra,
        rb,
        rc,
        config,
        { a: aRev, b: bRev, c: cRev },
        { a: fa, b: fb, c: fc }
      )
    )
  )

  await pause(700)
  let synthesisRaw = ''
  let synthesisFailed = false
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
    try {
      synthesisRaw = await callGitHubModel(
        synthAgent.model,
        [{ role: 'user', content: synthesisUser }],
        SYNTHESIS_SYSTEM,
        {
          agentName: synthAgent.name,
          errorContext: { stage: 'synthesis', round: 3 },
        }
      )
      dispatch({
        type: 'SET_STAGE_ERROR',
        payload: { stage: 'synthesis', error: null },
      })
    } catch (e) {
      const babelErr = toBabelError(e, {
        scope: 'synthesis',
        stage: 'synthesis',
        agent: synthAgent.name,
        round: 3,
      })
      if (isInfrastructureBlocker(babelErr)) throw babelErr
      synthesisFailed = true
      dispatch({
        type: 'SET_STAGE_ERROR',
        payload: { stage: 'synthesis', error: babelErr },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  if (synthesisFailed) {
    dispatch({ type: 'SET_STATUS', payload: 'complete_with_gaps' })
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

  const parsed = parseSynthesisOutput(synthesisRaw, config)

  dispatch({
    type: 'SET_SYNTHESIS',
    payload: {
      output: parsed.output,
      attributions: parsed.attributions,
      rationale: parsed.rationale,
      concessions: parsed.concessions,
      heldFirm: parsed.heldFirm,
      decisionArtifact: parsed.decisionArtifact ?? null,
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

  const rawBResult = await tryModel(
    () =>
      callGitHubModel(
        config.agentB.model,
        [{ role: 'user', content: msgB }],
        SYNTHESIS_VALIDATION_SYSTEM,
        {
          agentName: config.agentB.name,
          maxTokens: 1024,
          errorContext: { stage: 'synthesis', round: 3 },
        }
      ),
    voiceCtx(dispatch, config, 'b', 'synthesis', 3, getStatus)
  )
  const rawCResult = await tryModel(
    () =>
      callGitHubModel(
        config.agentC.model,
        [{ role: 'user', content: msgC }],
        SYNTHESIS_VALIDATION_SYSTEM,
        {
          agentName: config.agentC.name,
          maxTokens: 1024,
          errorContext: { stage: 'synthesis', round: 3 },
        }
      ),
    voiceCtx(dispatch, config, 'c', 'synthesis', 3, getStatus)
  )

  let rawB =
    rawBResult.ok && 'value' in rawBResult
      ? rawBResult.value
      : 'placeholder' in rawBResult && rawBResult.placeholder
        ? rawBResult.placeholder
        : AGENT_TIMEOUT_MESSAGE
  let rawC =
    rawCResult.ok && 'value' in rawCResult
      ? rawCResult.value
      : 'placeholder' in rawCResult && rawCResult.placeholder
        ? rawCResult.placeholder
        : AGENT_TIMEOUT_MESSAGE
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

  // Engine finalizes complete vs complete_with_gaps; avoid clobbering degraded mid-run.
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
    getStatus,
    roles = { a: 'skeptic', b: 'researcher', c: 'operator' },
    criteria = [],
  } = ctx

  const roleSys = (base, key) => withRoleSystem(base, roles[key], criteria)

  const aReviewMsg = clipInferenceText(
    buildRound2CombinedUserMessage(
      'A',
      { agentA: ra, agentB: rb, agentC: rc },
      config,
      roles
    )
  )
  const bReviewMsg = clipInferenceText(
    buildRound2CombinedUserMessage(
      'B',
      { agentA: ra, agentB: rb, agentC: rc },
      config,
      roles
    )
  )
  const cReviewMsg = clipInferenceText(
    buildRound2CombinedUserMessage(
      'C',
      { agentA: ra, agentB: rb, agentC: rc },
      config,
      roles
    )
  )

  dispatch({
    type: 'SET_REVIEW_THINKING',
    payload: { agent: 'a', startTime: Date.now() },
  })
  let aRev = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(
      () =>
        callGitHubModel(
          config.agentA.model,
          [{ role: 'user', content: aReviewMsg }],
          roleSys(ROUND2_COMBINED_SYSTEM, 'a'),
          {
            agentName: config.agentA.name,
            errorContext: { stage: 'cross-review', round: 2 },
          }
        ),
      voiceCtx(dispatch, config, 'a', 'round_2', 2, getStatus)
    )
    if (r.ok) {
      aRev = r.value
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'a', review: aRev, endTime: Date.now() },
      })
    } else {
      aRev =
        'placeholder' in r && r.placeholder
          ? r.placeholder
          : AGENT_TIMEOUT_MESSAGE
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'a', review: aRev, endTime: Date.now() },
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
    const r = await tryModel(
      () =>
        callGitHubModel(
          config.agentB.model,
          [{ role: 'user', content: bReviewMsg }],
          roleSys(ROUND2_COMBINED_SYSTEM, 'b'),
          {
            agentName: config.agentB.name,
            errorContext: { stage: 'cross-review', round: 2 },
          }
        ),
      voiceCtx(dispatch, config, 'b', 'round_2', 2, getStatus)
    )
    if (r.ok) {
      bRev = r.value
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'b', review: bRev, endTime: Date.now() },
      })
    } else {
      bRev =
        'placeholder' in r && r.placeholder
          ? r.placeholder
          : AGENT_TIMEOUT_MESSAGE
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'b', review: bRev, endTime: Date.now() },
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
    const r = await tryModel(
      () =>
        callGitHubModel(
          config.agentC.model,
          [{ role: 'user', content: cReviewMsg }],
          roleSys(ROUND2_COMBINED_SYSTEM, 'c'),
          {
            agentName: config.agentC.name,
            errorContext: { stage: 'cross-review', round: 2 },
          }
        ),
      voiceCtx(dispatch, config, 'c', 'round_2', 2, getStatus)
    )
    if (r.ok) {
      cRev = r.value
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'c', review: cRev, endTime: Date.now() },
      })
    } else {
      cRev =
        'placeholder' in r && r.placeholder
          ? r.placeholder
          : AGENT_TIMEOUT_MESSAGE
      dispatch({
        type: 'SET_REVIEW_DONE',
        payload: { agent: 'c', review: cRev, endTime: Date.now() },
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
    cRev,
    getStatus
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
    getStatus,
    roles,
    criteria,
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
    roles = { a: 'skeptic', b: 'researcher', c: 'operator' },
    criteria = [],
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
    getStatus: ctx.getStatus,
    roles,
    criteria,
  })
}

/**
 * Pull round/review/final texts from forge state for stage retries.
 * @param {Record<string, unknown>} state
 */
export function materialsFromForgeState(state) {
  const rounds = Array.isArray(state.rounds) ? state.rounds : []
  const reviews = Array.isArray(state.reviews) ? state.reviews : []
  const r1 =
    /** @type {{ agentA?: string, agentB?: string, agentC?: string }} */ (
      rounds.find((r) => r && r.roundNum === 1) || {}
    )
  const rev =
    /** @type {{ aReviews?: string, bReviews?: string, cReviews?: string }} */ (
      reviews.find((r) => r && r.roundNum === 1) || {}
    )
  const ar =
    /** @type {{ a?: string|null, b?: string|null, c?: string|null }} */ (
      state.agentResponses || {}
    )
  const rr =
    /** @type {{ a?: string|null, b?: string|null, c?: string|null }} */ (
      state.reviewResponses || {}
    )
  const fp =
    /** @type {{ a?: string|null, b?: string|null, c?: string|null }} */ (
      state.finalPositions || {}
    )
  const reb =
    /** @type {{ a?: string|null, b?: string|null, c?: string|null }} */ (
      state.rebuttals || {}
    )

  return {
    ra: String(ar.a ?? r1.agentA ?? ''),
    rb: String(ar.b ?? r1.agentB ?? ''),
    rc: String(ar.c ?? r1.agentC ?? ''),
    aRev: String(rr.a ?? rev.aReviews ?? ''),
    bRev: String(rr.b ?? rev.bReviews ?? ''),
    cRev: String(rr.c ?? rev.cReviews ?? ''),
    fa: String(fp.a ?? ''),
    fb: String(fp.b ?? ''),
    fc: String(fp.c ?? ''),
    rebA: String(reb.a ?? ''),
    rebB: String(reb.b ?? ''),
    rebC: String(reb.c ?? ''),
  }
}

/**
 * Retry synthesis (+ validation) without re-running voices or influence.
 * @param {{
 *   dispatch: import('react').Dispatch<unknown>,
 *   state: Record<string, unknown>,
 *   getStatus?: () => string,
 * }} opts
 * @returns {Promise<'ok' | 'failed' | 'blocked' | 'skipped'>}
 */
export async function runSynthesisOnly({ dispatch, state, getStatus }) {
  const config =
    /** @type {{
     *   agentA: { name: string, model: string },
     *   agentB: { name: string, model: string },
     *   agentC: { name: string, model: string },
     * }} */ (state.config)
  const userPrompt = String(state.prompt ?? '')
  const m = materialsFromForgeState(state)
  if (!m.fa && !m.fb && !m.fc) return 'skipped'

  const synthesisWinner = state.synthesisWinner
  const w =
    synthesisWinner &&
    typeof synthesisWinner === 'object' &&
    /** @type {{ winner?: string }} */ (synthesisWinner).winner
      ? String(/** @type {{ winner?: string }} */ (synthesisWinner).winner).toLowerCase()
      : 'gpt'
  const synthAgent =
    w === 'phi'
      ? config.agentB
      : w === 'mistral'
        ? config.agentC
        : config.agentA

  dispatch({
    type: 'SET_STAGE_ERROR',
    payload: { stage: 'synthesis', error: null },
  })

  const synthesisUser = clipInferenceText(
    buildFullSynthesisUserMessage(
      userPrompt,
      m.ra,
      m.rb,
      m.rc,
      m.aRev,
      m.bRev,
      m.cRev,
      m.fa,
      m.fb,
      m.fc,
      config,
      /** @type {any} */ (state).decisionCriteria ?? [],
      buildClaimCatalogForSynthesis(
        m.ra,
        m.rb,
        m.rc,
        config,
        { a: m.aRev, b: m.bRev, c: m.cRev },
        { a: m.fa, b: m.fb, c: m.fc }
      )
    )
  )

  let synthesisRaw = ''
  try {
    synthesisRaw = await callGitHubModel(
      synthAgent.model,
      [{ role: 'user', content: synthesisUser }],
      SYNTHESIS_SYSTEM,
      {
        agentName: synthAgent.name,
        errorContext: { stage: 'synthesis', round: 3 },
      }
    )
  } catch (e) {
    const babelErr = toBabelError(e, {
      scope: 'synthesis',
      stage: 'synthesis',
      agent: synthAgent.name,
      round: 3,
    })
    if (isInfrastructureBlocker(babelErr)) {
      dispatch({ type: 'SET_ERROR', payload: babelErr })
      dispatch({ type: 'SET_STATUS', payload: 'blocked' })
      return 'blocked'
    }
    dispatch({
      type: 'SET_STAGE_ERROR',
      payload: { stage: 'synthesis', error: babelErr },
    })
    dispatch({ type: 'SET_STATUS', payload: 'complete_with_gaps' })
    return 'failed'
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
      decisionArtifact: parsed.decisionArtifact ?? null,
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
    buildSynthesisValidationUserMessage(userPrompt.trim(), m.rb, parsed.output),
    48_000
  )
  const msgC = clipInferenceText(
    buildSynthesisValidationUserMessage(userPrompt.trim(), m.rc, parsed.output),
    48_000
  )

  const rawBResult = await tryModel(
    () =>
      callGitHubModel(
        config.agentB.model,
        [{ role: 'user', content: msgB }],
        SYNTHESIS_VALIDATION_SYSTEM,
        {
          agentName: config.agentB.name,
          maxTokens: 1024,
          errorContext: { stage: 'synthesis', round: 3 },
        }
      ),
    voiceCtx(dispatch, config, 'b', 'synthesis', 3, getStatus)
  )
  const rawCResult = await tryModel(
    () =>
      callGitHubModel(
        config.agentC.model,
        [{ role: 'user', content: msgC }],
        SYNTHESIS_VALIDATION_SYSTEM,
        {
          agentName: config.agentC.name,
          maxTokens: 1024,
          errorContext: { stage: 'synthesis', round: 3 },
        }
      ),
    voiceCtx(dispatch, config, 'c', 'synthesis', 3, getStatus)
  )

  const rawB =
    rawBResult.ok && 'value' in rawBResult
      ? rawBResult.value
      : 'placeholder' in rawBResult && rawBResult.placeholder
        ? rawBResult.placeholder
        : AGENT_TIMEOUT_MESSAGE
  const rawC =
    rawCResult.ok && 'value' in rawCResult
      ? rawCResult.value
      : 'placeholder' in rawCResult && rawCResult.placeholder
        ? rawCResult.placeholder
        : AGENT_TIMEOUT_MESSAGE

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

  const hasVoiceGaps = Boolean(
    /** @type {any} */ (state).voiceErrors?.a ||
      /** @type {any} */ (state).voiceErrors?.b ||
      /** @type {any} */ (state).voiceErrors?.c ||
      /** @type {any} */ (state).stageErrors?.audit ||
      /** @type {any} */ (state).stageErrors?.influence
  )
  dispatch({
    type: 'SET_STATUS',
    payload: hasVoiceGaps ? 'complete_with_gaps' : 'complete',
  })

  const influenceReport = state.influenceReport ?? null
  scheduleDebateAudit(
    dispatch,
    {
      config,
      prompt: userPrompt.trim(),
      round1: { agentA: m.ra, agentB: m.rb, agentC: m.rc },
      reviews: { aReviews: m.aRev, bReviews: m.bRev, cReviews: m.cRev },
      rebuttals: { a: m.rebA, b: m.rebB, c: m.rebC },
      finalPositions: { agentA: m.fa, agentB: m.fb, agentC: m.fc },
      synthesis: { output: parsed.output },
    },
    {
      prompt: userPrompt.trim(),
      rounds: [{ roundNum: 1, agentA: m.ra, agentB: m.rb, agentC: m.rc }],
      reviews: [{ aReviews: m.aRev, bReviews: m.bRev, cReviews: m.cRev }],
      rebuttals: { a: m.rebA, b: m.rebB, c: m.rebC },
      finalPositions: { a: m.fa, b: m.fb, c: m.fc },
      config,
      synthesisWinner: synthesisWinner ?? null,
      influenceReport,
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
  return 'ok'
}

/**
 * Rebuild audit snapshot from current forge state and re-run audit.
 * @param {import('react').Dispatch<unknown>} dispatch
 * @param {Record<string, unknown>} state
 * @returns {boolean} false if materials are insufficient
 */
export function retryDebateAudit(dispatch, state) {
  const config = /** @type {Record<string, unknown>} */ (state.config)
  const userPrompt = String(state.prompt ?? '')
  const m = materialsFromForgeState(state)
  if (!m.ra && !m.rb && !m.rc) return false

  const synth =
    state.synthesis && typeof state.synthesis === 'object'
      ? /** @type {{ output?: string }} */ (state.synthesis)
      : null
  const synthesisOutput =
    typeof synth?.output === 'string' && synth.output.trim()
      ? synth.output
      : clipInferenceText(auditSynthesisFallback(m.fa, m.fb, m.fc), 48_000)

  scheduleDebateAudit(
    dispatch,
    {
      config,
      prompt: userPrompt.trim(),
      round1: { agentA: m.ra, agentB: m.rb, agentC: m.rc },
      reviews: { aReviews: m.aRev, bReviews: m.bRev, cReviews: m.cRev },
      rebuttals: { a: m.rebA, b: m.rebB, c: m.rebC },
      finalPositions: { agentA: m.fa, agentB: m.fb, agentC: m.fc },
      synthesis: { output: synthesisOutput },
    },
    {
      prompt: userPrompt.trim(),
      rounds: [{ roundNum: 1, agentA: m.ra, agentB: m.rb, agentC: m.rc }],
      reviews: [{ aReviews: m.aRev, bReviews: m.bRev, cReviews: m.cRev }],
      rebuttals: { a: m.rebA, b: m.rebB, c: m.rebC },
      finalPositions: { a: m.fa, b: m.fb, c: m.fc },
      config,
      synthesisWinner: state.synthesisWinner ?? null,
      influenceReport: state.influenceReport ?? null,
      synthesis: synth,
      validation: state.validation ?? null,
    }
  )
  return true
}

/**
 * Re-run influence analysis from stored finals / reviews.
 * @param {import('react').Dispatch<unknown>} dispatch
 * @param {Record<string, unknown>} state
 * @returns {Promise<'ok' | 'failed' | 'skipped' | 'blocked'>}
 */
export async function retryInfluenceAnalysis(dispatch, state) {
  const config =
    /** @type {{
     *   agentA: { name: string, model: string },
     *   agentB: { name: string, model: string },
     *   agentC: { name: string, model: string },
     * }} */ (state.config)
  const m = materialsFromForgeState(state)
  if (!m.fa && !m.fb && !m.fc) return 'skipped'

  dispatch({ type: 'SET_INFLUENCE_LOADING', payload: true })
  dispatch({
    type: 'SET_STAGE_ERROR',
    payload: { stage: 'influence', error: null },
  })

  try {
    const influenceReport = await runInfluenceAnalysis(dispatch, {
      config,
      ra: m.ra,
      rb: m.rb,
      rc: m.rc,
      fa: m.fa,
      fb: m.fb,
      fc: m.fc,
      aRev: m.aRev,
      bRev: m.bRev,
      cRev: m.cRev,
    })
    dispatch({ type: 'SET_INFLUENCE_REPORT', payload: influenceReport })
    return 'ok'
  } catch (err) {
    const babelErr = toBabelError(err, {
      scope: 'voice',
      stage: 'influence_analysis',
    })
    if (isInfrastructureBlocker(babelErr)) {
      dispatch({ type: 'SET_ERROR', payload: babelErr })
      dispatch({ type: 'SET_STATUS', payload: 'blocked' })
      return 'blocked'
    }
    dispatch({ type: 'SET_INFLUENCE_REPORT', payload: null })
    dispatch({
      type: 'SET_STAGE_ERROR',
      payload: {
        stage: 'influence',
        error: {
          ...babelErr,
          title: 'Influence analysis unavailable',
          detail:
            'Position-change metrics could not be computed. Final answers remain available.',
          suggestion: 'Retry influence analysis, or continue without these metrics.',
          userMessage:
            'Position-change metrics could not be computed. Final answers remain available.',
        },
      },
    })
    return 'failed'
  } finally {
    dispatch({ type: 'SET_INFLUENCE_LOADING', payload: false })
  }
}
