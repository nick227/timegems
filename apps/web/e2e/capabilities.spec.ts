import { test, expect } from '@playwright/test'

test('server capabilities gate navigation, routes, and privileged actions', async ({ page }) => {
  // Keep the fixture user's OWNER role but remove capabilities from the
  // server response. If the client ever recreates role policy locally, this
  // test will expose the regression.
  await page.route('**/auth/me', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({
      response,
      json: {
        ...body,
        data: {
          ...body.data,
          capabilities: [],
        },
      },
    })
  })

  await page.goto('/projects')
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  await expect(page.getByLabel('New project name')).toHaveCount(0)

  await page.getByRole('button', { name: /open menu/i }).click()
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)
  await expect(page.getByText('Administration', { exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: /start work/i })).toBeVisible()

  await page.goto('/projects/e2e-project')
  await expect(page.getByText('Sapphire')).toBeVisible()
  await expect(page.getByRole('button', { name: /edit gem type/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /archive project/i })).toHaveCount(0)

  await page.goto('/teams')
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible()
  await expect(page.getByLabel('New team name')).toHaveCount(0)

  await page.goto('/teams/e2e-team')
  await expect(page.getByText('E2E User')).toBeVisible()
  await expect(page.getByLabel('Search tenant members')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /remove member/i })).toHaveCount(0)

  await page.goto('/')
  await page.getByRole('button', { name: /start work/i }).click()
  await expect(page.getByRole('button', { name: /new project/i })).toHaveCount(0)
  await page.getByRole('button', { name: /stop/i }).click()
  await page.getByRole('button', { name: /finish session/i }).click()
})
