/**
 * E2E Test for Screenshot Interval Estimation
 * Tests the full workflow with device fixture
 */

import type { Browser, Page } from 'playwright'

import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { MaaDeviceFixture } from '../src/device-fixture'

const BASE_URL = 'http://localhost:3113'
const POLLING_INTERVAL = 2000 // 2 seconds

describe('Screenshot Interval Estimation E2E', () => {
  let browser: Browser
  let page: Page
  let fixture: MaaDeviceFixture

  beforeAll(async () => {
    // Launch browser
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()

    // Start device fixture
    fixture = new MaaDeviceFixture({
      device: 'bdc57941058a47e6bf56f2a993c87af3',
      user: 'user',
      pollingInterval: POLLING_INTERVAL,
      baseUrl: BASE_URL,
    })

    fixture.start()

    // Wait for fixture to stabilize
    await new Promise((resolve) => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    fixture.stop()
    await browser.close()
  })

  it('should load the dashboard', async () => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for initial connection
    await page.waitForSelector('text=Online', { timeout: 10000 })

    const title = await page.title()
    expect(title).toBe('MAAM')
  }, 15000)

  it('should display screenshot after device connects', async () => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for screenshot to appear (fixture needs time to poll and respond)
    await page.waitForSelector('img[alt="Live screenshot"]', { timeout: 15000 })

    const screenshot = page.locator('img[alt="Live screenshot"]')
    expect(await screenshot.isVisible()).toBe(true)
  }, 20000)

  it('should estimate polling interval after multiple screenshots', async () => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for first screenshot
    await page.waitForSelector('img[alt="Live screenshot"]', { timeout: 15000 })

    // Wait for enough time to collect multiple samples
    // Need at least 2 samples (3 screenshots) to show interval
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL * 3))

    // Check if interval information is displayed
    const intervalText = await page.locator('text=/Interval: ~\\d+s/').textContent()
    expect(intervalText).toBeTruthy()
    expect(intervalText).toMatch(/Interval: ~\d+s/)
  }, 15000)

  it('should display countdown progress bar', async () => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for screenshots to be collected
    await page.waitForSelector('img[alt="Live screenshot"]', { timeout: 15000 })
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL * 3))

    // Check for countdown text
    const countdownText = await page.locator('text=/Next refresh in \\d+s/').textContent()
    expect(countdownText).toBeTruthy()
    expect(countdownText).toMatch(/Next refresh in \d+s/)

    // Check for progress bar
    const progressBar = await page.locator('[role="progressbar"]').count()
    expect(progressBar).toBeGreaterThan(0)
  }, 15000)

  it('should display interval estimate after first screenshot', async () => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for first screenshot
    await page.waitForSelector('img[alt="Live screenshot"]', { timeout: 15000 })
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL * 2))

    // Should show interval estimate after enough samples
    const intervalText = await page.locator('text=/Interval: ~\\d+s/').textContent()
    expect(intervalText).toBeTruthy()
  }, 15000)

  it('should display stable interval after multiple screenshots', async () => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for many screenshots to stabilize estimate
    await page.waitForSelector('img[alt="Live screenshot"]', { timeout: 15000 })
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL * 7))

    // Should show stable interval (no confidence indicator anymore)
    const intervalText = await page.locator('text=/Interval: ~\\d+s/').textContent()
    expect(intervalText).toBeTruthy()
    expect(intervalText).toMatch(/Interval: ~\d+s/)
  }, 20000)

  it('should update progress bar smoothly', async () => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for screenshots
    await page.waitForSelector('img[alt="Live screenshot"]', { timeout: 15000 })
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL * 3))

    // Capture progress values over time
    const progressValues: number[] = []
    for (let i = 0; i < 5; i++) {
      const countdownText = await page.locator('text=/Next refresh in (\\d+)s/').textContent()
      if (countdownText) {
        const match = countdownText.match(/Next refresh in (\d+)s/)
        if (match) {
          progressValues.push(parseInt(match[1]))
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Progress should be decreasing (countdown)
    expect(progressValues.length).toBeGreaterThan(0)
    // At least one transition should occur
    const hasDecrement = progressValues.some((val, idx) => idx > 0 && val < progressValues[idx - 1])
    expect(hasDecrement).toBe(true)
  }, 20000)

  it('should request interval data from server', async () => {
    await page.goto(BASE_URL)

    // Monitor network requests
    const requests: string[] = []
    page.on('request', (request) => {
      requests.push(request.url())
    })

    await page.waitForLoadState('networkidle')

    // Wait for interval query
    await new Promise((resolve) => setTimeout(resolve, 11000)) // Increased to match 10s refetch

    // Should have called screenshotInterval endpoint
    const hasIntervalRequest = requests.some((url) => url.includes('screenshotInterval'))
    expect(hasIntervalRequest).toBe(true)
  }, 15000)
})
