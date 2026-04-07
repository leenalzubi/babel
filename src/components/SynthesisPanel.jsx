import { useCallback, useState } from 'react'
import { Copy, HelpCircle, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useForge } from '../store/useForgeStore.js'
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import {
  copyToClipboard,
  downloadMarkdown,
} from '../utils/exportUtils.js'
import TriangleConsensus from './TriangleConsensus.jsx'

/** Prose for synthesis body — essay-like Scriptorium typography (wrapper around ReactMarkdown). */
const synthesisOutputMarkdownClass =
  'synthesis-output-md max-w-none text-[var(--text-primary)] ' +
  '[&_a]:text-[var(--accent-forge)] ' +
  '[&_code]:rounded-[4px] [&_code]:bg-[var(--bg-raised)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] ' +
  '[&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:[font-family:var(--font-display)] [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:text-[#1C1814] [&_h1:first-child]:mt-0 ' +
  '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:[font-family:var(--font-display)] [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:text-[#1C1814] [&_h2:first-child]:mt-0 ' +
  '[&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:[font-family:var(--font-display)] [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:text-[#1C1814] [&_h3:first-child]:mt-0 ' +
  '[&_p]:mb-4 [&_p]:[font-family:var(--font-body)] [&_p]:text-[17px] [&_p]:leading-[1.85] [&_p:last-child]:mb-0 ' +
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

  if (synthesis == null) {
    return null
  }

  const { output, attributions, rationale } = synthesis
  const { agentA, agentB, agentC } = state.config

  const divergence =
    state.divergenceScores.length > 0
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
      className="relative overflow-hidden rounded-forge-card border border-[var(--border)] border-t-2 border-t-[var(--accent-forge)] bg-[var(--bg-synthesis)]"
    >
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
            className="mt-1 h-6 w-6 shrink-0 text-[var(--accent-forge)]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="synthesis-panel-title"
                className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)] md:text-3xl"
              >
                Synthesis
              </h2>
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
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
              Each agent responded independently, reviewed the others, then their
              strongest arguments were reconciled into one answer.
            </p>
            {howWorksOpen ? (
              <div
                id="synthesis-how-works"
                role="region"
                aria-labelledby="synthesis-how-works-heading"
                className="mt-3 max-w-2xl rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-3 text-xs leading-relaxed text-[var(--text-secondary)]"
              >
                <p
                  id="synthesis-how-works-heading"
                  className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                >
                  How this works
                </p>
                <p className="mt-2">
                  <span className="font-medium text-[var(--text-primary)]">
                    Round 1:
                  </span>{' '}
                  Three models answered your prompt independently with no knowledge
                  of each other.{' '}
                  <span className="font-medium text-[var(--text-primary)]">
                    Round 2:
                  </span>{' '}
                  Each model read the other two responses and identified what
                  they agreed with, challenged, or found missing.{' '}
                  <span className="font-medium text-[var(--text-primary)]">
                    Synthesis:
                  </span>{' '}
                  A final pass reconciled all three positions — prioritising
                  points of agreement and resolving contradictions — to produce
                  this answer.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {divergence && (
        <div className="border-t border-dashed border-[var(--border)] bg-[var(--bg-synthesis)] px-6 py-6 md:px-10">
          <p className="mb-4 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Overall divergence
          </p>
          <div className="flex justify-center">
            <TriangleConsensus scores={divergence} initials={triInitials} />
          </div>
        </div>
      )}

      <div className="px-6 py-8 md:px-10 md:py-10">
        <div className={synthesisOutputMarkdownClass}>
          <ReactMarkdown>{output}</ReactMarkdown>
        </div>
      </div>

      <div className="border-t border-dashed border-[var(--border)] px-6 py-6 md:px-10">
        <h3 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
          <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
          className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-[var(--accent-forge)] px-5 py-2.5 font-mono text-xs font-semibold text-white transition hover:opacity-95"
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
