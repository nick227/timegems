import { load } from 'js-yaml'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const specPath = resolve(__dirname, '../packages/api-spec/openapi.yaml')
const spec = load(readFileSync(specPath, 'utf-8')) as any
const outDir = resolve(__dirname, '../apps/server/src/__tests__')
mkdirSync(outDir, { recursive: true })
const checkMode = process.argv.includes('--check')
let missingOperations = 0

type OpBlock = { operationId: string; block: string }
const byTag: Record<string, OpBlock[]> = {}

for (const [path, pathItem] of Object.entries<any>(spec.paths ?? {})) {
  for (const [method, op] of Object.entries<any>(pathItem)) {
    if (!op.operationId) continue

    const tag = op.tags?.[0] ?? 'default'

    const block = `
describe('${op.operationId}', () => {
  it.todo('${method.toUpperCase()} ${path} — add fixtures, authorization assertions, and response validation')
})
`
    if (!byTag[tag]) byTag[tag] = []
    byTag[tag].push({ operationId: op.operationId, block })
  }
}

for (const [tag, ops] of Object.entries(byTag)) {
  const outPath = resolve(outDir, `${tag}.test.ts`)

  if (existsSync(outPath)) {
    const existing = readFileSync(outPath, 'utf-8')
    const newOps = ops.filter(o => !existing.includes(`describe('${o.operationId}'`))
    if (newOps.length === 0) continue
    if (checkMode) {
      for (const op of newOps) console.error(`✗ Missing test coverage block for ${op.operationId}`)
      missingOperations += newOps.length
      continue
    }
    writeFileSync(outPath, existing + newOps.map(o => o.block).join(''))
    console.log(`✓ Appended ${newOps.length} new test(s) to ${tag}.test.ts`)
  } else {
    if (checkMode) {
      console.error(`✗ Missing test file ${tag}.test.ts (${ops.length} operations)`)
      missingOperations += ops.length
      continue
    }
    const header = `// Generated from openapi.yaml — fill in seeds and assertions.
// Run \`pnpm test:generate\` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId, testOtherUserId } from './helpers'

const app = buildTestApp()
`
    writeFileSync(outPath, header + ops.map(o => o.block).join(''))
    console.log(`✓ Generated ${tag}.test.ts (${ops.length} operations)`)
  }
}

if (checkMode) {
  if (missingOperations > 0) {
    console.error(`\n❌ ${missingOperations} OpenAPI operation${missingOperations === 1 ? '' : 's'} lack generated test stubs.`)
    process.exit(1)
  }
  console.log('✓ Every OpenAPI operation has a test coverage block')
}
