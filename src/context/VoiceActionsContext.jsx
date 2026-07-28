import { createContext, useContext } from 'react'

/**
 * @typedef {{
 *   retryVoice: (agent: 'a'|'b'|'c', stage?: string) => void | Promise<void>,
 *   continueWithout: (agent: 'a'|'b'|'c') => void,
 *   voiceBusy?: boolean,
 * }} VoiceActions
 */

/** @type {import('react').Context<VoiceActions | null>} */
const VoiceActionsContext = createContext(null)

export function VoiceActionsProvider({ value, children }) {
  return (
    <VoiceActionsContext.Provider value={value}>
      {children}
    </VoiceActionsContext.Provider>
  )
}

export function useVoiceActions() {
  return useContext(VoiceActionsContext)
}
