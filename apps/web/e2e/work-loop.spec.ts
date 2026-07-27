import { test, expect } from '@playwright/test'

/**
 * Real "capture a note via SmartTextEditor, see it persisted and rendered"
 * round trip -- SmartTextEditor is a contentEditable div, not a native
 * input/textarea, so `.fill()` doesn't work here; typing goes through
 * `page.keyboard.type()` instead. Stops the session it starts so later
 * tests (routes.spec.ts's '/' test expects the idle state) aren't left with
 * stray RUNNING state -- seed-e2e.ts also clears any leftover WorkSession on
 * the next run regardless, as a second line of defense.
 */
test('start work, capture a note through the rich text editor, see it rendered, then stop', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /start work/i }).click()
  await expect(page.getByText('Working', { exact: true })).toBeVisible()
  await expect(page.getByText('Under 5 min logged')).toBeVisible()
  await expect(page).toHaveTitle('Working · TimeGems')
  await expect(page.locator('.ProseMirror')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add update' }).click()
  await expect(page.getByRole('group', { name: 'Update suggestions' }).getByRole('button')).toHaveCount(5)

  const editor = page.locator('.ProseMirror').first()
  await editor.click()
  await page.keyboard.type('Reviewed the onboarding flow')
  const noteSaved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/work-sessions\/[^/]+\/notes$/.test(new URL(response.url()).pathname) &&
      response.ok(),
  )
  await page.keyboard.press('Enter')
  await noteSaved

  await expect(
    page.locator('.ProseMirror p').filter({ hasText: /^Reviewed the onboarding flow$/ }),
  ).toBeVisible()

  await page.getByRole('button', { name: /stop/i }).click()
  await expect(page.getByText('Session summary')).toBeVisible()

  // REVIEWING is durable: navigating away and refreshing still recovers the
  // review instead of silently restarting the timer.
  await page.getByRole('button', { name: /open menu/i }).click()
  await page.getByRole('link', { name: 'Projects' }).click()
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  await page.getByRole('button', { name: /open menu/i }).click()
  await expect(page.getByText('Awaiting review')).toBeVisible()
  await page.getByRole('link', { name: /return to active work session/i }).click()
  await page.reload()
  await expect(page.getByText('Session summary')).toBeVisible()
  await expect(page).toHaveTitle('TimeGems')

  await page.getByRole('button', { name: /resume working/i }).click()
  await expect(page.getByText('Working', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /stop/i }).click()
  await page.getByRole('button', { name: /finish session/i }).click()

  await expect(page.getByRole('button', { name: /start work/i })).toBeVisible()
  await page.getByRole('button', { name: /open menu/i }).click()
  await page.getByRole('link', { name: 'Activity' }).click()
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible()
  const savedSession = page.getByRole('article').filter({ hasText: 'Reviewed the onboarding flow' })
  await expect(savedSession).toBeVisible()
  await expect(savedSession.getByText('Recorded', { exact: true })).toBeVisible()

  await savedSession.getByRole('button', { name: 'Edit' }).click()
  const correctionDialog = page.getByRole('dialog', { name: 'Correct session' })
  await correctionDialog.getByRole('textbox', { name: 'Duration' }).fill('1:00')
  await correctionDialog.getByRole('combobox', { name: 'Project' }).selectOption({ label: 'E2E Project' })
  await correctionDialog.getByRole('textbox', { name: 'Note' }).fill('Corrected onboarding flow')
  await correctionDialog.getByRole('button', { name: 'Save corrections' }).click()

  const correctedSession = page.getByRole('article').filter({ hasText: 'Corrected onboarding flow' })
  await expect(correctedSession).toBeVisible()
  await expect(correctedSession.getByText('1h 0m', { exact: true })).toBeVisible()
  await expect(correctedSession.getByText('Corrected', { exact: true })).toBeVisible()
  await expect(correctedSession.getByText('1 gem', { exact: true })).toBeVisible()

  await correctedSession.getByRole('button', { name: 'Delete' }).click()
  const deleteDialog = page.getByRole('dialog', { name: 'Delete this session?' })
  await deleteDialog.getByRole('button', { name: 'Delete session' }).click()
  await expect(page.getByText('Corrected onboarding flow')).toHaveCount(0)
})
