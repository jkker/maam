import 'temporal-polyfill/global'

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ThemeProvider } from './components/ThemeProvider'
import { Toaster } from './components/ui/sonner'
import Dashboard from './Dashboard'
import { queryClient } from './lib/trpc'

import './style.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Dashboard />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
