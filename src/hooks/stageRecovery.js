import { callGitHubModel } from '../api/githubModelsClient.js'
import {
  AGENT_ROUND1_SYSTEM,
  FINAL_POSITION_SYSTEM,
  ROUND2_COMBINED_SYSTEM,
} from '../api/systemPrompts.js'
import { withRoleSystem } from '../lib/babelRoles.js'
import {
  AGENT_TIMEOUT_MESSAGE,
  isUnavailableAgentResponse,
} from '../lib/debateConstants.js'
import { clipInferenceText } from '../lib/clipInferenceText.js'
import { readBabelSynthesisEnabled } from '../lib/babelSynthesisPref.js'
import {
  materialsFromForgeState,
  resumeFromReviews,
  resumeFromRound1,
  runPipelineFromFinalsOnward,
} from './debatePipeline.js'
import { tryModelCall } from './tryModelCall.js'

/**
 * @param {Record<string, unknown>} state
 * @param {'a'|'b'|'c'} agent
 */
function agentSpec(state, agent) {
  const config =
    /** @type {{ agentA: { name: string, model: string }, agentB: { name: string, model: string }, agentC: { name: string, model: string } }} */ (
      state.config
    )
  return agent === 'a'
    ? config.agentA
    : agent === 'b'
      ? config.agentB
      : config.agentC
}

/**
 * @param {string | undefined} stage
 * @returns {'round_1' | 'round_2' | 'final_answers'}
 */
function normalizeVoiceStage(stage) {
  const s = String(stage ?? '').toLowerCase()
  if (s.includes('final') || s === 'final_answers') return 'final_answers'
  if (
    s.includes('round_2') ||
    s.includes('round2') ||
    s.includes('cross') ||
    s.includes('review') ||
    s.includes('peer')
  ) {
    return 'round_2'
  }
  return 'round_1'
}

/**
 * @param {string} text
 */
function isUsableText(text) {
  return (
    typeof text === 'string' &&
    text.length > 0 &&
    !isUnavailableAgentResponse(text)
  )
}

/**
 * Re-run a single voice at the narrowest stage that failed.
 * @param {{
 *   dispatch: import('react').Dispatch<unknown>,
 *   state: Record<string, unknown>,
 *   agent: 'a' | 'b' | 'c',
 *   stage?: string,
 *   getStatus?: () => string,
 *   isActive?: () => boolean,
 * }} opts
 * @returns {Promise<'ok' | 'failed' | 'stale'>}
 */
