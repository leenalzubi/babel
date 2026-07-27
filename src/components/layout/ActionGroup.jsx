import React from 'react'

/**
 * Horizontal wrap group for primary page actions.
 * @param {{
 *   children: import('react').ReactNode,
 *   className?: string,
 *   label?: string,
 * }} props
 */
export default function ActionGroup({ children, className = '', label }) {
  return (
    <div
      className={`action-group ${className}`.trim()}
      role={label ? 'group' : undefined}
      aria-label={label}
    >
      {children}
    </div>
  )
}
