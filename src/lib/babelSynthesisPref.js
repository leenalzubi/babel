export const BABEL_SYNTHESIS_TOGGLE_EVENT = 'babel-synthesis-toggle'

export function readBabelSynthesisEnabled() {
  try {
    return localStorage.getItem('babel_synthesis_enabled') === 'true'
  } catch {
    return false
  }
}

export function dispatchBabelSynthesisToggled() {
  try {
    window.dispatchEvent(new Event(BABEL_SYNTHESIS_TOGGLE_EVENT))
  } catch {
    /* ignore */
  }
}
