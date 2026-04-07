import { memo } from 'react'
import { MessageSquareReply } from 'lucide-react'
import AgentTimeoutNotice from './AgentTimeoutNotice.jsx'
import AgentResponseBody from './AgentResponseBody.jsx'
import AgentThinking from './AgentThinking.jsx'
import AgentTimer from './AgentTimer.jsx'
import { isAgentTimeoutResponse } from '../lib/debateConstants.js'
import { classifyRebuttalStance } from '../lib/rebuttalStance.js'

const mdClass =
  'max-w-none text-[17px] leading-[1.85] text-[var(--text-secondary)] [&_a]:text-[var(--accent-forge)] [&_code]:rounded-[4px] [&_code]:bg-[var(--bg-raised)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:text-[var(--text-primary)] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5'

/** @param {{ stance: 'conceded' | 'held' | 'modified' }} props */
function StanceBadge({ stance }) {
  const map = {
    conceded: 'bg-[#DC2626]/15 text-[#B91C1C] ring-1 ring-[#DC2626]/30',
    held: 'bg-[#16A34A]/12 text-[#15803D] ring-1 ring-[#16A34A]/25',
    modified: 'bg-[#D97706]/12 text-[#B45309] ring-1 ring-[#D97706]/25',
  }
  const labels = {
    conceded: 'Conceded',
    held: 'Held firm',
    modified: 'Modified',
  }
  return (
    <span
      className={`inline-flex rounded-[4px] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${map[stance]}`}
    >
      {labels[stance]}
    </span>
  )
}

/**
 * @param {{
 *   agentSpec: { name: string, color: string },
 *   body: string,
 *   timer: { startTime: number | null, endTime: number | null },
 *   borderVar: string,
 *   dotClass: string,
 *   regionLabel: string,
 * }} props
 */
function RebuttalColumn({
  agentSpec,
  body,
  timer,
  borderVar,
  dotClass,
  regionLabel,
}) {
  const hasBody = typeof body === 'string' && body.length > 0
  const live = timer.startTime != null && timer.endTime == null
  const stance = classifyRebuttalStance(body)

  if (hasBody) {
    if (isAgentTimeoutResponse(body)) {
      return <AgentTimeoutNotice agentName={agentSpec.name} />
    }
    return (
      <article
        role="region"
        aria-label={regionLabel}
        className="forge-reveal-card rounded-forge-card overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)]"
        style={{ borderTopWidth: 2, borderTopColor: borderVar }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
                aria-hidden
              />
              <h4
                className="font-mono text-[10px] font-semibold tracking-wide"
                style={{ color: agentSpec.color }}
              >
                {agentSpec.name}
              </h4>
            </div>
            <span className="font-sans text-[11px] italic text-[var(--text-muted)]">
              responding to challenges
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StanceBadge stance={stance} />
            {timer.startTime != null ? (
              <AgentTimer
                startTime={timer.startTime}
                endTime={timer.endTime ?? null}
              />
            ) : null}
          </div>
        </div>
        <div className="border-t border-dashed border-[var(--border)] px-4 pb-4 pt-3">
          <AgentResponseBody rawText={body} markdownClassName={mdClass} />
        </div>
      </article>
    )
  }

  if (live) {
    return (
      <AgentThinking
        title={agentSpec.name}
        color={agentSpec.color}
        line="Responding to challenges…"
        startTime={timer.startTime}
        endTime={timer.endTime}
      />
    )
  }

  return (
    <div className="rounded-forge-card flex min-h-[140px] flex-col items-center justify-center border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/50 px-4 py-8">
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
 *   rebuttals: { a?: string | null, b?: string | null, c?: string | null },
 *   rebuttalTimers: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
 * }} props
 */
function RebuttalCard({ config, rebuttals, rebuttalTimers }) {
  const { agentA, agentB, agentC } = config
  const ra = rebuttals?.a ?? ''
  const rb = rebuttals?.b ?? ''
  const rc = rebuttals?.c ?? ''

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-dashed border-[var(--border)] pb-4">
        <div className="flex items-center gap-2">
          <MessageSquareReply
            className="h-4 w-4 shrink-0 text-[var(--accent-forge)]"
            aria-hidden
          />
          <h3 className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
            Round 3 — rebuttals
          </h3>
        </div>
        <p className="pl-6 text-xs leading-relaxed text-[var(--text-secondary)]">
          Each agent responds to challenges directed at them
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <RebuttalColumn
          agentSpec={agentA}
          body={ra}
          timer={rebuttalTimers.a}
          borderVar="var(--agent-a)"
          dotClass="bg-[var(--agent-a)]"
          regionLabel={`${agentA.name} rebuttal`}
        />
        <RebuttalColumn
          agentSpec={agentB}
          body={rb}
          timer={rebuttalTimers.b}
          borderVar="var(--agent-b)"
          dotClass="bg-[var(--agent-b)]"
          regionLabel={`${agentB.name} rebuttal`}
        />
        <RebuttalColumn
          agentSpec={agentC}
          body={rc}
          timer={rebuttalTimers.c}
          borderVar="var(--agent-c)"
          dotClass="bg-[var(--agent-c)]"
          regionLabel={`${agentC.name} rebuttal`}
        />
      </div>
    </section>
  )
}

export default memo(RebuttalCard)
