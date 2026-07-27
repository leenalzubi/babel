import React from 'react'
import { computeLabSummary } from '../../lib/lab/aggregates.js'
import { listPublishedCases } from '../../lib/lab/loadCases.js'
import {
  CONDITION_LABELS,
  formatLastUpdatedLabel,
} from '../../lib/lab/schema.js'
import ActionGroup from '../layout/ActionGroup.jsx'
import MetadataRow from '../layout/MetadataRow.jsx'
import PageHeader from '../layout/PageHeader.jsx'
import PageSection from '../layout/PageSection.jsx'
import ReadingColumn from '../layout/ReadingColumn.jsx'

/**
 * @param {{
 *   catalog: {
 *     datasetVersion: string,
 *     cases: import('../../lib/lab/labTypes.js').EvaluationCase[],
 *     loadErrors: { file: string, error: string }[],
 *   },
 *   onOpenCase: (slug: string) => void,
 *   onOpenMethodology: () => void,
 * }} props
 */
export default function LabIndex({ catalog, onOpenCase, onOpenMethodology }) {
  const published = listPublishedCases(catalog.cases)
  const summary = computeLabSummary(catalog.cases)
  const updated = formatLastUpdatedLabel(catalog.datasetVersion)

  return (
    <div className="hybrid-page">
      <PageHeader
        className="mb-0 page-intro"
        eyebrow="Public evaluation"
        title="Babel Lab"
        titleId="lab-title"
        lede="A public record of where structured model debate helps, where it does not, and what it costs."
        actions={
          <ActionGroup label="Lab documents">
            <button
              type="button"
              className="babel-btn babel-btn-ghost"
              onClick={onOpenMethodology}
            >
              Read the methodology
            </button>
            <a
              href="#lab-limitations"
              className="babel-btn babel-btn-quiet"
            >
              Read the limitations
            </a>
          </ActionGroup>
        }
        metadata={
          updated ? (
            <MetadataRow fields={[{ value: updated }]} />
          ) : null
        }
      />

      <PageSection
        first
        title="Current evidence"
        titleId="lab-summary-h"
      >
        <ReadingColumn>
          {!summary.ready ? (
            <p className="babel-prose m-0">
              {summary.message}
              {summary.note ? (
                <>
                  {' '}
                  <span className="babel-caption">{summary.note}</span>
                </>
              ) : null}
            </p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0 babel-meta">
              <li>Published cases: {summary.publishedCount}</li>
              {summary.babelHighestHuman != null ? (
                <li>
                  Cases where Babel received the highest human score:{' '}
                  {summary.babelHighestHuman}
                </li>
              ) : null}
              {summary.babelDidNotOutperform != null ? (
                <li>
                  Cases where Babel did not outperform baselines:{' '}
                  {summary.babelDidNotOutperform}
                </li>
              ) : null}
            </ul>
          )}
        </ReadingColumn>
      </PageSection>

      <PageSection title="Evaluation cases" titleId="lab-cases-h" wide>
        {published.length === 0 ? (
          <p className="babel-caption m-0">No published cases yet.</p>
        ) : (
          <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-1 lg:grid-cols-2">
            {published.map((c) => {
              const conditions = [
                ...new Set(c.artifacts.map((a) => a.condition)),
              ]
              const evaluated = c.artifacts.some((a) =>
                a.scores.some(
                  (s) => s.method !== 'not_evaluated' && s.score != null
                )
              )
              return (
                <li key={c.id} className="babel-card flex flex-col">
                  <h3 className="babel-display babel-display-card m-0">
                    {c.title}
                  </h3>
                  <MetadataRow
                    className="mt-3"
                    fields={[
                      { label: 'Domain', value: c.domain },
                      {
                        label: 'Status',
                        value: evaluated
                          ? 'Partially evaluated'
                          : 'Not yet evaluated',
                      },
                    ]}
                  />
                  <p className="babel-prose mt-4 mb-0">
                    {c.prompt.length > 160
                      ? `${c.prompt.slice(0, 160)}…`
                      : c.prompt}
                  </p>
                  <MetadataRow
                    className="mt-3"
                    fields={[
                      {
                        label: 'Conditions',
                        value: conditions.length
                          ? conditions
                              .map((x) => CONDITION_LABELS[x] ?? x)
                              .join(', ')
                          : 'None recorded',
                        unavailable: conditions.length === 0,
                      },
                    ]}
                  />
                  {c.conciseFinding ? (
                    <p className="mt-4 mb-0 text-[var(--text-body)] leading-[var(--lh-body)] text-[var(--ink)]">
                      {c.conciseFinding}
                    </p>
                  ) : null}
                  {c.limitations[0] ? (
                    <p className="babel-caution mt-4 mb-0">
                      Limitation: {c.limitations[0]}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="babel-btn babel-btn-ghost mt-5 self-start"
                    onClick={() => onOpenCase(c.slug)}
                  >
                    Open evaluation case
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PageSection>

      <PageSection
        id="lab-limitations"
        title="Limitations"
        titleId="lab-limits-h"
      >
        <ReadingColumn>
          <ul className="babel-prose m-0 list-disc space-y-2 pl-5">
            <li>
              The Lab never invents scores, latencies, costs, or model outputs.
            </li>
            <li>
              Draft cases exist in the repository for future runs but are hidden
              from this public index.
            </li>
            <li>
              Aggregate comparisons appear only when enough published, scored
              cases exist.
            </li>
            <li>
              Private user debates are not published here. See the methodology
              for the no-cherry-picking policy.
            </li>
          </ul>
          {catalog.loadErrors.length > 0 ? (
            <p className="babel-meta mt-4 mb-0 text-[var(--ink-soft)]">
              {catalog.loadErrors.length} malformed case file
              {catalog.loadErrors.length === 1 ? '' : 's'} skipped.
            </p>
          ) : null}
        </ReadingColumn>
      </PageSection>
    </div>
  )
}
