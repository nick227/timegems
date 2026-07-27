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
 * test (see the Tab-order assertions below and in work-loop.spec.ts).
 *
 * Scoped to the screens this pass actually touched (Work, Projects, Goals,
 * Teams, Activity) plus the hamburger drawer, using the e2e fixture identity
 * from global-setup.ts. Not exhaustive over every route -- routes.spec.ts
 * already covers "does it render"; this covers "is what renders
 * accessible."
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

test('/projects has no axe violations', async ({ page }) => {
  await page.goto('/projects')
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  await assertNoViolations(page)
})

test('/projects/:projectId has no axe violations', async ({ page }) => {
  await page.goto('/projects/e2e-project')
  await expect(page.getByRole('heading', { name: 'E2E Project' })).toBeVisible()
  await assertNoViolations(page)
})

test('/goals has no axe violations', async ({ page }) => {
  await page.goto('/goals')
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()
  await assertNoViolations(page)
})

test('/teams/:teamId has no axe violations', async ({ page }) => {
  await page.goto('/teams/e2e-team')
  await expect(page.getByRole('heading', { name: 'E2E Team' })).toBeVisible()
  await assertNoViolations(page)
})

test('/views has no axe violations', async ({ page }) => {
  await page.goto('/views')
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()
  await assertNoViolations(page)
})

test('hamburger drawer: opens via keyboard, traps focus, has no axe violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).focus()
  await page.keyboard.press('Enter')

  const drawer = page.getByRole('dialog', { name: 'Main menu' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('Plan', { exact: true })).toBeVisible()
  await expect(drawer.getByText('Team', { exact: true })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Activity' })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Agent Reports' })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Integrations' })).toHaveCount(0)
  await assertNoViolations(page)

  // Tab-order / focus-containment is exactly what axe can't check --
  // it doesn't drive the keyboard. Confirm the trap for real: focus starts
  // inside the drawer (not on whatever the page happened to have focused),
  // and Escape closes it and returns focus to the button that opened it.
  await expect(drawer.locator(':focus')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused()
})

test('/missing-page (404) has no axe violations', async ({ page }) => {
  await page.goto('/missing-page')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await assertNoViolations(page)
})
