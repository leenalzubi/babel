import { callGitHubModel } from '../api/githubModelsClient.js'
import {
  CROSS_REVIEW_SYSTEM,
  FINAL_POSITION_SYSTEM,
  REBUTTAL_SYSTEM,
  SYNTHESIS_SYSTEM,
  SYNTHESIS_VALIDATION_SYSTEM,
} from '../api/systemPrompts.js'
import { runAudit } from '../lib/auditDebate.js'
import {
  AGENT_TIMEOUT_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from '../lib/debateConstants.js'
import { semanticDivergence } from '../lib/cosineSimilarity.js'
import { clipInferenceText } from '../lib/clipInferenceText.js'
import { extractReviewSectionAboutPeer } from '../lib/extractCrossReviewSection.js'
import { getEmbedding } from '../lib/getEmbedding.js'
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
 */
export function scheduleDebateAudit(dispatch, snapshot) {
  dispatch({ type: 'SET_AUDIT_LOADING', payload: true })
  dispatch({ type: 'SET_AUDIT_ERROR', payload: null })
  void (async () => {
    try {
      const result = await runAudit(snapshot)
      dispatch({ type: 'SET_AUDIT', payload: result })
    } catch (err) {
      dispatch({
        type: 'SET_AUDIT_ERROR',
        payload:
          err instanceof Error ? err.message : `Audit failed: ${String(err)}`,
      })
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

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * @param {'a' | 'b' | 'c'} target
 * @param {string} ra
 * @param {string} rb
 * @param {string} rc
 * @param {string} aRev
 * @param {string} bRev
 * @param {string} cRev
 * @param {{ agentA: { name: string }, agentB: { name: string }, agentC: { name: string } }} config
 */
function buildRebuttalUserMessage(target, ra, rb, rc, aRev, bRev, cRev, config) {
  const { agentA, agentB, agentC } = config
  if (target === 'a') {
    const sB = extractReviewSectionAboutPeer(bRev, agentA.name)
    const sC = extractReviewSectionAboutPeer(cRev, agentA.name)
    return `Your original response was:\n${ra}\n\n${agentB.name} reviewed your response and said:\n${sB}\n\n${agentC.name} reviewed your response and said:\n${sC}\n\nDo you maintain, modify, or concede your position?`
  }
  if (target === 'b') {
    const sA = extractReviewSectionAboutPeer(aRev, agentB.name)
    const sC = extractReviewSectionAboutPeer(cRev, agentB.name)
    return `Your original response was:\n${rb}\n\n${agentA.name} reviewed your response and said:\n${sA}\n\n${agentC.name} reviewed your response and said:\n${sC}\n\nDo you maintain, modify, or concede your position?`
  }
  const sA = extractReviewSectionAboutPeer(aRev, agentC.name)
  const sB = extractReviewSectionAboutPeer(bRev, agentC.name)
  return `Your original response was:\n${rc}\n\n${agentA.name} reviewed your response and said:\n${sA}\n\n${agentB.name} reviewed your response and said:\n${sB}\n\nDo you maintain, modify, or concede your position?`
}

function buildFinalPositionUserMessage(
  prompt,
  ra,
  rb,
  rc,
  aRev,
  bRev,
  cRev,
  rebA,
  rebB,
  rebC,
  config
) {
  const { agentA, agentB, agentC } = config
  return [
    `Original prompt:\n${prompt}`,
    `=== ${agentA.name} (round 1) ===\n${ra}`,
    `=== ${agentB.name} (round 1) ===\n${rb}`,
    `=== ${agentC.name} (round 1) ===\n${rc}`,
    `=== ${agentA.name} (cross-review) ===\n${aRev}`,
    `=== ${agentB.name} (cross-review) ===\n${bRev}`,
    `=== ${agentC.name} (cross-review) ===\n${cRev}`,
    `=== ${agentA.name} (rebuttal) ===\n${rebA}`,
    `=== ${agentB.name} (rebuttal) ===\n${rebB}`,
    `=== ${agentC.name} (rebuttal) ===\n${rebC}`,
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
  rebA,
  rebB,
  rebC,
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
    `=== ${agentA.name} (cross-review) ===\n${aRev}`,
    `=== ${agentB.name} (cross-review) ===\n${bRev}`,
    `=== ${agentC.name} (cross-review) ===\n${cRev}`,
    `=== ${agentA.name} (rebuttal) ===\n${rebA}`,
    `=== ${agentB.name} (rebuttal) ===\n${rebB}`,
    `=== ${agentC.name} (rebuttal) ===\n${rebC}`,
    `=== ${agentA.name} (final position) ===\n${fa}`,
    `=== ${agentB.name} (final position) ===\n${fb}`,
    `=== ${agentC.name} (final position) ===\n${fc}`,
  ].join('\n\n')
}

/**
 * @param {'A' | 'B' | 'C'} forKey
 * @param {{ agentA: string, agentB: string, agentC: string }} responses
 * @param {{ agentA: { name: string }, agentB: { name: string }, agentC: { name: string } }} config
 */
function buildCrossReviewUserMessage(forKey, { agentA: a, agentB: b, agentC: c }, config) {
  const { agentA, agentB, agentC } = config
  const tail =
    'Review both responses. For each: what did they get right, what would you challenge, what did they miss?'

  if (forKey === 'A') {
    return `Here are the two other responses to the prompt you just answered:\n\n=== ${agentB.name} responded: ===\n${b}\n\n=== ${agentC.name} responded: ===\n${c}\n\n${tail}`
  }
  if (forKey === 'B') {
    return `Here are the two other responses to the prompt you just answered:\n\n=== ${agentA.name} responded: ===\n${a}\n\n=== ${agentC.name} responded: ===\n${c}\n\n${tail}`
  }
  return `Here are the two other responses to the prompt you just answered:\n\n=== ${agentA.name} responded: ===\n${a}\n\n=== ${agentB.name} responded: ===\n${b}\n\n${tail}`
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
    if (e instanceof Error && e.message === TIMEOUT_ERROR_MESSAGE) {
      return { ok: false, timeout: true }
    }
    throw e
  }
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
    uiSettings,
    userPrompt,
    config,
    ra,
    rb,
    rc,
    aRev,
    bRev,
    cRev,
    rebA,
    rebB,
    rebC,
    embA,
    embB,
    embC,
    ab,
    ac,
    bc,
    average,
    skipFinalModelCalls,
    precomputedFinals,
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
      rebA,
      rebB,
      rebC,
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
        FINAL_POSITION_SYSTEM
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
        FINAL_POSITION_SYSTEM
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
        FINAL_POSITION_SYSTEM
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

  const shouldSynthesize =
    uiSettings.synthesisMode === 'always' || average > 0.4

  const debateBase = {
    prompt: userPrompt.trim(),
    rounds: [{ roundNum: 1, agentA: ra, agentB: rb, agentC: rc }],
    reviews: [{ aReviews: aRev, bReviews: bRev, cReviews: cRev }],
    rebuttals: { a: rebA, b: rebB, c: rebC },
    finalPositions: { a: fa, b: fb, c: fc },
    divergenceScores: [{ ab, ac, bc, average }],
    config,
    embedding_a: embA,
    embedding_b: embB,
    embedding_c: embC,
  }

  if (!shouldSynthesize) {
    dispatch({
      type: 'SET_SYNTHESIS',
      payload: {
        output:
          '*Synthesis skipped:* your setting only runs synthesis when **average semantic divergence** (embedding distance) is above **40%**. This run was below that threshold — use the full debate transcript (rounds 1–4) as the final output.',
        attributions: { a: '', b: '', c: '' },
        rationale: '',
        concessions: [],
        heldFirm: [],
      },
    })
    dispatch({
      type: 'SET_LAST_COMPLETED_STAGE',
      payload: { stage: 'synthesis' },
    })
    dispatch({ type: 'SET_STATUS', payload: 'complete' })
    void logDebate({
      ...debateBase,
      synthesis: {
        output:
          '*Synthesis skipped:* your setting only runs synthesis when **average semantic divergence** (embedding distance) is above **40%**. This run was below that threshold — use the full debate transcript (rounds 1–4) as the final output.',
        attributions: { a: '', b: '', c: '' },
        concessions: [],
        heldFirm: [],
      },
    })
    scheduleDebateAudit(dispatch, {
      config,
      prompt: userPrompt.trim(),
      round1: { agentA: ra, agentB: rb, agentC: rc },
      reviews: { aReviews: aRev, bReviews: bRev, cReviews: cRev },
      synthesis: {
        output:
          '*Synthesis skipped:* your setting only runs synthesis when **average semantic divergence** (embedding distance) is above **40%**. This run was below that threshold — use the full debate transcript (rounds 1–4) as the final output.',
      },
    })
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
      rebA,
      rebB,
      rebC,
      fa,
      fb,
      fc,
      config
    )
  )

  await pause(700)
  let synthesisRaw = ''
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentA.model,
        [{ role: 'user', content: synthesisUser }],
        SYNTHESIS_SYSTEM
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
      { agentName: config.agentB.name, maxTokens: 1024 }
    )
  )
  const rawCResult = await tryModel(() =>
    callGitHubModel(
      config.agentC.model,
      [{ role: 'user', content: msgC }],
      SYNTHESIS_VALIDATION_SYSTEM,
      { agentName: config.agentC.name, maxTokens: 1024 }
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
  void logDebate({
    ...debateBase,
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
  })
  scheduleDebateAudit(dispatch, {
    config,
    prompt: userPrompt.trim(),
    round1: { agentA: ra, agentB: rb, agentC: rc },
    reviews: { aReviews: aRev, bReviews: bRev, cReviews: cRev },
    synthesis: { output: parsed.output },
  })

}

/**
 * Rebuttals → finals → synthesis/validation → audit. Requires embeddings + divergence already computed.
 */
export async function runPipelineFromRebuttalsOnward(ctx) {
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
    embA,
    embB,
    embC,
    ab,
    ac,
    bc,
    average,
  } = ctx

  await pause(700)
  dispatch({
    type: 'SET_REBUTTAL_THINKING',
    payload: { agent: 'a', startTime: Date.now() },
  })
  let rebA = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentA.model,
        [
          {
            role: 'user',
            content: clipInferenceText(
              buildRebuttalUserMessage('a', ra, rb, rc, aRev, bRev, cRev, config)
            ),
          },
        ],
        REBUTTAL_SYSTEM
      )
    )
    if (r.ok) {
      rebA = r.value
      dispatch({
        type: 'SET_REBUTTAL_DONE',
        payload: { agent: 'a', rebuttal: rebA, endTime: Date.now() },
      })
    } else {
      dispatch({
        type: 'SET_REBUTTAL_DONE',
        payload: { agent: 'a', rebuttal: AGENT_TIMEOUT_MESSAGE, endTime: Date.now() },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  await pause(700)
  dispatch({
    type: 'SET_REBUTTAL_THINKING',
    payload: { agent: 'b', startTime: Date.now() },
  })
  let rebB = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentB.model,
        [
          {
            role: 'user',
            content: clipInferenceText(
              buildRebuttalUserMessage('b', ra, rb, rc, aRev, bRev, cRev, config)
            ),
          },
        ],
        REBUTTAL_SYSTEM
      )
    )
    if (r.ok) {
      rebB = r.value
      dispatch({
        type: 'SET_REBUTTAL_DONE',
        payload: { agent: 'b', rebuttal: rebB, endTime: Date.now() },
      })
    } else {
      dispatch({
        type: 'SET_REBUTTAL_DONE',
        payload: { agent: 'b', rebuttal: AGENT_TIMEOUT_MESSAGE, endTime: Date.now() },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  await pause(700)
  dispatch({
    type: 'SET_REBUTTAL_THINKING',
    payload: { agent: 'c', startTime: Date.now() },
  })
  let rebC = AGENT_TIMEOUT_MESSAGE
  {
    const r = await tryModel(() =>
      callGitHubModel(
        config.agentC.model,
        [
          {
            role: 'user',
            content: clipInferenceText(
              buildRebuttalUserMessage('c', ra, rb, rc, aRev, bRev, cRev, config)
            ),
          },
        ],
        REBUTTAL_SYSTEM
      )
    )
    if (r.ok) {
      rebC = r.value
      dispatch({
        type: 'SET_REBUTTAL_DONE',
        payload: { agent: 'c', rebuttal: rebC, endTime: Date.now() },
      })
    } else {
      dispatch({
        type: 'SET_REBUTTAL_DONE',
        payload: { agent: 'c', rebuttal: AGENT_TIMEOUT_MESSAGE, endTime: Date.now() },
      })
      bumpTimeout(dispatch)
    }
    bump(dispatch)
  }

  dispatch({
    type: 'SET_LAST_COMPLETED_STAGE',
    payload: { stage: 'rebuttals' },
  })

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
    rebA,
    rebB,
    rebC,
    embA,
    embB,
    embC,
    ab,
    ac,
    bc,
    average,
  })

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
  const { dispatch, uiSettings, userPrompt, config, ra, rb, rc } = ctx

  const [embA, embB, embC] = await Promise.all([
    getEmbedding(ra),
    getEmbedding(rb),
    getEmbedding(rc),
  ])

  const div_ab = embA && embB ? semanticDivergence(embA, embB) : null
  const div_ac = embA && embC ? semanticDivergence(embA, embC) : null
  const div_bc = embB && embC ? semanticDivergence(embB, embC) : null

  const divList = [div_ab, div_ac, div_bc].filter(
    (v) => v != null && typeof v === 'number'
  )
  const average =
    divList.length > 0
      ? Math.round(
          (divList.reduce((a, b) => a + b, 0) / divList.length) * 10000
        ) / 10000
      : 0
  const ab = div_ab ?? 0
  const ac = div_ac ?? 0
  const bc = div_bc ?? 0

  dispatch({
    type: 'SET_DIVERGENCE',
    payload: { ab, ac, bc, average },
  })

  const aReviewMsg = clipInferenceText(
    buildCrossReviewUserMessage('A', { agentA: ra, agentB: rb, agentC: rc }, config)
  )
  const bReviewMsg = clipInferenceText(
    buildCrossReviewUserMessage('B', { agentA: ra, agentB: rb, agentC: rc }, config)
  )
  const cReviewMsg = clipInferenceText(
    buildCrossReviewUserMessage('C', { agentA: ra, agentB: rb, agentC: rc }, config)
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
        CROSS_REVIEW_SYSTEM
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
        CROSS_REVIEW_SYSTEM
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
        CROSS_REVIEW_SYSTEM
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

  await pause(700)
  await runPipelineFromRebuttalsOnward({
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
    embA,
    embB,
    embC,
    ab,
    ac,
    bc,
    average,
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
  } = ctx

  const [embA, embB, embC] = await Promise.all([
    getEmbedding(ra),
    getEmbedding(rb),
    getEmbedding(rc),
  ])

  const div_ab = embA && embB ? semanticDivergence(embA, embB) : null
  const div_ac = embA && embC ? semanticDivergence(embA, embC) : null
  const div_bc = embB && embC ? semanticDivergence(embB, embC) : null
  const divList = [div_ab, div_ac, div_bc].filter(
    (v) => v != null && typeof v === 'number'
  )
  const average =
    divList.length > 0
      ? Math.round(
          (divList.reduce((a, b) => a + b, 0) / divList.length) * 10000
        ) / 10000
      : 0
  const ab = div_ab ?? 0
  const ac = div_ac ?? 0
  const bc = div_bc ?? 0

  dispatch({
    type: 'SET_DIVERGENCE',
    payload: { ab, ac, bc, average },
  })

  await runPipelineFromRebuttalsOnward({
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
    embA,
    embB,
    embC,
    ab,
    ac,
    bc,
    average,
  })
}
