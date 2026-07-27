import { expect, test } from '@playwright/test'

test('team manager searches, adds, and removes an existing tenant member', async ({ page }) => {
  await page.goto('/teams/e2e-team')

  const existingMember = page.getByRole('article', { name: 'Team member E2E User' })
  await expect(existingMember).toContainText('Tenant role: OWNER')

  await page.getByRole('textbox', { name: 'Search tenant members' }).fill('candidate@example.com')
  await page.getByRole('checkbox', { name: 'Select Casey Candidate' }).check()
  await page.getByRole('button', { name: 'Add 1 member' }).click()

  const addedMember = page.getByRole('article', { name: 'Team member Casey Candidate' })
  await expect(addedMember).toContainText('candidate@example.com')
  await expect(addedMember).toContainText('Tenant role: MEMBER')
  await expect(page.getByRole('checkbox', { name: 'Select Casey Candidate' })).toHaveCount(0)

  await addedMember.getByRole('button', { name: 'Remove member Casey Candidate' }).click()
  await page.getByRole('dialog', { name: /Remove Casey Candidate/ }).getByRole('button', { name: 'Remove' }).click()

  await expect(addedMember).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Select Casey Candidate' })).toBeVisible()
})
