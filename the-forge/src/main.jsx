import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './index.css'
import App from './App.jsx'
import { ForgeSettingsProvider } from './context/ForgeSettingsContext.jsx'
import { ForgeProvider } from './store/useForgeStore.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ForgeProvider>
      <ForgeSettingsProvider>
        <App />
      </ForgeSettingsProvider>
    </ForgeProvider>
  </StrictMode>,
)
