import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/* Cuántos mensajes del chat no vio todavía quien está usando la app.

   Se cuenta en el servidor con `head: true`: solo hace falta el número, y
   traerse los mensajes para contarlos en el navegador sería descargar el hilo
   entero cada vez que alguien cambia de pantalla.

   Vuelve a contar al cambiar de ruta porque salir del chat es lo que lo deja
   en cero: la pantalla marca lo leído al entrar, y este contador tiene que
   enterarse sin que haya que recargar. */
export function useNoLeidos(userId) {
  const [cantidad, setCantidad] = useState(0)
  const ubicacion = useLocation()

  const contar = useCallback(async () => {
    if (!userId) return

    const { data: lectura } = await supabase
      .from('chat_lecturas')
      .select('visto_en')
      .eq('perfil_id', userId)
      .maybeSingle()

    /* Sin lectura previa cuentan todos: es alguien que nunca abrió el chat. */
    const desde = lectura?.visto_en ?? '1970-01-01T00:00:00Z'

    const { count } = await supabase
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .gt('creado_en', desde)
      /* Lo propio no cuenta como no leído: uno ya sabe lo que escribió. */
      .neq('autor_id', userId)

    setCantidad(count ?? 0)
  }, [userId])

  useEffect(() => {
    contar()
  }, [contar, ubicacion.pathname])

  useEffect(() => {
    if (!userId) return

    const canal = supabase
      .channel('chat-no-leidos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          if (payload.new.autor_id === userId) return
          /* Estando en el chat el mensaje se lee solo, así que no suma. */
          if (window.location.pathname === '/chat') return
          setCantidad((n) => n + 1)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(canal)
  }, [userId])

  return cantidad
}
