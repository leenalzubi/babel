import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import {
  dispatchBabelSynthesisToggled,
  readBabelSynthesisEnabled,
} from '../lib/babelSynthesisPref.js'
import { FORGE_SETTINGS_DEFAULTS, loadForgeSettings } from '../lib/forgeSettings.js'

function envKeySet(key) {
  try {
    const v = import.meta.env[key]
    return typeof v === 'string' && v.trim().length > 0
  } catch {
    return false
  }
}

function StatusPill({ label, ok }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-2.5 py-1.5 babel-meta font-medium ${
        ok
          ? 'border-[var(--agree)]/50 bg-[var(--agree)]/15 text-[var(--agree)]'
          : 'border-[var(--border)] bg-[var(--bg-base)] text-[var(--ink-soft)]'
      }`}
    >
      {label}: {ok ? 'Set' : 'Not set'}
    </span>
  )
}

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function SettingsDrawer({ open, onClose }) {
  const { applySettings } = useForgeUiSettings()
  const [draft, setDraft] = useState(() => ({ ...FORGE_SETTINGS_DEFAULTS }))
  const [synthesisPass, setSynthesisPass] = useState(readBabelSynthesisEnabled)
  const draftRef = useRef(draft)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    if (!open) return
    /* Reload persisted settings when the drawer opens (external source of truth). */
    setDraft(loadForgeSettings()) // eslint-disable-line react-hooks/set-state-in-effect -- sync from localStorage
    setSynthesisPass(readBabelSynthesisEnabled())
  }, [open])

  const closeAndPersist = useCallback(() => {
    applySettings(draftRef.current)
    onClose()
  }, [applySettings, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeAndPersist()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeAndPersist])

  if (!open) return null

  const githubToken = envKeySet('VITE_GITHUB_TOKEN')
  const supabaseUrl = envKeySet('VITE_SUPABASE_URL')

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[2px]"
        aria-label="Close settings"
        onClick={closeAndPersist}
      />
      <aside
        className="settings-drawer-panel fixed bottom-0 right-0 top-0 z-[70] flex w-[100vw] max-w-[100vw] flex-col border-l border-[var(--border)] bg-[var(--bg-surface)] shadow-[0_8px_40px_rgba(0,0,0,0.08)] md:w-[min(100vw,320px)] md:max-w-[min(100vw,320px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-drawer-title"
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2
            id="settings-drawer-title"
            className="font-mono text-sm font-semibold tracking-wide text-[var(--text-primary)]"
          >
            Settings
          </h2>
          <button
            type="button"
            onClick={closeAndPersist}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
          <section>
            <label className="mb-2 block babel-eyebrow">
              Max debate rounds
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={draft.maxRounds}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxRounds: Number(e.target.value),
                  }))
                }
                className="h-2 flex-1 accent-[var(--accent-forge)]"
              />
              <span className="w-6 font-mono text-sm text-[var(--text-primary)]">
                {draft.maxRounds}
              </span>
            </div>
            <p className="mt-1 babel-meta text-[var(--text-muted)]">
              1-3 rounds (stored locally)
            </p>
          </section>

          <section>
            <label className="flex cursor-pointer flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3">
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={synthesisPass}
                  onChange={(e) => {
                    const v = e.target.checked
                    setSynthesisPass(v)
                    try {
                      localStorage.setItem(
                        'babel_synthesis_enabled',
                        v ? 'true' : 'false'
                      )
                      dispatchBabelSynthesisToggled()
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--accent-forge)]"
                />
                <span className="babel-meta font-medium text-[var(--text-primary)]">
                  Synthesis
                </span>
              </span>
              <span className="pl-7 babel-meta leading-snug text-[var(--text-muted)]">
                Generate a unified answer after final positions
              </span>
            </label>
          </section>

          <section>
            <span className="mb-2 block babel-eyebrow">
              Synthesis mode
            </span>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, synthesisMode: 'always' }))}
                className={`rounded-lg border px-3 py-2 text-left babel-meta transition ${
                  draft.synthesisMode === 'always'
                    ? 'border-[var(--accent-forge)] bg-[var(--accent-forge)]/15 text-[var(--text-primary)]'
                    : 'border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                }`}
              >
                Always synthesize
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({ ...d, synthesisMode: 'divergence' }))
                }
                className={`rounded-lg border px-3 py-2 text-left babel-meta transition ${
                  draft.synthesisMode === 'divergence'
                    ? 'border-[var(--accent-forge)] bg-[var(--accent-forge)]/15 text-[var(--text-primary)]'
                    : 'border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                }`}
              >
                Only synthesize if claim disagreement &gt; 40%
              </button>
            </div>
            <p className="mt-2 babel-meta leading-relaxed text-[var(--text-muted)]">
              Claim disagreement is computed after the debate audit. Until a pre-synthesis
              gate exists, both modes run synthesis whenever synthesis is enabled.
            </p>
          </section>

          <section>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5">
              <input
                type="checkbox"
                checked={draft.showRationale}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, showRationale: e.target.checked }))
                }
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent-forge)]"
              />
              <span className="babel-meta text-[var(--text-primary)]">
                Show rationale (“Why this answer”)
              </span>
            </label>
          </section>

          <section>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5">
              <input
                type="checkbox"
                checked={Boolean(draft.showResearchSurfaces)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    showResearchSurfaces: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent-forge)]"
              />
              <span className="babel-meta text-[var(--text-primary)]">
                Show research surfaces (influence, divergence, audit trail)
              </span>
            </label>
            <p className="mt-2 babel-meta leading-relaxed text-[var(--text-muted)]">
              Off by default. The flagship path ends at the decision memo.
            </p>
          </section>

          <section>
            <span className="mb-2 block babel-eyebrow">
              API key status
            </span>
            <p className="mb-2 babel-meta leading-snug text-[var(--text-muted)]">
              Keys are read from your Vite env at build time. Values are never
              shown.
            </p>
            <div className="flex flex-col gap-2">
              <StatusPill label="GitHub Token" ok={githubToken} />
              <StatusPill label="Supabase" ok={supabaseUrl} />
            </div>
          </section>

          <section className="mt-auto border-t border-[var(--border)] pt-4">
            <h3 className="babel-meta font-semibold text-[var(--text-primary)]">
              Babel v1.0, multi-model debate engine
            </h3>
          </section>
        </div>

        <footer className="border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={closeAndPersist}
            className="babel-btn babel-btn-primary w-full"
          >
            Done
          </button>
        </footer>
      </aside>
    </>
  )
}
