import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should show auth modal on first visit', async ({ page }) => {
    await page.goto('/')

    // Auth modal should be visible
    await expect(page.getByRole('heading', { name: /welcome to maa manager/i })).toBeVisible()
    await expect(page.getByText(/please authenticate/i)).toBeVisible()

    // Form fields should be present
    await expect(page.getByLabel(/user id/i)).toBeVisible()
    await expect(page.getByLabel(/device id/i)).toBeVisible()
    await expect(page.getByLabel(/device name/i)).toBeVisible()
  })

  test('should generate random device ID', async ({ page }) => {
    await page.goto('/')

    const deviceIdInput = page.getByLabel(/device id/i)

    // Device ID should be empty initially
    await expect(deviceIdInput).toHaveValue('')

    // Click generate button
    await page.getByRole('button', { name: /generate/i }).click()

    // Device ID should now have a value
    const deviceId = await deviceIdInput.inputValue()
    expect(deviceId).toHaveLength(32)
    expect(deviceId).toMatch(/^[a-f0-9]+$/)
  })

  test('should successfully authenticate and access dashboard', async ({ page }) => {
    await page.goto('/')

    // Fill in authentication form
    await page.getByLabel(/user id/i).fill('e2e-test-user')
    await page.getByRole('button', { name: /generate/i }).click()
    await page.getByLabel(/device name/i).fill('E2E Test Device')

    // Submit form
    await page.getByRole('button', { name: /continue/i }).click()

    // Wait for dashboard to load
    await expect(page.getByText(/maa manager/i)).toBeVisible()

    // Auth modal should be gone
    await expect(page.getByRole('heading', { name: /welcome to maa manager/i })).not.toBeVisible()

    // Dashboard elements should be visible
    await expect(page.getByText(/screenshot/i)).toBeVisible()
    await expect(page.getByText(/task/i)).toBeVisible()
  })

  test('should persist authentication across page reloads', async ({ page }) => {
    await page.goto('/')

    // Authenticate
    await page.getByLabel(/user id/i).fill('e2e-persist-user')
    await page.getByRole('button', { name: /generate/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Wait for dashboard
    await expect(page.getByText(/maa manager/i)).toBeVisible()

    // Reload page
    await page.reload()

    // Should still be authenticated (no auth modal)
    await expect(page.getByRole('heading', { name: /welcome to maa manager/i })).not.toBeVisible()
    await expect(page.getByText(/maa manager/i)).toBeVisible()
  })

  test('should show validation error for short device ID', async ({ page }) => {
    await page.goto('/')

    // Fill in form with short device ID
    await page.getByLabel(/user id/i).fill('test-user')
    await page.getByLabel(/device id/i).fill('short')

    // Try to submit
    await page.getByRole('button', { name: /continue/i }).click()

    // Should show validation error
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible()

    // Should still be on auth modal
    await expect(page.getByRole('heading', { name: /welcome to maa manager/i })).toBeVisible()
  })

  test('should allow logout', async ({ page }) => {
    await page.goto('/')

    // Authenticate
    await page.getByLabel(/user id/i).fill('e2e-logout-user')
    await page.getByRole('button', { name: /generate/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Wait for dashboard
    await expect(page.getByText(/maa manager/i)).toBeVisible()

    // Open user menu
    await page.getByRole('button', { name: /user/i }).click()

    // Click logout
    await page.getByRole('menuitem', { name: /logout/i }).click()

    // Page should reload and show auth modal
    await page.waitForURL('/')
    await expect(page.getByRole('heading', { name: /welcome to maa manager/i })).toBeVisible()
  })
})

test.describe('Dashboard Features', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate before each test
    await page.goto('/')
    await page.getByLabel(/user id/i).fill('e2e-dashboard-user')
    await page.getByRole('button', { name: /generate/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()
    await expect(page.getByText(/maa manager/i)).toBeVisible()
  })

  test('should display main dashboard sections', async ({ page }) => {
    // Screenshot viewer should be present
    await expect(page.getByText(/screenshot/i).first()).toBeVisible()

    // Task management should be present
    await expect(page.getByText(/task/i).first()).toBeVisible()

    // Schedule should be present
    await expect(page.getByText(/schedule/i).first()).toBeVisible()
  })

  test('should show connectivity status', async ({ page }) => {
    // Connection indicator should be present
    const connectionStatus = page
      .locator('[aria-label*="connection"], [aria-label*="status"]')
      .first()
    await expect(connectionStatus).toBeVisible()
  })

  test('should have user menu with device info', async ({ page }) => {
    // Open user menu
    await page.getByRole('button', { name: /user/i }).click()

    // User ID should be shown
    await expect(page.getByText(/e2e-dashboard-user/i)).toBeVisible()

    // Logout option should be available
    await expect(page.getByRole('menuitem', { name: /logout/i })).toBeVisible()
  })
})
