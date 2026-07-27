/**
 * Shared voice card shell: model speaking from a niche.
 * Role is primary; model identity remains visible underneath.
 * @param {{
 *   title: string,
 *   subtitle?: string | null,
 *   color?: string,
 *   stance?: string,
 *   foot?: import('react').ReactNode,
 *   children: import('react').ReactNode,
 *   className?: string,
 *   regionLabel?: string,
 *   responseState?: 'pending' | 'streaming' | 'done' | 'declined' | 'failed' | null,
 *   extractionState?: string | null,
 *   responseDomId?: string | null,
 * }} props
 */
export default function VoiceCard({
  title,
  subtitle = null,
  color,
  stance,
  foot,
  children,
  className = '',
  regionLabel,
  responseState = null,
  extractionState = null,
  responseDomId = null,
}) {
  const heading = subtitle ? `${title}, ${subtitle}` : title
  const headingId = responseDomId
    ? `${responseDomId}-heading`
    : undefined

  return (
    <div
      role="region"
      aria-labelledby={headingId}
      aria-label={headingId ? undefined : regionLabel ?? heading}
      data-state={responseState || undefined}
      data-extraction={extractionState || undefined}
      className={`babel-voice voice forge-reveal-card ${className}`.trim()}
    >
      <div
        className={`babel-voice-niche niche${
          responseState === 'streaming' ? ' niche-pulse' : ''
        }`}
        style={
          color
            ? {
                background: `color-mix(in srgb, ${color} 18%, var(--plaster-hi))`,
                borderBottomColor: 'var(--line)',
              }
            : undefined
        }
      >
        <div className="min-w-0">
          <h3
            id={headingId}
            className="babel-voice-name m-0 block text-[0.8rem] font-medium"
            style={color ? { color } : undefined}
          >
            {title}
            {subtitle ? (
              <span className="model-name mt-0.5 block font-normal">
                {subtitle}
              </span>
            ) : null}
          </h3>
        </div>
        {stance ? <span className="babel-voice-stance">{stance}</span> : null}
      </div>
      <div className="babel-voice-body body" id={responseDomId || undefined}>
        {children}
      </div>
      {foot != null ? <div className="babel-voice-foot">{foot}</div> : null}
    </div>
  )
}
