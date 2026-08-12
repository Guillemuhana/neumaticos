import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { supabase } from '../lib/supabase'
import { Aviso, Boton, Encabezado, Tarjeta, estiloInput } from '../components/UI'

/* El asistente de gerencia. Es una conversación y no un tablero más porque lo
   que se le pregunta no tiene forma fija: un día es "cuánto vendimos", al otro
   "qué le hicimos al Corsa de Gómez" y al otro "cómo se anula una factura".
   Cualquiera de las tres respuestas ya está en el sistema; lo que faltaba era
   poder pedirlas hablando.
 *
 * Acá no hay ninguna clave ni ninguna lógica de negocio: la pantalla manda el
 * hilo a /api/asistente con el token de la sesión y muestra lo que vuelve.
 * Quién puede preguntar y qué datos se pueden mirar se decide allá, que es
 * donde el navegador no llega. Ver api/asistente.js. */

/* Nombres de las herramientas del servidor en castellano de mostrador: abajo
   de cada respuesta se muestra qué fue a mirar, que es lo que permite creerle
   —o mandarlo a mirar de nuevo. */
const QUE_MIRO = {
  buscar_productos: 'stock',
  resumen_stock: 'inventario',
  resumen_ventas: 'ventas',
  listar_ventas: 'ventas',
  listar_ordenes: 'taller',
  buscar_clientes: 'clientes',
  historial_cliente: 'historial del cliente',
  historial_vehiculo: 'historial del vehículo',
  listar_comprobantes: 'facturación',
  comisiones: 'comisiones',
  estado_caja: 'caja',
  equipo: 'personal',
  garantias: 'garantías',
}

const SUGERENCIAS = [
  '¿Cuánto vendimos este mes y con qué medio de pago?',
  '¿Qué cubiertas están por debajo del stock mínimo?',
  '¿Qué órdenes hay en el taller ahora y quién las tiene?',
  '¿Quedaron comprobantes sin emitir?',
  '¿Cuánto le debo de comisión a cada uno?',
]

