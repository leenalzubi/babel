import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { loadForgeSettings, saveForgeSettings } from '../lib/forgeSettings.js'
import { useForge } from '../store/useForgeStore.js'

/** @typedef {{ maxRounds: number, synthesisMode: 'always' | 'divergence', showRationale: boolean }} ForgeUiSettings */

const ForgeSettingsContext = createContext(null)

export function ForgeSettingsProvider({ children }) {
  const { dispatch } = useForge()
  const [settings, setSettings] = useState(() => loadForgeSettings())

  const applySettings = useCallback(
    /** @param {ForgeUiSettings} next */ (next) => {
      saveForgeSettings(next)
      setSettings(next)
      dispatch({ type: 'PATCH_CONFIG', payload: { maxRounds: next.maxRounds } })
    },
    [dispatch]
  )

  const value = useMemo(
    () => ({ settings, applySettings }),
    [settings, applySettings]
  )

  return (
    <ForgeSettingsContext.Provider value={value}>
      {children}
    </ForgeSettingsContext.Provider>
  )
}

/** @returns {{ settings: ForgeUiSettings, applySettings: (next: ForgeUiSettings) => void }} */
// eslint-disable-next-line react-refresh/only-export-components -- paired hook for this context module
export function useForgeUiSettings() {
  const ctx = useContext(ForgeSettingsContext)
  if (ctx == null) {
    throw new Error('useForgeUiSettings requires ForgeSettingsProvider')
  }
  return ctx
}
