export const BABEL_SYNTHESIS_TOGGLE_EVENT = 'babel-synthesis-toggle'

/**
 * Synthesis is required on every debate. Kept as a function so call sites and
 * the workflow timeline stay stable if this ever becomes a gated flag again.
 */
export function readBabelSynthesisEnabled() {
  return true
}

export function dispatchBabelSynthesisToggled() {
  try {
    window.dispatchEvent(new Event(BABEL_SYNTHESIS_TOGGLE_EVENT))
  } catch {
    /* ignore */
  }
}
