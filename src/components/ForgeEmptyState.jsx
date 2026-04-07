const EXAMPLES = [
  'Is the ocean more dangerous than it was 100 years ago, or have we just gotten better at measuring the risk?',
  'At what point does a field of study become too specialized to be useful?',
  'Did the novel as a form peak in the 19th century?',
  'Is expertise overrated in an age where information is free?',
]

function ThreeBubblesIllustration() {
  return (
    <svg
      width={80}
      height={64}
      viewBox="0 0 80 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden
    >
      <rect
        x="0"
        y="4"
        width="36"
        height="24"
        rx="8"
        fill="#2563EB"
        fillOpacity="0.15"
        stroke="#2563EB"
        strokeWidth="1.5"
      />
      <polygon
        points="8,28 6,36 16,28"
        fill="#2563EB"
        fillOpacity="0.15"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect
        x="44"
        y="4"
        width="36"
        height="24"
        rx="8"
        fill="#16A34A"
        fillOpacity="0.15"
        stroke="#16A34A"
        strokeWidth="1.5"
      />
      <polygon
        points="64,28 62,36 72,28"
        fill="#16A34A"
        fillOpacity="0.15"
        stroke="#16A34A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect
        x="22"
        y="18"
        width="36"
        height="24"
        rx="8"
        fill="#DC2626"
        fillOpacity="0.15"
        stroke="#DC2626"
        strokeWidth="1.5"
      />
      <polygon
        points="30,42 28,50 38,42"
        fill="#DC2626"
        fillOpacity="0.15"
        stroke="#DC2626"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * @param {{
 *   onPickExample: (text: string) => void,
 *   onAfterExamplePick?: () => void,
 * }} props
 */
export default function ForgeEmptyState({ onPickExample, onAfterExamplePick }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-12 text-center md:py-16">
      <div className="mb-6 flex items-center justify-center">
        <ThreeBubblesIllustration />
      </div>
      <p className="mt-3 max-w-md text-sm italic leading-relaxed text-[var(--text-secondary)]">
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
              onClick={() => {
                onPickExample(ex)
                setTimeout(() => {
                  onAfterExamplePick?.()
                }, 0)
              }}
              className="rounded-[4px] border-l border-l-[var(--accent-forge)] bg-transparent py-2.5 pl-3 pr-2 text-left text-xs italic leading-snug text-[var(--text-secondary)] transition hover:bg-[var(--bg-synthesis)]"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
