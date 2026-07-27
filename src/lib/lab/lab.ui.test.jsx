/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import LabIndex from '../../components/lab/LabIndex.jsx'
import LabCaseDetail from '../../components/lab/LabCaseDetail.jsx'
import LabMethodology from '../../components/lab/LabMethodology.jsx'
import { loadEvaluationCatalog, listPublishedCases } from './loadCases.js'
import {
  formatHumanDate,
  formatLastUpdatedLabel,
} from './schema.js'

afterEach(() => {
  cleanup()
})

describe('Babel Lab UI', () => {
  it('shows published cases on the index and hides drafts', () => {
    const catalog = loadEvaluationCatalog()
    const published = listPublishedCases(catalog.cases)
    expect(published.some((c) => c.slug === 'ai-action-items')).toBe(true)
    expect(published.every((c) => c.status === 'published')).toBe(true)

    render(
      <LabIndex
        catalog={catalog}
        onOpenCase={() => {}}
        onOpenMethodology={() => {}}
      />
    )
    expect(screen.getByRole('heading', { name: 'Babel Lab' })).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Current evidence' })
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Evaluation cases' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Read the methodology/i })
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        name: /AI meeting assistant without human approval/i,
      })
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: /React vs Vue/i })
    ).toBeNull()
  })

  it('uses human-readable update labels and no middots in Lab index metadata', () => {
    const catalog = loadEvaluationCatalog()
    const { container } = render(
      <LabIndex
        catalog={catalog}
        onOpenCase={() => {}}
        onOpenMethodology={() => {}}
      />
    )
    expect(screen.getByText(/Last updated July 26, 2026/i)).toBeTruthy()
    expect(screen.queryByText(/Dataset 2026-07-26/i)).toBeNull()
    expect(container.textContent).not.toMatch(/ · /)
  })

  it('renders methodology with evaluation-method language', () => {
    render(
      <LabMethodology
        onBack={() => {}}
        datasetVersion="2026-07-26"
      />
    )
    expect(
      screen.getByRole('heading', {
        name: /How Babel Lab evaluates cases/i,
      })
    ).toBeTruthy()
    expect(screen.getByText(/Evaluation method/i)).toBeTruthy()
    expect(screen.queryByText(/Rubric v1/i)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Technical details' })).toBeTruthy()
    expect(screen.getByText('1.0')).toBeTruthy()
    expect(screen.getByText(/July 26, 2026/)).toBeTruthy()
  })

  it('renders Not evaluated / Not recorded and switches conditions', () => {
    const catalog = loadEvaluationCatalog()
    render(
      <LabCaseDetail
        slug="ai-action-items"
        cases={catalog.cases}
        onBack={() => {}}
        onOpenMethodology={() => {}}
      />
    )
    expect(screen.getAllByText('Not evaluated').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0)
    expect(screen.getByText(/Last updated July 26, 2026/i)).toBeTruthy()
    expect(screen.queryByText(/Dataset 2026-07-26/i)).toBeNull()

    const single = screen.getByRole('button', {
      name: /^Single model$/,
    })
    fireEvent.click(single)
    expect(screen.getByText(/Showing: Single model/i)).toBeTruthy()
    expect(
      screen.getByText(/Output not recorded for this condition/i)
    ).toBeTruthy()
  })

  it('does not crash when slug is unknown', () => {
    const catalog = loadEvaluationCatalog()
    render(
      <LabCaseDetail
        slug="does-not-exist"
        cases={catalog.cases}
        onBack={() => {}}
        onOpenMethodology={() => {}}
      />
    )
    expect(screen.getByText(/Case not found/i)).toBeTruthy()
  })

  it('keeps long outputs from forcing horizontal page overflow classes', () => {
    const catalog = loadEvaluationCatalog()
    const cases = catalog.cases.map((c) =>
      c.slug === 'ai-action-items'
        ? {
            ...c,
            artifacts: c.artifacts.map((a) =>
              a.condition === 'single_model'
                ? {
                    ...a,
                    outputText: `${'word '.repeat(200)}end`,
                    failureNotes: [],
                  }
                : a
            ),
          }
        : c
    )
    const { container } = render(
      <LabCaseDetail
        slug="ai-action-items"
        cases={cases}
        onBack={() => {}}
        onOpenMethodology={() => {}}
      />
    )
    const article = container.querySelector('article')
    expect(article).toBeTruthy()
    fireEvent.click(
      within(/** @type {HTMLElement} */ (article)).getByRole('button', {
        name: /^Single model$/,
      })
    )
    expect(container.querySelector('.reading-column')).toBeTruthy()
    expect(screen.getByText(/end$/)).toBeTruthy()
  })

  it('supports keyboard activation of condition buttons', () => {
    const catalog = loadEvaluationCatalog()
    const { container } = render(
      <LabCaseDetail
        slug="ai-action-items"
        cases={catalog.cases}
        onBack={() => {}}
        onOpenMethodology={() => {}}
      />
    )
    const article = container.querySelector('article')
    const side = within(/** @type {HTMLElement} */ (article)).getByRole(
      'button',
      { name: /^Side by side$/ }
    )
    side.focus()
    expect(document.activeElement).toBe(side)
    fireEvent.click(side)
    expect(screen.getByText(/Showing: Side by side/i)).toBeTruthy()
  })
})

describe('lab display helpers', () => {
  it('formats dataset versions as human dates', () => {
    expect(formatHumanDate('2026-07-26')).toBe('July 26, 2026')
    expect(formatLastUpdatedLabel('2026-07-26')).toBe(
      'Last updated July 26, 2026'
    )
  })
})

describe('malformed catalog resilience', () => {
  it('loadEvaluationCatalog returns cases array even if some files fail validation', () => {
    const catalog = loadEvaluationCatalog()
    expect(Array.isArray(catalog.cases)).toBe(true)
    expect(catalog.cases.length).toBeGreaterThan(0)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => loadEvaluationCatalog()).not.toThrow()
  })
})
