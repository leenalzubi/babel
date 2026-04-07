/** Living research brief — editorial layout, light and spacious. */

function SectionDivider() {
  return (
    <div
      className="mt-12 border-t border-dashed border-[var(--border)]"
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
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)]">
          {num}
        </p>
        <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--text-primary)] md:text-2xl">
          {title}
        </h2>
      </div>
      <div className="mt-8 space-y-5">{children}</div>
    </section>
  )
}

/**
 * @param {{ title: string, children: React.ReactNode }} props
 */
function ObservationCard({ title, children }) {
  return (
    <div className="rounded-forge-card border border-[var(--border)] border-l-2 border-l-[var(--accent-forge)] bg-[var(--bg-surface)] py-5 pl-5 pr-6">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-3 text-[17px] leading-[1.85] text-[var(--text-secondary)]">
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
    <div className="h-full rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] p-6">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-3 text-[17px] leading-[1.85] text-[var(--text-secondary)]">
        {children}
      </p>
    </div>
  )
}

export default function ResearchPanel() {
  return (
    <article
      className="mx-auto w-full min-w-0 max-w-[720px] pb-16 md:pb-24"
      aria-label="About Babel"
    >
      <SectionShell num="01" title="What Babel Is">
        <div className="space-y-5 text-[17px] leading-[1.85] text-[var(--text-secondary)]">
          <p>
            Babel sends a single prompt to three AI models simultaneously:
            GPT-4o mini, Phi-4 mini reasoning, and Mistral Small. Each model
            responds independently, then reviews the other two responses, then
            a synthesis pass reconciles all three into one unified answer.
          </p>
          <p>
            The goal is not to find the &apos;best&apos; model. It is to use
            disagreement as a feature; to surface where models converge, where
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
            prompt, that divergence is data.
          </ObservationCard>
          <ObservationCard title="Reasoning style taxonomy">
            Different model families reason differently. Some toward caution,
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
            Most multi-model research happens in controlled lab conditions. Babel
            collects real questions from real people, which is a different and
            valuable dataset.
          </ObservationCard>
        </div>
      </SectionShell>

      <SectionDivider />

      <SectionShell num="03" title="Where This Goes">
        <div className="grid gap-6 md:grid-cols-2">
          <DirectionCard title="More models, more diversity">
            Adding models from additional labs, like Gemini, Grok, Command R,
            would increase reasoning diversity and make divergence patterns more
            meaningful.
          </DirectionCard>
          <DirectionCard title="Prompt categorisation">
            Tagging debates by topic (technical, ethical, strategic, creative)
            would allow divergence patterns to be studied by domain, revealing
            which categories produce the most contested outputs.
          </DirectionCard>
          <DirectionCard title="Human evaluation layer">
            Adding a simple post-synthesis rating (&quot;Was this better than
            any single response?&quot;) would create a feedback signal for
            studying what good synthesis looks like.
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
        <div className="space-y-6 text-[17px] leading-[1.85] text-[var(--text-secondary)]">
          <p>
            Built by Leen Al-Zu&apos;bi, Senior Product Manager at Softchoice,
            as self-directed study in AI research. No lab, no grant, just
            genuine curiosity about how these models think and where they
            disagree.
          </p>
          <p>
            This tool is free to use. The dataset it generates is open, and
            every debate logged here is visible in the Findings tab. If you
            find it useful, run a debate. If you find it interesting, reach
            out.
          </p>
          <p>
            <a
              href="https://www.linkedin.com/in/leenalzubi/"
              target="_blank"
              rel="noopener noreferrer"
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
