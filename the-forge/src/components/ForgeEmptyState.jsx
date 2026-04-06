import { Anvil, Flame } from 'lucide-react'

const EXAMPLES = [
  'What is the strongest argument for remote-first work culture?',
  'How should a B2B SaaS company prioritize its product roadmap?',
  'What makes a good API design?',
]

/**
 * @param {{ onPickExample: (text: string) => void }} props
 */
export default function ForgeEmptyState({ onPickExample }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-12 text-center md:py-16">
      <div className="mb-6 flex items-center justify-center gap-2 text-[var(--accent-forge)]">
        <Anvil className="h-14 w-14 md:h-16 md:w-16" strokeWidth={1.25} aria-hidden />
        <Flame className="h-12 w-12 md:h-14 md:w-14" strokeWidth={1.25} aria-hidden />
      </div>
      <h2 className="font-mono text-xl font-bold tracking-tight text-[var(--text-primary)] md:text-2xl">
        Ready to Forge
      </h2>
      <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-[var(--text-secondary)]">
        Enter a prompt above. Three agents debate it, cross-review each other, and
        synthesize a refined answer.
      </p>
      <div className="mt-8 flex w-full max-w-md flex-col gap-2">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Try an example
        </span>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onPickExample(ex)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-left font-sans text-xs leading-snug text-[var(--text-secondary)] transition hover:border-[var(--accent-forge)]/40 hover:text-[var(--text-primary)]"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
