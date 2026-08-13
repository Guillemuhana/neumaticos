import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ClipboardList, History, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { desde, plata } from '../lib/formato'
import { ETAPAS_ACTIVAS, avanceDe, etapaDe } from '../lib/taller'
import PanelOrden from '../components/taller/PanelOrden'
import NuevaOrden from '../components/taller/NuevaOrden'
import { Aviso, Boton, Cargando, Encabezado, Etiqueta, Tarjeta, Vacio } from '../components/UI'

const urlDeFoto = (ruta) => supabase.storage.from('vehiculos').getPublicUrl(ruta).data.publicUrl

/* El tablero sigue el recorrido real de la orden, de izquierda a derecha:
   entra por el mostrador, la toma el taller, vuelve al mostrador para
   entregarla. Todo el equipo ve las tres columnas —el vendedor necesita saber
   si el auto está listo— pero solo actúa sobre las suyas, que van marcadas. */

export default function Taller() {
  const { sesion, rol } = useAuth()
  const ubicacion = useLocation()

  /* El proceso empieza en el mostrador, no acá: desde el panel y desde la
     ficha de un cliente se entra con la orden ya abierta —y, si vino de un
     cliente, con el paso 1 completo. */
  const [creando, setCreando] = useState(Boolean(ubicacion.state?.nueva))
  const clienteInicial = ubicacion.state?.cliente ?? null
  /* Y desde una cotización aprobada se entra directo a la orden que acaba de
     abrirse: el vendedor la mandó al taller y quiere ver que llegó. */
  const [abiertaId, setAbiertaId] = useState(ubicacion.state?.orden ?? null)
  const [verHistorial, setVerHistorial] = useState(false)

  /* La orden apunta dos veces a `perfiles` (quién la recibió y quién la
     repara). Embeberlas obliga a nombrar cada constraint y, peor, `perfiles`
     solo deja leer el perfil propio: al mecánico le llegarían los nombres en
     blanco. Traemos el equipo aparte —por la vista `equipo`, que expone solo
     nombres— y lo cruzamos acá. */
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

    /* Una foto por orden, para reconocer el auto de un vistazo en el tablero.
       Se piden solo las de las órdenes que se van a mostrar —y no la tabla
       entera— porque el historial de fotos crece para siempre y el tablero
       no. Se ordena por momento para que gane la del ingreso, que es la que
       muestra el auto completo; las del trabajo suelen ser un primer plano de
       una pieza, que no sirve para identificarlo. */
    const fotos = await supabase
      .from('orden_fotos')
      .select('orden_id, ruta, momento')
      .in('orden_id', ordenes.data.map((o) => o.id))
      .order('momento')
      .order('creada_en')

    if (fotos.error) return { error: fotos.error }

    const portada = new Map()
    for (const f of fotos.data) {
      if (!portada.has(f.orden_id)) portada.set(f.orden_id, f.ruta)
    }

    const nombre = new Map(equipo.data.map((p) => [p.id, p.nombre]))
    const quien = (id) => (id ? { nombre: nombre.get(id) ?? 'Usuario dado de baja' } : null)

    return {
      data: ordenes.data.map((o) => ({
        ...o,
        mecanico: quien(o.mecanico_id),
        recepcionista: quien(o.recepcionista_id),
        portada: portada.get(o.id) ?? null,
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
        detalle="Del mostrador al taller y de vuelta: la orden entra, se trabaja y se entrega."
      >
        <Boton variante="secundario" onClick={() => setVerHistorial((v) => !v)}>
          <History size={16} /> {verHistorial ? 'Ver tablero' : `Historial (${entregadas.length})`}
        </Boton>
        {recibe && (
          <Boton onClick={() => setCreando(true)}>
            <Plus size={16} /> Nueva orden de trabajo
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
                ? 'Cuando llegue un vehículo, cargá la orden con el cliente, la falla y el mecánico que lo va a atender.'
                : 'Todavía no hay trabajo cargado desde recepción.'
            }
          />
          {recibe && (
            <div className="flex justify-center pb-8">
              <Boton onClick={() => setCreando(true)}>
                <Plus size={16} /> Crear la primera orden
              </Boton>
            </div>
          )}
        </Tarjeta>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ETAPAS_ACTIVAS.map((columna) => {
            const enColumna = datos.filter((o) => o.estado === columna.valor)
            const meToca = Boolean(avanceDe(columna.valor, rol))

            return (
              <section key={columna.valor} className="space-y-3">
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
                  <TarjetaOrden
                    key={o.id}
                    orden={o}
                    destacar={meToca}
                    mia={o.mecanico_id === sesion.user.id}
                    onAbrir={setAbiertaId}
                  />
                ))}
              </section>
            )
          })}
        </div>
      )}

      {creando && (
        <NuevaOrden
          clienteInicial={clienteInicial}
          onCerrar={() => setCreando(false)}
          onGuardada={(id) => {
            /* Abrir la orden recién creada deja el próximo paso a la vista en
               vez de dejar al usuario buscando su tarjeta en el tablero. */
            setCreando(false)
            setAbiertaId(id)
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

function TarjetaOrden({ orden, destacar, mia = false, onAbrir }) {
  const etapa = etapaDe(orden.estado)

  return (
    <Tarjeta
      /* La tarjeta ya no trae borde propio, así que el resaltado tiene que
         declarar el ancho además del color: `border-perez-200` solo no pinta
         nada. Es un anillo interior para no correr el contenido 1px. */
      className={`elevar w-full cursor-pointer p-3 text-left ${
        destacar ? 'ring-1 ring-inset ring-perez-200' : ''
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
      {/* La foto del ingreso al lado del nombre: en un tablero de doce
          tarjetas, "Ford Ranger" se repite y el auto no. */}
      <div className="flex items-start gap-2.5">
        {orden.portada && (
          <img
            src={urlDeFoto(orden.portada)}
            alt=""
            loading="lazy"
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-caucho-950">{orden.vehiculo}</p>
          {orden.patente && (
            <p className="font-mono text-xs uppercase text-acero-500">{orden.patente}</p>
          )}
          <p className="mt-1 truncate text-sm text-acero-500">
            {orden.clientes?.nombre ?? 'Sin cliente'}
          </p>
        </div>
      </div>

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

      {orden.mecanico?.nombre ? (
        <p className={`mt-1.5 text-xs ${mia ? 'font-semibold text-perez-700' : 'text-acero-500'}`}>
          {mia ? 'Asignada a vos' : orden.mecanico.nombre}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-atencion-700">Sin mecánico asignado</p>
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
