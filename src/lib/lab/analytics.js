/**
 * Console analytics for Babel Lab (matches existing [babel:analytics] pattern).
 * Does not log private outputs.
 */

/**
 * @param {string} event
 * @param {Record<string, unknown>} [payload]
 */
export function trackLabEvent(event, payload = {}) {
  try {
    console.info('[babel:analytics]', {
      event,
      surface: 'lab',
      ...payload,
    })
  } catch {
    /* ignore */
  }
}
