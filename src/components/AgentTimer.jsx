import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

/** @param {number} ms */
function formatElapsed(ms) {
  const sec = Math.max(0, ms) / 1000
  return `${sec.toFixed(1)}s`
}

/**
 * @param {{ startTime: number | null, endTime: number | null }} props
 */
export default function AgentTimer({ startTime, endTime }) {
  const [now, setNow] = useState(() => Date.now())
  const [flash, setFlash] = useState(false)
  const prevEndRef = useRef(endTime)

  useEffect(() => {
    if (endTime == null) {
      const id = window.setInterval(() => setNow(Date.now()), 100)
      return () => window.clearInterval(id)
    }
    const t = window.setTimeout(() => setNow(Date.now()), 0)
    return () => window.clearTimeout(t)
  }, [endTime])

  useEffect(() => {
    if (endTime != null && prevEndRef.current == null) {
      const t0 = window.setTimeout(() => {
        setFlash(true)
        window.setTimeout(() => setFlash(false), 600)
      }, 0)
      prevEndRef.current = endTime
      return () => window.clearTimeout(t0)
    }
    prevEndRef.current = endTime
    return undefined
  }, [endTime])

  if (startTime == null) return null

  const elapsedMs =
    endTime != null ? endTime - startTime : Math.max(0, now - startTime)

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[12px] text-[var(--text-muted)] transition-colors ease-out [transition-duration:600ms] ${
        flash ? 'text-[var(--agree)]' : ''
      }`}
    >
      {endTime != null ? (
        <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : null}
      {formatElapsed(elapsedMs)}
    </span>
  )
}
