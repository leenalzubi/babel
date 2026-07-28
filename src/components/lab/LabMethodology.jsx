import React from 'react'
import { METHODOLOGY } from '../../lib/lab/methodology.js'
import {
  formatLastUpdatedLabel,
} from '../../lib/lab/schema.js'
import MetadataRow from '../layout/MetadataRow.jsx'
import PageHeader from '../layout/PageHeader.jsx'
import PageSection from '../layout/PageSection.jsx'
import ReadingColumn from '../layout/ReadingColumn.jsx'

/**
 * @param {{
 *   datasetVersion: string,
 * }} props
 */
export default function LabMethodology({
  datasetVersion,
}) {
  const updated = formatLastUpdatedLabel(datasetVersion)

  return (
    <article className="reading-page" aria-labelledby="lab-method-title">
      <PageHeader
        title={METHODOLOGY.title}
        titleId="lab-method-title"
        lede={METHODOLOGY.intro}
      />

      <ReadingColumn>
        <PageSection first title="What is compared" titleId="lab-compared-h">
          <ol className="m-0 list-decimal space-y-5 pl-5">
            {METHODOLOGY.conditions.map((c) => (
              <li key={c.id}>
                <h3 className="babel-display babel-display-card m-0">
                  {c.title}
                </h3>
                <p className="babel-prose mt-2 mb-0">{c.body}</p>
              </li>
            ))}
          </ol>
        </PageSection>

        <PageSection title="What is evaluated" titleId="lab-evaluated-h">
          <p className="babel-prose m-0">{METHODOLOGY.scale}</p>
          <dl className="mt-6 space-y-5">
            {METHODOLOGY.criteria.map((c) => (
              <div key={c.id}>
                <dt className="babel-display babel-display-card m-0">
                  {c.title}
                </dt>
                <dd className="babel-prose mt-2 mb-0">{c.body}</dd>
              </div>
            ))}
          </dl>
        </PageSection>

        <PageSection
          title="How results are reported"
          titleId="lab-reported-h"
        >
          <div className="space-y-5">
            <div>
              <h3 className="babel-display babel-display-card m-0">
                Human evaluation
              </h3>
              <p className="babel-prose mt-2 mb-0">{METHODOLOGY.humanEval}</p>
            </div>
            <div>
              <h3 className="babel-display babel-display-card m-0">
                Automated evaluation
              </h3>
              <p className="babel-prose mt-2 mb-0">{METHODOLOGY.llmJudge}</p>
            </div>
            <div>
              <h3 className="babel-display babel-display-card m-0">
                Deterministic metrics
              </h3>
              <p className="babel-prose mt-2 mb-0">
                {METHODOLOGY.deterministic}
              </p>
            </div>
            <div>
              <h3 className="babel-display babel-display-card m-0">
                No cherry-picking
              </h3>
              <ul className="babel-prose mt-2 mb-0 list-disc space-y-2 pl-5">
                {METHODOLOGY.noCherryPicking.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="babel-display babel-display-card m-0">Privacy</h3>
              <ul className="babel-prose mt-2 mb-0 list-disc space-y-2 pl-5">
                {METHODOLOGY.privacy.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>
        </PageSection>

        <PageSection title="Current limitations" titleId="lab-limits-method-h">
          <ul className="babel-prose m-0 list-disc space-y-2 pl-5">
            {METHODOLOGY.currentLimitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </PageSection>

        <PageSection title="Technical details" titleId="lab-tech-h">
          <MetadataRow
            fields={[
              {
                label: 'Methodology version',
                value: METHODOLOGY.methodologyVersionLabel,
              },
              ...(updated
                ? [
                    {
                      label: 'Evaluation data last updated',
                      value: updated.replace(/^Last updated /, ''),
                    },
                  ]
                : []),
            ]}
          />
        </PageSection>
      </ReadingColumn>
    </article>
  )
}
