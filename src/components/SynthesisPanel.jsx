import { useCallback, useMemo, useRef, useState } from 'react'
import { Copy, HelpCircle, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useForge } from '../store/useForgeStore.js'
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import {
  copyToClipboard,
  downloadMarkdown,
} from '../utils/exportUtils.js'
import InfluenceMap from './InfluenceMap.jsx'
import LineageDrawer from './LineageDrawer.jsx'
import SectionHeading from './SectionHeading.jsx'
import ValidationBadge from './ValidationBadge.jsx'
import ClaimIdLinks from './reasoning/ClaimIdLinks.jsx'
import {
  ConsensusFinding,
  MinorityReport,
  UnresolvedQuestion,
} from './reasoning/Primitives.jsx'
import { FINDING_TITLES } from '../lib/claimNavigation.js'
import { buildLineageBundle } from '../lib/synthesisLineage.js'

/** Prose for synthesis body: essay-like Scriptorium typography (wrapper around ReactMarkdown). */
const synthesisOutputMarkdownClass =
  'synthesis-output-md max-w-none text-[var(--text-primary)] ' +
  '[&_a]:text-[var(--blue)] ' +
  '[&_code]:rounded-[4px] [&_code]:bg-[var(--bg-raised)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] ' +
  '[&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:[font-family:var(--font-display)] [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:text-[var(--ink)] [&_h1:first-child]:mt-0 ' +
  '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:[font-family:var(--font-display)] [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:text-[var(--ink)] [&_h2:first-child]:mt-0 ' +
  '[&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:[font-family:var(--font-display)] [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:text-[var(--ink)] [&_h3:first-child]:mt-0 ' +
  '[&_p]:mb-4 [&_p]:[font-family:var(--font-body)] [&_p]:text-[17px] [&_p]:leading-[1.65] [&_p:last-child]:mb-0 ' +
  '[&_strong]:font-semibold ' +
  '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-8 [&_ul]:[font-family:var(--font-body)] [&_ul]:text-[17px] ' +
  '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-8 [&_ol]:[font-family:var(--font-body)] [&_ol]:text-[17px] ' +
  '[&_li]:my-1 [&_li]:leading-[1.75]'

/**
 * @param {{
 *   synthesis: {
 *     output: string,
 *     attributions: { a: string, b: string, c: string },
 *     rationale: string,
 *   } | null,
 * }} props
 */
