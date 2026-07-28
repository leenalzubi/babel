import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useEasterEggDiscovery } from '../../hooks/useEasterEggDiscovery.js'

const VIEWPORT_CARD_INSET = 12

/**
 * Keep the card fully visible in the viewport.
 * @param {HTMLElement} cardEl
 */
function clampCardInsideViewport(cardEl) {
  cardEl.style.marginLeft = ''
  cardEl.style.marginTop = ''

  const card = cardEl.getBoundingClientRect()
  const maxRight = window.innerWidth - VIEWPORT_CARD_INSET
  const maxBottom = window.innerHeight - VIEWPORT_CARD_INSET

  let shiftX = 0
  let shiftY = 0

  if (card.left < VIEWPORT_CARD_INSET) {
    shiftX = VIEWPORT_CARD_INSET - card.left
  } else if (card.right > maxRight) {
    shiftX = maxRight - card.right
  }

  if (card.top < VIEWPORT_CARD_INSET) {
    shiftY = VIEWPORT_CARD_INSET - card.top
  } else if (card.bottom > maxBottom) {
    shiftY = maxBottom - card.bottom
  }

  if (shiftX) cardEl.style.marginLeft = `${shiftX}px`
  if (shiftY) cardEl.style.marginTop = `${shiftY}px`
}

/**
 * Reusable discoverable hotspot with hover/focus/tap card.
 *
 * @param {{
 *   id: string,
 *   label: string,
 *   cardTitle?: string,
 *   className?: string,
 *   triggerClassName?: string,
 *   cardClassName?: string,
 *   placement?: 'below' | 'above' | 'start' | 'end',
 *   children: import('react').ReactNode,
 *   card: import('react').ReactNode,
 *   onOpen?: () => void,
 * }} props
 */
export default function EasterEgg({
  id,
  label,
  cardTitle,
  className = '',
  triggerClassName = '',
  cardClassName = '',
  placement = 'below',
  children,
  card,
  onOpen,
}) {
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const closeTimer = useRef(/** @type {number | null} */ (null))
  const [open, setOpen] = useState(false)
  /** When true, stay open through mouseleave until outside click / Escape / toggle. */
  const [pinned, setPinned] = useState(false)
  const cardId = useId()
  const { discover } = useEasterEggDiscovery()

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const close = useCallback(() => {
    clearCloseTimer()
    setPinned(false)
    setOpen(false)
  }, [clearCloseTimer])

  const openCard = useCallback(
    (options = {}) => {
      const pin = Boolean(options.pin)
      clearCloseTimer()
      setOpen(true)
      if (pin) setPinned(true)
      discover(id)
      onOpen?.()
    },
    [clearCloseTimer, discover, id, onOpen]
  )

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      closeTimer.current = null
    }, 140)
  }, [clearCloseTimer])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  useEffect(() => {
    if (!open) return

    /** @param {PointerEvent} event */
    const onPointerDown = (event) => {
      const root = rootRef.current
      if (!root) return
      if (event.target instanceof Node && !root.contains(event.target)) {
        close()
      }
    }

    /** @param {KeyboardEvent} event */
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        rootRef.current?.querySelector('button')?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  useLayoutEffect(() => {
    if (!open) return
    const root = rootRef.current
    const cardEl = root?.querySelector('.easter-egg-card')
    if (!(cardEl instanceof HTMLElement)) return

    const clamp = () => clampCardInsideViewport(cardEl)
    clamp()
    const raf = window.requestAnimationFrame(clamp)

    const onReflow = () => clamp()
    window.addEventListener('resize', onReflow)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', onReflow)
      cardEl.style.marginLeft = ''
      cardEl.style.marginTop = ''
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className={`easter-egg easter-egg--${placement}${open ? ' is-open' : ''}${pinned ? ' is-pinned' : ''} ${className}`.trim()}
      data-egg-id={id}
      onMouseEnter={() => openCard()}
      onMouseLeave={() => {
        if (!pinned) scheduleClose()
      }}
      onFocusCapture={() => openCard()}
      onBlurCapture={(event) => {
        if (pinned) return
        const root = rootRef.current
        const next = event.relatedTarget
        if (root && next instanceof Node && root.contains(next)) return
        scheduleClose()
      }}
    >
      <button
        type="button"
        className={`easter-egg-trigger ${triggerClassName}`.trim()}
        aria-expanded={open}
        aria-controls={cardId}
        aria-haspopup="dialog"
        aria-label={label}
        onClick={(event) => {
          event.preventDefault()
          if (open && pinned) {
            close()
            return
          }
          openCard({ pin: true })
        }}
      >
        {children}
      </button>

      <div
        id={cardId}
        role="dialog"
        aria-label={cardTitle || label}
        className={`easter-egg-card ${cardClassName}`.trim()}
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        {card}
      </div>
    </div>
  )
}
