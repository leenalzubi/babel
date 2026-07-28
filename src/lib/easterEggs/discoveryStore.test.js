import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetEasterEggStoreForTests,
  clearArchiveNoticePending,
  getEasterEggState,
  markEasterEggDiscovered,
  normalizeEasterEggState,
} from './discoveryStore.js'
import { ARCHIVE_UNLOCK_COUNT } from './catalog.js'

describe('easter egg discovery store', () => {
  beforeEach(() => {
    __resetEasterEggStoreForTests()
  })

  it('normalizes unknown ids and dedupes', () => {
    const state = normalizeEasterEggState({
      discovered: ['tablet-gate', 'nope', 'tablet-gate', 'creator-portrait'],
      archiveUnlocked: false,
    })
    expect(state.discovered).toEqual(['tablet-gate', 'creator-portrait'])
    expect(state.archiveUnlocked).toBe(false)
  })

  it('marks discoveries and unlocks archive at threshold', () => {
    markEasterEggDiscovered('creator-portrait')
    markEasterEggDiscovered('tablet-gate')
    expect(getEasterEggState().archiveUnlocked).toBe(false)
    expect(getEasterEggState().archiveNoticePending).toBe(false)

    markEasterEggDiscovered('tablet-water')
    const state = getEasterEggState()
    expect(state.discovered).toHaveLength(ARCHIVE_UNLOCK_COUNT)
    expect(state.archiveUnlocked).toBe(true)
    expect(state.archiveNoticePending).toBe(true)

    clearArchiveNoticePending()
    expect(getEasterEggState().archiveNoticePending).toBe(false)
    expect(getEasterEggState().archiveUnlocked).toBe(true)
  })

  it('is idempotent for the same egg', () => {
    markEasterEggDiscovered('lineage-mode')
    markEasterEggDiscovered('lineage-mode')
    expect(getEasterEggState().discovered).toEqual(['lineage-mode'])
  })

  it('accepts trash-archive as a discovery id', () => {
    markEasterEggDiscovered('trash-archive')
    expect(getEasterEggState().discovered).toContain('trash-archive')
  })
})
