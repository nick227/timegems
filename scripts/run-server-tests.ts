import { spawnSync } from 'child_process'
import { resolve } from 'path'

const root = resolve(__dirname, '..')
const sourceUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL

if (!sourceUrl) {
  console.error('DATABASE_URL or TEST_DATABASE_URL is required to run server tests.')
  process.exit(1)
}

const testDatabaseUrl = new URL(sourceUrl)
const configuredDatabase = testDatabaseUrl.pathname.replace(/^\//, '')

if (!process.env.TEST_DATABASE_URL) {
  if (!configuredDatabase) {
    console.error('DATABASE_URL must include a database name so an isolated test database can be derived.')
    process.exit(1)
  }
  testDatabaseUrl.pathname = `/${configuredDatabase.replace(/_dev$/, '').replace(/_test$/, '')}_test`
}

const testDatabase = testDatabaseUrl.pathname.replace(/^\//, '')
if (!/^[A-Za-z0-9_]+$/.test(testDatabase)) {
  console.error(`Unsafe test database name: ${JSON.stringify(testDatabase)}`)
  process.exit(1)
}
if (!testDatabase.endsWith('_test')) {
  console.error('Refusing to run destructive server tests against a database that does not end in `_test`.')
  process.exit(1)
}

function run(command: string, args: string[], env = process.env, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const mysqlArgs = [
  '--protocol=TCP',
  '--host',
  testDatabaseUrl.hostname,
  '--port',
  testDatabaseUrl.port || '3306',
  '--user',
  decodeURIComponent(testDatabaseUrl.username),
  '--execute',
  `CREATE DATABASE IF NOT EXISTS \`${testDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
]
run('mysql', mysqlArgs, {
  ...process.env,
  MYSQL_PWD: decodeURIComponent(testDatabaseUrl.password),
})

const testEnv = { ...process.env, DATABASE_URL: testDatabaseUrl.toString() }
run(
  process.execPath,
  [
    resolve(root, 'node_modules/prisma/build/index.js'),
    'migrate',
    'reset',
    '--force',
    '--skip-seed',
    '--schema',
    resolve(root, 'packages/db/prisma/schema.prisma'),
  ],
  testEnv,
)
run(
  process.execPath,
  [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', ...process.argv.slice(2)],
  testEnv,
  resolve(root, 'apps/server'),
)
