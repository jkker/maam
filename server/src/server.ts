import os from 'node:os'

import { serve } from '@hono/node-server'

import { app } from './index'

serve(
  {
    fetch: app.fetch,
    port: 3113,
    hostname: '0.0.0.0',
  },
  ({ port }) => {
    const interfaces = os.networkInterfaces()
    let message = `Server running at:\n\n    http://127.0.0.1:${port}\n`

    // Get LAN IP addresses
    for (const nets of Object.values(interfaces)) {
      if (!nets) continue

      for (const net of nets) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          message += `    http://${net.address}:${port}\n`
        }
      }
    }
    console.log(message)
  },
)
