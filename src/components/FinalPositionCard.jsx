import { memo, useMemo } from 'react'
import AgentTimeoutNotice from './AgentTimeoutNotice.jsx'
import AgentResponseBody from './AgentResponseBody.jsx'
import AgentThinking from './AgentThinking.jsx'
import AgentTimer from './AgentTimer.jsx'
import InfluenceMap from './InfluenceMap.jsx'
import { isAgentTimeoutResponse } from '../lib/debateConstants.js'

const replyMd =
  'max-w-none text-[17px] leading-[1.85] text-[var(--text-secondary)] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-[var(--text-primary)]'

/**
 * @param {{
 *   startTime: number | null,
 *   endTime: number | null,
 * }} t
 * @returns {number | null}
 */
function segmentMs(t) {
  if (t.startTime == null || t.endTime == null) return null
  return Math.max(0, t.endTime - t.startTime)
}

/**
 * @param {{
 *   agentKey: 'a' | 'b' | 'c',
 *   agentTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   reviewTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   rebuttalTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   finalPositionTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 * }} props
 */
function useTotalDebateMs({
  agentKey,
  agentTimers,
  reviewTimers,
  rebuttalTimers,
  finalPositionTimers,
}) {
  return useMemo(() => {
    const parts = [
      segmentMs(agentTimers[agentKey] ?? {}),
      segmentMs(reviewTimers[agentKey] ?? {}),
      segmentMs(rebuttalTimers[agentKey] ?? {}),
      segmentMs(finalPositionTimers[agentKey] ?? {}),
    ].filter((v) => v != null)
    if (parts.length === 0) return null
    return parts.reduce((a, b) => a + b, 0)
  }, [agentKey, agentTimers, reviewTimers, rebuttalTimers, finalPositionTimers])
}

/** @param {{ totalMs: number | null }} props */
function TotalDebateTimer({ totalMs }) {
  if (totalMs == null) {
    return (
      <span className="font-mono text-[9px] text-[var(--text-muted)]/60">—</span>
    )
  }
  const sec = Math.round(totalMs / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  const label =
    m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`
  return (
    <span
      className="font-mono text-[9px] text-[var(--text-muted)]"
      title="Total time this model spent generating in this debate"
    >
      {label} total
    </span>
  )
}

/**
 * @param {{
 *   agentSpec: { name: string, color: string },
 *   text: string,
 *   finalTimer: { startTime: number | null, endTime: number | null },
 *   totalMs: number | null,
 * }} props
 */
function FinalColumn({ agentSpec, text, finalTimer, totalMs }) {
  const hasText = typeof text === 'string' && text.length > 0
  const live =
    finalTimer.startTime != null && finalTimer.endTime == null

  if (hasText) {
    if (isAgentTimeoutResponse(text)) {
      return <AgentTimeoutNotice agentName={agentSpec.name} />
    }
    return (
      <div
        role="region"
        aria-label={`${agentSpec.name} final position`}
        className="forge-reveal-card rounded-forge-card flex min-h-0 flex-col overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)]"
        style={{ borderTopWidth: 2, borderTopColor: agentSpec.color }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className="font-mono text-[10px] font-semibold tracking-wide"
              style={{ color: agentSpec.color }}
            >
              {agentSpec.name}
            </span>
            <span className="font-sans text-[11px] italic text-[var(--text-muted)]">
              final position
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {finalTimer.startTime != null ? (
              <AgentTimer
                startTime={finalTimer.startTime}
                endTime={finalTimer.endTime}
              />
            ) : null}
            <TotalDebateTimer totalMs={totalMs} />
          </div>
        </div>
        <div className="forge-response-scroll px-4 pb-4 pt-1">
          <AgentResponseBody rawText={text} markdownClassName={replyMd} />
        </div>
      </div>
    )
  }

  if (live) {
    return (
      <AgentThinking
        title={agentSpec.name}
        color={agentSpec.color}
        line="Stating final position…"
        startTime={finalTimer.startTime}
        endTime={finalTimer.endTime}
      />
    )
  }

  return (
    <div className="rounded-forge-card flex min-h-[180px] flex-col items-center justify-center border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/50 px-4 py-8">
      <span
        className="font-mono text-[10px] font-semibold tracking-wide"
        style={{ color: agentSpec.color }}
      >
        {agentSpec.name}
      </span>
      <p className="mt-2 text-center text-sm italic text-[var(--text-muted)]">
        Waiting its turn
      </p>
    </div>
  )
}

/**
 * @param {{
 *   config: {
 *     agentA: { name: string, color: string },
 *     agentB: { name: string, color: string },
 *     agentC: { name: string, color: string },
 *   },
 *   finalPositions: { a?: string | null, b?: string | null, c?: string | null },
 *   finalPositionTimers: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
 *   agentTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   reviewTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   rebuttalTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   scores: { ab: number, ac: number, bc: number, average?: number } | null,
 *   influenceReport?: Record<string, unknown> | null,
 *   influenceLoading?: boolean,
 * }} props
 */
function FinalPositionCard({
  config,
  scores = null,
  finalPositions,
  finalPositionTimers,
  agentTimers,
  reviewTimers,
  rebuttalTimers,
  influenceReport = null,
  influenceLoading = false,
}) {
  const { agentA, agentB, agentC } = config
  const fa = finalPositions?.a ?? ''
  const fb = finalPositions?.b ?? ''
  const fc = finalPositions?.c ?? ''

  const initials = {
    a: (agentA.name?.[0] ?? 'A').toUpperCase(),
    b: (agentB.name?.[0] ?? 'B').toUpperCase(),
    c: (agentC.name?.[0] ?? 'C').toUpperCase(),
  }

  const totalA = useTotalDebateMs({
    agentKey: 'a',
    agentTimers,
    reviewTimers,
    rebuttalTimers,
    finalPositionTimers,
  })
  const totalB = useTotalDebateMs({
    agentKey: 'b',
    agentTimers,
    reviewTimers,
    rebuttalTimers,
    finalPositionTimers,
  })
  const totalC = useTotalDebateMs({
    agentKey: 'c',
    agentTimers,
    reviewTimers,
    rebuttalTimers,
    finalPositionTimers,
  })

  const showTriangle =
    scores != null &&
    typeof scores.ab === 'number' &&
    [fa, fb, fc].every(
      (t) => typeof t === 'string' && t.length > 0 && !isAgentTimeoutResponse(t)
    )

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-dashed border-[var(--border)] pb-4">
        <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
          Round 3
        </p>
        <h2
          className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.75rem]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Final positions
        </h2>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Each model&apos;s closing argument after the full debate
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FinalColumn
          agentSpec={agentA}
          text={fa}
          finalTimer={finalPositionTimers.a}
          totalMs={totalA}
        />
        <FinalColumn
          agentSpec={agentB}
          text={fb}
          finalTimer={finalPositionTimers.b}
          totalMs={totalB}
        />
        <FinalColumn
          agentSpec={agentC}
          text={fc}
          finalTimer={finalPositionTimers.c}
          totalMs={totalC}
        />
      </div>

      {showTriangle && scores ? (
        <div className="border-t border-dashed border-[var(--border)] pt-6">
          <InfluenceMap
            scores={scores}
            initials={initials}
            config={config}
            influenceReport={influenceReport}
            influenceLoading={influenceLoading}
            showPositionTracks
          />
        </div>
      ) : null}
    </section>
  )
}

export default memo(FinalPositionCard)
