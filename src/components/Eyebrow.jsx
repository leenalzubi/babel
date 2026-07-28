import React from 'react'

/**
 * Design-system eyebrow: ochre mark + section label.
 * @param {{ children: import('react').ReactNode, className?: string }} props
 */
export default function Eyebrow({ children, className = '' }) {
  return (
    <span
      className={`babel-eyebrow ${className}`.trim()}
    >
      {children}
    </span>
  )
}
