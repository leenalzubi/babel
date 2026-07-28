/**
 * Section heading block: optional eyebrow + bold display title + optional lede.
 * @param {{
 *   eyebrow?: string,
 *   title: string,
 *   lede?: string,
 *   as?: 'h1' | 'h2' | 'h3',
 *   titleId?: string,
 *   className?: string,
 * }} props
 */
import Eyebrow from './Eyebrow.jsx'

export default function SectionHeading({
  eyebrow,
  title,
  lede,
  as: Tag = 'h2',
  titleId,
  className = '',
}) {
  return (
    <header className={`babel-section-heading ${className}`.trim()}>
      {eyebrow ? <Eyebrow className="m-0">{eyebrow}</Eyebrow> : null}
      <Tag id={titleId} className="babel-display">
        {title}
      </Tag>
      {lede ? <p className="babel-lede">{lede}</p> : null}
    </header>
  )
}
