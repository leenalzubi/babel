import { useCallback, useEffect, useRef, useState } from 'react'
import { callGitHubModel } from '../api/githubModelsClient.js'
import { AGENT_ROUND1_SYSTEM } from '../api/systemPrompts.js'
import { withRoleSystem } from '../lib/babelRoles.js'
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import {
  AGENT_TIMEOUT_MESSAGE,
  isUnavailableAgentResponse,
} from '../lib/debateConstants.js'
import {
  allVoicesRateLimited,
  isInfrastructureBlocker,
  maxRateLimitWaitMs,
  toBabelError,
} from '../lib/babelErrors.js'
import { normalizeDebateFailure } from '../lib/modelCallErrors.js'
import { clipInferenceText } from '../lib/clipInferenceText.js'
import { readBabelSynthesisEnabled } from '../lib/babelSynthesisPref.js'
import { copyToClipboard, exportToMarkdown } from '../utils/exportUtils.js'
import { useForge } from '../store/useForgeStore.js'
import {
  retryDebateAudit,
  retryInfluenceAnalysis,
  runPipelineAfterRound1,
  runSynthesisOnly,
} from './debatePipeline.js'
import {
  continueWithoutVoice,
  resumeDebateFromCheckpoint,
  retryVoiceCall,
} from './stageRecovery.js'
import { tryModelCall } from './tryModelCall.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @param {import('react').Dispatch<unknown>} dispatch
 */
function bump(dispatch) {
  dispatch({ type: 'INCREMENT_PROGRESS_CALLS', payload: 1 })
}

/**
 * @param {string} text
 */
function isUsableRound1(text) {
  return (
    typeof text === 'string' &&
    text.length > 0 &&
    !isUnavailableAgentResponse(text)
  )
}

