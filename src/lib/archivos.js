import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from 'lucide-react'

/* Qué es cada adjunto, mirando su extensión.
 *
 * El tipo MIME sería más exacto, pero no siempre está: un archivo que llega
 * desde el explorador de Windows a veces viaja con `application/octet-stream`
 * y ahí todo sería «archivo». La extensión, en cambio, viene siempre y es
 * además lo que la persona ve escrito.
 *
 * El color no es decoración: en una lista de adjuntos, el bordó del PDF y el
 * verde de la planilla se distinguen de reojo, que es como se busca un remito
 * entre veinte mensajes. Salen de la paleta del sistema, sin colores nuevos. */

const FAMILIAS = [
  { rotulo: 'PDF', icono: FileText, tono: 'alerta', extensiones: ['pdf'] },
  {
    rotulo: 'Planilla',
    icono: FileSpreadsheet,
    tono: 'conforme',
    extensiones: ['xls', 'xlsx', 'ods', 'csv'],
  },
  {
    rotulo: 'Documento',
    icono: FileText,
    tono: 'acento',
    extensiones: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'],
  },
  {
    rotulo: 'Imagen',
    icono: FileImage,
    tono: 'acento',
    extensiones: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'bmp', 'svg'],
  },
  {
    rotulo: 'Video',
    icono: FileVideo,
    tono: 'acento',
    extensiones: ['mp4', 'mov', 'webm', 'mkv', 'avi', '3gp'],
  },
  { rotulo: 'Audio', icono: FileAudio, tono: 'acento', extensiones: ['mp3', 'wav', 'ogg', 'm4a'] },
  {
    rotulo: 'Comprimido',
    icono: FileArchive,
    tono: 'neutro',
    extensiones: ['zip', 'rar', '7z', 'tar', 'gz'],
  },
]

export const extensionDe = (nombre = '') => {
  const trozos = String(nombre).split('.')
  return trozos.length > 1 ? trozos.pop().toLowerCase() : ''
}

/* Lo desconocido no cae en un «Archivo» genérico: si la extensión existe, se
   muestra en mayúsculas. Ver «DWG» dice bastante más que ver «Archivo». */
export function pintaDeArchivo(nombre) {
  const extension = extensionDe(nombre)
  const familia = FAMILIAS.find((f) => f.extensiones.includes(extension))
  if (familia) return familia
  return { rotulo: extension ? extension.toUpperCase() : 'Archivo', icono: File, tono: 'neutro' }
}

export const TONOS_ARCHIVO = {
  alerta: 'bg-atencion-50 text-atencion-600',
  acento: 'bg-perez-50 text-perez-600',
  conforme: 'bg-conforme-50 text-conforme-500',
  neutro: 'bg-concreto-200 text-acero-500',
}
