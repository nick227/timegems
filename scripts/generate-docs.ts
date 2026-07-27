import { load } from 'js-yaml'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..')
const spec = load(readFileSync(resolve(root, 'packages/api-spec/openapi.yaml'), 'utf-8')) as any
const docsDir = resolve(root, 'docs')
mkdirSync(docsDir, { recursive: true })
const checkMode = process.argv.includes('--check')
let drifted = 0

function emit(relativePath: string, content: string) {
  const path = resolve(root, relativePath)
  if (checkMode) {
    if (!existsSync(path) || readFileSync(path, 'utf-8') !== content) {
      console.error(`✗ ${relativePath} is out of date`)
      drifted++
    } else {
      console.log(`✓ ${relativePath}`)
    }
    return
  }
  writeFileSync(path, content)
  console.log(`✓ ${relativePath}`)
}

// ── api-reference.md ────────────────────────────────────────────────────────

const apiLines: string[] = [
  '# API Reference',
  '',
  '> Generated from `packages/api-spec/openapi.yaml`. Do not edit by hand.',
  '',
]

const byTag: Record<string, string[]> = {}

for (const [path, pathItem] of Object.entries<any>(spec.paths ?? {})) {
  for (const [method, op] of Object.entries<any>(pathItem)) {
    const tag = op.tags?.[0] ?? 'default'
    const isPublic = Array.isArray(op.security) && op.security.length === 0
    const successStatus = Object.keys(op.responses ?? {}).find(s => s.startsWith('2')) ?? '200'
    const row = `| \`${method.toUpperCase()} ${path}\` | ${op.summary ?? op.operationId} | ${isPublic ? 'Public' : 'Auth required'} | \`${successStatus}\` |`
    if (!byTag[tag]) byTag[tag] = []
    byTag[tag].push(row)
  }
}

for (const [tag, rows] of Object.entries(byTag)) {
  apiLines.push(`## ${tag.charAt(0).toUpperCase() + tag.slice(1)}`, '')
  apiLines.push('| Endpoint | Description | Auth | Success |')
  apiLines.push('|---|---|---|---|')
  apiLines.push(...rows, '')
}

emit('docs/api-reference.md', apiLines.join('\n'))

// ── env-vars.md ──────────────────────────────────────────────────────────────

const envExample = readFileSync(resolve(root, '.env.example'), 'utf-8')
const envLines: string[] = [
  '# Environment Variables',
  '',
  '> Generated from `.env.example`. Do not edit by hand.',
  '',
  '| Variable | Required | Description |',
  '|---|---|---|',
]

for (const line of envExample.split('\n')) {
  if (line.startsWith('#') || !line.trim()) continue
  const [key] = line.split('=')
  envLines.push(`| \`${key.trim()}\` | Yes | — |`)
}

emit('docs/env-vars.md', envLines.join('\n'))

// ── database.md ───────────────────────────────────────────────────────────────

const schema = readFileSync(resolve(root, 'packages/db/prisma/schema.prisma'), 'utf-8')
const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map(m => m[1])
const enums = [...schema.matchAll(/^enum\s+(\w+)/gm)].map(m => m[1])

const dbLines: string[] = [
  '# Database',
  '',
  '> Generated from `packages/db/prisma/schema.prisma`. Do not edit by hand.',
  '',
  '## Models',
  '',
  ...models.map(m => `- \`${m}\``),
  '',
]

if (enums.length) {
  dbLines.push('## Enums', '', ...enums.map(e => `- \`${e}\``), '')
}

emit('docs/database.md', dbLines.join('\n'))

if (checkMode && drifted > 0) {
  console.error(`\n❌ ${drifted} generated document${drifted === 1 ? '' : 's'} out of date. Run \`pnpm generate\`.`)
  process.exit(1)
}

console.log(checkMode ? '\n✓ Generated docs are current.' : '\nAll docs generated. Run again after spec/schema changes.')
