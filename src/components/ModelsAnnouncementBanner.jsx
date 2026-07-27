import { Sparkles } from 'lucide-react'

/**
 * Site-wide note on model lineup and GitHub Models free-tier constraints.
 */
export default function ModelsAnnouncementBanner() {
  return (
    <aside
      role="note"
      aria-label="Model lineup and GitHub Models limitations"
      className="mb-4 rounded-forge-card border border-dashed border-[var(--line-firm)] bg-[var(--blue-wash)]/55 px-4 py-3.5 sm:px-5"
    >
      <div className="flex gap-3">
        <Sparkles
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--blue)]"
          aria-hidden
        />
        <div className="min-w-0 space-y-2">
          <p className="babel-eyebrow">New models under review</p>
          <p
            className="text-[13px] leading-relaxed text-[var(--text-secondary)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            We&apos;re looking into expanding which models can debate here.
            Right now Babel uses the{' '}
            <span className="font-medium text-[var(--text-primary)]">
              GitHub Models
            </span>{' '}
            free tier: it&apos;s a generous way to run multi-model calls without
            billing you, but the hosted catalog and rate limits are smaller than
            a full commercial API. That keeps the project accessible and also
            means we can only pick from the models GitHub exposes on that tier,
            so lineup diversity is naturally capped until we wire in more
            options.
          </p>
        </div>
      </div>
    </aside>
  )
}
