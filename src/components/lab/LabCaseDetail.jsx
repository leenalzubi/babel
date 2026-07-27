import React, { useMemo, useState } from 'react'
import {
  artifactForCondition,
  findCaseBySlug,
  publicCaseView,
} from '../../lib/lab/loadCases.js'
import {
  CONDITION_LABELS,
  CRITERION_LABELS,
  EVALUATION_CONDITIONS,
  EVALUATION_CRITERIA,
  METHOD_LABELS,
  formatCostUsd,
  formatDurationMs,
  formatHumanDate,
  formatLastUpdatedLabel,
  formatMetricDisplay,
  formatScoreDisplay,
} from '../../lib/lab/schema.js'
import { trackLabEvent } from '../../lib/lab/analytics.js'
import ActionGroup from '../layout/ActionGroup.jsx'
import MetadataRow from '../layout/MetadataRow.jsx'
import PageHeader from '../layout/PageHeader.jsx'
import PageSection from '../layout/PageSection.jsx'
import ReadingColumn from '../layout/ReadingColumn.jsx'
import LabConditionOutput from './LabConditionOutput.jsx'

/**
 * @param {{
 *   slug: string,
 *   cases: import('../../lib/lab/labTypes.js').EvaluationCase[],
 *   onBack: () => void,
 *   onOpenMethodology: () => void,
 * }} props
 */
