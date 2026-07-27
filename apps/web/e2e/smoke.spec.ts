/**
 * Golden-path smoke test. Auth is Google, email+password, or an
 * auto-provisioned anonymous guest account (see AuthGuard.tsx) -- an
 * unauthenticated visitor to any protected route gets an instant guest
 * session rather than a login redirect, so most of this suite covers that
 * path plus /login's explicit-opt-in entry points and the app's error
 * states. Google/email credential-based sign-in itself isn't driven here
 * (no real Google account or throwaway email inbox in CI); the full
 * login -> work -> logout loop for those is verified manually.
 */
import { test, expect } from '@playwright/test'

test.describe('auth guard', () => {
  // The rest of the suite runs authenticated by default (see
  // playwright.config.ts's `use.storageState`) via the e2e fixture session
  // from global-setup.ts -- these tests specifically need a logged-out
  // context, so they override back to an empty one.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('unauthenticated access auto-provisions a guest session', async ({ page }) => {
    await page.goto('/')
    // No redirect to /login -- AuthGuard sees the 401, calls POST
    // /auth/anonymous automatically, and the Work screen renders once the
    // new session is established. This is the real end-to-end path, not a
    // mock: it exercises AnonymousAuthService's funny-name generation and
    // tenant auto-provisioning against the actual server.
    await expect(page.getByRole('button', { name: /start work/i })).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('login page renders Google, email, and guest entry points', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'TimeGems' })).toBeVisible()
    // The Google widget itself only mounts with real OAuth credentials (not
    // configured in dev/CI) -- assert on the stable slot it renders into
    // instead of copy text.
    await expect(page.getByTestId('google-login-slot')).toBeVisible()
    await expect(page.getByText('Google sign-in is not configured.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload configuration' })).toBeVisible()

    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    await expect(page.getByRole('button', { name: 'Continue as a guest instead' })).toBeVisible()
  })

  test('session verification failure is explicit and retryable, then recovers into a guest session', async ({ page }) => {
    let attempts = 0
    await page.route('**/auth/me', async (route) => {
      attempts += 1
      if (attempts === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) })
        return
      }
      await route.continue()
    })

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Unable to verify your session' })).toBeVisible()
    await page.getByRole('button', { name: 'Retry' }).click()
    // The retry hits the real server with no session cookie -- same 401 ->
    // auto-anonymous-provision path as the test above, not a login redirect.
    await expect(page.getByRole('button', { name: /start work/i })).toBeVisible()
  })

  test('revoked access is distinct from an authentication outage', async ({ page }) => {
    await page.route('**/auth/me', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Tenant access revoked' }) }),
    )

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Return to sign in' })).toBeVisible()
  })
})

test.describe.skip('core work loop — requires GOOGLE_TEST_EMAIL', () => {
  // EXTEND once a real Google test account is configured:
  // start work -> pause -> resume -> stop with a note -> see it in Activity.
  test('start, pause, resume, stop', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /start work/i }).click()
    await expect(page.getByText(/working/i)).toBeVisible()
    await page.getByRole('button', { name: /pause/i }).click()
    await page.getByRole('button', { name: /resume/i }).click()
    await page.getByRole('button', { name: /stop/i }).click()
    await page.getByRole('button', { name: /finish session/i }).click()
  })
})
