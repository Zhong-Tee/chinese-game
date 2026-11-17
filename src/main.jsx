import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initializeTheme } from './utils/theme'
import { initializeStandaloneViewport } from './utils/standaloneViewport'

initializeTheme()
initializeStandaloneViewport()
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
