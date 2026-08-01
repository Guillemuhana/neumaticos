import { useMemo, useState } from 'react'
import { ClipboardList, History, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { desde, plata } from '../lib/formato'
import { ETAPAS_ACTIVAS, avanceDe, etapaDe } from '../lib/taller'
import PanelOrden from '../components/taller/PanelOrden'
import RecibirVehiculo from '../components/taller/RecibirVehiculo'
import { Aviso, Boton, Cargando, Encabezado, Etiqueta, Tarjeta, Vacio } from '../components/UI'

/* El tablero sigue el recorrido real de la orden, de izquierda a derecha:
   mostrador → administración → taller → mostrador. Todo el equipo ve las
   cinco columnas —el vendedor necesita saber si el auto está listo— pero solo
   actúa sobre las suyas, que van marcadas. */

export default function Taller() {
  const { rol } = useAuth()
  const [recibiendo, setRecibiendo] = useState(false)
  const [abiertaId, setAbiertaId] = useState(null)
  const [verHistorial, setVerHistorial] = useState(false)

  /* La orden apunta cuatro veces a `perfiles` (recibió, planificó, aprobó,
     reparó). Embeber las cuatro obliga a nombrar cada constraint y, peor,
     `perfiles` solo deja leer el perfil propio: al mecánico le llegarían todos
     los nombres en blanco. Traemos el equipo aparte —por la vista `equipo`, que
     expone solo nombres— y lo cruzamos acá. */
  const { datos, cargando, error, recargar } = useConsulta(async () => {
    const [ordenes, equipo] = await Promise.all([
      supabase
        .from('ordenes')
        .select('*, clientes(nombre, telefono)')
        .order('creada_en', { ascending: false })
        .limit(200),
      supabase.from('equipo').select('id, nombre'),
    ])

    const fallo = ordenes.error || equipo.error
    if (fallo) return { error: fallo }

    const nombre = new Map(equipo.data.map((p) => [p.id, p.nombre]))
    const quien = (id) => (id ? { nombre: nombre.get(id) ?? 'Usuario dado de baja' } : null)

    return {
      data: ordenes.data.map((o) => ({
        ...o,
        mecanico: quien(o.mecanico_id),
        recepcionista: quien(o.recepcionista_id),
        planificador: quien(o.planificada_por),
        aprobador: quien(o.aprobada_por),
      })),
    }
  }, [])

  /* La orden abierta sale siempre de la lista, no de una copia: así el panel
     se actualiza solo cuando una acción recarga el tablero. */
  const abierta = useMemo(
    () => datos?.find((o) => o.id === abiertaId) ?? null,
    [datos, abiertaId]
  )

  const entregadas = useMemo(
    () => (datos ?? []).filter((o) => o.estado === 'entregada'),
    [datos]
  )

  const recibe = rol === 'gerencia' || rol === 'vendedor'

  return (
    <>
      <Encabezado
        titulo="Taller"
        detalle="Del mostrador al taller: recepción, plan de trabajo, ejecución y entrega."
      >
        <Boton variante="secundario" onClick={() => setVerHistorial((v) => !v)}>
          <History size={16} /> {verHistorial ? 'Ver tablero' : `Historial (${entregadas.length})`}
        </Boton>
        {recibe && (
          <Boton onClick={() => setRecibiendo(true)}>
            <Plus size={16} /> Recibir vehículo
          </Boton>
        )}
      </Encabezado>

      {error && <Aviso>{error}</Aviso>}

      {cargando ? (
        <Cargando texto="Buscando órdenes…" alto="min-h-[40vh]" />
      ) : verHistorial ? (
        <Historial ordenes={entregadas} onAbrir={setAbiertaId} />
      ) : !datos?.length ? (
        <Tarjeta>
          <Vacio
            icono={ClipboardList}
            titulo="No hay órdenes"
            detalle={
              recibe
                ? 'Cuando llegue un vehículo, abrí la orden desde “Recibir vehículo”.'
                : 'Todavía no hay trabajo cargado desde recepción.'
            }
          />
        </Tarjeta>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 xl:grid xl:grid-cols-5 xl:overflow-visible">
          {ETAPAS_ACTIVAS.map((columna) => {
            const enColumna = datos.filter((o) => o.estado === columna.valor)
            const meToca = Boolean(avanceDe(columna.valor, rol))

            return (
              <section key={columna.valor} className="w-64 shrink-0 space-y-3 xl:w-auto">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="display text-sm font-bold uppercase tracking-wide">
                    {columna.texto}
                  </h2>
                  <span className="font-mono text-xs text-acero-500">{enColumna.length}</span>
                </div>

                <p className="text-xs text-acero-500">
                  {meToca ? (
                    <span className="font-semibold text-perez-700">Te toca</span>
                  ) : (
                    columna.puesto
                  )}
                </p>

                {enColumna.map((o) => (
                  <TarjetaOrden key={o.id} orden={o} destacar={meToca} onAbrir={setAbiertaId} />
                ))}
              </section>
            )
          })}
        </div>
      )}

      {recibiendo && (
        <RecibirVehiculo
          onCerrar={() => setRecibiendo(false)}
          onGuardada={() => {
            setRecibiendo(false)
            recargar()
          }}
        />
      )}

      {abierta && (
        <PanelOrden orden={abierta} onCerrar={() => setAbiertaId(null)} onCambio={recargar} />
      )}
    </>
  )
}

function TarjetaOrden({ orden, destacar, onAbrir }) {
  const etapa = etapaDe(orden.estado)

  return (
    <Tarjeta
      className={`elevar w-full cursor-pointer p-3 text-left ${
        destacar ? 'border-perez-200' : ''
      }`}
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(orden.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAbrir(orden.id)
        }
      }}
    >
      <p className="font-semibold text-caucho-950">{orden.vehiculo}</p>
      {orden.patente && (
        <p className="font-mono text-xs uppercase text-acero-500">{orden.patente}</p>
      )}

      <p className="mt-1.5 truncate text-sm text-acero-500">
        {orden.clientes?.nombre ?? 'Sin cliente'}
      </p>

      {orden.falla_reportada && (
        <p className="mt-1.5 line-clamp-2 text-xs text-acero-500">{orden.falla_reportada}</p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {Number(orden.total) > 0 ? (
          <span className="font-mono text-sm font-semibold">{plata(orden.total)}</span>
        ) : (
          <Etiqueta tono={etapa.tono}>Sin valorizar</Etiqueta>
        )}
        <span className="text-xs text-acero-500">{desde(orden.creada_en)}</span>
      </div>

      {orden.mecanico?.nombre && (
        <p className="mt-1.5 text-xs text-acero-500">{orden.mecanico.nombre}</p>
      )}
    </Tarjeta>
  )
}

function Historial({ ordenes, onAbrir }) {
  if (!ordenes.length) {
    return (
      <Tarjeta>
        <Vacio
          icono={History}
          titulo="Todavía no entregaste ninguna orden"
          detalle="Acá van a quedar los trabajos cerrados, con su plan y su venta."
        />
      </Tarjeta>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ordenes.map((o) => (
        <TarjetaOrden key={o.id} orden={o} destacar={false} onAbrir={onAbrir} />
      ))}
    </div>
  )
}
