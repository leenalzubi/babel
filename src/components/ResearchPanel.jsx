import { WELCOME_STORAGE_KEY } from './WelcomeModal.jsx'

/** About tab content — editorial layout, light and spacious. */

/** Default forge agent accent colors (match useForgeStore). */
const AGENT_DOT = {
  a: '#2563EB',
  b: '#16A34A',
  c: '#DC2626',
}

function TriangleDivergenceIllustration() {
  const r = 3.5
  const c = [AGENT_DOT.a, AGENT_DOT.b, AGENT_DOT.c]

  /** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
  function tri(x0, y0, x1, y1, x2, y2, strokeW = 1.25) {
    return (
      <g>
        <polygon
          points={`${x0},${y0} ${x1},${y1} ${x2},${y2}`}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={strokeW}
          opacity={0.85}
        />
        <circle cx={x0} cy={y0} r={r} fill={c[0]} />
        <circle cx={x1} cy={y1} r={r} fill={c[1]} />
        <circle cx={x2} cy={y2} r={r} fill={c[2]} />
      </g>
    )
  }

  return (
    <figure
      className="mx-auto w-[200px] max-w-full"
      aria-label="Three triangle divergence patterns: consensus, uniform divergence, and two versus one"
    >
      <svg
        width="200"
        height="82"
        viewBox="0 0 200 82"
        className="overflow-visible"
        role="img"
      >
        <title>Triangle consensus map patterns</title>
        {/* Column centers ~33, 100, 167 — small eq */}
        {tri(33, 28, 24, 44, 42, 44)}
        {/* Large eq */}
        {tri(100, 18, 82, 48, 118, 48, 1.35)}
        {/* Two vs one: long edge bottom */}
        {tri(167, 22, 152, 50, 188, 50, 1.35)}
        <text
          x="33"
          y="72"
          textAnchor="middle"
          className="fill-[var(--text-muted)]"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '8px',
            letterSpacing: '0.02em',
          }}
        >
          Consensus
        </text>
        <text
          x="100"
          y="68"
          textAnchor="middle"
          className="fill-[var(--text-muted)]"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '6.5px',
            letterSpacing: '0.02em',
          }}
        >
          Uniform
        </text>
        <text
          x="100"
          y="75"
          textAnchor="middle"
          className="fill-[var(--text-muted)]"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '6.5px',
            letterSpacing: '0.02em',
          }}
        >
          divergence
        </text>
        <text
          x="167"
          y="72"
          textAnchor="middle"
          className="fill-[var(--text-muted)]"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '8px',
            letterSpacing: '0.02em',
          }}
        >
          Two vs one
        </text>
      </svg>
    </figure>
  )
}

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
      <div className="mb-8">
        <button
          type="button"
          onClick={() => {
            try {
              window.sessionStorage.removeItem(WELCOME_STORAGE_KEY)
            } catch {
              /* ignore */
            }
            window.location.reload()
          }}
          className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)] underline-offset-2 transition hover:text-[var(--text-secondary)] hover:underline"
        >
          Show welcome again
        </button>
      </div>

      <SectionShell num="01" title="What Babel is">
        <div className="space-y-5 text-[17px] leading-[1.85] text-[var(--text-secondary)]">
          <p>
            Babel sends a single prompt to three AI models: GPT-4o mini, Phi-4
            mini reasoning, and Mistral Small. Each model responds without seeing
            the others, but they then launch into a debate.
          </p>
          <p>
            In round two, each model reads the other two responses and
            identifies what it agrees with, challenges, and finds missing. In
            round three, each model responds directly to the challenges directed
            at it; this is where concessions happen, positions harden, and
            genuine disagreement becomes visible. In round four, each model
            states its final position.
          </p>
          <p>
            A synthesis pass then reconciles all four rounds into one answer,
            explicitly noting which points reached consensus, which were
            conceded, and which remained contested to the end.
          </p>
          <p>
            The goal is not to find the best model. It is to use disagreement
            as a research instrument to surface where models converge, where
            they hold firm under challenge, and what the structure of their
            disagreement reveals about how they reason.
          </p>
        </div>
      </SectionShell>

      <SectionDivider />

      <SectionShell num="02" title="Why model disagreement is worth studying">
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

      <SectionShell num="03" title="Measuring disagreement">
        <div className="space-y-8 text-[17px] leading-[1.85] text-[var(--text-secondary)]">
          <div>
            <h3 className="mb-4 font-[family-name:var(--font-body)] text-lg font-semibold text-[var(--text-primary)]">
              Semantic differences
            </h3>
            <p>
              Each agent response is converted into a 1,536-dimension embedding
              vector using OpenAI&apos;s text-embedding-3-small model. These
              vectors encode vocabulary (not meaning); two responses that say
              the same thing in different words will score low divergence. Two
              responses that reach different conclusions will score high, even
              if they share common phrases.
            </p>
          </div>

          <div>
            <h3 className="mb-4 font-[family-name:var(--font-body)] text-lg font-semibold text-[var(--text-primary)]">
              Pairwise scoring
            </h3>
            <p>
              This means a debate where two models agree but a third dissents
              will show two low-divergence edges and one high-divergence edge.
              This is visually distinct from a debate where all three diverge
              equally.
            </p>
          </div>

          <div>
            <h3 className="mb-4 font-[family-name:var(--font-body)] text-lg font-semibold text-[var(--text-primary)]">
              What the triangle shows
            </h3>
            <p className="mb-6">
              Each corner represents a model, and each edge represents how
              differently those two models reasoned about the same question. A
              tight triangle means consensus, a stretched triangle means
              genuine disagreement, and a lopsided triangle means two models
              aligned against a third.
            </p>
            <TriangleDivergenceIllustration />
          </div>

          <div>
            <h3 className="mb-4 font-[family-name:var(--font-body)] text-lg font-semibold text-[var(--text-primary)]">
              Debate structure
            </h3>
            <p className="mb-5">
              Each debate runs four rounds:
            </p>
            <ol className="list-none space-y-0">
              <li className="border-b border-dashed border-[var(--border)] pb-4">
                <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.85] text-[var(--text-secondary)]">
                  <span
                    className="font-mono font-medium text-[#8B1A1A]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Round 1
                  </span>{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    — independent:
                  </span>{' '}
                  Three models answer without seeing each other. This is their
                  uncontaminated position.
                </p>
              </li>
              <li className="border-b border-dashed border-[var(--border)] py-4">
                <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.85] text-[var(--text-secondary)]">
                  <span
                    className="font-mono font-medium text-[#8B1A1A]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Round 2
                  </span>{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    — cross-review:
                  </span>{' '}
                  Each model reads the other two responses and identifies what it
                  agrees with, challenges, and finds missing.
                </p>
              </li>
              <li className="border-b border-dashed border-[var(--border)] py-4">
                <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.85] text-[var(--text-secondary)]">
                  <span
                    className="font-mono font-medium text-[#8B1A1A]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Round 3
                  </span>{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    — rebuttal:
                  </span>{' '}
                  Each model responds directly to the challenges directed at it.
                  This is where concessions happen.
                </p>
              </li>
              <li className="border-b border-dashed border-[var(--border)] py-4">
                <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.85] text-[var(--text-secondary)]">
                  <span
                    className="font-mono font-medium text-[#8B1A1A]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Round 4
                  </span>{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    — final position:
                  </span>{' '}
                  Each model states its closing argument having seen the full
                  debate.
                </p>
              </li>
              <li className="pt-4">
                <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.85] text-[var(--text-secondary)]">
                  Synthesis draws on all four rounds, weighting unanimous points
                  highly, flagging genuine disagreements, and explicitly noting
                  any concessions made.
                </p>
              </li>
            </ol>
          </div>

          <div>
            <h3 className="mb-4 font-[family-name:var(--font-body)] text-lg font-semibold text-[var(--text-primary)]">
              Peer validation
            </h3>
            <div
              className="space-y-5 text-[17px] leading-[1.85] text-[var(--text-secondary)]"
              style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
            >
              <p>
                The synthesis model is one of the three debaters. Having formed
                a position in round one, it cannot be a neutral arbiter of the
                debate it participated in. This is a structural problem with no
                perfect solution at this scale.
              </p>
              <p>
                My partial solution: after synthesis is generated, the two
                non-synthesizing agents are asked to score it for fairness.
                Each validator reads the original prompt, their own round one
                response, and the synthesis, then scores it out of ten and flags
                any detected bias or missing positions. If either validator
                scores below six or flags the synthesis, it is marked as
                peer-flagged in the audit trail.
              </p>
              <p className="my-8 text-[17px] font-semibold leading-[1.75] text-[var(--text-primary)]">
                This reduces the problem. It does not solve it.
              </p>
              <p>
                It is important to reiterate that validators are also language
                models with their own positions in the debate. A validator that
                held firm on a point the synthesis ignored will naturally flag
                that as missing, which may reflect genuine bias in the synthesis,
                or may simply reflect the validator&apos;s own stubbornness. The
                two are indistinguishable from the outside.
              </p>
              <p>
                What peer validation does provide is a signal. A synthesis that
                receives high scores from both validators is more likely to be
                balanced than one that does not. Over many debates, the rate of
                flagged syntheses becomes a meaningful dataset point.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionDivider />

      <SectionShell num="04" title="Future directions">
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
            The dataset this tool generates (structured, timestamped,
            multi-model debates on naturalistic prompts) has potential value for
            NLP and AI alignment researchers studying model behaviour and
            consensus formation.
          </DirectionCard>
        </div>
      </SectionShell>

      <SectionDivider />

      <SectionShell num="05" title="Limitations and open questions">
        <div
          className="space-y-5 text-[15px] leading-[1.85] text-[#6B5E4E]"
          style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
        >
          <p>
            These three models were selected for reliability on the GitHub
            Models free tier, not for maximum diversity. GPT-4o mini, Phi-4,
            and Mistral Small share significant training overlap. The divergence
            patterns you see here likely understate true model disagreement.
          </p>
          <p>
            Semantic divergence measures how differently models reasoned, not
            whether either was correct. A high divergence score on a factual
            question may simply mean one model is wrong.
          </p>
          <p>
            The synthesis model is one of the three debaters. Its synthesis
            will likely favour its own original position in subtle ways. This is
            a known limitation with no clean solution at this scale.
          </p>
          <p>
            The concession detection is heuristic, as it looks for signal words
            like &apos;I concede&apos; or &apos;valid point&apos;. A model can
            capitulate substantively without using these words, or use them
            rhetorically without genuinely conceding. Treat concession counts as
            directional, not definitive.
          </p>
          <p>
            This dataset is small. Patterns visible in the Findings tab after
            50 debates may not hold at 500. We are in early days.
          </p>
        </div>
      </SectionShell>

      <SectionDivider />

      <SectionShell num="06" title="About">
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