export default function Asistente() {
  const { perfil } = useAuth()
  const [hilo, setHilo] = useState([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState('')
  const fin = useRef(null)

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [hilo, pensando])

  const preguntar = async (pregunta) => {
    const limpia = pregunta.trim()
    if (!limpia || pensando) return

    setError('')
    setTexto('')

    /* El hilo que se manda es el que se ve, con la pregunta nueva adentro: sin
       eso, un "¿y el mes pasado?" llegaría al servidor sin el mes de antes y
       la respuesta saldría de la nada. */
    const conPregunta = [...hilo, { rol: 'usuario', texto: limpia }]
    setHilo(conPregunta)
    setPensando(true)

    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('Se cerró la sesión. Volvé a entrar.')

      const respuesta = await fetch('/api/asistente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ mensajes: conPregunta }),
      })

      /* `vite dev` sirve el index.html para cualquier ruta que no sea un
         archivo, así que en local sin `vercel dev` esto vuelve HTML y el
         .json() explota con un error críptico sobre un "<". Se explica acá en
         vez de dejar que el usuario lo descubra. */
      if (!respuesta.headers.get('content-type')?.includes('application/json'))
        throw new Error(
          'El asistente no está corriendo. En local hace falta «vercel dev» en lugar de «npm run dev».'
        )

      const cuerpo = await respuesta.json()
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo consultar al asistente.')

      setHilo([...conPregunta, { rol: 'asistente', texto: cuerpo.texto, consultadas: cuerpo.consultadas }])
    } catch (err) {
      setError(err.message)
      /* La pregunta se devuelve al cuadro de texto: reescribirla a mano
         después de un corte de señal en el taller es la peor manera de
         enterarse de que falló. */
      setTexto(limpia)
      setHilo(hilo)
    } finally {
      setPensando(false)
    }
  }

  return (
    <>
      <Encabezado
        titulo="Asistente"
        detalle="Preguntale lo que quieras del sistema: stock, ventas, clientes, taller, facturación, comisiones o caja. Solo mira datos, no toca nada."
      />

      <Aviso>{error}</Aviso>

      <Tarjeta className="mt-3 flex h-[calc(100vh-16rem)] min-h-[26rem] flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          {!hilo.length ? (
            <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-perez-50 text-perez-600">
                <Bot size={24} aria-hidden="true" />
              </span>
              <p className="display mt-3 text-lg font-bold text-caucho-950">
                Hola{perfil?.nombre ? `, ${perfil.nombre.split(' ')[0]}` : ''}
              </p>
              <p className="mt-1 text-sm text-acero-500">
                Conozco todo lo que hay cargado en el sistema. Preguntame.
              </p>

              <ul className="mt-5 w-full space-y-2 text-left">
                {SUGERENCIAS.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => preguntar(s)}
                      className="flex w-full items-center gap-2 rounded-lg border border-acero-200 px-3 py-2 text-sm text-caucho-800 transition-colors hover:border-acero-300 hover:bg-concreto-50"
                    >
                      <Sparkles size={14} aria-hidden="true" className="shrink-0 text-perez-600" />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="space-y-4">
              {hilo.map((m, i) => (
                <li key={i} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                  {m.rol === 'usuario' ? (
                    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl bg-perez-50 px-3 py-2 text-sm text-caucho-900 sm:max-w-[70%]">
                      {m.texto}
                    </p>
                  ) : (
                    <div className="max-w-[92%] rounded-xl bg-concreto-100 px-3.5 py-2.5 sm:max-w-[80%]">
                      <Respuesta texto={m.texto} />
                      {m.consultadas?.length > 0 && (
                        <p className="mt-2 border-t border-concreto-200 pt-1.5 text-micro text-acero-500">
                          Miré: {[...new Set(m.consultadas.map((c) => QUE_MIRO[c] ?? c))].join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {pensando && (
            <p role="status" className="mt-4 flex items-center gap-2 text-sm text-acero-500">
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-concreto-200 border-t-perez-600"
              />
              Revisando el sistema…
            </p>
          )}

          <div ref={fin} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            preguntar(texto)
          }}
          className="flex items-end gap-2 border-t border-concreto-200 p-3"
        >
          <label className="sr-only" htmlFor="pregunta">
            Tu pregunta
          </label>
          <textarea
            id="pregunta"
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            /* Enter manda y Shift+Enter baja de línea, como en el chat del
               equipo: la mano ya viene acostumbrada de la otra pantalla. */
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                preguntar(texto)
              }
            }}
            placeholder="Preguntá algo del sistema…"
            className={`${estiloInput} max-h-32 min-h-10 resize-none py-2`}
          />
          <Boton type="submit" disabled={pensando || !texto.trim()}>
            <Send size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Preguntar</span>
          </Boton>
        </form>
      </Tarjeta>
    </>
  )
}

/* El modelo contesta en Markdown suelto: títulos no, pero listas y negritas
   sí, y sin esto la respuesta llega con asteriscos a la vista. Se resuelven
   los dos casos que aparecen —viñetas y **negrita**— en vez de sumar una
   librería de Markdown entera para eso. */
function Respuesta({ texto = '' }) {
  const lineas = texto.split('\n')

  return (
    <div className="space-y-1 text-sm leading-relaxed text-caucho-900">
      {lineas.map((linea, i) => {
        const viñeta = /^\s*([-*•]|\d+\.)\s+/.exec(linea)
        const contenido = viñeta ? linea.slice(viñeta[0].length) : linea

        if (!contenido.trim()) return <div key={i} className="h-1" />

        return (
          <p key={i} className={viñeta ? 'flex gap-2 pl-1' : ''}>
            {viñeta && <span aria-hidden="true" className="text-acero-400">•</span>}
            <span className="min-w-0 flex-1 break-words">{negritas(contenido)}</span>
          </p>
        )
      })}
    </div>
  )
}

const negritas = (texto) =>
  texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
    trozo.startsWith('**') && trozo.endsWith('**') ? (
      <strong key={i} className="font-semibold text-caucho-950">
        {trozo.slice(2, -2)}
      </strong>
    ) : (
      trozo
    )
  )
