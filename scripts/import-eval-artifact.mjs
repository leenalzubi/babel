#!/usr/bin/env node
/**
 * Import a forge debate JSON export into a draft evaluation case artifact.
 *
 * Usage:
 *   node scripts/import-eval-artifact.mjs --case ai-action-items --condition babel --input ./debate.json
 *
 * Writes updated draft JSON under src/data/evaluations/cases/ (never sets published).
 * Prints missing fields and privacy warnings.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  debateStateToArtifact,
  addArtifactToDraftCase,
} from '../src/lib/lab/importArtifact.js'
import { validateCase } from '../src/lib/lab/schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function arg(name) {
  const i = process.argv.indexOf(name)
  if (i < 0) return null
  return process.argv[i + 1] ?? null
}

const caseSlug = arg('--case')
const condition = arg('--condition') || 'babel'
const inputPath = arg('--input')
const dryRun = process.argv.includes('--dry-run')

if (!caseSlug || !inputPath) {
  console.error(
    'Usage: node scripts/import-eval-artifact.mjs --case <slug> --condition <single_model|side_by_side|babel> --input <debate.json> [--dry-run]'
  )
  process.exit(1)
}

const casePath = join(
  root,
  'src/data/evaluations/cases',
  `${caseSlug}.json`
)
if (!existsSync(casePath)) {
  console.error(`Case file not found: ${casePath}`)
  process.exit(1)
}
if (!existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}`)
  process.exit(1)
}

const debate = JSON.parse(readFileSync(inputPath, 'utf8'))
const existing = JSON.parse(readFileSync(casePath, 'utf8'))
const imported = debateStateToArtifact(debate, {
  condition: /** @type {any} */ (condition),
  promptVersion: `import:${new Date().toISOString().slice(0, 10)}`,
})

console.log('## Import report')
console.log('neverAutoPublish:', imported.neverAutoPublish)
if (imported.validationError) {
  console.error('Validation failed:', imported.validationError)
  process.exit(1)
}
if (imported.missing.length) {
  console.log('Missing required:', imported.missing.join(', '))
}
if (imported.warnings.length) {
  console.log('Warnings:')
  for (const w of imported.warnings) console.log(' -', w)
}

const next = addArtifactToDraftCase(existing, imported.artifact)
next.status = 'draft'
const checked = validateCase(next)
if (!checked.ok) {
  console.error('Case invalid after merge:', checked.error)
  process.exit(1)
}

if (dryRun) {
  console.log('Dry run; not writing. Artifact condition:', condition)
  process.exit(0)
}

writeFileSync(casePath, `${JSON.stringify(checked.value, null, 2)}\n`)
console.log(`Wrote draft case (status=draft): ${casePath}`)
console.log('Publish manually by setting status to published after review.')
