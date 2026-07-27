import Eyebrow from './Eyebrow.jsx'
import { EVAL_PROMPT_SUITE } from '../lib/evalPromptSuite.js'

const EXAMPLES = EVAL_PROMPT_SUITE.slice(0, 4).map((p) => p.decision)

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
        fill="#1E4E5E"
        fillOpacity="0.15"
        stroke="#1E4E5E"
        strokeWidth="1.5"
      />
      <polygon
        points="8,28 6,36 16,28"
        fill="#1E4E5E"
        fillOpacity="0.15"
        stroke="#1E4E5E"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect
        x="44"
        y="4"
        width="36"
        height="24"
        rx="8"
        fill="#4C6647"
        fillOpacity="0.15"
        stroke="#4C6647"
        strokeWidth="1.5"
      />
      <polygon
        points="64,28 62,36 72,28"
        fill="#4C6647"
        fillOpacity="0.15"
        stroke="#4C6647"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect
        x="22"
        y="18"
        width="36"
        height="24"
        rx="8"
        fill="#97372B"
        fillOpacity="0.15"
        stroke="#97372B"
        strokeWidth="1.5"
      />
      <polygon
        points="30,42 28,50 38,42"
        fill="#97372B"
        fillOpacity="0.15"
        stroke="#97372B"
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
      <Eyebrow className="justify-center">Begin a debate</Eyebrow>
      <p className="babel-lede mt-4 text-center">
        Enter a prompt above. Three agents debate it, cross-review each other,
        and synthesize a refined answer.
      </p>
      <div className="mt-8 flex w-full max-w-md flex-col gap-2">
        <Eyebrow className="justify-center">Try an example</Eyebrow>
        <div className="mt-2 flex flex-col gap-2">
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
              className="rounded-[4px] border-l-[3px] border-l-[var(--ochre)] bg-[var(--plaster)] py-3 pl-3 pr-2 text-left babel-meta italic leading-snug text-[var(--ink-soft)] shadow-forge-card transition hover:bg-[var(--ochre-wash)]"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
