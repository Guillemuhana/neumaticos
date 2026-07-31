import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { configurado } from './lib/supabase'
import FaltaConfig from './components/FaltaConfig'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {configurado ? (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <FaltaConfig />
    )}
  </StrictMode>
)
