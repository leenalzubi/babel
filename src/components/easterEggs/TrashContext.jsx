import { createContext, useContext } from 'react'

/**
 * @typedef {{
 *   openTrash: (trigger?: HTMLElement | null) => void,
 * }} TrashContextValue
 */

/** @type {import('react').Context<TrashContextValue>} */
const TrashContext = createContext({
  openTrash: () => {},
})

export function TrashProvider({ value, children }) {
  return (
    <TrashContext.Provider value={value}>{children}</TrashContext.Provider>
  )
}

export function useTrash() {
  return useContext(TrashContext)
}
