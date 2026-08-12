import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [perfilError, setPerfilError] = useState('')
  const [cargando, setCargando] = useState(true)

  const traerPerfil = useCallback(async (userId) => {
    setPerfilError('')
    if (!userId) {
      setPerfil(null)
      return
    }

    try {
      const { data, error } = await supabase
        .from('perfiles')
        /* `imagen_url` la usa la barra lateral y `comision_pct`, el panel de
           cada uno: son datos del propio perfil, que es justo lo que RLS
           siempre devuelve, así que no cuesta traerlos con la sesión. */
        .select('id, nombre, rol, activo, imagen_url, comision_pct')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      setPerfil(data ?? null)
    } catch (err) {
      console.error('Error cargando perfil:', err)
      setPerfil(null)
      setPerfilError(
        err.message ||
          'No se pudo cargar el perfil. Revisa que la tabla perfiles exista y que el esquema de Supabase esté desplegado.'
      )
    }
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

  /* Revocar una sesión desde Supabase no echa a quien ya tiene la app
     abierta: el token que guarda el navegador está firmado y sigue siendo
     válido hasta que vence, así que la pestaña anda sola durante una hora sin
     preguntarle nada al servidor.

     `getUser()` sí pregunta. Se consulta al volver a la pestaña —que es
     cuando alguien retoma el trabajo— y así una sesión dada de baja se corta
     en el momento en que la persona vuelve a mirar la pantalla, en vez de
     seguir viva hasta que el token expire.

     Solo cierra ante una respuesta del servidor que diga que la sesión no
     vale. Un error de red no echa a nadie: quedarse sin señal en el taller es
     lo más común que hay, y desloguear por eso sería peor que el problema. */
  useEffect(() => {
    const verificar = async () => {
      if (document.visibilityState !== 'visible') return
      const { data } = await supabase.auth.getSession()
      if (!data.session) return

      const { error } = await supabase.auth.getUser()
      if (error?.status === 401 || error?.status === 403) await supabase.auth.signOut()
    }

    document.addEventListener('visibilitychange', verificar)
    window.addEventListener('focus', verificar)

    return () => {
      document.removeEventListener('visibilitychange', verificar)
      window.removeEventListener('focus', verificar)
    }
  }, [])

  const iniciarSesion = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const cerrarSesion = () => supabase.auth.signOut()

  /* El rol de la UI es solo para no mostrar botones inútiles: quien manda
     es RLS en la base. Ver supabase/schema.sql. */
  const rol = perfil?.rol ?? null
  const puede = (...roles) => roles.includes(rol)

  return (
    <AuthContext.Provider
      value={{ sesion, perfil, perfilError, rol, puede, cargando, iniciarSesion, cerrarSesion }}
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
