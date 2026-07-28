import { useCallback, useSyncExternalStore } from 'react'
import {
  clearArchiveNoticePending,
  getEasterEggState,
  markEasterEggDiscovered,
  subscribeEasterEggs,
} from '../lib/easterEggs/discoveryStore.js'

export function useEasterEggDiscovery() {
  const state = useSyncExternalStore(
    subscribeEasterEggs,
    getEasterEggState,
    getEasterEggState
  )

  const discover = useCallback((/** @type {string} */ id) => {
    return markEasterEggDiscovered(id)
  }, [])

  const dismissArchiveNotice = useCallback(() => {
    clearArchiveNoticePending()
  }, [])

  return {
    discovered: state.discovered,
    archiveUnlocked: state.archiveUnlocked,
    archiveNoticePending: state.archiveNoticePending,
    discover,
    dismissArchiveNotice,
  }
}
