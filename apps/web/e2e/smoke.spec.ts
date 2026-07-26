/**
 * Golden-path smoke test. Auth here is Google-only (see
 * templates/plugins/google-auth) — there is no email/password form to drive,
 * so automated coverage is limited to what doesn't require a real Google
 * account: the unauthenticated redirect and the login page rendering the
 * Google entry point. The full login -> work -> logout loop is verified
 * manually against a real Google test account (see google-auth's README).
 */
import { test, expect } from '@playwright/test'

test.describe('auth guard', () => {
  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders the Google sign-in entry point', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/continue with google/i)).toBeVisible()
  })
})

test.describe.skip('core work loop — requires GOOGLE_TEST_EMAIL', () => {
  // EXTEND once a real Google test account is configured:
  // start work -> pause -> resume -> stop with a note -> see it in Views.
  test('start, pause, resume, stop', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /start work/i }).click()
    await expect(page.getByText(/working/i)).toBeVisible()
    await page.getByRole('button', { name: /pause/i }).click()
    await page.getByRole('button', { name: /resume/i }).click()
    await page.getByRole('button', { name: /stop/i }).click()
    await page.getByRole('button', { name: /save/i }).click()
  })
})
