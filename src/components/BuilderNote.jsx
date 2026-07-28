import { useCallback, useEffect, useId, useState } from 'react'

export const BUILDER_NOTE_STORAGE_KEY = 'babel-builder-note-dismissed'
const ILLUSTRATION_SRC = '/images/leen-illustration.png'

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
            src={ILLUSTRATION_SRC}
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
            Builder&apos;s note
          </h2>
          <p id={bodyId} className="builder-note-text">
            Babel does not claim that more AI reasoning is always better. It is
            an attempt to make disagreement easier to inspect, and bad certainty
            harder to fake.
          </p>
        </div>
      </div>
    </aside>
  )
}
