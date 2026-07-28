import { BUILDER_NOTE_STORAGE_KEY } from './BuilderNote.jsx'
import Eyebrow from './Eyebrow.jsx'
import PageHeader from './layout/PageHeader.jsx'
import ReadingColumn from './layout/ReadingColumn.jsx'
import { useEasterEggDiscovery } from '../hooks/useEasterEggDiscovery.js'
import { useTrash } from './easterEggs/TrashContext.jsx'
import React, { useRef } from 'react'

/** About tab content: editorial layout, light and spacious. */

/** Default forge agent accent colors (match useForgeStore). */
const AGENT_DOT = {
  a: '#1E4E5E',
  b: '#4C6647',
  c: '#97372B',
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
        {/* Column centers ~33, 100, 167: small eq */}
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

function SectionShell({ num, title, children, first = false }) {
  return (
    <section
      className={`page-section scroll-mt-8 ${first ? 'is-first' : ''}`.trim()}
    >
      <div className="flex flex-col">
        <Eyebrow>{num}</Eyebrow>
        <h2 className="babel-display babel-display-section m-0">{title}</h2>
      </div>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  )
}

/**
 * @param {{ title: string, children: React.ReactNode }} props
 */
function ObservationCard({ title, children }) {
  return (
    <div className="babel-card border-l-[3px] border-l-[var(--accent-forge)]">
      <h3 className="babel-display babel-display-card m-0">{title}</h3>
      <div className="babel-prose space-y-4">{children}</div>
    </div>
  )
}

/**
 * @param {{ title: string, children: React.ReactNode }} props
 */
function DirectionCard({ title, children }) {
  return (
    <div className="babel-card h-full">
      <h3 className="babel-display babel-display-card m-0">{title}</h3>
      <div className="babel-prose space-y-4">{children}</div>
    </div>
  )
}

/**
 * @param {{ onOpenArchive?: () => void }} [props]
 */
export default function ResearchPanel({ onOpenArchive }) {
  const { archiveUnlocked } = useEasterEggDiscovery()
  const { openTrash } = useTrash()
  const trashRef = useRef(/** @type {HTMLButtonElement | null} */ (null))

  return (
    <article className="reading-page" aria-label="About Babel">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.removeItem(BUILDER_NOTE_STORAGE_KEY)
            } catch {
              /* ignore */
            }
            window.location.reload()
          }}
          className="babel-btn babel-btn-quiet px-2"
        >
          Show builder&apos;s note again
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <button
            ref={trashRef}
            type="button"
            className="babel-trash-inline-trigger easter-archive-link"
            onClick={() => openTrash(trashRef.current)}
          >
            Trash
          </button>
          {archiveUnlocked && onOpenArchive ? (
            <button
              type="button"
              className="easter-archive-link"
              onClick={onOpenArchive}
            >
              Archive
            </button>
          ) : null}
        </div>
      </div>

      <PageHeader
        eyebrow="About Babel"
        title="What Babel is"
        lede="Babel sends one question to three AI models, then lets them challenge each other so you can study disagreement, influence, and synthesis."
      />

      <ReadingColumn>

      <SectionShell num="01" title="How the debate works" first>
        <div className="babel-prose space-y-4">
          <p>
            Babel sends one question to three AI models. Each answers without
            seeing the others. Then they read each other&apos;s responses and the
            debate begins.
          </p>
          <p>
            The models are told who they are arguing with. In round two, each
            model reviews the other two, challenges what it disputes, and defends
            its own position. They are competing: the model judged sharpest by
            its peers earns the right to synthesize.
          </p>
          <p>In round three, each model states its final position.</p>
          <p>
            After the debate, Babel measures whether each model actually changed
            its view between round one and round three, and whether that change
            came from a genuine argument or from social pressure.
          </p>
          <p>
            The goal is not to find the best model. It is to study how models
            reason under challenge and whether they can be genuinely influenced.
          </p>
        </div>
      </SectionShell>
      <SectionShell num="02" title="Why model disagreement is worth studying">
        <div className="flex flex-col gap-6">
          <ObservationCard title="Divergence as signal">
            <p>
              When models trained on similar data still disagree on the same
              prompt, that divergence is data. It points to genuinely contested
              knowledge, not stylistic variation.
            </p>
          </ObservationCard>
          <ObservationCard title="Reasoning style taxonomy">
            <p>
              Different model families reason differently. Some move toward
              caution, some toward conviction, some toward synthesis. Those
              patterns are not yet systematically mapped at the prompt level.
            </p>
          </ObservationCard>
          <ObservationCard title="Synthesis as a benchmark problem">
            <p>
              There is no established way to evaluate whether a synthesized
              answer is better than any individual response. Every debate logged
              here generates exactly that comparison.
            </p>
          </ObservationCard>
          <ObservationCard title="Prompt sensitivity">
            <p>
              Small changes in how a question is framed likely produce different
              divergence patterns. Logging at scale reveals how robust or brittle
              models are to phrasing.
            </p>
          </ObservationCard>
          <ObservationCard title="Naturalistic data">
            <p>
              Most multi-model research happens in controlled lab conditions.
              Babel collects real questions from real people. That is a different
              and more valuable dataset.
            </p>
          </ObservationCard>
          <ObservationCard title="Influence and opinion dynamics">
            <p>
              Models are trained to be helpful and agreeable. This creates a
              tension: when challenged by another model, will it update because
              the argument is better, or because it is trained to defer?
            </p>
            <p>
              The distinction between genuine updating and social capitulation
              matters. It determines how much we can trust multi-model systems to
              reach reliable conclusions rather than socially converged ones.
            </p>
            <p>
              Babel tracks this explicitly. Every position change is classified.
              Over many debates, the pattern of which models change, why, and in
              response to which arguments becomes a dataset about model reasoning
              under pressure.
            </p>
          </ObservationCard>
        </div>
      </SectionShell>
      <SectionShell num="03" title="Measuring disagreement">
        <div className="babel-prose space-y-8">
          <div>
            <h3 className="babel-display babel-display-card mb-4">
              Claim-based disagreement
            </h3>
            <div className="space-y-4">
              <p>
                After round one, each response is analysed to extract the most
                specific, falsifiable assertions made by each model. Position
                mapping tracks whether each model agrees, disagrees, partially
                agrees, or stays silent on each claim. Divergence is calculated
                from these positions directly.
              </p>
              <p>
                The extracting model is one of the debaters. This introduces
                bias. The claim list reflects one model&apos;s reading of what was
                said, not an independent record.
              </p>
            </div>
          </div>

          <div>
            <h3 className="babel-display babel-display-card mb-4">
              Pairwise scoring
            </h3>
            <p>
              Three pairwise scores are computed per debate: GPT vs Phi-4, GPT
              vs Mistral, and Phi-4 vs Mistral. A debate where two models agree
              but a third dissents shows two low-divergence edges and one
              high-divergence edge.
            </p>
          </div>

          <div>
            <h3 className="babel-display babel-display-card mb-4">
              What the triangle shows
            </h3>
            <p className="mb-6">
              Each corner is a model. Each edge shows how differently those two
              models reasoned about the same question. Edge thickness reflects
              divergence. A tight triangle means consensus. A lopsided triangle
              means two models aligned against a third.
            </p>
            <TriangleDivergenceIllustration />
          </div>

          <div>
            <h3 className="babel-display babel-display-card mb-4">
              Position change detection
            </h3>
            <div className="space-y-4">
              <p>
                Babel compares each model&apos;s round one response to its round
                three response using embedding distance. High distance means the
                position shifted. Low distance means it held.
              </p>
              <p>
                Each model also self-reports: did its position change, what
                caused it, and what would have been needed to change it further.
                The self-report is cross-checked against the embedding distance to
                distinguish genuine updates from social capitulation.
              </p>
            </div>
          </div>

          <div>
            <h3 className="babel-display babel-display-card mb-4">
              Debate structure
            </h3>
            <div className="space-y-4">
              <p>
                <span className="babel-meta-tech text-[var(--blue)]">
                  Round 1
                </span>
                : Three models answer independently. This is their uncontaminated
                position.
              </p>
              <p>
                <span className="babel-meta-tech text-[var(--blue)]">
                  Round 2
                </span>
                : Each model reads the other two responses, challenges what it
                disputes, and defends its own position. Peer scores determine who
                earns synthesis.
              </p>
              <p>
                <span className="babel-meta-tech text-[var(--blue)]">
                  Round 3
                </span>
                : Each model states its final position having seen the full
                debate.
              </p>
              <p>
                Synthesis is optional. When enabled, the model that scored
                highest in peer evaluation writes the synthesis.
              </p>
            </div>
          </div>

          <div>
            <h3 className="babel-display babel-display-card mb-4">
              Peer validation
            </h3>
            <div className="space-y-4">
              <p>
                The synthesis model participated in the debate. It cannot be a
                neutral arbiter. After synthesis, the two non-synthesizing models
                score it for fairness. If either scores below six or flags bias,
                the synthesis is marked as peer-flagged.
              </p>
              <p className="font-semibold text-[var(--ink)]">
                This reduces the problem. It does not solve it.
              </p>
              <p>
                The validators are also debaters with their own positions. A
                validator that held firm on a point the synthesis ignored will
                flag it as missing. That may reflect genuine synthesis bias, or
                the validator&apos;s own stubbornness. The two are
                indistinguishable from the outside.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>
      <SectionShell num="04" title="Future directions">
        <div className="grid gap-6 md:grid-cols-2">
          <DirectionCard title="More models, more diversity">
            <p>
              Adding models from additional labs would increase reasoning
              diversity. The three current models share significant training
              overlap. Divergence patterns here likely understate true model
              disagreement.
            </p>
          </DirectionCard>
          <DirectionCard title="Prompt categorisation">
            <p>
              Tagging debates by topic would allow divergence patterns to be
              studied by domain. Some categories likely produce more contested
              outputs than others.
            </p>
          </DirectionCard>
          <DirectionCard title="Human evaluation layer">
            <p>
              A simple post-debate rating from the user would create a feedback
              signal for studying what good synthesis looks like from a human
              perspective.
            </p>
          </DirectionCard>
          <DirectionCard title="Academic partnership">
            <p>
              The dataset Babel generates has potential value for NLP and AI
              alignment researchers. Structured, timestamped, multi-model debates
              on naturalistic prompts with position change tracking is not a
              dataset that currently exists elsewhere.
            </p>
          </DirectionCard>
        </div>
      </SectionShell>
      <SectionShell num="05" title="Limitations and open questions">
        <div className="babel-caution space-y-4">
          <p>
            These three models were selected for reliability on the GitHub
            Models free tier. GPT-4o mini, Phi-4, and Mistral Small share
            significant training overlap. Divergence patterns here likely
            understate true model disagreement.
          </p>
          <p>
            Claim extraction is automated and imperfect. The model extracting
            claims may miss positions or frame assertions in ways that skew
            agreement mapping.
          </p>
          <p>
            Position change detection via embeddings captures content shift but
            not emphasis or confidence. A model can reframe its argument while
            technically maintaining the same conclusion.
          </p>
          <p>
            Concession detection uses signal words. A model can capitulate
            without using those words, or use them rhetorically without genuinely
            conceding. Treat counts as directional.
          </p>
          <p>
            The dataset is small. Patterns visible after 50 debates may not hold
            at 500.
          </p>
        </div>
      </SectionShell>
      <SectionShell num="06" title="About">
        <div className="babel-prose space-y-6">
          <p>
            Built by Leen Al-Zu&apos;bi, Product Manager at World Wide
            Technology, as self-directed study in AI research. No lab, no grant,
            just genuine curiosity about how these models think and where they
            disagree.
          </p>
          <p>
            This tool is free to use. The dataset is open. Every debate logged
            here is visible in the Findings tab. If you find it useful, run a
            debate. If you find it interesting, reach out.
          </p>
          <p>
            <a
              href="https://www.linkedin.com/in/leenalzubi/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--accent-forge)] underline decoration-[var(--accent-forge)]/30 underline-offset-4 transition hover:decoration-[var(--accent-forge)]"
            >
              Get in touch
            </a>
          </p>
        </div>
      </SectionShell>
      </ReadingColumn>
    </article>
  )
}

