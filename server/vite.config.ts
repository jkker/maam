import { defineConfig } from 'vite'
import devServer from '@hono/vite-dev-server'

export default defineConfig(({ mode }) => ({
  build: {
    target: 'esnext',
    ssr: true,
    lib: {
      formats: ['es'],
      entry: ['src/index.ts', 'src/server.ts'],
    },
    emptyOutDir: true,
  },
  plugins: [
    devServer({
      entry: 'src/index.ts',
      injectClientScript: false,
    }),
  ],
  server: {
    port: mode === 'development' ? 31113 : 3113,
  },
}))
