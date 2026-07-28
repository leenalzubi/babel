import { jumpToClaim } from '../../lib/claimNavigation.js'

/**
 * Clickable claim ID chips that jump to source passages.
 * @param {{ claimIds?: string[] }} props
 */
export default function ClaimIdLinks({ claimIds = [] }) {
  if (!claimIds.length) return null
  return (
    <p className="mt-2 flex flex-wrap gap-2 font-mono text-[0.72rem]">
      {claimIds.map((id) => (
        <button
          key={id}
          type="button"
          className="claim-id-chip min-h-11 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--blue-wash)] px-2 text-[var(--blue-deep)] underline-offset-2 hover:underline"
          onClick={() => jumpToClaim(id)}
        >
          {id}
        </button>
      ))}
    </p>
  )
}
