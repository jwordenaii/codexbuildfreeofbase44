import { test, expect } from '@playwright/test'

test('quote form smoke flow', async ({ page }) => {
  await page.route('**/api/v1/leads/quote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'received',
        lead_id: 501,
        lead_score: 'HOT',
        follow_up_sla: 'Follow-up in 1 hour',
      }),
    })
  })

  await page.goto('/quote')
  await page.getByRole('button', { name: /Asphalt Paving/i }).click()
  await page.getByRole('button', { name: /Property Details/i }).click()
  await page.getByRole('button', { name: /Contact Info/i }).click()

  await page.getByPlaceholder('John Smith').fill('Playwright User')
  await page.getByPlaceholder('john@example.com').fill('pw@example.com')
  await page.getByPlaceholder('(555) 555-5555').fill('5551231234')

  await page.getByRole('button', { name: /Review & Submit/i }).click()
  await page.getByRole('button', { name: /Submit Request/i }).click()

  await expect(page.getByText(/Quote Request Received/i)).toBeVisible()
})

test('command center login gate smoke flow', async ({ page }) => {
  await page.goto('/command-center')
  await expect(page.getByText('Command Center')).toBeVisible()
  await page.getByPlaceholder('Access PIN').fill('wrong')
  await page.getByRole('button', { name: /Unlock/i }).click()
  await expect(page.getByText(/Incorrect PIN/i)).toBeVisible()

  await page.getByPlaceholder('Access PIN').fill('e2e-pin')
  await page.getByRole('button', { name: /Unlock/i }).click()
  await expect(page.getByText(/Operations Dashboard/i)).toBeVisible()
})
