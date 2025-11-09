/**
 * Test mode server - launches with device fixture for testing
 */

import { serve } from '@hono/node-server'

import { MaaDeviceFixture } from './device-fixture'
import app from '../index'
import { logger } from '../lib/logger'

const PORT = 3113
const FIXTURE_POLLING_INTERVAL = 2000 // 2 seconds

// Test user and device credentials
const TEST_DEVICE = 'test-device-fixture'
const TEST_USER = 'test-user'

logger.info('Starting server in TEST MODE with device fixture')

// Create and start the device fixture
const fixture = new MaaDeviceFixture({
  device: TEST_DEVICE,
  user: TEST_USER,
  pollingInterval: FIXTURE_POLLING_INTERVAL,
  baseUrl: `http://localhost:${PORT}`,
})

// Start the server
const server = serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
  },
  (info) => {
    logger.info(`Server listening on http://localhost:${info.port}`)
    logger.info('Test fixture will start in 2 seconds...')

    // Start the fixture after a short delay to ensure server is ready
    setTimeout(() => {
      void fixture.start()
      logger.info(`Device fixture started with ${FIXTURE_POLLING_INTERVAL}ms polling interval`)
    }, 2000)
  },
)

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  fixture.stop()
  server.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  fixture.stop()
  server.close()
  process.exit(0)
})
