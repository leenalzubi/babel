import { LINEAGE_MODE_NOTICE } from '../../lib/easterEggs/catalog.js'

/**
 * @param {{ active: boolean, onExit: () => void }} props
 */
export default function LineageModeNotice({ active, onExit }) {
  if (!active) return null

  return (
    <div className="easter-lineage-notice" role="status" aria-live="polite">
      <p className="easter-lineage-notice-text">{LINEAGE_MODE_NOTICE}</p>
      <button
        type="button"
        className="easter-lineage-notice-exit"
        onClick={onExit}
      >
        Exit
      </button>
    </div>
  )
}
