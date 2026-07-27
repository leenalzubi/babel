/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

describe('visual system primitives', () => {
  it('defines shared stage, reading column, and type tokens', () => {
    const css = readFileSync(join(root, 'src/index.css'), 'utf8')
    const theme = readFileSync(join(root, 'src/styles/theme.css'), 'utf8')
    expect(theme).toMatch(/--stage:\s*1200px/)
    expect(theme).toMatch(/--reading:\s*42rem/)
    expect(theme).toMatch(/--text-body:\s*1\.125rem/)
    expect(theme).toMatch(/--text-lede:\s*1\.25rem/)
    expect(theme).toMatch(/--text-meta:\s*0\.9375rem/)
    expect(theme).toMatch(/--text-label:\s*0\.875rem/)
    expect(theme).toMatch(/--text-control:\s*1rem/)
    expect(css).toMatch(/\.stage\s*\{/)
    expect(css).toMatch(/max-width:\s*var\(--stage\)/)
    expect(css).toMatch(/\.reading-column/)
    expect(css).toMatch(/\.page-header/)
    expect(css).toMatch(/\.babel-display-page/)
    expect(css).toMatch(
      /\.babel-display-page\s*\{[\s\S]*font-size:\s*clamp\(2\.5rem,\s*4vw,\s*3\.5rem\)/
    )
    expect(css).toMatch(/\.babel-btn\s*\{[\s\S]*min-height:\s*48px/)
    expect(css).toMatch(/\.app-tab\s*\{[\s\S]*min-height:\s*48px/)
    expect(css).toMatch(/\.credit\s*\{[\s\S]*margin-top:\s*var\(--s-8\)/)
    expect(css).not.toMatch(/\.credit\s*\{[\s\S]*margin-top:\s*auto/)
    expect(css).not.toMatch(/\.metric-card\.has-description/)
    expect(css).not.toMatch(/\.metric-card\.compact/)
  })

  it('ships shared layout components', () => {
    for (const name of [
      'PageHeader.jsx',
      'ReadingColumn.jsx',
      'PageSection.jsx',
      'MetadataRow.jsx',
      'ActionGroup.jsx',
    ]) {
      const src = readFileSync(
        join(root, 'src/components/layout', name),
        'utf8'
      )
      expect(src.length).toBeGreaterThan(40)
    }
  })

  it('keeps Lab index free of middot metadata and raw dataset labels', () => {
    const src = readFileSync(
      join(root, 'src/components/lab/LabIndex.jsx'),
      'utf8'
    )
    expect(src).not.toMatch(/ · /)
    expect(src).not.toMatch(/Dataset \{/)
    expect(src).toMatch(/Last updated|formatLastUpdatedLabel/)
    expect(src).toMatch(/Current evidence/)
    expect(src).toMatch(/Evaluation cases/)
  })

  it('does not advertise Rubric v1 in methodology UI', () => {
    const src = readFileSync(
      join(root, 'src/components/lab/LabMethodology.jsx'),
      'utf8'
    )
    expect(src).not.toMatch(/Rubric \{/)
    expect(src).toMatch(/Evaluation method/)
    expect(src).toMatch(/Methodology version/)
  })

  it('maps essential muted text to ink-soft for AA contrast', () => {
    const theme = readFileSync(join(root, 'src/styles/theme.css'), 'utf8')
    expect(theme).toMatch(/--text-muted:\s*var\(--ink-soft\)/)
    expect(theme).toMatch(/--ink-faint:/)
  })

  it('migrates Findings and About onto shared PageHeader', () => {
    const findings = readFileSync(
      join(root, 'src/components/FindingsPanel.jsx'),
      'utf8'
    )
    const about = readFileSync(
      join(root, 'src/components/ResearchPanel.jsx'),
      'utf8'
    )
    expect(findings).toMatch(/PageHeader/)
    expect(findings).toMatch(/An open record of disagreement/)
    expect(about).toMatch(/PageHeader/)
    expect(about).toMatch(/What Babel is/)
  })

  it('keeps stage gutters at 16 / 24 / 32', () => {
    const css = readFileSync(join(root, 'src/index.css'), 'utf8')
    expect(css).toMatch(
      /\.stage\s*\{[\s\S]*padding-inline:\s*16px/
    )
    expect(css).toMatch(/@media \(min-width: 600px\)[\s\S]*\.stage[\s\S]*padding-inline:\s*24px/)
    expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*\.stage[\s\S]*padding-inline:\s*32px/)
  })
})
