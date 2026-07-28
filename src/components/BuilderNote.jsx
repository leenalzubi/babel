import { useCallback, useEffect, useId, useState } from 'react'
import {
  BUILDER_NOTE_BODY,
  BUILDER_NOTE_HEADING,
  CAT_AVATAR_SRC,
} from '../lib/easterEggs/catalog.js'

export const BUILDER_NOTE_STORAGE_KEY = 'babel-builder-note-dismissed'

function readDismissed() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(BUILDER_NOTE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Playful builder disclaimer card — bottom-right on desktop, adapted on mobile.
 * @param {{ suppressed?: boolean }} [props]
 */
export default function BuilderNote({ suppressed = false }) {
  const titleId = useId()
  const bodyId = useId()
  const [dismissed, setDismissed] = useState(true)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      window.localStorage.setItem(BUILDER_NOTE_STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (dismissed || suppressed) return
    /** @param {KeyboardEvent} event */
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        // Don't steal Escape from open dialogs / drawers
        if (
          document.querySelector(
            '[role="dialog"][aria-modal="true"], [role="alertdialog"]'
          )
        ) {
          return
        }
        event.preventDefault()
        dismiss()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dismissed, suppressed, dismiss])

  if (dismissed || suppressed) return null

  return (
    <aside
      className="builder-note"
      role="complementary"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      <button
        type="button"
        className="builder-note-close"
        aria-label="Dismiss builder's note"
        onClick={dismiss}
      >
        <span aria-hidden>×</span>
      </button>

      <div className="builder-note-art" aria-hidden>
        {imgFailed ? (
          <span className="builder-note-initials">L</span>
        ) : (
          <img
            className="builder-note-illustration"
            src={CAT_AVATAR_SRC}
            alt=""
            width={493}
            height={750}
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        )}
      </div>

      <div className="builder-note-body">
        <div className="builder-note-copy">
          <h2 id={titleId} className="builder-note-heading">
            {BUILDER_NOTE_HEADING}
          </h2>
          <p id={bodyId} className="builder-note-text">
            {BUILDER_NOTE_BODY}
          </p>
        </div>
      </div>
    </aside>
  )
}
