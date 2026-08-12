import { useState } from 'react'
import { Banknote, Lock, Unlock } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { fecha, plata } from '../lib/formato'
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Metrica,
  Tabla,
  Tarjeta,
  Vacio,
  estiloInput,
} from '../components/UI'

/* El turno de mostrador: se abre con lo que hay en el cajón y se cierra
   contando. Lo que importa no es el total sino la diferencia entre lo que la
   caja dice que debería haber y lo que efectivamente había.

   Solo mira el efectivo: una transferencia no está en el cajón, así que
   sumarla haría que el arqueo diera mal siempre. */

export default function Caja() {
  const { sesion } = useAuth()
  const [error, setError] = useState('')

  const abierta = useConsulta(
    () => supabase.from('cajas').select('*').is('cerrada_en', null).maybeSingle(),
    []
  )

  const historial = useConsulta(
    () =>
      supabase
        .from('cajas')
        .select('*')
        .not('cerrada_en', 'is', null)
        .order('cerrada_en', { ascending: false })
        .limit(15),
    []
  )

  /* El efectivo del turno lo suma la base: si lo calculara la pantalla habría
     que traerse las ventas del día solo para sumarlas. */
  const efectivo = useConsulta(
    () =>
      abierta.datos
        ? supabase.rpc('efectivo_de_caja', { p_caja: abierta.datos.id })
        : Promise.resolve({ data: null, error: null }),
    [abierta.datos?.id]
  )

  const recargarTodo = () => {
    abierta.recargar()
    historial.recargar()
    efectivo.recargar()
  }

  if (abierta.cargando) return <Cargando texto="Buscando la caja…" alto="min-h-[40vh]" />

  return (
    <>
      <Encabezado
        titulo="Caja"
        detalle="Apertura y cierre del turno de mostrador, sobre el efectivo del cajón."
      />

      {error && <Aviso>{error}</Aviso>}
      {abierta.error && <Aviso>{abierta.error}</Aviso>}

      {abierta.datos ? (
        <Abierta
          caja={abierta.datos}
          efectivo={Number(efectivo.datos ?? 0)}
          usuarioId={sesion.user.id}
          onCambio={recargarTodo}
          onError={setError}
        />
      ) : (
        <Apertura usuarioId={sesion.user.id} onAbierta={recargarTodo} onError={setError} />
      )}

      <Historial consulta={historial} />
    </>
  )
}

function Apertura({ usuarioId, onAbierta, onError }) {
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)

  const abrir = async (e) => {
    e.preventDefault()
    setGuardando(true)
    onError('')

    const { error } = await supabase.from('cajas').insert({
      abierta_por: usuarioId,
      monto_inicial: Number(monto || 0),
    })

    /* El índice único deja una sola caja abierta en todo el local: si otro la
       abrió hace un minuto desde la otra computadora, esto lo cuenta. */
    if (error) {
      onError(
        error.code === '23505'
          ? 'Ya hay una caja abierta. Actualizá la pantalla para verla.'
          : error.message
      )
      setGuardando(false)
    } else onAbierta()
  }

  return (
    <Tarjeta className="max-w-md p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-md bg-concreto-100 p-1.5 text-acero-500">
          <Unlock size={16} aria-hidden="true" />
        </span>
        <h2 className="display text-base font-bold">Abrir caja</h2>
      </div>

      <form onSubmit={abrir} className="space-y-4">
        <Campo
          etiqueta="Monto inicial"
          ayuda="Lo que hay en el cajón al empezar el turno, contado."
        >
          <input
            autoFocus
            type="number"
            min="0"
            step="0.01"
            className={estiloInput}
            placeholder="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </Campo>

        <Boton type="submit" disabled={guardando}>
          {guardando ? 'Abriendo…' : 'Abrir caja'}
        </Boton>
      </form>
    </Tarjeta>
  )
}

