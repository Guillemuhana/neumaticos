import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/* Vite inlinea estas variables al compilar: si faltan en el entorno de build,
   el bundle sale sin credenciales. Avisamos en pantalla en vez de reventar
   al importar, que dejaba la página en blanco sin explicación. */
export const configurado = Boolean(url && anonKey)

export const supabase = configurado ? createClient(url, anonKey) : null