export async function retryVoiceCall(opts) {
  const { dispatch, state, agent, getStatus, isActive } = opts
  const voiceErr =
    /** @type {{ stage?: string } | null | undefined} */ (
      /** @type {any} */ (state).voiceErrors?.[agent]
    )
  const stage = normalizeVoiceStage(opts.stage || voiceErr?.stage)
  const spec = agentSpec(state, agent)
  const config = /** @type {any} */ (state.config)
  const userPrompt = String(state.prompt ?? '')
  const m = materialsFromForgeState(state)

  dispatch({ type: 'CLEAR_VOICE_ERROR', payload: { agent } })

  const t0 = Date.now()
  if (stage === 'round_1') {
    dispatch({
      type: 'SET_AGENT_THINKING',
      payload: { agent, startTime: t0 },
    })
  } else if (stage === 'round_2') {
    dispatch({
      type: 'SET_REVIEW_THINKING',
      payload: { agent, startTime: t0 },
    })
  } else {
    dispatch({
      type: 'SET_FINAL_THINKING',
      payload: { agent, startTime: t0 },
    })
  }

  const roles = /** @type {any} */ (state).roles ?? {
    a: 'skeptic',
    b: 'researcher',
    c: 'operator',
  }
  const criteria = /** @type {any} */ (state).decisionCriteria ?? []
  const sys = (base) => withRoleSystem(base, roles[agent], criteria)

  /** @type {() => Promise<string>} */
  let fn
  if (stage === 'round_1') {
    const promptClipped = clipInferenceText(userPrompt.trim(), 48_000)
    fn = () =>
      callGitHubModel(
        spec.model,
        [{ role: 'user', content: promptClipped }],
        sys(AGENT_ROUND1_SYSTEM),
        {
          agentName: spec.name,
          errorContext: { stage: 'round1', round: 1 },
        }
      )
  } else if (stage === 'round_2') {
    const forKey = agent === 'a' ? 'A' : agent === 'b' ? 'B' : 'C'
    const reviewMsg = clipInferenceText(
      buildRound2Msg(
        forKey,
        { agentA: m.ra, agentB: m.rb, agentC: m.rc },
        config
      )
    )
    fn = () =>
      callGitHubModel(
        spec.model,
        [{ role: 'user', content: reviewMsg }],
        sys(ROUND2_COMBINED_SYSTEM),
        {
          agentName: spec.name,
          errorContext: { stage: 'cross-review', round: 2 },
        }
      )
  } else {
    const finalUser = clipInferenceText(
      buildFinalMsg(
        userPrompt,
        m.ra,
        m.rb,
        m.rc,
        m.aRev,
        m.bRev,
        m.cRev,
        config
      )
    )
    fn = () =>
      callGitHubModel(
        spec.model,
        [{ role: 'user', content: finalUser }],
        sys(FINAL_POSITION_SYSTEM),
        {
          agentName: spec.name,
          errorContext: { stage: 'final-positions', round: 3 },
        }
      )
  }

  const r = await tryModelCall(fn, {
    dispatch,
    agent,
    agentName: spec.name,
    stage,
    round: stage === 'round_1' ? 1 : stage === 'round_2' ? 2 : 3,
    getStatus,
  })

  if (typeof isActive === 'function' && !isActive()) return 'stale'

  const body =
    r.ok && 'value' in r
      ? r.value
      : 'placeholder' in r && r.placeholder
        ? r.placeholder
        : AGENT_TIMEOUT_MESSAGE

  if (stage === 'round_1') {
    dispatch({
      type: 'SET_AGENT_DONE',
      payload: { agent, response: body, endTime: Date.now() },
    })
  } else if (stage === 'round_2') {
    dispatch({
      type: 'SET_REVIEW_DONE',
      payload: { agent, review: body, endTime: Date.now() },
    })
  } else {
    dispatch({
      type: 'SET_FINAL_DONE',
      payload: { agent, position: body, endTime: Date.now() },
    })
  }

  return r.ok ? 'ok' : 'failed'
}

/**
 * Keep the soft-fail placeholder; clear the actionable voice error marker.
 * @param {import('react').Dispatch<unknown>} dispatch
 * @param {'a'|'b'|'c'} agent
 */
export function continueWithoutVoice(dispatch, agent) {
  dispatch({ type: 'CLEAR_VOICE_ERROR', payload: { agent } })
}

/**
 * Resume after reconnect using lastCompletedStage + stored materials.
 * @param {{
 *   dispatch: import('react').Dispatch<unknown>,
 *   getState: () => Record<string, unknown>,
 *   uiSettings: Record<string, unknown>,
 *   getStatus?: () => string,
 *   isActive?: () => boolean,
 * }} opts
 */
