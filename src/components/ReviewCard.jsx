import { memo } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import AgentResponseBody from './AgentResponseBody.jsx'

const mdClass =
  'max-w-none text-[17px] leading-[1.85] text-[var(--text-secondary)] [&_a]:text-[var(--accent-forge)] [&_code]:rounded-[4px] [&_code]:bg-[var(--bg-raised)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:text-[var(--text-primary)] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5'

/**
 * @param {{
 *   border: string
 *   dot: string
 *   title: string
 *   body: string
 *   regionLabel: string
 * }} props
 */
function CrossReviewAgentCard({ border, dot, title, body, regionLabel }) {
  return (
    <article
      role="region"
      aria-label={regionLabel}
      className="rounded-forge-card overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)]"
      style={{ borderTopWidth: 2, borderTopColor: border }}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
          aria-hidden
        />
        <h4
          className="font-mono text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: border }}
        >
          {title}
        </h4>
      </div>
      <div className="border-t border-dashed border-[var(--border)] px-4 pb-4 pt-3">
        <AgentResponseBody rawText={body} markdownClassName={mdClass} />
      </div>
    </article>
  )
}

/**
 * @param {{
 *   roundNum: number
 *   aReviews: string
 *   bReviews: string
 *   cReviews: string
 *   config: {
 *     agentA: { name: string }
 *     agentB: { name: string }
 *     agentC: { name: string }
 *   }
 * }} props
 */
function ReviewCard({ roundNum, aReviews, bReviews, cReviews, config }) {
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
        <CrossReviewAgentCard
          border="var(--agent-a)"
          dot="bg-[var(--agent-a)]"
          title={`${agentA.name} reviewing ${agentB.name} + ${agentC.name}`}
          regionLabel={`${agentA.name} cross-review`}
          body={aReviews}
        />
        <CrossReviewAgentCard
          border="var(--agent-b)"
          dot="bg-[var(--agent-b)]"
          title={`${agentB.name} reviewing ${agentA.name} + ${agentC.name}`}
          regionLabel={`${agentB.name} cross-review`}
          body={bReviews}
        />
        <CrossReviewAgentCard
          border="var(--agent-c)"
          dot="bg-[var(--agent-c)]"
          title={`${agentC.name} reviewing ${agentA.name} + ${agentB.name}`}
          regionLabel={`${agentC.name} cross-review`}
          body={cReviews}
        />
      </div>
    </section>
  )
}

export default memo(ReviewCard)
