import PageHeader from './layout/PageHeader.jsx'
import ReadingColumn from './layout/ReadingColumn.jsx'
import { ARCHIVE_CONTENT } from '../lib/easterEggs/catalog.js'

/**
 * Quiet archive page — only linked after discovery unlock.
 * Content is drawn from existing product documentation.
 */
export default function ArchivePanel() {
  return (
    <article className="reading-page" aria-label="The Babel Archive">
      <PageHeader
        eyebrow="Archive"
        title={ARCHIVE_CONTENT.title}
        lede={ARCHIVE_CONTENT.lede}
      />
      <ReadingColumn>
        <div className="babel-prose space-y-8">
          {ARCHIVE_CONTENT.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="babel-display babel-display-section mb-3">
                {section.heading}
              </h2>
              <p className="babel-prose mb-0">{section.body}</p>
            </section>
          ))}
        </div>
      </ReadingColumn>
    </article>
  )
}
