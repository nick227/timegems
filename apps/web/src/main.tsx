import './lib/theme'  // must be first — reads localStorage and sets dark class before React renders
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { createApiClient } from '@timegems/sdk'
import { queryClient } from './lib/queryClient'
import { App } from './App'
import './index.css'

// Initialize API client — uses httpOnly cookies by default.
// Pass getToken for native apps that use Bearer tokens instead.
createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  </React.StrictMode>,
)
