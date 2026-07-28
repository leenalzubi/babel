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
    expect(theme).toMatch(/--stage:\s*1180px/)
    expect(theme).toMatch(/--chrome:\s*2400px/)
    expect(theme).toMatch(/--shell-inset:\s*160px/)
    expect(theme).toMatch(/--reading:\s*44rem/)
    expect(theme).toMatch(/--text-body:\s*1rem/)
    expect(theme).toMatch(/--text-lede:\s*1\.0625rem/)
    expect(theme).toMatch(/--text-meta:\s*0\.8125rem/)
    expect(theme).toMatch(/--text-label:\s*0\.75rem/)
    expect(theme).toMatch(/--text-eyebrow:\s*0\.6875rem/)
    expect(theme).toMatch(/--text-mono:\s*0\.75rem/)
    expect(theme).toMatch(/--text-control:\s*0\.875rem/)
    expect(theme).toMatch(/--s-9:\s*80px/)
    expect(theme).toMatch(/--radius-window:\s*20px/)
    expect(theme).toMatch(/--shadow-window:/)
    expect(css).toMatch(/\.stage\s*\{/)
    expect(css).toMatch(/max-width:\s*var\(--stage\)/)
    expect(css).toMatch(/\.reading-column/)
    expect(theme).toMatch(/--gap-eyebrow:\s*var\(--s-2\)/)
    expect(theme).toMatch(/--gap-lede:\s*var\(--s-3\)/)
    expect(css).toMatch(/\.babel-eyebrow \+ \.babel-lede/)
    expect(theme).toMatch(/--font-display:\s*'Inter', system-ui, sans-serif/)
    expect(theme).toMatch(/--font-body:\s*'Inter', system-ui, sans-serif/)
    expect(theme).toMatch(/--font-mono:\s*'Inter', system-ui, sans-serif/)
    expect(css).toMatch(/@theme[\s\S]*--font-sans:\s*var\(--font-body\)/)
    expect(css).toMatch(/\.babel-display\s*\{[\s\S]*font-family:\s*var\(--font-display\)/)
    expect(css).toMatch(
      /\.babel-global-wordmark\s*\{[\s\S]*font-family:\s*var\(--font-display\)/
    )
    expect(css).toMatch(/\.babel-display-page/)
    expect(css).toMatch(
      /\.babel-display-page\s*\{[\s\S]*font-size:\s*clamp\(1\.5rem/
    )
    expect(css).toMatch(/\.babel-btn\s*\{[\s\S]*min-height:\s*48px/)
    expect(css).toMatch(/\.app-tab\s*\{[\s\S]*min-height:\s*48px/)
    expect(css).toMatch(/\.credit\s*\{[\s\S]*margin-top:\s*var\(--s-8\)/)
    expect(css).not.toMatch(/\.credit\s*\{[\s\S]*margin-top:\s*auto/)
    expect(css).not.toMatch(/\.metric-card\.has-description/)
    expect(css).not.toMatch(/\.metric-card\.compact/)
  })

  it('keeps the shell calm: opaque surfaces, quiet shortcuts, visible wordmark', () => {
    const css = readFileSync(join(root, 'src/index.css'), 'utf8')
    const theme = readFileSync(join(root, 'src/styles/theme.css'), 'utf8')
    expect(css).toMatch(
      /\.babel-global-wordmark\s*\{[\s\S]*font-size:\s*1\.25rem/
    )
    expect(css).toMatch(/\.babel-env-shortcut\s*\{[\s\S]*width:\s*var\(--env-rail\)/)
    expect(css).toMatch(/calc\(100vw - var\(--shell-inset/)
    expect(css).toMatch(/\.babel-chrome\s*\{/)
    expect(theme).toMatch(/--env-rail:\s*74px/)
    expect(theme).toMatch(/--chrome:\s*2400px/)
    expect(css).toMatch(
      /\.babel-env-shortcuts-col--left\s*\{[\s\S]*var\(--chrome-width\)/
    )
    expect(css).not.toMatch(/backdrop-filter:\s*blur/)
    expect(css).toMatch(/\.babel-environment-veil[\s\S]*0\.14/)
    expect(css).toMatch(/\.builder-note\s*\{[\s\S]*width:\s*min\(380px/)
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
    expect(css).toMatch(/\.babel-shell/)
    expect(css).toMatch(/\.babel-environment/)
    expect(css).toMatch(/\.babel-app-window/)
    expect(css).toMatch(
      /\.babel-app-window-body\s*\{[\s\S]*overflow-y:\s*auto/
    )
    expect(css).toMatch(/\.babel-shell\s*\{[\s\S]*overflow:\s*hidden/)
    expect(css).toMatch(/\.babel-global-nav/)
  })

  it('ships Babylon shell components and public environment asset', () => {
    for (const name of [
      'BabelShell.jsx',
      'BabylonBackground.jsx',
      'GlobalNav.jsx',
      'ApplicationWindow.jsx',
      'EnvironmentShortcuts.jsx',
      'WindowTitleBar.jsx',
    ]) {
      const src = readFileSync(
        join(root, 'src/components/shell', name),
        'utf8'
      )
      expect(src.length).toBeGreaterThan(40)
    }
    const png = readFileSync(
      join(root, 'public/images/babylon-environment.png')
    )
    expect(png.length).toBeGreaterThan(10_000)
  })
})
