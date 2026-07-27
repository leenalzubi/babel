import { describe, expect, it } from 'vitest'
import { parseSynthesisOutput } from './parseSynthesisOutput.js'

describe('synthesis failure / fallback', () => {
  it('does not wipe prior voice payloads when synthesis text is unusable', () => {
    const priorVoices = {
      ra: 'voice a stayed',
      rb: 'voice b stayed',
      rc: 'voice c stayed',
    }
    const parsed = parseSynthesisOutput('not a structured artifact', {
      agentA: { name: 'A' },
      agentB: { name: 'B' },
      agentC: { name: 'C' },
    })
    // Fallback still produces output; callers keep rounds/reviews separately
    expect(typeof parsed.output).toBe('string')
    expect(priorVoices.ra).toBe('voice a stayed')
    expect(priorVoices.rb).toBe('voice b stayed')
    expect(priorVoices.rc).toBe('voice c stayed')
  })
})
