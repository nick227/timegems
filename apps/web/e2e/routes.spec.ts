import { test, expect } from '@playwright/test'

const apiURL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001'

/**
 * One smoke test per main route, using the e2e fixture identity seeded by
 * global-setup.ts (e2e-tenant / e2e-project / e2e-team / e2e-report). Each
 * test asserts one stable piece of key content -- proof the route renders
 * its real data, not just "didn't crash." Projects/Teams/Agent
 * Reports/Activity/Admin are tabs inside /settings now, not their own
 * routes (see SettingsRoute) -- `?tab=` is a real deep link (also what a
 * detail page's "Return to X" link uses), so those are covered via
 * `/settings?tab=...` rather than a bare goto.
 */

test('/ (work)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /start work/i })).toBeVisible()
})

test('/settings?tab=projects', async ({ page }) => {
  await page.goto('/settings?tab=projects')
  await expect(page.getByRole('tab', { name: 'Projects', selected: true })).toBeVisible()
  await expect(page.getByText('E2E Project')).toBeVisible()
})

test('/projects/:projectId', async ({ page }) => {
  await page.goto('/projects/e2e-project')
  await expect(page.getByRole('heading', { name: 'E2E Project' })).toBeVisible()
  await expect(page.getByText('Sapphire')).toBeVisible()
})

test('project detail distinguishes not found', async ({ page }) => {
  await page.goto('/projects/missing-project')
  await expect(page.getByRole('heading', { name: 'Project not found' })).toBeVisible()
  await page.getByRole('button', { name: 'Return to Projects' }).click()
  await expect(page.getByRole('tab', { name: 'Projects', selected: true })).toBeVisible()
})

test('project detail distinguishes no access', async ({ page }) => {
  await page.route(`${apiURL}/projects/e2e-project`, (route) =>
    route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Forbidden' }) }),
  )
  await page.goto('/projects/e2e-project')
  await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
})

test('project detail exposes retry after a load failure', async ({ page }) => {
  let attempts = 0
  await page.route(`${apiURL}/projects/e2e-project`, async (route) => {
    attempts += 1
    if (attempts <= 2) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) })
      return
    }
    await route.continue()
  })

  await page.goto('/projects/e2e-project')
  await expect(page.getByRole('heading', { name: 'Project could not be loaded' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('heading', { name: 'E2E Project' })).toBeVisible()
})

test('/settings?tab=teams', async ({ page }) => {
  await page.goto('/settings?tab=teams')
  await expect(page.getByRole('tab', { name: 'Teams', selected: true })).toBeVisible()
  await expect(page.getByText('E2E Team')).toBeVisible()
})

test('/teams/:teamId', async ({ page }) => {
  await page.goto('/teams/e2e-team')
  await expect(page.getByRole('heading', { name: 'E2E Team' })).toBeVisible()
  await expect(page.getByLabel('Team member E2E User').getByText('E2E User')).toBeVisible()
})

test('/users/:userId', async ({ page }) => {
  // The e2e fixture user's id is an auto-generated cuid (unlike the other
  // fixture entities, which are seeded with fixed slug ids) -- looked up
  // via the already-covered team-members endpoint (on the API origin, not
  // the web dev server that `page.request`'s baseURL points at) rather than
  // hardcoding one.
  const members = await page.request.get(`${apiURL}/teams/e2e-team/members`)
  const { data } = await members.json()
  const userId = data[0].id

  await page.goto(`/users/${userId}`)
  await expect(page.getByRole('heading', { name: 'E2E User' })).toBeVisible()
})

test('/settings?tab=activity', async ({ page }) => {
  await page.goto('/settings?tab=activity')
  await expect(page.getByRole('tab', { name: 'Activity', selected: true })).toBeVisible()
  // Period is a real radiogroup (see useRovingRadioGroup), not plain
  // buttons -- "Day"'s accessible role is radio, not button.
  await expect(page.getByRole('radio', { name: 'Day' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Week' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Month' })).toBeVisible()
})

test('/settings?tab=activity exposes a recoverable load failure', async ({ page }) => {
  let attempts = 0
  await page.route('**/reports/time-summary?**', async (route) => {
    attempts += 1
    if (attempts <= 2) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) })
      return
    }
    await route.continue()
  })

  await page.goto('/settings?tab=activity')
  await expect(page.getByText('Activity could not be loaded')).toBeVisible()
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('region', { name: 'Activity summary' })).toBeVisible()
})

test('/settings?tab=reports', async ({ page }) => {
  await page.goto('/settings?tab=reports')
  await expect(page.getByRole('tab', { name: 'Agents', selected: true })).toBeVisible()
  await expect(page.getByText('E2E fixture report')).toBeVisible()
})

test('/reports/:agentReportId', async ({ page }) => {
  await page.goto('/reports/e2e-report')
  await expect(page.getByRole('heading', { name: 'E2E fixture report' })).toBeVisible()
})

test('/integrations', async ({ page }) => {
  await page.goto('/integrations')
  await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible()
  await expect(page.getByText('Connected — this is how you signed in')).toBeVisible()
})

test('/settings', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Account', selected: true })).toBeVisible()
  await expect(page.getByLabel('Username')).toHaveValue('E2E User')
})

test('/settings?tab=gems', async ({ page }) => {
  await page.goto('/settings?tab=gems')
  await expect(page.getByRole('tab', { name: 'Gems', selected: true })).toBeVisible()
  // The e2e fixture user has no finalized (STOPPED) sessions on the gem-typed
  // E2E Project, so the Gem Bank's real empty state is what should render.
  await expect(page.getByText('No gems yet')).toBeVisible()
})

test('/settings?tab=admin', async ({ page }) => {
  await page.goto('/settings?tab=admin')
  await expect(page.getByRole('tab', { name: 'Admin', selected: true })).toBeVisible()
  await expect(page.getByText('E2E Tenant')).toBeVisible()
})

test('no drawer: branding returns to Work, account menu is the way to Settings', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveCount(0)

  await page.getByRole('link', { name: 'TimeGems' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Work' })).toBeVisible()

  await page.getByRole('button', { name: /E2E User/ }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

test('unknown authenticated route renders a recoverable 404', async ({ page }) => {
  await page.goto('/missing-page')
  await expect(page).toHaveURL(/\/missing-page$/)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  await page.getByRole('button', { name: 'Return to Work' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: /start work/i })).toBeVisible()
})
