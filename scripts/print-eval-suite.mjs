#!/usr/bin/env node
/**
 * Phase B helper: prints the evaluation suite and role rotations.
 * Usage: node scripts/print-eval-suite.mjs
 */
import {
  EVAL_PROMPT_SUITE,
  EVAL_SUITE_VERSION,
  baselineSideBySidePrompt,
} from '../src/lib/evalPromptSuite.js'
import { allRoleRotations } from '../src/lib/roleRotation.js'

console.log(`# Babel eval suite ${EVAL_SUITE_VERSION}`)
console.log(`prompts: ${EVAL_PROMPT_SUITE.length}`)
console.log('\n## Role rotations')
for (const r of allRoleRotations()) {
  console.log(`- ${r.rotation}: ${r.label}`)
}
console.log('\n## Decisions')
for (const p of EVAL_PROMPT_SUITE) {
  console.log(`\n### ${p.id} (${p.category})`)
  console.log(p.decision)
  console.log(`criteria: ${p.suggestedCriteria.join(', ')}`)
  console.log('baseline:', baselineSideBySidePrompt(p.decision).slice(0, 80) + '…')
}