function Abierta({ caja, efectivo, usuarioId, onCambio, onError }) {
  const [contado, setContado] = useState('')
  const [notas, setNotas] = useState('')
  const [cerrando, setCerrando] = useState(false)

  const esperado = Number(caja.monto_inicial) + efectivo
  /* La diferencia se muestra mientras se tipea: quien cuenta ve enseguida si
     le falta un billete, en vez de enterarse después de cerrar. */
  const diferencia = contado === '' ? null : Number(contado) - esperado

  const cerrar = async (e) => {
    e.preventDefault()
    setCerrando(true)
    onError('')

    const { error } = await supabase
      .from('cajas')
      .update({
        cerrada_por: usuarioId,
        cerrada_en: new Date().toISOString(),
        monto_contado: Number(contado || 0),
        notas: notas.trim() || null,
      })
      .eq('id', caja.id)

    if (error) {
      onError(error.message)
      setCerrando(false)
    } else onCambio()
  }

  return (
    <>
      <div className="cascada mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          icono={Unlock}
          tono="conforme"
          titulo="Caja abierta"
          valor={plata(caja.monto_inicial)}
          pie={`Desde ${fecha(caja.abierta_en)}`}
        />
        <Metrica
          icono={Banknote}
          tono="marca"
          titulo="Cobrado en efectivo"
          valor={plata(efectivo)}
          pie="Ventas confirmadas del turno"
        />
        <Metrica
          icono={Banknote}
          titulo="Debería haber"
          valor={plata(esperado)}
          pie="Inicial más el efectivo del turno"
        />
      </div>

      <Tarjeta className="max-w-md p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-concreto-100 p-1.5 text-acero-500">
            <Lock size={16} aria-hidden="true" />
          </span>
          <h2 className="display text-base font-bold">Cerrar caja</h2>
        </div>

        <form onSubmit={cerrar} className="space-y-4">
          <Campo etiqueta="Contado" ayuda="Lo que hay en el cajón ahora, contado billete por billete.">
            <input
              type="number"
              min="0"
              step="0.01"
              className={estiloInput}
              placeholder="0"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
            />
          </Campo>

          {diferencia !== null && (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                Math.abs(diferencia) < 0.01
                  ? 'border-conforme-100 bg-conforme-50 text-conforme-700'
                  : 'border-atencion-100 bg-atencion-50 text-atencion-700'
              }`}
            >
              {Math.abs(diferencia) < 0.01
                ? 'La caja cierra justa.'
                : diferencia > 0
                  ? `Sobran ${plata(diferencia)}.`
                  : `Faltan ${plata(Math.abs(diferencia))}.`}
            </p>
          )}

          <Campo etiqueta="Notas" ayuda="Opcional. Si hay diferencia, conviene decir por qué.">
            <input
              className={estiloInput}
              placeholder="Se pagó un flete con plata de la caja"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Campo>

          <Boton type="submit" disabled={cerrando || contado === ''}>
            {cerrando ? 'Cerrando…' : 'Cerrar caja'}
          </Boton>
        </form>
      </Tarjeta>
    </>
  )
}

function Historial({ consulta }) {
  if (consulta.cargando || !consulta.datos?.length) return null

  return (
    <section className="mt-6">
      <h2 className="display mb-3 text-base font-bold">Cierres anteriores</h2>
      <Tarjeta>
        <Tabla
          columnas={[
            'Cerrada',
            { texto: 'Inicial', cifra: true },
            { texto: 'Contado', cifra: true },
            'Notas',
          ]}
        >
          {consulta.datos.map((c) => (
            <tr key={c.id} className="rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none">
              <td data-label="Cerrada" className="px-4 py-2.5 text-acero-500">
                {fecha(c.cerrada_en)}
              </td>
              <td data-label="Inicial" className="cifra px-4 py-2.5 text-acero-500">
                {plata(c.monto_inicial)}
              </td>
              <td data-label="Contado" className="cifra px-4 py-2.5 font-semibold">
                {plata(c.monto_contado)}
              </td>
              <td data-label="Notas" className="px-4 py-2.5 text-acero-500">
                {c.notas ?? '—'}
              </td>
            </tr>
          ))}
        </Tabla>
      </Tarjeta>
    </section>
  )
}
