import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import TriangleConsensus from './TriangleConsensus.jsx'

const replyMd =
  'max-w-none text-sm leading-relaxed text-[var(--text-secondary)] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-[var(--text-primary)]'

/** @param {{ label: string, color: string, pct: number }} props */
function DivergenceChip({ label, color, pct }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-raised)] px-2.5 py-1 font-mono text-[10px] text-[var(--text-secondary)]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
      <span className="font-medium text-[var(--text-primary)]">{pct}%</span>
    </span>
  )
}

/**
 * @param {{ title: string, color: string, text: string }} props
 */
function RoundAgentPanel({ title, color, text }) {
  return (
    <div
      role="region"
      aria-label={`${title} response`}
      className="rounded-forge-card flex min-h-0 flex-col overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)] shadow-forge-card"
      style={{ borderTopWidth: 3, borderTopColor: color }}
    >
      <div className="px-4 pb-1 pt-4">
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-wide"
          style={{ color }}
        >
          {title}
        </span>
      </div>
      <div className="max-h-[360px] overflow-y-auto px-4 pb-4 pt-1">
        <ReactMarkdown className={replyMd}>{text}</ReactMarkdown>
      </div>
    </div>
  )
}

/** @param {{ scores: { ab: number, ac: number, bc: number }, initials: { a: string, b: string, c: string }, colors: { a: string, b: string, c: string } }} props */
function DivergenceRow({ scores, initials, colors }) {
  const pct = (n) => Math.min(100, Math.max(0, Math.round(Number(n) * 100)))
  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-[var(--border)] pt-6 md:flex-row md:items-center md:justify-between">
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
 * }} props
 */
function RoundCard({ roundNum, scores, round, config }) {
  const { agentA, agentB, agentC } = config

  const initials = {
    a: (agentA.name?.[0] ?? 'A').toUpperCase(),
    b: (agentB.name?.[0] ?? 'B').toUpperCase(),
    c: (agentC.name?.[0] ?? 'C').toUpperCase(),
  }

  const colors = { a: agentA.color, b: agentB.color, c: agentC.color }

  return (
    <section className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-forge-card sm:p-8">
      <h2 className="mb-6 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
        Round {roundNum} — independent responses
      </h2>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
        <RoundAgentPanel title={agentA.name} color={agentA.color} text={round.agentA} />
        <RoundAgentPanel title={agentB.name} color={agentB.color} text={round.agentB} />
        <RoundAgentPanel title={agentC.name} color={agentC.color} text={round.agentC} />
      </div>

      <DivergenceRow scores={scores} initials={initials} colors={colors} />
    </section>
  )
}

export default memo(RoundCard)
