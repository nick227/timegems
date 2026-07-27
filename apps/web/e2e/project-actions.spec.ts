import { test, expect } from '@playwright/test'

async function finishActiveSession(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByText('Session summary')).toBeVisible()
  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page.getByRole('button', { name: 'Start Work' })).toBeVisible()
}

test('starts project-tagged work from the project list and recovers it after the page closes', async ({ page, context }) => {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Start work on E2E Project' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('Working', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'E2E Project' })).toHaveAttribute('aria-checked', 'true')

  await page.close()
  const recoveredPage = await context.newPage()
  await recoveredPage.goto('/projects/e2e-project')
  await expect(recoveredPage.getByText('You are working on this project.')).toBeVisible()
  await expect(recoveredPage.getByRole('button', { name: 'Working on E2E Project. Return to Work' })).toBeVisible()
  await expect(
    recoveredPage.getByText(
      'Timing continues on the server when this browser closes or you log out. Only an explicit Pause or Stop working action changes timing.',
    ),
  ).toBeVisible()
  await recoveredPage.reload()
  await expect(recoveredPage.getByText('You are working on this project.')).toBeVisible()
  await expect(recoveredPage.getByRole('button', { name: 'Start work on E2E Project' })).toHaveCount(0)

  await recoveredPage.getByRole('button', { name: 'Stop working' }).click()
  await expect(recoveredPage).toHaveURL(/\/$/)
  await expect(recoveredPage.getByText('Session summary')).toBeVisible()
  await recoveredPage.getByRole('button', { name: 'Finish session' }).click()
  await expect(recoveredPage.getByRole('button', { name: 'Start Work' })).toBeVisible()

  await recoveredPage.goto('/projects/e2e-project')
  await recoveredPage.getByRole('button', { name: 'Start work on E2E Project' }).click()
  await expect(recoveredPage).toHaveURL(/\/$/)
  await expect(recoveredPage.getByText('Working', { exact: true })).toBeVisible()
  await finishActiveSession(recoveredPage)
})

test('validates and imports project goals from CSV', async ({ page }) => {
  const apiURL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001'
  let importedBody: unknown
  await page.route(`${apiURL}/projects/e2e-project/goals/import`, async (route) => {
    importedBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { imported: 2 } }),
    })
  })

  await page.goto('/projects/e2e-project')
  await page.getByLabel('Goal CSV file').setInputFiles({
    name: 'goals.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'title,description,complexityScore,estimatedHours\n' +
        '"Ship onboarding","Deliver the first-run flow",4,12\n' +
        '"Measure activation","Track activation, weekly",2,6\n',
    ),
  })

  await expect(page.getByText('goals.csv: 2 goals ready.')).toBeVisible()
  await page.getByRole('button', { name: 'Import 2 goals' }).click()
  await expect(page.getByText('2 goals imported')).toBeVisible()
  expect(importedBody).toEqual({
    goals: [
      {
        title: 'Ship onboarding',
        description: 'Deliver the first-run flow',
        complexityScore: 4,
        estimatedHours: 12,
      },
      {
        title: 'Measure activation',
        description: 'Track activation, weekly',
        complexityScore: 2,
        estimatedHours: 6,
      },
    ],
  })
})
