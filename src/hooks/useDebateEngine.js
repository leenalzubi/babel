import { useCallback, useRef } from 'react'
import { callGitHubModel } from '../api/githubModelsClient.js'
import {
  AGENT_A_ROUND1_SYSTEM,
  AGENT_B_ROUND1_SYSTEM,
  AGENT_C_ROUND1_SYSTEM,
} from '../api/systemPrompts.js'
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import {
  AGENT_TIMEOUT_MESSAGE,
  isAgentTimeoutResponse,
} from '../lib/debateConstants.js'
import {
  isModelCallTimeoutError,
  normalizeDebateFailure,
} from '../lib/modelCallErrors.js'
import { clipInferenceText } from '../lib/clipInferenceText.js'
import { semanticDivergence } from '../lib/cosineSimilarity.js'
import { getEmbedding } from '../lib/getEmbedding.js'
import { readBabelSynthesisEnabled } from '../lib/babelSynthesisPref.js'
import { logDebate } from '../lib/logDebate.js'
import { useForge } from '../store/useForgeStore.js'
import {
  resumeFromReviews,
  resumeFromRound1,
  runPipelineAfterRound1,
  runPipelineFromFinalsOnward,
  scheduleDebateAudit,
} from './debatePipeline.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @param {import('react').Dispatch<unknown>} dispatch
 */
function bump(dispatch) {
  dispatch({ type: 'INCREMENT_PROGRESS_CALLS', payload: 1 })
}

/**
 * @template T
 * @param {() => Promise<T>} fn
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

/** @param {string | null} stage */
function stageLabel(stage) {
  if (!stage) return 'last stage'
  const map = {
    round1: 'Round 1',
    reviews: 'Round 2 (cross-review & rebuttal)',
    rebuttals: 'rebuttals',
    finalPositions: 'final positions',
    synthesis: 'synthesis',
    audit: 'audit',
    validation: 'validation',
  }
  return map[stage] ?? String(stage)
}

