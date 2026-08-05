import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { configurado } from './lib/supabase'
import FaltaConfig from './components/FaltaConfig'
import Pausada from './components/Pausada'
import App from './App'
import './index.css'

/* Interruptor de mantenimiento. Se define en Vercel → Settings → Environment
   Variables y, como toda VITE_*, se lee al compilar: cambiarla exige volver a
   desplegar para que tenga efecto (y para volver a habilitar la app también). */
const pausada = import.meta.env.VITE_APP_PAUSADA === 'true'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {pausada ? (
      <Pausada />
    ) : configurado ? (
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
