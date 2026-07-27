import { useId } from 'react'

/**
 * Mashrabiya lattice divider: 8-point star tessellation in umber line.
 * @param {{ tight?: boolean, className?: string }} props
 */
export default function MashrabiyaScreen({ tight = false, className = '' }) {
  const uid = useId().replace(/:/g, '')
  const patternId = `babel-mashrabiya-${uid}`

  return (
    <svg
      className={`babel-screen ${tight ? 'babel-screen-tight' : ''} ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={patternId}
          width="56"
          height="56"
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke="currentColor" strokeWidth="1.15">
            <path d="M28 4 L36 20 L52 28 L36 36 L28 52 L20 36 L4 28 L20 20 Z" />
            <rect
              x="18"
              y="18"
              width="20"
              height="20"
              transform="rotate(45 28 28)"
            />
            <path d="M0 28 H8 M48 28 H56 M28 0 V8 M28 48 V56" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
