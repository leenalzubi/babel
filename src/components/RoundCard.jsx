import { memo } from 'react'
import AgentTimeoutNotice from './AgentTimeoutNotice.jsx'
import AgentResponseBody from './AgentResponseBody.jsx'
import AgentThinking from './AgentThinking.jsx'
import AgentTimer from './AgentTimer.jsx'
import TriangleConsensus from './TriangleConsensus.jsx'
import { isAgentTimeoutResponse } from '../lib/debateConstants.js'

const replyMd =
  'max-w-none text-[17px] leading-[1.85] text-[var(--text-secondary)] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-[var(--text-primary)]'

/** @param {{ label: string, color: string, pct: number }} props */
function DivergenceChip({ label, color, pct }) {
  return (
    <span
      className="inline-flex flex-col items-center gap-0.5 rounded-[4px] border border-dashed border-[var(--border)] bg-transparent px-2 py-1.5 font-mono text-[10px] text-[var(--text-secondary)]"
      title="Semantic divergence: meaning similarity, not vocabulary overlap."
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        {label}
        <span className="font-medium text-[var(--text-primary)]">{pct}%</span>
      </span>
      <span className="text-[8px] font-normal tracking-wide text-[var(--text-muted)]">
        Semantic
      </span>
    </span>
  )
}

/**
 * @param {{ title: string, color: string, text: string, startTime: number | null, endTime: number | null }} props
 */
function RoundAgentPanel({ title, color, text, startTime, endTime }) {
  return (
    <div
      role="region"
      aria-label={`${title} response`}
      className="forge-reveal-card rounded-forge-card flex min-h-0 flex-col overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)]"
      style={{ borderTopWidth: 2, borderTopColor: color }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-4">
        <span
          className="font-mono text-[10px] font-semibold tracking-wide"
          style={{ color }}
        >
          {title}
        </span>
        {startTime != null ? (
          <AgentTimer startTime={startTime} endTime={endTime} />
        ) : null}
      </div>
      <div className="max-h-[360px] overflow-y-auto px-4 pb-4 pt-1">
        <AgentResponseBody rawText={text} markdownClassName={replyMd} />
      </div>
    </div>
  )
}

/**
 * @param {{ title: string, color: string }} props
 */
function RoundAgentWaiting({ title, color }) {
  return (
    <div className="rounded-forge-card flex min-h-[200px] flex-col items-center justify-center border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/50 px-4 py-10">
      <span
        className="font-mono text-[10px] font-semibold tracking-wide"
        style={{ color }}
      >
        {title}
      </span>
      <p className="mt-3 text-center text-sm italic text-[var(--text-muted)]">
        Waiting its turn
      </p>
    </div>
  )
}

/**
 * @param {{
 *   agentSpec: { name: string, color: string },
 *   responseText: string,
 *   timer: { startTime: number | null, endTime: number | null },
 * }} props
 */
function AgentRoundColumn({ agentSpec, responseText, timer }) {
  const hasResponse =
    typeof responseText === 'string' && responseText.length > 0
  const live =
    timer.startTime != null && timer.endTime == null

  if (hasResponse) {
    if (isAgentTimeoutResponse(responseText)) {
      return <AgentTimeoutNotice agentName={agentSpec.name} />
    }
    return (
      <RoundAgentPanel
        title={agentSpec.name}
        color={agentSpec.color}
        text={responseText}
        startTime={timer.startTime}
        endTime={timer.endTime}
      />
    )
  }

  if (live) {
    return (
      <AgentThinking
        title={agentSpec.name}
        color={agentSpec.color}
        line="Thinking through your prompt…"
        startTime={timer.startTime}
        endTime={timer.endTime}
      />
    )
  }

  return <RoundAgentWaiting title={agentSpec.name} color={agentSpec.color} />
}

/** @param {{ scores: { ab: number, ac: number, bc: number }, initials: { a: string, b: string, c: string }, colors: { a: string, b: string, c: string } }} props */
function DivergenceRow({ scores, initials, colors }) {
  const pct = (n) => Math.min(100, Math.max(0, Math.round(Number(n) * 100)))
  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-dashed border-[var(--border)] pt-6 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2">
        <DivergenceChip
          label={`${initials.a}–${initials.b}`}
          color={colors.a}
          pct={pct(scores.ab)}
        />
        <DivergenceChip
          label={`${initials.a}–${initials.c}`}
          color={colors.c}
          pct={pct(scores.ac)}
        />
        <DivergenceChip
          label={`${initials.b}–${initials.c}`}
          color={colors.b}
          pct={pct(scores.bc)}
        />
      </div>
      <div className="flex shrink-0 justify-center md:justify-end">
        <TriangleConsensus scores={scores} initials={initials} />
      </div>
    </div>
  )
}

/**
 * @param {{
 *   roundNum: number,
 *   scores: { ab: number, ac: number, bc: number, average: number },
 *   round: { agentA: string, agentB: string, agentC: string },
 *   config: {
 *     agentA: { name: string, color: string },
 *     agentB: { name: string, color: string },
 *     agentC: { name: string, color: string },
 *   },
 *   agentTimers: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
 * }} props
 */
function RoundCard({ roundNum, scores, round, config, agentTimers }) {
  const { agentA, agentB, agentC } = config

  const initials = {
    a: (agentA.name?.[0] ?? 'A').toUpperCase(),
    b: (agentB.name?.[0] ?? 'B').toUpperCase(),
    c: (agentC.name?.[0] ?? 'C').toUpperCase(),
  }

  const colors = { a: agentA.color, b: agentB.color, c: agentC.color }

  const showDivergence =
    round.agentA &&
    round.agentB &&
    round.agentC &&
    scores &&
    typeof scores.ab === 'number'

  return (
    <section className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-8">
      <h2 className="mb-6 border-b border-dashed border-[var(--border)] pb-4 font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
        Round {roundNum} — independent responses
      </h2>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
        <AgentRoundColumn
          agentSpec={agentA}
          responseText={round.agentA}
          timer={agentTimers.a}
        />
        <AgentRoundColumn
          agentSpec={agentB}
          responseText={round.agentB}
          timer={agentTimers.b}
        />
        <AgentRoundColumn
          agentSpec={agentC}
          responseText={round.agentC}
          timer={agentTimers.c}
        />
      </div>

      {showDivergence ? (
        <DivergenceRow scores={scores} initials={initials} colors={colors} />
      ) : null}
    </section>
  )
}

export default memo(RoundCard)
