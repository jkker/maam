import { VitePWA, type IconResource } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const favicon: IconResource = {
  src: 'maa-logo.png',
  sizes: '512x512',
  type: 'image/png',
  purpose: 'any maskable',
}
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    VitePWA({
      devOptions: {
        enabled: false,
        type: 'module',
      },
      registerType: 'autoUpdate',
      includeAssets: [favicon.src],
      manifest: {
        name: `MAA Manager`,
        short_name: 'MAAM',
        description: 'Automated Task Orchestration',
        theme_color: '#78dde8',
        background_color: '#19181A',
        icons: [favicon],
      },
    }),
  ],
  build: {
    outDir: '../server/dist/public',
  },
  server: {
    port: 3113,
    proxy: {
      '/rpc': 'http://localhost:31113',
      '/maa': 'http://localhost:31113',
    },
  },
})
