import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Runtime accessibility check, distinct from eslint-plugin-jsx-a11y: ESLint
 * catches missing semantics in the JSX source (a button with no
 * aria-pressed, a label with no htmlFor) -- it can't see what actually
 * renders. axe-core inspects the live DOM and computed styles, so it also
 * catches things no amount of static analysis can: color-contrast failures
 * against the real theme tokens, duplicate ids, ARIA attributes that don't
 * match the rendered role, etc. Neither one catches focus-order or
 * keyboard-interaction bugs -- that still needs an actual keyboard-driven
 * test (see the Tab-order assertions in work-loop.spec.ts).
 *
 * Scoped to the screens this pass actually touched (Work, the combined
 * Settings page and each of its tabs, Teams detail), using the e2e fixture
 * identity from global-setup.ts. Not exhaustive over every route --
 * routes.spec.ts already covers "does it render"; this covers "is what
 * renders accessible."
 */
async function assertNoViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
}

test('/ (work) has no axe violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /start work/i })).toBeVisible()
  await assertNoViolations(page)
})

test('/projects/:projectId has no axe violations', async ({ page }) => {
  await page.goto('/projects/e2e-project')
  await expect(page.getByRole('heading', { name: 'E2E Project' })).toBeVisible()
  await assertNoViolations(page)
})

test('/teams/:teamId has no axe violations', async ({ page }) => {
  await page.goto('/teams/e2e-team')
  await expect(page.getByRole('heading', { name: 'E2E Team' })).toBeVisible()
  await assertNoViolations(page)
})

// Projects, Teams, Agent Reports, and Activity used to be their own routes
// (each with its own a11y check here); they're tabs on one page now, so one
// test walks all of them rather than one goto per former route.
test('/settings and each of its tabs have no axe violations', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await assertNoViolations(page)

  for (const tabName of ['Activity', 'Projects', 'Teams', 'Agent Reports']) {
    await page.getByRole('tab', { name: tabName }).click()
    await assertNoViolations(page)
  }
})

test('/missing-page (404) has no axe violations', async ({ page }) => {
  await page.goto('/missing-page')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await assertNoViolations(page)
})
