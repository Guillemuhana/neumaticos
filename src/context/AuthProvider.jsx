import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  const traerPerfil = useCallback(async (userId) => {
    if (!userId) return setPerfil(null)
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, activo')
      .eq('id', userId)
      .maybeSingle()
    setPerfil(data ?? null)
  }, [])

  useEffect(() => {
    let vivo = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return
      setSesion(data.session)
      await traerPerfil(data.session?.user?.id)
      if (vivo) setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, s) => {
      if (!vivo) return
      setSesion(s)
      await traerPerfil(s?.user?.id)
      if (vivo) setCargando(false)
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [traerPerfil])

  const iniciarSesion = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const cerrarSesion = () => supabase.auth.signOut()

  /* El rol de la UI es solo para no mostrar botones inútiles: quien manda
     es RLS en la base. Ver supabase/schema.sql. */
  const rol = perfil?.rol ?? null
  const puede = (...roles) => roles.includes(rol)

  return (
    <AuthContext.Provider
      value={{ sesion, perfil, rol, puede, cargando, iniciarSesion, cerrarSesion }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
