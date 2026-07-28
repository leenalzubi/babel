import {
  ARCHIVE_UNLOCK_COUNT,
  EASTER_EGG_IDS,
} from './catalog.js'

export const EASTER_EGG_STORAGE_KEY = 'babel.easterEggs.v1'

/**
 * @typedef {{
 *   discovered: string[],
 *   archiveUnlocked: boolean,
 *   archiveNoticePending: boolean,
 * }} EasterEggPersistedState
 */

/** @returns {EasterEggPersistedState} */
function emptyState() {
  return {
    discovered: [],
    archiveUnlocked: false,
    archiveNoticePending: false,
  }
}

/**
 * @param {unknown} raw
 * @returns {EasterEggPersistedState}
 */
export function normalizeEasterEggState(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base

  const discovered = Array.isArray(/** @type {{ discovered?: unknown }} */ (raw).discovered)
    ? /** @type {unknown[]} */ (
        /** @type {{ discovered: unknown[] }} */ (raw).discovered
      )
        .filter((id) => typeof id === 'string' && EASTER_EGG_IDS.includes(/** @type {*} */ (id)))
        .filter((id, i, arr) => arr.indexOf(id) === i)
    : []

  const archiveUnlocked =
    Boolean(/** @type {{ archiveUnlocked?: unknown }} */ (raw).archiveUnlocked) ||
    discovered.length >= ARCHIVE_UNLOCK_COUNT

  const archiveNoticePending = Boolean(
    /** @type {{ archiveNoticePending?: unknown }} */ (raw).archiveNoticePending
  )

  return { discovered, archiveUnlocked, archiveNoticePending }
}

/** @returns {EasterEggPersistedState} */
export function readEasterEggState() {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = window.localStorage.getItem(EASTER_EGG_STORAGE_KEY)
    if (!raw) return emptyState()
    return normalizeEasterEggState(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

/**
 * @param {EasterEggPersistedState} state
 */
function writeEasterEggState(state) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EASTER_EGG_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private mode */
  }
}

/** @type {EasterEggPersistedState} */
let memoryState = emptyState()
let hydrated = false

/** @type {Set<() => void>} */
const listeners = new Set()

function ensureHydrated() {
  if (hydrated) return
  hydrated = true
  memoryState = readEasterEggState()
}

function emit() {
  for (const listener of listeners) listener()
}

/** @returns {EasterEggPersistedState} */
export function getEasterEggState() {
  ensureHydrated()
  return memoryState
}

/**
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribeEasterEggs(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * @param {string} id
 * @returns {EasterEggPersistedState}
 */
export function markEasterEggDiscovered(id) {
  ensureHydrated()
  if (!EASTER_EGG_IDS.includes(/** @type {*} */ (id))) return memoryState
  if (memoryState.discovered.includes(id)) return memoryState

  const discovered = [...memoryState.discovered, id]
  const wasUnlocked = memoryState.archiveUnlocked
  const archiveUnlocked = discovered.length >= ARCHIVE_UNLOCK_COUNT
  const archiveNoticePending =
    archiveUnlocked && !wasUnlocked ? true : memoryState.archiveNoticePending

  memoryState = {
    discovered,
    archiveUnlocked,
    archiveNoticePending,
  }
  writeEasterEggState(memoryState)
  emit()
  return memoryState
}

/** Clear the one-shot archive unlock notice flag. */
export function clearArchiveNoticePending() {
  ensureHydrated()
  if (!memoryState.archiveNoticePending) return memoryState
  memoryState = { ...memoryState, archiveNoticePending: false }
  writeEasterEggState(memoryState)
  emit()
  return memoryState
}

/** @param {string} id */
export function isEasterEggDiscovered(id) {
  return getEasterEggState().discovered.includes(id)
}

/** Test helper — reset in-memory + storage. */
export function __resetEasterEggStoreForTests() {
  memoryState = emptyState()
  hydrated = true
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(EASTER_EGG_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
  emit()
}