export async function resumeDebateFromCheckpoint(opts) {
  const { dispatch, getState, uiSettings, getStatus, isActive } = opts
  const state = getState()
  const err = state.error
  const errType =
    err && typeof err === 'object'
      ? /** @type {{ type?: string }} */ (err).type
      : null

  if (state.status === 'blocked' && errType && errType !== 'network') {
    return 'skipped'
  }

  dispatch({ type: 'RESUME_DEBATE' })
  dispatch({ type: 'SET_ERROR', payload: null })

  const synthesisEnabled = readBabelSynthesisEnabled()
  const lcs = state.lastCompletedStage

  if (typeof isActive === 'function' && !isActive()) return 'stale'

  if (lcs === 'finalPositions' || lcs === 'synthesis' || lcs === 'validation') {
    const m = materialsFromForgeState(getState())
    await runPipelineFromFinalsOnward({
      dispatch,
      uiSettings,
      userPrompt: String(getState().prompt ?? ''),
      config: getState().config,
      ra: m.ra,
      rb: m.rb,
      rc: m.rc,
      aRev: m.aRev,
      bRev: m.bRev,
      cRev: m.cRev,
      rebA: m.rebA,
      rebB: m.rebB,
      rebC: m.rebC,
      skipFinalModelCalls: true,
      precomputedFinals: { a: m.fa, b: m.fb, c: m.fc },
      synthesisEnabled,
      synthesisWinner: getState().synthesisWinner ?? null,
      getStatus,
      roles: getState().roles,
      criteria: getState().decisionCriteria ?? [],
    })
    return 'ok'
  }

  if (lcs === 'reviews') {
    const m = materialsFromForgeState(getState())
    await resumeFromReviews({
      dispatch,
      uiSettings,
      userPrompt: String(getState().prompt ?? ''),
      config: getState().config,
      ra: m.ra,
      rb: m.rb,
      rc: m.rc,
      aRev: m.aRev,
      bRev: m.bRev,
      cRev: m.cRev,
      synthesisEnabled,
      existingSynthesisWinner: getState().synthesisWinner ?? null,
      roles: getState().roles,
      criteria: getState().decisionCriteria ?? [],
      getStatus,
    })
    return 'ok'
  }

  if (lcs === 'round1') {
    const m = materialsFromForgeState(getState())
    await resumeFromRound1({
      dispatch,
      uiSettings,
      userPrompt: String(getState().prompt ?? ''),
      config: getState().config,
      ra: m.ra,
      rb: m.rb,
      rc: m.rc,
      synthesisEnabled,
      getStatus,
      roles: getState().roles,
      criteria: getState().decisionCriteria ?? [],
    })
    return 'ok'
  }

  // Incomplete round 1: fill missing usable voices, then continue.
  /** @type {('a'|'b'|'c')[]} */
  const agents = ['a', 'b', 'c']
  for (const agent of agents) {
    if (typeof isActive === 'function' && !isActive()) return 'stale'
    const m = materialsFromForgeState(getState())
    const existing = agent === 'a' ? m.ra : agent === 'b' ? m.rb : m.rc
    if (isUsableText(existing)) continue
    await retryVoiceCall({
      dispatch,
      state: getState(),
      agent,
      stage: 'round_1',
      getStatus,
      isActive,
    })
  }

  if (typeof isActive === 'function' && !isActive()) return 'stale'
  const m = materialsFromForgeState(getState())
  if (![m.ra, m.rb, m.rc].some(isUsableText)) {
    dispatch({
      type: 'SET_STATUS',
      payload: 'failed',
    })
    return 'failed'
  }

  await resumeFromRound1({
    dispatch,
    uiSettings,
    userPrompt: String(getState().prompt ?? ''),
    config: getState().config,
    ra: m.ra,
    rb: m.rb,
    rc: m.rc,
    synthesisEnabled,
    getStatus,
    roles: getState().roles,
    criteria: getState().decisionCriteria ?? [],
  })
  return 'ok'
}

function buildRound2Msg(forKey, responses, config) {
  const { agentA, agentB, agentC } = config
  const { agentA: a, agentB: b, agentC: c } = responses
  if (forKey === 'A') {
    return `Your original response was:\n${a}\n\nHere is how ${agentB.name} answered:\n${b}\n\nHere is how ${agentC.name} answered:\n${c}`
  }
  if (forKey === 'B') {
    return `Your original response was:\n${b}\n\nHere is how ${agentA.name} answered:\n${a}\n\nHere is how ${agentC.name} answered:\n${c}`
  }
  return `Your original response was:\n${c}\n\nHere is how ${agentA.name} answered:\n${a}\n\nHere is how ${agentB.name} answered:\n${b}`
}

function buildFinalMsg(prompt, ra, rb, rc, aRev, bRev, cRev, config) {
  const { agentA, agentB, agentC } = config
  return [
    `Original prompt:\n${prompt}`,
    `=== ${agentA.name} (round 1) ===\n${ra}`,
    `=== ${agentB.name} (round 1) ===\n${rb}`,
    `=== ${agentC.name} (round 1) ===\n${rc}`,
    `=== ${agentA.name} (round 2: cross-review & rebuttal) ===\n${aRev}`,
    `=== ${agentB.name} (round 2: cross-review & rebuttal) ===\n${bRev}`,
    `=== ${agentC.name} (round 2: cross-review & rebuttal) ===\n${cRev}`,
  ].join('\n\n')
}
