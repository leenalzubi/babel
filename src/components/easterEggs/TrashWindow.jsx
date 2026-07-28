import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  TrashFileMdIcon,
  TrashFilePdfIcon,
  TrashFileZipIcon,
} from './TrashIcons.jsx'

/** @typedef {'minsky-pdf' | 'easter-eggs-md' | 'stickers-zip'} TrashFileId */

/** @type {{ id: TrashFileId, name: string, kind: 'pdf' | 'md' | 'zip', errorBody: string }[]} */
const TRASH_FILES = [
  {
    id: 'minsky-pdf',
    name: "Minsky's Vision and the Coming AI-Induced Crash.pdf",
    kind: 'pdf',
    errorBody: 'Preview unavailable. The prediction remains unresolved.',
  },
  {
    id: 'easter-eggs-md',
    name: 'website easter eggs.md',
    kind: 'md',
    errorBody: 'Recursive reference detected.',
  },
  {
    id: 'stickers-zip',
    name: 'iMessage Stickers.zip',
    kind: 'zip',
    errorBody: 'This attachment cannot be rendered in the current environment.',
  },
]

/**
 * Floating Trash window with unopenable remnant files.
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   triggerRef?: import('react').RefObject<HTMLElement | null>,
 * }} props
 */
export default function TrashWindow({ open, onClose, triggerRef }) {
  const titleId = useId()
  const closeBtnRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const errorCloseRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const [selectedId, setSelectedId] = useState(
    /** @type {TrashFileId | null} */ (null)
  )
  /** @type {'file' | 'empty' | null} */
  const [errorKind, setErrorKind] = useState(null)
  const lastTapRef = useRef(
    /** @type {{ id: TrashFileId | null, time: number }} */ ({
      id: null,
      time: 0,
    })
  )

  const clearError = useCallback(() => {
    setErrorKind(null)
  }, [])

  const closeAll = useCallback(() => {
    setErrorKind(null)
    setSelectedId(null)
    onClose()
  }, [onClose])

  const attemptOpen = useCallback((/** @type {TrashFileId} */ id) => {
    setSelectedId(id)
    setErrorKind('file')
  }, [])

  const attemptEmpty = useCallback(() => {
    setErrorKind('empty')
  }, [])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open || !errorKind) return
    const t = window.setTimeout(() => {
      errorCloseRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open, errorKind])

  useEffect(() => {
    if (!open) return

    /** @param {KeyboardEvent} event */
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (errorKind) {
        clearError()
        return
      }
      closeAll()
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, errorKind, clearError, closeAll])

  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    const trigger = triggerRef?.current
    if (trigger && typeof trigger.focus === 'function') {
      trigger.focus()
    }
  }, [open, triggerRef])

  if (!open) return null

  const selected = TRASH_FILES.find((f) => f.id === selectedId) ?? null
  const errorTitle = 'Unable to open file'
  const errorBody =
    errorKind === 'empty'
      ? 'Some files resist deletion.'
      : selected?.errorBody ?? ''
  const errorHeading =
    errorKind === 'empty' ? 'Unable to empty Trash' : errorTitle

  return (
    <div className="babel-trash-root">
      <div
        className="babel-trash-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="babel-trash-titlebar">
          <h2 id={titleId} className="babel-trash-title">
            Trash
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="babel-trash-close"
            aria-label="Close Trash"
            onClick={closeAll}
          >
            Close
          </button>
        </div>

        <ul className="babel-trash-list" aria-label="Trash contents">
          {TRASH_FILES.map((file) => {
            const selected = selectedId === file.id
            return (
              <li key={file.id}>
                <button
                  type="button"
                  className={`babel-trash-item${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => {
                    const now = Date.now()
                    const last = lastTapRef.current
                    const isDouble =
                      last.id === file.id && now - last.time < 450
                    lastTapRef.current = { id: file.id, time: now }
                    if (isDouble) {
                      attemptOpen(file.id)
                      return
                    }
                    setSelectedId(file.id)
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    attemptOpen(file.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      attemptOpen(file.id)
                    }
                  }}
                >
                  <span className="babel-trash-item-icon" aria-hidden>
                    {file.kind === 'pdf' ? (
                      <TrashFilePdfIcon />
                    ) : file.kind === 'md' ? (
                      <TrashFileMdIcon />
                    ) : (
                      <TrashFileZipIcon />
                    )}
                  </span>
                  <span className="babel-trash-item-name">{file.name}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="babel-trash-actions">
          <button
            type="button"
            className="babel-trash-action"
            disabled={!selectedId}
            onClick={() => {
              if (selectedId) attemptOpen(selectedId)
            }}
          >
            Open
          </button>
          <button
            type="button"
            className="babel-trash-action babel-trash-action--quiet"
            onClick={attemptEmpty}
          >
            Empty Trash
          </button>
        </div>
      </div>

      {errorKind ? (
        <div
          className="babel-trash-error"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="babel-trash-error-title"
          aria-describedby="babel-trash-error-body"
        >
          <h3 id="babel-trash-error-title" className="babel-trash-error-title">
            {errorHeading}
          </h3>
          <p id="babel-trash-error-body" className="babel-trash-error-body">
            {errorBody}
          </p>
          <button
            ref={errorCloseRef}
            type="button"
            className="babel-trash-error-close"
            onClick={clearError}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  )
}
