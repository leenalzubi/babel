import { memo } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const mdClass =
  'max-w-none text-sm leading-relaxed text-[var(--text-secondary)] [&_a]:text-[var(--accent-forge)] [&_code]:rounded-md [&_code]:bg-[var(--bg-raised)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:text-[var(--text-primary)] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5'

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
      className="rounded-forge-card overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)] shadow-forge-card"
      style={{ borderTopWidth: 3, borderTopColor: border }}
    >
      <header
        className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-raised)]/50 px-4 py-3"
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`}
          aria-hidden
        />
        <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--text-primary)]">
          {title}
        </h4>
      </header>
      <div className="px-4 py-4">
        <ReactMarkdown className={mdClass}>{body}</ReactMarkdown>
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
 * }} props
 */
function ReviewCard({ roundNum, aReviews, bReviews, cReviews }) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ArrowLeftRight
            className="h-4 w-4 shrink-0 text-[var(--accent-forge)]"
            aria-hidden
          />
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-[var(--text-primary)]">
            Cross-Review — Round {roundNum}
          </h3>
        </div>
        <p className="pl-6 font-sans text-xs text-[var(--text-secondary)]">
          Each agent reviewed the other two
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <CrossReviewAgentCard
          border="var(--agent-a)"
          dot="bg-[var(--agent-a)]"
          title="CLAUDE reviewing DEEPSEEK R1 + LLAMA 4"
          regionLabel="Claude cross-review"
          body={aReviews}
        />
        <CrossReviewAgentCard
          border="var(--agent-b)"
          dot="bg-[var(--agent-b)]"
          title="DEEPSEEK R1 reviewing CLAUDE + LLAMA 4"
          regionLabel="DeepSeek R1 cross-review"
          body={bReviews}
        />
        <CrossReviewAgentCard
          border="var(--agent-c)"
          dot="bg-[var(--agent-c)]"
          title="LLAMA 4 reviewing CLAUDE + DEEPSEEK R1"
          regionLabel="Llama 4 cross-review"
          body={cReviews}
        />
      </div>
    </section>
  )
}

export default memo(ReviewCard)