export function useDebateEngine() {
  const { dispatch, state } = useForge()
  const stateRef = useRef(state)
  stateRef.current = state
  const { settings: uiSettings } = useForgeUiSettings()
  const uiSettingsRef = useRef(uiSettings)
  uiSettingsRef.current = uiSettings

  /** Bumps on each new debate so late responses from an old run are ignored. */
  const runIdRef = useRef(0)
  const resumingRef = useRef(false)

  const [stageRetrying, setStageRetrying] = useState(
    /** @type {null | 'synthesis' | 'audit' | 'influence' | 'voice'} */ (null)
  )

  const runDebate = useCallback(
    async (prompt, config) => {
      const runId = ++runIdRef.current
      const debateId = `babel-${Date.now().toString(36)}-${runId}`
      const isActive = () => runIdRef.current === runId

      try {
        dispatch({ type: 'SET_ERROR', payload: null })
        const userPrompt =
          typeof prompt === 'string' ? prompt : String(prompt ?? '')
        dispatch({ type: 'SET_PROMPT', payload: userPrompt.trim() })
        dispatch({ type: 'SET_STATUS', payload: 'running' })
        dispatch({ type: 'SET_DEBATE_ID', payload: debateId })

        const promptClipped = clipInferenceText(userPrompt.trim(), 48_000)
        const getStatus = () => stateRef.current.status

        /** @type {'a' | 'b' | 'c'} */
        const agents = /** @type {const} */ (['a', 'b', 'c'])
        const specs = {
          a: config.agentA,
          b: config.agentB,
          c: config.agentC,
        }

        /** @type {Record<'a'|'b'|'c', string>} */
        const responses = {
          a: AGENT_TIMEOUT_MESSAGE,
          b: AGENT_TIMEOUT_MESSAGE,
          c: AGENT_TIMEOUT_MESSAGE,
        }

        for (const agent of agents) {
          if (!isActive()) return
          if (agent !== 'a') await pause(700)
          if (!isActive()) return
          const spec = specs[agent]
          const attemptId = `${debateId}-${agent}-r1`
          const t0 = Date.now()
          dispatch({
            type: 'SET_AGENT_THINKING',
            payload: { agent, startTime: t0 },
          })
          const r = await tryModelCall(
            () =>
              callGitHubModel(
                spec.model,
                [{ role: 'user', content: promptClipped }],
                withRoleSystem(
                  AGENT_ROUND1_SYSTEM,
                  stateRef.current.roles?.[agent],
                  stateRef.current.decisionCriteria
                ),
                {
                  agentName: spec.name,
                  errorContext: { stage: 'round1', round: 1 },
                }
              ),
            {
              dispatch,
              agent,
              agentName: spec.name,
              stage: 'round_1',
              round: 1,
              getStatus,
              isActive,
              debateId,
              attemptId,
            }
          )
          if (!isActive() || r.stale) return
          if (r.ok && 'value' in r) {
            responses[agent] = r.value
            dispatch({
              type: 'SET_AGENT_DONE',
              payload: {
                agent,
                response: r.value,
                endTime: Date.now(),
              },
            })
          } else {
            const body =
              'placeholder' in r && r.placeholder
                ? r.placeholder
                : AGENT_TIMEOUT_MESSAGE
            responses[agent] = body
            if (r.timeout) {
              dispatch({
                type: 'SET_AGENT_TIMEOUT',
                payload: { agent, endTime: Date.now() },
              })
            } else {
              dispatch({
                type: 'SET_AGENT_DONE',
                payload: {
                  agent,
                  response: body,
                  endTime: Date.now(),
                },
              })
            }
          }
          bump(dispatch)
        }

        if (!isActive()) return

        const { a: ra, b: rb, c: rc } = responses
        const usableCount = [ra, rb, rc].filter(isUsableRound1).length

        if (usableCount === 0) {
          const snapErrs = stateRef.current.voiceErrors
          if (allVoicesRateLimited(snapErrs)) {
            const waitMs = Math.max(maxRateLimitWaitMs(snapErrs), 15_000)
            const err = toBabelError(
              {
                type: 'rate_limit',
                title: 'Request limit reached',
                detail:
                  'This debate has reached the current GitHub Models request limit. Your completed responses are saved.',
                suggestion:
                  'Wait for the countdown, then retry Round 1. Completed work is preserved.',
                scope: 'infrastructure',
                retryAfterMs: waitMs,
                retryMode: 'delayed',
              },
              { scope: 'infrastructure', stage: 'round_1' }
            )
            dispatch({ type: 'SET_ERROR', payload: err })
            dispatch({ type: 'SET_STATUS', payload: 'blocked' })
            return
          }
          const allFiltered = [ra, rb, rc].every((t) =>
            String(t).toLowerCase().includes('content policy')
          )
          if (allFiltered) {
            const err = toBabelError(
              {
                type: 'content_filter',
                title: 'Prompt blocked',
                detail:
                  'All models filtered the initial prompt. Revise the prompt to continue.',
                suggestion: 'Edit the prompt, then run the debate again.',
                scope: 'debate',
              },
              { scope: 'debate', stage: 'round_1' }
            )
            dispatch({ type: 'SET_ERROR', payload: err })
            dispatch({ type: 'SET_STATUS', payload: 'blocked' })
            return
          }
          const err = toBabelError(
            new Error(
              'None of the selected models answered in time, so Babel cannot continue this debate.'
            ),
            { scope: 'debate', stage: 'round_1' }
          )
          dispatch({ type: 'SET_ERROR', payload: err })
          dispatch({ type: 'SET_STATUS', payload: 'failed' })
          return
        }

        dispatch({
          type: 'SET_LAST_COMPLETED_STAGE',
          payload: { stage: 'round1' },
        })

        const synthesisEnabled = readBabelSynthesisEnabled()
        await runPipelineAfterRound1({
          dispatch,
          uiSettings: uiSettingsRef.current,
          userPrompt,
          config,
          ra,
          rb,
          rc,
          synthesisEnabled,
          getStatus,
          roles: stateRef.current.roles,
          criteria: stateRef.current.decisionCriteria ?? [],
        })

        if (!isActive()) return

        const snap = stateRef.current
        const hasVoiceGaps = Boolean(
          snap.voiceErrors?.a ||
            snap.voiceErrors?.b ||
            snap.voiceErrors?.c ||
            snap.stageErrors?.audit ||
            snap.stageErrors?.influence ||
            snap.stageErrors?.synthesis ||
            snap.auditError
        )
        if (snap.status !== 'blocked' && snap.status !== 'failed') {
          dispatch({
            type: 'SET_STATUS',
            payload: hasVoiceGaps ? 'complete_with_gaps' : 'complete',
          })
        }
      } catch (err) {
        if (!isActive()) return
        const babelErr = normalizeDebateFailure(err, {
          scope: isInfrastructureBlocker(/** @type {any} */ (err))
            ? 'infrastructure'
            : 'debate',
        })
        dispatch({ type: 'SET_ERROR', payload: babelErr })
        dispatch({
          type: 'SET_STATUS',
          payload: isInfrastructureBlocker(babelErr) ? 'blocked' : 'failed',
        })
      }
    },
    [dispatch]
  )

  const resumeAfterReconnect = useCallback(async () => {
    if (resumingRef.current) return
    const snap = stateRef.current
    const err = snap.error
    const errType =
      err && typeof err === 'object'
        ? /** @type {{ type?: string }} */ (err).type
        : null
    if (snap.status !== 'blocked' || errType !== 'network') return

    resumingRef.current = true
    const runId = ++runIdRef.current
    try {
      await resumeDebateFromCheckpoint({
        dispatch,
        getState: () => stateRef.current,
        uiSettings: uiSettingsRef.current,
        getStatus: () => stateRef.current.status,
        isActive: () => runIdRef.current === runId,
      })
      if (runIdRef.current !== runId) return
      const after = stateRef.current
      const hasGaps = Boolean(
        after.voiceErrors?.a ||
          after.voiceErrors?.b ||
          after.voiceErrors?.c ||
          after.stageErrors?.audit ||
          after.stageErrors?.influence ||
          after.stageErrors?.synthesis ||
          after.auditError
      )
      if (after.status !== 'blocked' && after.status !== 'failed') {
        dispatch({
          type: 'SET_STATUS',
          payload: hasGaps ? 'complete_with_gaps' : 'complete',
        })
      }
    } catch (err) {
      if (runIdRef.current !== runId) return
      const babelErr = normalizeDebateFailure(err, {
        scope: 'infrastructure',
      })
      dispatch({ type: 'SET_ERROR', payload: babelErr })
      dispatch({
        type: 'SET_STATUS',
        payload: isInfrastructureBlocker(babelErr) ? 'blocked' : 'failed',
      })
    } finally {
      resumingRef.current = false
    }
  }, [dispatch])

  useEffect(() => {
    const onOnline = () => {
      void resumeAfterReconnect()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [resumeAfterReconnect])

  const resetAndRetry = useCallback(() => {
    const snap = stateRef.current
    const p = snap.prompt
    const c = snap.config
    runIdRef.current += 1
    dispatch({ type: 'RESET' })
    dispatch({ type: 'SET_PROMPT', payload: p })
    void runDebate(p, c)
  }, [dispatch, runDebate])

  const resetForEditPrompt = useCallback(() => {
    runIdRef.current += 1
    const snap = stateRef.current
    const p = snap.prompt
    dispatch({ type: 'RESET' })
    dispatch({ type: 'SET_PROMPT', payload: p })
  }, [dispatch])

  const retrySynthesis = useCallback(async () => {
    if (stageRetrying) return
    setStageRetrying('synthesis')
    try {
      await runSynthesisOnly({
        dispatch,
        state: stateRef.current,
        getStatus: () => stateRef.current.status,
      })
    } finally {
      setStageRetrying(null)
    }
  }, [dispatch, stageRetrying])

  const finishWithoutSynthesis = useCallback(() => {
    dispatch({
      type: 'SET_STAGE_ERROR',
      payload: { stage: 'synthesis', error: null },
    })
    const snap = stateRef.current
    const stillGaps = Boolean(
      snap.voiceErrors?.a ||
        snap.voiceErrors?.b ||
        snap.voiceErrors?.c ||
        snap.stageErrors?.audit ||
        snap.stageErrors?.influence ||
        snap.auditError
    )
    if (
      snap.status === 'complete' ||
      snap.status === 'complete_with_gaps' ||
      snap.status === 'degraded'
    ) {
      dispatch({
        type: 'SET_STATUS',
        payload: stillGaps ? 'complete_with_gaps' : 'complete',
      })
    }
  }, [dispatch])

  const retryAudit = useCallback(() => {
    if (stageRetrying) return
    setStageRetrying('audit')
    try {
      retryDebateAudit(dispatch, stateRef.current)
    } finally {
      setStageRetrying(null)
    }
  }, [dispatch, stageRetrying])

  const retryInfluence = useCallback(async () => {
    if (stageRetrying) return
    setStageRetrying('influence')
    try {
      await retryInfluenceAnalysis(dispatch, stateRef.current)
    } finally {
      setStageRetrying(null)
    }
  }, [dispatch, stageRetrying])

  const retryVoice = useCallback(
    async (/** @type {'a'|'b'|'c'} */ agent, stage) => {
      if (stageRetrying) return
      setStageRetrying('voice')
      const debateRunId = runIdRef.current
      try {
        await retryVoiceCall({
          dispatch,
          state: stateRef.current,
          agent,
          stage,
          getStatus: () => stateRef.current.status,
          isActive: () => runIdRef.current === debateRunId,
        })
      } finally {
        setStageRetrying(null)
      }
    },
    [dispatch, stageRetrying]
  )

  const continueWithout = useCallback(
    (/** @type {'a'|'b'|'c'} */ agent) => {
      continueWithoutVoice(dispatch, agent)
    },
    [dispatch]
  )

  const copyPartialTranscript = useCallback(async () => {
    const md = exportToMarkdown(stateRef.current)
    return copyToClipboard(md)
  }, [])

  return {
    runDebate,
    resetAndRetry,
    resetForEditPrompt,
    retrySynthesis,
    finishWithoutSynthesis,
    retryAudit,
    retryInfluence,
    retryVoice,
    continueWithout,
    copyPartialTranscript,
    resumeAfterReconnect,
    stageRetrying,
  }
}
