/** Living research brief — editorial layout, light and spacious. */

function SectionDivider() {
  return (
    <div
      className="my-16 border-t border-[var(--border)]/80 md:my-20"
      aria-hidden
    />
  )
}

/**
 * @param {{ num: string, title: string, children: React.ReactNode }} props
 */
function SectionShell({ num, title, children }) {
  return (
    <section className="scroll-mt-8">
      <p className="font-mono text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)]">
        {num}
      </p>
      <h2 className="mt-2 font-sans text-xl font-semibold tracking-tight text-[var(--text-primary)] md:text-2xl">
        {title}
      </h2>
      <div className="mt-8 space-y-5">{children}</div>
    </section>
  )
}

/**
 * @param {{ title: string, children: React.ReactNode }} props
 */
function ObservationCard({ title, children }) {
  return (
    <div className="rounded-lg border border-[var(--border)] border-l-[3px] border-l-[var(--accent-forge)] bg-[var(--bg-surface)] py-5 pl-5 pr-6 shadow-forge-card">
      <h3 className="font-sans text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-3 font-sans text-[15px] leading-[1.7] text-[var(--text-secondary)]">
        {children}
      </p>
    </div>
  )
}

/**
 * @param {{ title: string, children: React.ReactNode }} props
 */
function DirectionCard({ title, children }) {
  return (
    <div className="h-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-forge-card">
      <h3 className="font-sans text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-3 font-sans text-[15px] leading-[1.7] text-[var(--text-secondary)]">
        {children}
      </p>
    </div>
  )
}

export default function ResearchPanel() {
  return (
    <article
      className="mx-auto w-full max-w-3xl pb-16 md:pb-24"
      aria-label="Research brief"
    >
      <SectionShell num="01" title="What The Forge Is">
        <div className="space-y-5 font-sans text-[15px] leading-[1.75] text-[var(--text-secondary)]">
          <p>
            The Forge sends a single prompt to three AI models simultaneously —
            GPT-4o mini, Phi-4 mini reasoning, and Mistral Small. Each model
            responds independently, then reviews the other two responses, then
            a synthesis pass reconciles all three into one unified answer.
          </p>
          <p>
            The goal is not to find the &apos;best&apos; model. It is to use
            disagreement as a feature — to surface where models converge, where
            they diverge, and what each reasoning style contributes that the
            others miss.
          </p>
        </div>
      </SectionShell>

      <SectionDivider />

      <SectionShell num="02" title="Why Model Disagreement Is Worth Studying">
        <div className="flex flex-col gap-6">
          <ObservationCard title="Divergence as signal">
            When models trained on similar data still disagree on the same
            prompt, that divergence is data — it indicates genuinely contested
            knowledge, not just stylistic variation.
          </ObservationCard>
          <ObservationCard title="Reasoning style taxonomy">
            Different model families reason differently — some toward caution,
            some toward conviction, some toward synthesis. Those patterns are
            not yet systematically mapped at the prompt level.
          </ObservationCard>
          <ObservationCard title="Synthesis as a benchmark problem">
            There is no established way to evaluate whether a synthesized
            answer is better than any individual response. Every debate logged
            here generates exactly that comparison.
          </ObservationCard>
          <ObservationCard title="Prompt sensitivity">
            Small changes in how a question is framed likely produce
            dramatically different divergence patterns. Logging at scale
            reveals how robust or brittle models are to phrasing.
          </ObservationCard>
          <ObservationCard title="Naturalistic data">
            Most multi-model research happens in controlled lab conditions. The
            Forge collects real questions from real people — a different and
            potentially more valuable dataset.
          </ObservationCard>
        </div>
      </SectionShell>

      <SectionDivider />

      <SectionShell num="03" title="Where This Goes">
        <div className="grid gap-6 md:grid-cols-2">
          <DirectionCard title="More models, more diversity">
            Adding models from additional labs — Gemini, Grok, Command R —
            would increase reasoning diversity and make divergence patterns more
            meaningful.
          </DirectionCard>
          <DirectionCard title="Prompt categorisation">
            Tagging debates by topic (technical, ethical, strategic, creative)
            would allow divergence patterns to be studied by domain —
            revealing which categories produce the most contested outputs.
          </DirectionCard>
          <DirectionCard title="Human evaluation layer">
            Adding a simple post-synthesis rating (&quot;Was this better than
            any single response?&quot;) would create a feedback signal for
            studying what good synthesis actually looks like.
          </DirectionCard>
          <DirectionCard title="Academic partnership">
            The dataset this tool generates — structured, timestamped,
            multi-model debates on naturalistic prompts — has potential value
            for NLP and AI alignment researchers studying model behaviour and
            consensus formation.
          </DirectionCard>
        </div>
      </SectionShell>

      <SectionDivider />

      <SectionShell num="04" title="About">
        <div className="space-y-6 font-sans text-[15px] leading-[1.75] text-[var(--text-secondary)]">
          <p>
            Built by Leen Alzubi, Senior Product Manager at Softchoice. This
            project sits at the intersection of product thinking and AI research
            — an attempt to build tools that make model behaviour more legible,
            not just more capable.
          </p>
          <p>
            Feedback, collaboration, and research partnerships welcome.
          </p>
          <p>
            <a
              href="mailto:leenalzubi99@gmail.com"
              className="font-mono text-sm font-semibold text-[var(--accent-forge)] underline decoration-[var(--accent-forge)]/30 underline-offset-4 transition hover:decoration-[var(--accent-forge)]"
            >
              Get in touch
            </a>
          </p>
        </div>
      </SectionShell>
    </article>
  )
}
