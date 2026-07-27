import {
  isInfrastructureBlocker,
  isVoiceSoftFail,
  softFailPlaceholder,
  statusAfterVoiceSoftFail,
  toBabelError,
} from '../lib/babelErrors.js'
import { isModelCallTimeoutError } from '../lib/modelCallErrors.js'

/**
 * Run a model call; soft-fail voice errors into state, rethrow infrastructure blockers.
 * Skips state writes when `isActive()` is false (stale attempt).
 *
 * @param {() => Promise<string>} fn
 * @param {{
 *   dispatch: import('react').Dispatch<unknown>,
 *   agent: 'a' | 'b' | 'c',
 *   agentName: string,
 *   stage: import('../lib/babelErrors.js').DebateStage | string,
 *   round?: number,
 *   getStatus?: () => string,
 *   isActive?: () => boolean,
 *   debateId?: string,
 *   attemptId?: string,
 * }} opts
 * @returns {Promise<
 *   | { ok: true, value: string, stale?: boolean }
 *   | { ok: false, timeout?: boolean, softFail?: boolean, stale?: boolean, error: import('../lib/babelErrors.js').BabelError, placeholder: string }
 * >}
 */
export async function tryModelCall(fn, opts) {
  const {
    dispatch,
    agent,
    agentName,
    stage,
    round,
    getStatus,
    isActive,
    debateId,
    attemptId,
  } = opts

  const stillActive = () =>
    typeof isActive !== 'function' ? true : Boolean(isActive())

  try {
    const value = await fn()
    if (!stillActive()) {
      return { ok: true, value, stale: true }
    }
    dispatch({ type: 'CLEAR_VOICE_ERROR', payload: { agent } })
    return { ok: true, value }
  } catch (e) {
    const babelErr = toBabelError(e, {
      scope: 'voice',
      stage,
      agentId: agent,
      agent: agentName,
      round,
    })
    if (debateId) {
      babelErr.technicalMessage = [
        babelErr.technicalMessage,
        `debateId=${debateId}`,
        attemptId ? `attemptId=${attemptId}` : null,
      ]
        .filter(Boolean)
        .join(' ')
    }

    if (!stillActive()) {
      return {
        ok: false,
        softFail: true,
        stale: true,
        error: babelErr,
        placeholder: softFailPlaceholder(babelErr),
      }
    }

    if (isInfrastructureBlocker(babelErr)) {
      throw babelErr
    }

    if (!isVoiceSoftFail(babelErr) && babelErr.scope === 'debate') {
      throw babelErr
    }

    const placeholder = softFailPlaceholder(babelErr)
    dispatch({
      type: 'SET_VOICE_ERROR',
      payload: { agent, error: babelErr },
    })
    const cur = typeof getStatus === 'function' ? getStatus() : 'running'
    dispatch({
      type: 'SET_STATUS',
      payload: statusAfterVoiceSoftFail(cur),
    })

    if (isModelCallTimeoutError(e) || babelErr.type === 'timeout') {
      return { ok: false, timeout: true, error: babelErr, placeholder }
    }
    return { ok: false, softFail: true, error: babelErr, placeholder }
  }
}