export default function SynthesisPanel({ synthesis }) {
  const { state } = useForge()
  const { settings } = useForgeUiSettings()
  const [toast, setToast] = useState(null)
  const [howWorksOpen, setHowWorksOpen] = useState(false)
  const [lineageFindingId, setLineageFindingId] = useState(
    /** @type {string | null} */ (null)
  )
  const triggerRef = useRef(/** @type {HTMLElement | null} */ (null))

  const lineage = useMemo(() => buildLineageBundle(state), [state])

  const clearToastLater = useCallback(() => {
    window.setTimeout(() => setToast(null), 2000)
  }, [])

  const handleCopyOutput = useCallback(async () => {
    if (!synthesis?.output) return
    const result = await copyToClipboard(synthesis.output)
    if (result.ok) {
      setToast('copied')
      clearToastLater()
    }
  }, [synthesis, clearToastLater])

  const handleExportFull = useCallback(() => {
    downloadMarkdown(state)
    setToast('downloaded')
    clearToastLater()
  }, [state, clearToastLater])

  const openLineage = useCallback((findingId, el) => {
    triggerRef.current = el
    setLineageFindingId(findingId)
    try {
      const f = lineage.findings.find((x) => x.findingId === findingId)
      console.info('[babel:analytics]', {
        event: 'lineage_panel_opened',
        findingId,
        findingType: f?.type ?? null,
        lineageStatus: f?.lineageStatus ?? null,
      })
      if (f?.lineageStatus === 'partial' || f?.lineageStatus === 'unavailable') {
        console.info('[babel:analytics]', {
          event: 'lineage_status_encountered',
          findingId,
          lineageStatus: f.lineageStatus,
        })
      }
    } catch {
      /* ignore */
    }
  }, [lineage.findings])

  if (synthesis == null) {
    return null
  }

  const { output, attributions, rationale } = synthesis
  const { agentA, agentB, agentC } = state.config
  const enrichedFindings = lineage.findings
  const activeFinding =
    enrichedFindings.find((f) => f.findingId === lineageFindingId) ?? null

  const divergence =
    settings.showResearchSurfaces && state.divergenceScores.length > 0
      ? state.divergenceScores[state.divergenceScores.length - 1]
      : null

  const triInitials = {
    a: (agentA.name?.[0] ?? 'A').toUpperCase(),
    b: (agentB.name?.[0] ?? 'B').toUpperCase(),
    c: (agentC.name?.[0] ?? 'C').toUpperCase(),
  }

  const attPills = [
    {
      short: agentA.name,
      text: attributions?.a ?? '',
      color: agentA.color,
    },
    {
      short: agentB.name,
      text: attributions?.b ?? '',
      color: agentB.color,
    },
    {
      short: agentC.name,
      text: attributions?.c ?? '',
      color: agentC.color,
    },
  ]

  return (
    <article
      role="region"
      aria-label="Synthesis result"
      className="relative overflow-hidden rounded-forge-card border border-[var(--line)] bg-[var(--plaster)] shadow-forge-card"
    >
      <div className="babel-arbiter mx-6 mt-6 md:mx-10 md:mt-8">
        <span className="babel-voice-name">arbiter</span>
        <p className="mt-2 font-[family-name:var(--font-display)] text-[1.08rem] leading-snug text-[var(--ink)]">
          {rationale
            ? String(rationale)
            : 'The synthesis gathers what was said into one measured answer.'}
        </p>
      </div>
      <div className="relative px-6 pb-2 pt-6 md:px-10 md:pt-8">
        <button
          type="button"
          onClick={handleCopyOutput}
          aria-label="Copy synthesis output to clipboard"
          className="absolute right-4 top-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-[var(--text-secondary)] transition hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] md:right-8 md:top-6"
        >
          <Copy className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex items-start gap-3 pr-14">
          <Sparkles
            className="mt-1 h-6 w-6 shrink-0 text-[var(--ink-soft)]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <SectionHeading
              eyebrow="Arbiter"
              title="Synthesis"
              titleId="synthesis-panel-title"
              lede="Three rounds (independent positions, cross-examination, and explicit revision), then one decision artifact from the full transcript."
            />
            <div className="-mt-3 mb-2">
              <button
                type="button"
                onClick={() => setHowWorksOpen((open) => !open)}
                aria-expanded={howWorksOpen}
                aria-controls="synthesis-how-works"
                title="How this works"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] aria-expanded:border-[var(--accent-forge)]/40 aria-expanded:text-[var(--accent-forge)]"
              >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">How this works</span>
              </button>
            </div>
            {state.synthesisWinner &&
            typeof state.synthesisWinner === 'object' &&
            state.synthesisWinner.winner ? (
              <p className="mt-2 max-w-2xl font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[var(--text-muted)]">
                Synthesized by{' '}
                <span className="text-[var(--text-secondary)]">
                  {state.synthesisWinner.winner === 'phi'
                    ? agentB.name
                    : state.synthesisWinner.winner === 'mistral'
                      ? agentC.name
                      : agentA.name}
                </span>
                <span className="mt-0.5 block text-[10px] italic">
                  Earned through highest peer evaluation score
                </span>
              </p>
            ) : null}
            {howWorksOpen ? (
              <div
                id="synthesis-how-works"
                role="region"
                aria-labelledby="synthesis-how-works-heading"
                className="mt-3 max-w-2xl rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-3 text-xs leading-relaxed text-[var(--text-secondary)]"
              >
                <p
                  id="synthesis-how-works-heading"
                  className="font-mono text-[10px] font-semibold tracking-wide text-[var(--text-muted)]"
                >
                  How this works
                </p>
                <p className="mt-2">
                  <span className="font-medium text-[var(--text-primary)]">
                    Round 1:
                  </span>{' '}
                  Independent positions with claims.{' '}
                  <span className="font-medium text-[var(--text-primary)]">
                    Round 2:
                  </span>{' '}
                  Cross-examination of decision-relevant claims.{' '}
                  <span className="font-medium text-[var(--text-primary)]">
                    Round 3:
                  </span>{' '}
                  Preserve, narrow, amend, or withdraw.{' '}
                  <span className="font-medium text-[var(--text-primary)]">
                    Synthesis:
                  </span>{' '}
                  A decision artifact with a minority report; you own the final memo.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <ValidationBadge />
      </div>

      {divergence && (
        <div className="border-t border-dashed border-[var(--border)] bg-[var(--bg-synthesis)] px-6 py-6 md:px-10">
          <div className="flex justify-center">
            <InfluenceMap
              scores={divergence}
              initials={triInitials}
              config={state.config}
              influenceReport={state.influenceReport}
              influenceLoading={state.influenceLoading}
              showPositionTracks
            />
          </div>
        </div>
      )}

      <div className="px-6 py-8 md:px-10 md:py-10">
        {lineage.debateLineageStatus === 'unavailable' &&
        !enrichedFindings.length ? (
          <p className="mb-4 font-mono text-[0.75rem] text-[var(--ink-soft)]">
            Lineage unavailable for this debate.
          </p>
        ) : null}
        {enrichedFindings.length > 0 ? (
          <div className="flex flex-col gap-6">
            {enrichedFindings
              .filter((f) => f.kind !== 'minority')
              .map((f) => {
                const supportCount = f.supportingClaimIds.length
                const lineageLabel =
                  f.lineageStatus === 'complete'
                    ? 'Lineage available'
                    : f.lineageStatus === 'partial'
                      ? 'Partial lineage'
                      : 'Lineage unavailable'
                return (
                  <section
                    key={f.findingId}
                    aria-labelledby={`synth-${f.findingId}`}
                    className="rounded-[var(--radius)] border border-transparent"
                  >
                    <h3
                      id={`synth-${f.findingId}`}
                      className="babel-display-heading mb-2"
                    >
                      {FINDING_TITLES[f.kind] ?? f.findingId}
                    </h3>
                    {f.kind === 'agreement' || f.kind === 'support' ? (
                      <ConsensusFinding claimIds={f.supportingClaimIds}>
                        <p className="m-0 whitespace-pre-wrap">{f.text}</p>
                      </ConsensusFinding>
                    ) : f.kind === 'disagreement' || f.kind === 'change' ? (
                      <div>
                        <UnresolvedQuestion>
                          <span className="whitespace-pre-wrap">{f.text}</span>
                        </UnresolvedQuestion>
                        <ClaimIdLinks claimIds={f.supportingClaimIds} />
                      </div>
                    ) : (
                      <div>
                        <p className="m-0 whitespace-pre-wrap text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink)]">
                          {f.text}
                        </p>
                        <ClaimIdLinks claimIds={f.supportingClaimIds} />
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="babel-btn babel-btn-ghost min-h-11 text-[var(--blue)]"
                        aria-label={`Trace this finding: ${FINDING_TITLES[f.kind] ?? f.findingId}`}
                        onClick={(e) =>
                          openLineage(f.findingId, e.currentTarget)
                        }
                      >
                        Trace this finding
                      </button>
                      <span
                        className={`font-mono text-[0.72rem] ${
                          f.lineageStatus === 'unavailable'
                            ? 'text-[var(--ink-soft)]'
                            : 'text-[var(--ink-soft)]'
                        }`}
                      >
                        {supportCount > 0
                          ? `${supportCount} supporting claim${
                              supportCount === 1 ? '' : 's'
                            }. `
                          : ''}
                        {lineageLabel}
                      </span>
                    </div>
                  </section>
                )
              })}
            {enrichedFindings.some((f) => f.kind === 'minority') ? (
              <MinorityReport>
                <p className="m-0 whitespace-pre-wrap">
                  {enrichedFindings.find((f) => f.kind === 'minority')?.text}
                </p>
                <ClaimIdLinks
                  claimIds={
                    enrichedFindings.find((f) => f.kind === 'minority')
                      ?.supportingClaimIds ?? []
                  }
                />
                <button
                  type="button"
                  className="babel-btn babel-btn-ghost mt-3 min-h-11"
                  aria-label="Trace minority report"
                  onClick={(e) => {
                    const mid = enrichedFindings.find(
                      (f) => f.kind === 'minority'
                    )?.findingId
                    if (mid) openLineage(mid, e.currentTarget)
                  }}
                >
                  Trace this finding
                </button>
              </MinorityReport>
            ) : null}
          </div>
        ) : (
          <div className={synthesisOutputMarkdownClass}>
            <ReactMarkdown>{output}</ReactMarkdown>
            <p className="mt-4 font-mono text-[0.75rem] text-[var(--ink-soft)]">
              Lineage unavailable for this debate.
            </p>
          </div>
        )}
      </div>

      <LineageDrawer
        open={Boolean(activeFinding)}
        onClose={() => setLineageFindingId(null)}
        finding={activeFinding}
        registry={lineage.registry}
        voiceRecords={lineage.voiceRecords}
        criteria={state.decisionCriteria ?? []}
        returnFocusRef={triggerRef}
      />

      <div className="border-t border-dashed border-[var(--border)] px-6 py-6 md:px-10">
        <h3 className="mb-4 font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
          Contributions
        </h3>
        <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:gap-3">
          {attPills.map((p) => (
            <div
              key={p.short}
              className="inline-flex max-w-full items-start gap-2 rounded-forge-card border border-[var(--border)] border-l-[3px] bg-[var(--bg-surface)] py-2 pl-3 pr-4"
              style={{ borderLeftColor: p.color }}
            >
              <span
                className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <p className="min-w-0 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  {p.short}
                </span>{' '}
                contributed: {p.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {settings.showRationale && rationale ? (
        <div className="border-t border-dashed border-[var(--border)] px-6 py-6 md:px-10">
          <h3 className="mb-2 font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
            Why this answer
          </h3>
          <p className="text-[17px] italic leading-relaxed text-[var(--text-secondary)]">
            {rationale}
          </p>
        </div>
      ) : null}

      <div className="relative flex flex-col items-stretch gap-2 border-t border-dashed border-[var(--border)] px-6 py-4 sm:flex-row sm:justify-end md:px-10">
        <button
          type="button"
          onClick={handleExportFull}
          aria-label="Export full debate as Markdown file"
          className="babel-btn babel-btn-primary"
        >
          Export full debate
        </button>
        {toast ? (
          <span
            className="pointer-events-none absolute bottom-full right-6 mb-2 rounded-[4px] border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[10px] text-[var(--agree)] sm:right-8"
            role="status"
          >
            {toast === 'downloaded' ? 'Downloaded!' : 'Copied!'}
          </span>
        ) : null}
      </div>
    </article>
  )
}
