import { useCallback, useState } from 'react'
import { Copy, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useForge } from '../store/useForgeStore.js'
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import {
  copyToClipboard,
  downloadMarkdown,
} from '../utils/exportUtils.js'
import TriangleConsensus from './TriangleConsensus.jsx'

const mdClass =
  'max-w-none text-[17px] leading-[1.65] text-[var(--text-primary)] [&_a]:text-[var(--accent-forge)] [&_code]:rounded-md [&_code]:bg-[var(--bg-raised)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h3]:text-lg [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-[var(--text-primary)] [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6'

const gradientBar = {
  height: 3,
  background: 'linear-gradient(90deg, var(--agent-a) 0%, var(--agent-b) 50%, var(--agent-c) 100%)',
}

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
      className="relative overflow-hidden rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] shadow-forge-card"
    >
      <div className="h-[3px] w-full" style={gradientBar} aria-hidden />

      <div className="relative px-6 pb-2 pt-6 md:px-10 md:pt-8">
        <button
          type="button"
          onClick={handleCopyOutput}
          aria-label="Copy synthesis output to clipboard"
          className="absolute right-4 top-4 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-[var(--text-secondary)] shadow-forge-card transition hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] md:right-8 md:top-6"
        >
          <Copy className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex items-start gap-3 pr-14">
          <Sparkles
            className="mt-1 h-6 w-6 shrink-0 text-[var(--accent-forge)]"
            aria-hidden
          />
          <div>
            <h2 className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-[var(--text-primary)]">
              Synthesis
            </h2>
            <p className="mt-2 max-w-2xl font-sans text-sm text-[var(--text-secondary)]">
              Unified answer from all three agents — this is the payoff.
            </p>
          </div>
        </div>
      </div>

      {divergence && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-base)]/50 px-6 py-6 md:px-10">
          <p className="mb-4 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Overall divergence
          </p>
          <div className="flex justify-center">
            <TriangleConsensus scores={divergence} initials={triInitials} />
          </div>
        </div>
      )}

      <div className="px-6 py-8 md:px-10 md:py-10">
        <ReactMarkdown className={mdClass}>{output}</ReactMarkdown>
      </div>

      <div className="border-t border-[var(--border)] px-6 py-6 md:px-10">
        <h3 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Contributions
        </h3>
        <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:gap-3">
          {attPills.map((p) => (
            <div
              key={p.short}
              className="inline-flex max-w-full items-start gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-raised)] py-2 pl-3 pr-4 shadow-forge-card"
              style={{ borderLeftWidth: 3, borderLeftColor: p.color }}
            >
              <span
                className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <p className="min-w-0 font-sans text-[13px] leading-snug text-[var(--text-secondary)]">
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
        <div className="border-t border-[var(--border)] px-6 py-6 md:px-10">
          <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Why this answer
          </h3>
          <p className="text-[15px] italic leading-relaxed text-[var(--text-secondary)]">
            {rationale}
          </p>
        </div>
      ) : null}

      <div className="relative flex flex-col items-stretch gap-2 border-t border-[var(--border)] px-6 py-4 sm:flex-row sm:justify-end md:px-10">
        <button
          type="button"
          onClick={handleExportFull}
          aria-label="Export full debate as Markdown file"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-forge)] px-5 py-2.5 font-mono text-xs font-semibold text-white shadow-forge-card transition hover:brightness-[1.03]"
        >
          Export full debate
        </button>
        {toast ? (
          <span
            className="pointer-events-none absolute bottom-full right-6 mb-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[10px] text-[var(--agree)] shadow-forge-card sm:right-8"
            role="status"
          >
            {toast === 'downloaded' ? 'Downloaded!' : 'Copied!'}
          </span>
        ) : null}
      </div>
    </article>
  )
}
