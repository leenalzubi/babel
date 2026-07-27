import { useEffect, useRef } from 'react'
import { roleLabel } from '../lib/babelRoles.js'
import { useForge } from '../store/useForgeStore.js'

/**
 * Discrete polite announcements for voice lifecycle (§6 / §8).
 * Does not announce streaming tokens.
 */
export default function VoiceAnnouncer() {
  const { state } = useForge()
  const liveRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const prevTimers = useRef({
    agent: { ...state.agentTimers },
    review: { ...state.reviewTimers },
    final: { ...state.finalPositionTimers },
  })
  const prevErrors = useRef({ ...state.voiceErrors })

  useEffect(() => {
    const announce = (msg) => {
      const el = liveRef.current
      if (!el) return
      el.textContent = ''
      // Force a DOM change so polite regions re-announce.
      window.requestAnimationFrame(() => {
        el.textContent = msg
      })
    }

    for (const key of /** @type {const} */ (['a', 'b', 'c'])) {
      const specs = {
        a: state.config.agentA,
        b: state.config.agentB,
        c: state.config.agentC,
      }
      const role = roleLabel(state.roles?.[key])
      const model = specs[key]?.name ?? 'model'

      const buckets = [
        ['agent', state.agentTimers, prevTimers.current.agent],
        ['review', state.reviewTimers, prevTimers.current.review],
        ['final', state.finalPositionTimers, prevTimers.current.final],
      ]
      for (const [, curMap, prevMap] of buckets) {
        const cur = curMap?.[key]
        const prev = prevMap?.[key]
        if (cur?.startTime != null && prev?.startTime == null) {
          announce(`${role} (${model}) started responding.`)
        }
        if (
          cur?.endTime != null &&
          prev?.endTime == null &&
          cur?.startTime != null
        ) {
          announce(`${role} (${model}) response complete.`)
        }
      }

      const err = state.voiceErrors?.[key]
      const prevErr = prevErrors.current?.[key]
      if (err && !prevErr) {
        announce(`${role} (${model}) response failed.`)
      }
    }

    prevTimers.current = {
      agent: { ...state.agentTimers },
      review: { ...state.reviewTimers },
      final: { ...state.finalPositionTimers },
    }
    prevErrors.current = { ...state.voiceErrors }
  }, [
    state.agentTimers,
    state.reviewTimers,
    state.finalPositionTimers,
    state.voiceErrors,
    state.roles,
    state.config,
  ])

  return (
    <div
      ref={liveRef}
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
    />
  )
}
