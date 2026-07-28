import { useEffect } from 'react'
import { useEasterEggDiscovery } from '../../hooks/useEasterEggDiscovery.js'
import { ARCHIVE_UNLOCK_NOTICE } from '../../lib/easterEggs/catalog.js'

/**
 * Quiet non-modal notice after the third discovery.
 * @param {{ onOpenArchive?: () => void }} props
 */
export default function ArchiveUnlockedNotice({ onOpenArchive }) {
  const { archiveNoticePending, dismissArchiveNotice, archiveUnlocked } =
    useEasterEggDiscovery()

  useEffect(() => {
    if (!archiveNoticePending) return
    const timer = window.setTimeout(() => {
      dismissArchiveNotice()
    }, 6000)
    return () => window.clearTimeout(timer)
  }, [archiveNoticePending, dismissArchiveNotice])

  if (!archiveNoticePending || !archiveUnlocked) return null

  return (
    <div
      className="easter-archive-notice"
      role="status"
      aria-live="polite"
    >
      <p className="easter-archive-notice-text">{ARCHIVE_UNLOCK_NOTICE}</p>
      {onOpenArchive ? (
        <button
          type="button"
          className="easter-archive-notice-link"
          onClick={() => {
            dismissArchiveNotice()
            onOpenArchive()
          }}
        >
          Open Archive
        </button>
      ) : null}
      <button
        type="button"
        className="easter-archive-notice-dismiss"
        aria-label="Dismiss archive notice"
        onClick={dismissArchiveNotice}
      >
        Dismiss
      </button>
    </div>
  )
}