export function useDebateEngine() {
  const { dispatch, state } = useForge()
  const stateRef = useRef(state)
  stateRef.current = state
  const { settings: uiSettings } = useForgeUiSettings()

  const runDebate = useCallback(
    async (prompt, config) => {
      try {
        dispatch({ type: 'SET_ERROR', payload: null })
        const userPrompt = typeof prompt === 'string' ? prompt : String(prompt ?? '')
        dispatch({ type: 'SET_PROMPT', payload: userPrompt.trim() })
        dispatch({ type: 'SET_STATUS', payload: 'running' })

        const promptClipped = clipInferenceText(userPrompt.trim(), 48_000)

        const tA0 = Date.now()
        dispatch({
          type: 'SET_AGENT_THINKING',
          payload: { agent: 'a', startTime: tA0 },
        })
        let ra = AGENT_TIMEOUT_MESSAGE
        {
          const r = await tryModel(() =>
            callGitHubModel(
              config.agentA.model,
              [{ role: 'user', content: promptClipped }],
              AGENT_A_ROUND1_SYSTEM,
              {
                agentName: config.agentA.name,
                errorContext: { stage: 'round1', round: 1 },
              }
            )
          )
          if (r.ok && 'value' in r) {
            ra = r.value
            dispatch({
              type: 'SET_AGENT_DONE',
              payload: { agent: 'a', response: ra, endTime: Date.now() },
            })
          } else {
            dispatch({
              type: 'SET_AGENT_TIMEOUT',
              payload: { agent: 'a', endTime: Date.now() },
            })
          }
          bump(dispatch)
        }

        await pause(700)
        const tB0 = Date.now()
        dispatch({
          type: 'SET_AGENT_THINKING',
          payload: { agent: 'b', startTime: tB0 },
        })
        let rb = AGENT_TIMEOUT_MESSAGE
        {
          const r = await tryModel(() =>
            callGitHubModel(
              config.agentB.model,
              [{ role: 'user', content: promptClipped }],
              AGENT_B_ROUND1_SYSTEM,
              {
                agentName: config.agentB.name,
                errorContext: { stage: 'round1', round: 1 },
              }
            )
          )
          if (r.ok && 'value' in r) {
            rb = r.value
            dispatch({
              type: 'SET_AGENT_DONE',
              payload: { agent: 'b', response: rb, endTime: Date.now() },
            })
          } else {
            dispatch({
              type: 'SET_AGENT_TIMEOUT',
              payload: { agent: 'b', endTime: Date.now() },
            })
          }
          bump(dispatch)
        }

        await pause(700)
        const tC0 = Date.now()
        dispatch({
          type: 'SET_AGENT_THINKING',
          payload: { agent: 'c', startTime: tC0 },
        })
        let rc = AGENT_TIMEOUT_MESSAGE
        {
          const r = await tryModel(() =>
            callGitHubModel(
              config.agentC.model,
              [{ role: 'user', content: promptClipped }],
              AGENT_C_ROUND1_SYSTEM,
              {
                agentName: config.agentC.name,
                errorContext: { stage: 'round1', round: 1 },
              }
            )
          )
          if (r.ok && 'value' in r) {
            rc = r.value
            dispatch({
              type: 'SET_AGENT_DONE',
              payload: { agent: 'c', response: rc, endTime: Date.now() },
            })
          } else {
            dispatch({
              type: 'SET_AGENT_TIMEOUT',
              payload: { agent: 'c', endTime: Date.now() },
            })
          }
          bump(dispatch)
        }

        if (
          isAgentTimeoutResponse(ra) &&
          isAgentTimeoutResponse(rb) &&
          isAgentTimeoutResponse(rc)
        ) {
          throw new Error(
            'All three models timed out in round 1. Check your connection or try again.'
          )
        }

        dispatch({
          type: 'SET_LAST_COMPLETED_STAGE',
          payload: { stage: 'round1' },
        })

        const synthesisEnabled = readBabelSynthesisEnabled()
        await runPipelineAfterRound1({
          dispatch,
          uiSettings,
          userPrompt,
          config,
          ra,
          rb,
          rc,
          synthesisEnabled,
        })
      } catch (err) {
        const snap = stateRef.current
        const lastStage = snap.lastCompletedStage
        if (lastStage) {
          dispatch({ type: 'SET_PARTIAL', payload: true })
          dispatch({ type: 'SET_STATUS', payload: 'partial' })
          dispatch({ type: 'SET_ERROR', payload: null })
          void logDebate({
            prompt: snap.prompt,
            rounds: snap.rounds,
            reviews: snap.reviews,
            rebuttals: snap.rebuttals,
            finalPositions: snap.finalPositions,
            divergenceScores: snap.divergenceScores,
            synthesis: snap.synthesis,
            validation: snap.validation,
            config: snap.config,
            is_partial: true,
            last_completed_stage: lastStage,
            timeout_count: snap.timeoutCount,
          })
        } else {
          dispatch({ type: 'SET_ERROR', payload: normalizeDebateFailure(err) })
          dispatch({ type: 'SET_STATUS', payload: 'error' })
        }
      }
    },
    [dispatch, uiSettings]
  )

  const resumeDebate = useCallback(
    async (/** @type {string} */ fromStage) => {
      const snap = state
      const userPrompt = snap.prompt
      const config = snap.config
      const r0 = snap.rounds.find((r) => r.roundNum === 1)
      const ra = String(r0?.agentA ?? snap.agentResponses?.a ?? '')
      const rb = String(r0?.agentB ?? snap.agentResponses?.b ?? '')
      const rc = String(r0?.agentC ?? snap.agentResponses?.c ?? '')
      const rev = snap.reviews.find((r) => r.roundNum === 1)
      const aRev = String(rev?.aReviews ?? snap.reviewResponses?.a ?? '')
      const bRev = String(rev?.bReviews ?? snap.reviewResponses?.b ?? '')
      const cRev = String(rev?.cReviews ?? snap.reviewResponses?.c ?? '')
      const rbRef = snap.rebuttals ?? { a: '', b: '', c: '' }
      const rebA = String(rbRef.a ?? '')
      const rebB = String(rbRef.b ?? '')
      const rebC = String(rbRef.c ?? '')
      const fp = snap.finalPositions ?? { a: '', b: '', c: '' }
      const fa = String(fp.a ?? '')
      const fb = String(fp.b ?? '')
      const fc = String(fp.c ?? '')

      dispatch({ type: 'RESUME_DEBATE' })

      try {
        const synthesisEnabled = readBabelSynthesisEnabled()
        if (fromStage === 'round1') {
          await resumeFromRound1({
            dispatch,
            uiSettings,
            userPrompt,
            config,
            ra,
            rb,
            rc,
            synthesisEnabled,
          })
          return
        }
        if (fromStage === 'reviews') {
          await resumeFromReviews({
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
            synthesisEnabled,
          })
          return
        }
        if (fromStage === 'rebuttals') {
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
            synthesisEnabled,
          })
          return
        }
        if (fromStage === 'finalPositions') {
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
            skipFinalModelCalls: true,
            precomputedFinals: { a: fa, b: fb, c: fc },
            synthesisEnabled,
          })
          return
        }
        if (fromStage === 'synthesis') {
          const out = snap.synthesis?.output
            ? String(snap.synthesis.output)
            : ''
          if (!out) {
            throw new Error('No synthesis output to resume from.')
          }
          scheduleDebateAudit(dispatch, {
            config,
            prompt: userPrompt.trim(),
            round1: { agentA: ra, agentB: rb, agentC: rc },
            reviews: { aReviews: aRev, bReviews: bRev, cReviews: cRev },
            synthesis: { output: out },
          })
          dispatch({ type: 'SET_STATUS', payload: 'complete' })
        }
      } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: normalizeDebateFailure(e) })
        dispatch({ type: 'SET_STATUS', payload: 'error' })
      }
    },
    [dispatch, state, uiSettings]
  )

  const resetAndRetry = useCallback(() => {
    const snap = stateRef.current
    const p = snap.prompt
    const c = snap.config
    dispatch({ type: 'RESET' })
    dispatch({ type: 'SET_PROMPT', payload: p })
    void runDebate(p, c)
  }, [dispatch, runDebate])

  const resetForEditPrompt = useCallback(() => {
    const snap = stateRef.current
    const p = snap.prompt
    dispatch({ type: 'RESET' })
    dispatch({ type: 'SET_PROMPT', payload: p })
  }, [dispatch])

  return {
    runDebate,
    resumeDebate,
    stageLabel,
    resetAndRetry,
    resetForEditPrompt,
  }
}
