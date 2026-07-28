import React from 'react'
import Eyebrow from '../Eyebrow.jsx'

/**
 * Shared page identity block used across all routes.
 * @param {{
 *   eyebrow?: string,
 *   title: string,
 *   lede?: string,
 *   titleId?: string,
 *   actions?: import('react').ReactNode,
 *   metadata?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export default function PageHeader({
  eyebrow,
  title,
  lede,
  titleId,
  actions,
  metadata,
  className = '',
}) {
  return (
    <header className={`page-header ${className}`.trim()}>
      {eyebrow ? <Eyebrow className="m-0">{eyebrow}</Eyebrow> : null}
      <h1 id={titleId} className="babel-display babel-display-page">
        {title}
      </h1>
      {lede ? <p className="babel-lede">{lede}</p> : null}
      {actions ? <div className="action-group">{actions}</div> : null}
      {metadata ? <div className="metadata-row">{metadata}</div> : null}
    </header>
  )
}
