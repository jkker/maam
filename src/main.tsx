import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '#/stores/theme'
import { ReactI18nextProvider } from '#/lib/i18next'
import { TanStackQueryProvider } from '#/lib/tanstack-query'
import { TanstackRouterProvider } from '#/lib/tanstack-router'

import { ToastProvider } from './components/ui/toast'

import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <ReactI18nextProvider>
      <TanStackQueryProvider>
        <ToastProvider>
          <TanstackRouterProvider />
        </ToastProvider>
      </TanStackQueryProvider>
    </ReactI18nextProvider>
  </StrictMode>,
)