export default function LabCaseDetail({
  slug,
  cases,
  onBack,
  onOpenMethodology,
}) {
  const found = findCaseBySlug(cases, slug)
  const c = found ? publicCaseView(found) : null
  const available = useMemo(() => {
    if (!c) return []
    return EVALUATION_CONDITIONS.filter((cond) =>
      c.artifacts.some((a) => a.condition === cond)
    )
  }, [c])
  const [conditionOverride, setConditionOverride] = useState(
    /** @type {import('../../lib/lab/schema.js').EvaluationCondition | null} */ (
      null
    )
  )
  const condition =
    conditionOverride && available.includes(conditionOverride)
      ? conditionOverride
      : available[0] ?? 'babel'

  if (!c) {
    return (
      <article className="reading-page">
        <ReadingColumn>
          <button
            type="button"
            className="babel-btn babel-btn-quiet mb-6 px-2"
            onClick={onBack}
          >
            ← Babel Lab
          </button>
          <h1 className="babel-display babel-display-page">Case not found</h1>
          <p className="babel-lede">
            This slug is not a published or archived public case. Draft cases are
            not listed for public visitors.
          </p>
        </ReadingColumn>
      </article>
    )
  }

  const artifact = artifactForCondition(c, condition)
  const updated = formatLastUpdatedLabel(c.datasetVersion)
  const published = formatHumanDate(c.publishedAt)

  return (
    <article className="hybrid-page" aria-labelledby="lab-case-title">
      <a
        href="#lab-case-eval"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--plaster)] focus:px-3 focus:py-2 focus:text-[var(--blue)]"
      >
        Skip to evaluation table
      </a>

      <button
        type="button"
        className="babel-btn babel-btn-quiet mb-6 px-2"
        onClick={onBack}
      >
        ← Babel Lab
      </button>

      <PageHeader
        className="page-intro"
        eyebrow={
          c.status === 'archived' ? 'Archived case' : 'Evaluation case'
        }
        title={c.title}
        titleId="lab-case-title"
        metadata={
          <MetadataRow
            fields={[
              { label: 'Domain', value: c.domain },
              updated ? { value: updated } : null,
              published
                ? { label: 'Published', value: published }
                : null,
              c.status === 'archived' && c.archiveReason
                ? { label: 'Archived', value: c.archiveReason }
                : null,
            ].filter(Boolean)}
          />
        }
      />

      <PageSection first title="Case framing" titleId="lab-frame-h">
        <ReadingColumn>
          <h3 className="babel-eyebrow m-0">Prompt</h3>
          <p className="babel-prose mt-3 mb-0 whitespace-pre-wrap text-[var(--ink)]">
            {c.prompt}
          </p>
          {c.decisionCriteria?.length ? (
            <>
              <h3 className="babel-eyebrow mt-6 mb-0">Decision criteria</h3>
              <ul className="babel-prose mt-3 mb-0 list-disc pl-5">
                {c.decisionCriteria.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          ) : null}
          <h3 className="babel-eyebrow mt-6 mb-0">Why this case</h3>
          <p className="babel-prose mt-3 mb-0">{c.whyThisCase}</p>
          {c.knownDifficulty ? (
            <>
              <h3 className="babel-eyebrow mt-6 mb-0">Expected difficulty</h3>
              <p className="babel-prose mt-3 mb-0">{c.knownDifficulty}</p>
            </>
          ) : null}
        </ReadingColumn>
      </PageSection>

      <PageSection title="Condition" titleId="lab-cond-select-h">
        <ActionGroup label="Evaluation condition">
          {EVALUATION_CONDITIONS.map((cond) => {
            const has = available.includes(cond)
            const active = condition === cond
            return (
              <button
                key={cond}
                type="button"
                disabled={!has}
                aria-pressed={active}
                className={`babel-btn ${
                  active
                    ? 'babel-btn-primary'
                    : has
                      ? 'babel-btn-ghost'
                      : 'babel-btn-quiet'
                }`}
                onClick={() => {
                  setConditionOverride(cond)
                  trackLabEvent('condition_selected', {
                    slug: c.slug,
                    condition: cond,
                  })
                }}
              >
                {CONDITION_LABELS[cond]}
                {!has ? ' (unavailable)' : ''}
              </button>
            )
          })}
        </ActionGroup>
        <p className="babel-meta mt-3 mb-0" aria-live="polite">
          Showing: {CONDITION_LABELS[condition]}
        </p>
      </PageSection>

      <PageSection title="Output" titleId="lab-output-h">
        <LabConditionOutput artifact={artifact} condition={condition} />
      </PageSection>

      <PageSection
        id="lab-case-eval"
        title="Evaluation"
        titleId="lab-eval-h"
        wide
      >
        <p className="babel-meta mt-0 mb-4 max-w-[42rem]">
          Scores for the selected condition. Human and automated methods are
          labeled separately. Missing scores are not treated as zero.
        </p>
        <div className="overflow-x-auto">
          <table className="babel-table min-w-[36rem]">
            <thead>
              <tr>
                <th scope="col">Criterion</th>
                <th scope="col">Score</th>
                <th scope="col">Method</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {EVALUATION_CRITERIA.map((crit) => {
                const score =
                  artifact?.scores.find((s) => s.criterion === crit) ?? null
                return (
                  <tr key={crit}>
                    <th scope="row">{CRITERION_LABELS[crit]}</th>
                    <td className="babel-meta-tech">
                      {formatScoreDisplay(score)}
                    </td>
                    <td>
                      {score
                        ? METHOD_LABELS[score.method]
                        : METHOD_LABELS.not_evaluated}
                    </td>
                    <td className="babel-caption">
                      {score?.rationale || score?.limitations || 'None'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection
        title="Operational comparison"
        titleId="lab-ops-h"
        wide
      >
        <p className="babel-meta mt-0 mb-4 max-w-[42rem]">
          Values appear only when recorded on the artifact.
        </p>
        <div className="overflow-x-auto">
          <table className="babel-table min-w-[28rem]">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {EVALUATION_CONDITIONS.map((cond) => (
                  <th key={cond} scope="col">
                    {CONDITION_LABELS[cond]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: 'Duration',
                  read: (a) => formatDurationMs(a?.metrics?.durationMs),
                },
                {
                  label: 'Calls attempted',
                  read: (a) =>
                    formatMetricDisplay(a?.metrics?.callsAttempted),
                },
                {
                  label: 'Calls succeeded',
                  read: (a) =>
                    formatMetricDisplay(a?.metrics?.callsSucceeded),
                },
                {
                  label: 'Input tokens',
                  read: (a) => formatMetricDisplay(a?.metrics?.inputTokens),
                },
                {
                  label: 'Output tokens',
                  read: (a) => formatMetricDisplay(a?.metrics?.outputTokens),
                },
                {
                  label: 'Estimated cost',
                  read: (a) => formatCostUsd(a?.metrics?.estimatedCostUsd),
                },
                {
                  label: 'Completed with gaps',
                  read: (a) =>
                    formatMetricDisplay(a?.metrics?.completedWithGaps),
                },
              ].map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {EVALUATION_CONDITIONS.map((cond) => {
                    const a = artifactForCondition(c, cond)
                    return (
                      <td key={cond} className="babel-meta-tech">
                        {a ? row.read(a) : 'Not recorded'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {artifact?.modelIds?.length ? (
          <MetadataRow
            className="mt-5"
            fields={[
              {
                label: `Models (${CONDITION_LABELS[condition]})`,
                value: artifact.modelIds.join(', '),
              },
              artifact.promptVersion
                ? {
                    label: 'Prompt',
                    value: artifact.promptVersion,
                  }
                : null,
              artifact.orchestrationVersion
                ? {
                    label: 'Orchestration',
                    value: artifact.orchestrationVersion,
                  }
                : null,
            ].filter(Boolean)}
          />
        ) : null}
      </PageSection>

      <PageSection title="What Babel improved" titleId="lab-improved-h">
        <ReadingColumn>
          <p className="babel-prose m-0">
            {c.whatBabelImproved ||
              'Not evaluated. No evidence-backed improvement has been recorded for this case.'}
          </p>
        </ReadingColumn>
      </PageSection>

      <PageSection title="Where Babel did not help" titleId="lab-nohelp-h">
        <ReadingColumn>
          <div className="babel-caution">
            {c.whereBabelDidNotHelp ||
              'Required section missing; treat as incomplete case documentation.'}
          </div>
        </ReadingColumn>
      </PageSection>

      {c.caseConclusion ? (
        <PageSection title="Case conclusion" titleId="lab-concl-h">
          <ReadingColumn>
            <p className="babel-prose m-0">{c.caseConclusion}</p>
          </ReadingColumn>
        </PageSection>
      ) : null}

      <PageSection title="Limitations" titleId="lab-case-limits-h">
        <ReadingColumn>
          <ul className="babel-prose m-0 list-disc space-y-2 pl-5">
            {c.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <button
            type="button"
            className="babel-btn babel-btn-ghost mt-5"
            onClick={() => {
              trackLabEvent('limitation_section_viewed', { slug: c.slug })
              onOpenMethodology()
            }}
          >
            Read the methodology
          </button>
        </ReadingColumn>
      </PageSection>

      {c.changelog?.length ? (
        <PageSection title="Changelog" titleId="lab-change-h">
          <ReadingColumn>
            <ul className="babel-meta m-0 list-none space-y-2 p-0">
              {c.changelog.map((e) => (
                <li key={`${e.at}-${e.note}`}>
                  {formatHumanDate(e.at) || e.at.slice(0, 10)}: {e.note}
                </li>
              ))}
            </ul>
          </ReadingColumn>
        </PageSection>
      ) : null}

      <PageSection title="Raw artifacts" titleId="lab-raw-h">
        <ReadingColumn>
          <p className="babel-meta mt-0 mb-3">
            Expand to inspect recorded metadata. Private IDs and secrets are not
            included.
          </p>
          {c.artifacts.map((a) => (
            <details
              key={a.condition}
              className="babel-card mt-3"
              onToggle={(e) => {
                if (/** @type {HTMLDetailsElement} */ (e.currentTarget).open) {
                  trackLabEvent('raw_artifact_opened', {
                    slug: c.slug,
                    condition: a.condition,
                  })
                }
              }}
            >
              <summary className="min-h-11 cursor-pointer py-2 babel-meta text-[var(--ink)]">
                {CONDITION_LABELS[a.condition]} metadata
              </summary>
              <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words font-mono text-[0.8125rem] leading-relaxed text-[var(--ink-soft)]">
                {JSON.stringify(
                  {
                    condition: a.condition,
                    modelIds: a.modelIds,
                    roleAssignments: a.roleAssignments,
                    promptVersion: a.promptVersion,
                    orchestrationVersion: a.orchestrationVersion,
                    metrics: a.metrics,
                    scores: a.scores,
                    failureNotes: a.failureNotes,
                    developmentFixture: a.developmentFixture,
                    hasOutputText: Boolean(a.outputText),
                    sideBySideCount: a.sideBySideOutputs?.length ?? 0,
                    hasBabelRounds: Boolean(a.babelRounds),
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          ))}
        </ReadingColumn>
      </PageSection>
    </article>
  )
}
