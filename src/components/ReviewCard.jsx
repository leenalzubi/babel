import { memo } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import AgentResponseBody from './AgentResponseBody.jsx'
import AgentThinking from './AgentThinking.jsx'
import AgentTimer from './AgentTimer.jsx'

const mdClass =
  'max-w-none text-[17px] leading-[1.85] text-[var(--text-secondary)] [&_a]:text-[var(--accent-forge)] [&_code]:rounded-[4px] [&_code]:bg-[var(--bg-raised)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:text-[var(--text-primary)] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5'

/**
 * @param {{
 *   border: string
 *   titleColor: string
 *   dot: string
 *   title: string
 *   body: string
 *   regionLabel: string
 *   startTime?: number | null
 *   endTime?: number | null
 * }} props
 */
function CrossReviewAgentCard({
  border,
  titleColor,
  dot,
  title,
  body,
  regionLabel,
  startTime,
  endTime,
}) {
  return (
    <article
      role="region"
      aria-label={regionLabel}
      className="forge-reveal-card rounded-forge-card overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)]"
      style={{ borderTopWidth: 2, borderTopColor: border }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
            aria-hidden
          />
          <h4
            className="font-mono text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: titleColor }}
          >
            {title}
          </h4>
        </div>
        {startTime != null ? (
          <AgentTimer startTime={startTime} endTime={endTime ?? null} />
        ) : null}
      </div>
      <div className="border-t border-dashed border-[var(--border)] px-4 pb-4 pt-3">
        <AgentResponseBody rawText={body} markdownClassName={mdClass} />
      </div>
    </article>
  )
}

/**
 * @param {{ title: string, color: string }} props
 */
function CrossReviewWaiting({ title, color }) {
  return (
    <div className="rounded-forge-card flex min-h-[160px] flex-col items-center justify-center border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/50 px-4 py-8">
      <span
        className="font-mono text-[10px] font-semibold uppercase tracking-wide"
        style={{ color }}
      >
        {title}
      </span>
      <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
        Queued…
      </p>
    </div>
  )
}

/**
 * @param {{
 *   agentSpec: { name: string, color: string },
 *   otherNames: string,
 *   body: string,
 *   timer: { startTime: number | null, endTime: number | null },
 *   borderVar: string,
 *   dotClass: string,
 *   regionLabel: string,
 * }} props
 */
function ReviewAgentColumn({
  agentSpec,
  otherNames,
  body,
  timer,
  borderVar,
  dotClass,
  regionLabel,
}) {
  const hasBody = typeof body === 'string' && body.length > 0
  const live = timer.startTime != null && timer.endTime == null
  const titleDone = `${agentSpec.name} reviewing ${otherNames}`
  const color = agentSpec.color

  if (hasBody) {
    return (
      <CrossReviewAgentCard
        border={borderVar}
        titleColor={color}
        dot={dotClass}
        title={titleDone}
        regionLabel={regionLabel}
        body={body}
        startTime={timer.startTime}
        endTime={timer.endTime}
      />
    )
  }

  if (live) {
    return (
      <AgentThinking
        title={agentSpec.name}
        color={color}
        line="Reviewing the other agents' answers…"
        startTime={timer.startTime}
        endTime={timer.endTime}
      />
    )
  }

  return <CrossReviewWaiting title={agentSpec.name} color={color} />
}

/**
 * @param {{
 *   roundNum: number
 *   aReviews: string
 *   bReviews: string
 *   cReviews: string
 *   config: {
 *     agentA: { name: string, color: string }
 *     agentB: { name: string, color: string }
 *     agentC: { name: string, color: string }
 *   }
 *   reviewTimers: {
 *     a: { startTime: number | null, endTime: number | null }
 *     b: { startTime: number | null, endTime: number | null }
 *     c: { startTime: number | null, endTime: number | null }
 *   }
 * }} props
 */
function ReviewCard({
  roundNum,
  aReviews,
  bReviews,
  cReviews,
  config,
  reviewTimers,
}) {
  const { agentA, agentB, agentC } = config

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-dashed border-[var(--border)] pb-4">
        <div className="flex items-center gap-2">
          <ArrowLeftRight
            className="h-4 w-4 shrink-0 text-[var(--accent-forge)]"
            aria-hidden
          />
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Cross-Review — Round {roundNum}
          </h3>
        </div>
        <p className="pl-6 text-xs leading-relaxed text-[var(--text-secondary)]">
          Each agent reviewed the other two
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <ReviewAgentColumn
          agentSpec={agentA}
          otherNames={`${agentB.name} + ${agentC.name}`}
          body={aReviews}
          timer={reviewTimers.a}
          borderVar="var(--agent-a)"
          dotClass="bg-[var(--agent-a)]"
          regionLabel={`${agentA.name} cross-review`}
        />
        <ReviewAgentColumn
          agentSpec={agentB}
          otherNames={`${agentA.name} + ${agentC.name}`}
          body={bReviews}
          timer={reviewTimers.b}
          borderVar="var(--agent-b)"
          dotClass="bg-[var(--agent-b)]"
          regionLabel={`${agentB.name} cross-review`}
        />
        <ReviewAgentColumn
          agentSpec={agentC}
          otherNames={`${agentA.name} + ${agentB.name}`}
          body={cReviews}
          timer={reviewTimers.c}
          borderVar="var(--agent-c)"
          dotClass="bg-[var(--agent-c)]"
          regionLabel={`${agentC.name} cross-review`}
        />
      </div>
    </section>
  )
}

export default memo(ReviewCard)
