export const FORGE_SETTINGS_KEY = 'the-forge-settings'

export const FORGE_SETTINGS_DEFAULTS = {
  maxRounds: 2,
  /** @type {'always' | 'divergence'} */
  synthesisMode: 'always',
  showRationale: true,
  /**
   * Influence map, divergence chips, and post-hoc audit trail.
   * Off by default: Phase C / evaluation surfaces, not the flagship path.
   */
  showResearchSurfaces: false,
}

/**
 * @returns {{
 *   maxRounds: number,
 *   synthesisMode: 'always' | 'divergence',
 *   showRationale: boolean,
 *   showResearchSurfaces: boolean,
 * }}
 */
export function loadForgeSettings() {
  try {
    const raw = localStorage.getItem(FORGE_SETTINGS_KEY)
    if (!raw) return { ...FORGE_SETTINGS_DEFAULTS }
    const parsed = JSON.parse(raw)
    return {
      ...FORGE_SETTINGS_DEFAULTS,
      maxRounds: clampRounds(parsed.maxRounds),
      synthesisMode:
        parsed.synthesisMode === 'divergence' ? 'divergence' : 'always',
      showRationale:
        parsed.showRationale === undefined
          ? true
          : Boolean(parsed.showRationale),
      showResearchSurfaces: Boolean(parsed.showResearchSurfaces),
    }
  } catch {
    return { ...FORGE_SETTINGS_DEFAULTS }
  }
}

/** @param {unknown} n */
function clampRounds(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return FORGE_SETTINGS_DEFAULTS.maxRounds
  return Math.min(3, Math.max(1, Math.round(x)))
}

/**
 * @param {{
 *   maxRounds: number,
 *   synthesisMode: 'always' | 'divergence',
 *   showRationale: boolean,
 *   showResearchSurfaces: boolean,
 * }} settings
 */
export function saveForgeSettings(settings) {
  const payload = {
    maxRounds: clampRounds(settings.maxRounds),
    synthesisMode:
      settings.synthesisMode === 'divergence' ? 'divergence' : 'always',
    showRationale: Boolean(settings.showRationale),
    showResearchSurfaces: Boolean(settings.showResearchSurfaces),
  }
  localStorage.setItem(FORGE_SETTINGS_KEY, JSON.stringify(payload))
}
