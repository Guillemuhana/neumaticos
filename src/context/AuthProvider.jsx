import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s)
      setCargando(false)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const iniciarSesion = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const cerrarSesion = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ sesion, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
