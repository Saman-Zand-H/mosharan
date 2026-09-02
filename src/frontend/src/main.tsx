import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/vazirmatn'

import App from './App'
import { AuthProvider } from './features/auth/AuthProvider'
import './styles.css'
import './features/packet-simulator/simulator.css'
import './features/platform-admin/platform-admin.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
