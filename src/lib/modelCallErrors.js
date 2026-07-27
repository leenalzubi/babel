import { TIMEOUT_ERROR_MESSAGE } from './debateConstants.js'
import {
  enrichBabelError,
  toBabelError,
} from './babelErrors.js'

/**
 * @param {unknown} e
 * @returns {boolean}
 */
export function isModelCallTimeoutError(e) {
  return (
    (e instanceof Error && e.message === TIMEOUT_ERROR_MESSAGE) ||
    (Boolean(e) &&
      typeof e === 'object' &&
      /** @type {{ type?: string }} */ (e).type === 'timeout')
  )
}

/**
 * Rich error object for SET_ERROR / ErrorBanner / voice cards.
 * @param {unknown} err
 * @param {{
 *   scope?: import('./babelErrors.js').ErrorScope,
 *   stage?: import('./babelErrors.js').DebateStage | string,
 *   agentId?: string,
 *   agent?: string,
 *   round?: number,
 *   attempt?: number,
 * }} [ctx]
 * @returns {import('./babelErrors.js').BabelError}
 */
export function normalizeDebateFailure(err, ctx) {
  return toBabelError(err, ctx)
}

/**
 * Attach Babel taxonomy fields onto a classified API error before throw.
 * @param {object} classified
 * @param {{ stage?: string, round?: number, scope?: import('./babelErrors.js').ErrorScope, agentId?: string }} [ctx]
 */
export function withBabelMeta(classified, ctx = {}) {
  return enrichBabelError({
    ...classified,
    type: /** @type {import('./babelErrors.js').ErrorType} */ (
      classified.type || 'unknown'
    ),
    scope: ctx.scope,
    stage: /** @type {any} */ (ctx.stage || classified.stage),
    round:
      typeof ctx.round === 'number'
        ? ctx.round
        : typeof classified.round === 'number'
          ? classified.round
          : undefined,
    agentId: ctx.agentId,
  })
}
