import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/* Vite inlinea estas variables al compilar: si faltan en el entorno de build,
   el bundle sale sin credenciales. Avisamos en pantalla en vez de reventar
   al importar, que dejaba la página en blanco sin explicación. */
export const configurado = Boolean(url && anonKey)

export const supabase = configurado ? createClient(url, anonKey) : null

/* Los dos fallos de Storage que se ven en la práctica tienen el mismo origen
   —falta correr supabase/storage.sql— pero Postgres los reporta con mensajes
   crudos que no dicen qué hacer. Se traducen acá para no repetirlo en cada
   pantalla que sube archivos. */
export function errorDeStorage(error, bucket) {
  const texto = error?.message?.toLowerCase() ?? ''

  if (texto.includes('bucket not found'))
    return new Error(
      `Falta el bucket «${bucket}» en Supabase Storage. Corré supabase/storage.sql en el SQL Editor.`
    )

  if (texto.includes('row-level security') || texto.includes('violates'))
    return new Error(
      `El bucket «${bucket}» existe pero no permite subir archivos: le faltan las políticas. ` +
        'Corré supabase/storage.sql en el SQL Editor de Supabase (crear el bucket desde el panel no alcanza).'
    )

  return error
}
