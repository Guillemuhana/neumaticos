import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/* Vite inlinea estas variables al compilar: si faltan en el entorno de build,
   el bundle sale sin credenciales. Avisamos en pantalla en vez de reventar
   al importar, que dejaba la página en blanco sin explicación. */
export const configurado = Boolean(url && anonKey)

export const supabase = configurado ? createClient(url, anonKey) : null

/* El enlace para ver un archivo del bucket. Estaba repetido en cada pantalla
   que muestra fotos o audios; vive acá porque la variante de descarga tiene
   una vuelta que no conviene volver a descubrir en cada una. */
export const urlPublica = (bucket, ruta) =>
  supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl

/* Y el enlace para bajarlo al teléfono o a la computadora.
 *
 * El atributo `download` de un `<a>` no alcanza: el navegador lo ignora
 * cuando el archivo está en otro dominio, y los nuestros están en Supabase.
 * Sin esto, tocar "Descargar" abre la foto en una pestaña en vez de bajarla,
 * que es exactamente el problema que se ve en el celular del taller.
 *
 * `download` acá es otra cosa: es una opción de Storage, que responde con
 * `Content-Disposition: attachment` y el nombre que se le pase. Ahí sí el
 * navegador guarda el archivo, y encima con un nombre que se entiende en vez
 * del UUID con el que se subió. */
export const urlDescarga = (bucket, ruta, nombre) =>
  supabase.storage.from(bucket).getPublicUrl(ruta, { download: nombre || true }).data.publicUrl

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
