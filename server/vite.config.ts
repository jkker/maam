import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import devServer from '@hono/vite-dev-server'
import { workflow } from 'workflow/vite'

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
    workflow(),
    dts({
      entryRoot: 'src',
      exclude: ['**/*.test.ts'],
    }),
    devServer({
      entry: 'src/index.ts',
      injectClientScript: false,
    }),
  ],
  server: {
    port: mode === 'development' ? 31113 : 3113,
  },
}))
