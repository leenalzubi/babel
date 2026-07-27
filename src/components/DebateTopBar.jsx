import { useState } from 'react'

/**
 * Sticky question bar: appears once the reader scrolls past framing.
 * @param {{
 *   prompt: string,
 *   activeRound?: string | null,
 *   onJump?: (target: 'r1' | 'r2' | 'r3' | 'synthesis' | 'memo') => void,
 *   visible?: boolean,
 * }} props
 */
export default function DebateTopBar({
  prompt,
  activeRound = null,
  onJump,
  visible = true,
}) {
  const [expanded, setExpanded] = useState(false)
  if (!visible || !prompt.trim()) return null

  const oneLine = prompt.trim().replace(/\s+/g, ' ')

  return (
    <div
      className="topbar sticky z-[15] -mx-4 border-b border-[var(--line)] bg-[var(--plaster)] px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8"
      role="navigation"
      aria-label="Debate question"
    >
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2">
        <div className="min-w-0 flex-1">
          <p
            className={`m-0 font-[family-name:var(--font-body)] text-[0.9rem] text-[var(--ink)] ${
              expanded ? 'whitespace-pre-wrap' : 'truncate'
            }`}
          >
            {oneLine}
          </p>
          {oneLine.length > 72 ? (
            <button
              type="button"
              className="mt-1 babel-meta text-[var(--blue)] underline-offset-2 hover:underline md:hidden"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Collapse' : 'Expand question'}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            ['r1', 'R1'],
            ['r2', 'R2'],
            ['r3', 'R3'],
            ['synthesis', 'Synth'],
            ['memo', 'Memo'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`babel-btn babel-btn-quiet min-h-11 px-2 py-1 ${
                activeRound === id
                  ? 'border border-[var(--line)] bg-[var(--blue-wash)] text-[var(--blue-deep)]'
                  : ''
              }`}
              onClick={() => onJump?.(/** @type {any} */ (id))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
