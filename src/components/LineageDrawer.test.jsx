/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LineageDrawer from './LineageDrawer.jsx'

const finding = {
  findingId: 'agreement',
  type: 'agreement',
  text: 'Prefer a reversible rollout.',
  supportingClaimIds: ['A-C1'],
  challengingClaimIds: [],
  relatedClaimIds: [],
  lineageStatus: 'complete',
  kind: 'agreement',
}

const registry = {
  'A-C1': {
    claimId: 'A-C1',
    responseId: 'voice-r1-a',
    roundId: 'round_1',
    agentId: 'a',
    roleLabel: 'Skeptic',
    modelId: 'gpt',
    modelName: 'GPT',
    text: 'Use a feature flag.',
    evolution: 'kept',
    evidenceState: 'model_supplied',
    challengedByClaimIds: [],
  },
}

const voiceRecords = {
  'voice-r1-a': {
    responseId: 'voice-r1-a',
    roleLabel: 'Skeptic',
    modelName: 'GPT',
    roundId: 'round_1',
    rawText: 'Use a feature flag. Exact prose.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
}

describe('LineageDrawer a11y', () => {
  it('opens with dialog semantics and closes on Escape returning focus', () => {
    const onClose = vi.fn()
    const trigger = document.createElement('button')
    trigger.textContent = 'Trace'
    document.body.appendChild(trigger)
    trigger.focus()
    const returnFocusRef = { current: trigger }

    const { rerender } = render(
      <LineageDrawer
        open
        onClose={onClose}
        finding={finding}
        registry={registry}
        voiceRecords={voiceRecords}
        returnFocusRef={returnFocusRef}
      />
    )

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Prefer a reversible rollout.')).toBeTruthy()
    expect(screen.getByText(/Complete lineage/i)).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()

    rerender(
      <LineageDrawer
        open={false}
        onClose={onClose}
        finding={null}
        registry={registry}
        voiceRecords={voiceRecords}
        returnFocusRef={returnFocusRef}
      />
    )
    expect(document.activeElement).toBe(trigger)
  })

  it('opens original response without executing HTML', () => {
    const unsafe = {
      ...voiceRecords,
      'voice-r1-a': {
        ...voiceRecords['voice-r1-a'],
        rawText: 'Hello <img src=x onerror="window.__xss=1"> world',
      },
    }
    render(
      <LineageDrawer
        open
        onClose={() => {}}
        finding={finding}
        registry={registry}
        voiceRecords={unsafe}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /View original response/i }))
    expect(screen.getByText(/Exact passage mapping unavailable/i)).toBeTruthy()
    expect(window.__xss).toBeUndefined()
    // react-markdown should not create an img from raw HTML
    expect(document.querySelector('img')).toBeNull()
  })

  it('shows unavailable status text without relying on color', () => {
    render(
      <LineageDrawer
        open
        onClose={() => {}}
        finding={{
          ...finding,
          lineageStatus: 'unavailable',
          supportingClaimIds: [],
          limitation: 'Lineage unavailable for this debate.',
        }}
        registry={{}}
        voiceRecords={{}}
      />
    )
    expect(screen.getAllByText(/Lineage unavailable/i).length).toBeGreaterThan(0)
  })
})
