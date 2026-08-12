import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, Download, Plus, Wrench } from 'lucide-react'
import { useConsulta } from '../../hooks/useConsulta'
import { supabase, urlDescarga, urlPublica } from '../../lib/supabase'
import { fecha, sello } from '../../lib/formato'
import { cuitFormateado } from '../../lib/fiscal'
import { etapaDe } from '../../lib/taller'
import { errorDeVehiculo, nombreVehiculo, patenteNormal } from '../../lib/vehiculos'
import { Aviso, Boton, Campo, Etiqueta, Modal, estiloInput } from '../UI'

/* Todo lo del cliente en una sola pantalla: sus autos, las fotos de cada
   ingreso y las órdenes que pasaron por el taller.

   Las fotos cuelgan de la orden, no del cliente, pero acá se muestran juntas:
   es la vista que se usa cuando alguien vuelve a los seis meses diciendo que
   el golpe ya estaba, y hay que encontrar el ingreso donde se ve. */

const BUCKET = 'vehiculos'
const urlDe = (ruta) => urlPublica(BUCKET, ruta)

const nombreAlBajar = (foto) =>
  [
    'perez',
    (foto.ordenes?.patente || foto.ordenes?.vehiculo || 'vehiculo')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-'),
    sello(foto.creada_en),
  ].join('-') + '.jpg'

export default function FichaCliente({ cliente, onCerrar, onCambio }) {
  const navigate = useNavigate()

  const vehiculos = useConsulta(
    () =>
      supabase
        .from('vehiculos')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('creado_en', { ascending: false }),
    [cliente.id]
  )

  const ordenes = useConsulta(
    () =>
      supabase
        .from('ordenes')
        .select('id, vehiculo, patente, estado, creada_en, falla_reportada')
        .eq('cliente_id', cliente.id)
        .order('creada_en', { ascending: false })
        .limit(20),
    [cliente.id]
  )

  /* `!inner` obliga a que la orden exista y filtra por su cliente: sin eso,
     Postgres devolvería las fotos de todo el taller y el filtro quedaría del
     lado del navegador, que es donde no sirve. */
  const fotos = useConsulta(
    () =>
      supabase
        .from('orden_fotos')
        .select('id, ruta, momento, creada_en, ordenes!inner (id, vehiculo, patente, cliente_id)')
        .eq('ordenes.cliente_id', cliente.id)
        .order('creada_en', { ascending: false })
        .limit(24),
    [cliente.id]
  )

  return (
    <Modal titulo={cliente.nombre} onCerrar={onCerrar}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-acero-500">
          {cliente.telefono && <span>{cliente.telefono}</span>}
          {cliente.email && <span>{cliente.email}</span>}
          {(cliente.cuit || cliente.documento) && (
            <span className="font-mono">
              {cliente.cuit ? cuitFormateado(cliente.cuit) : cliente.documento}
            </span>
          )}
        </div>

        <Vehiculos cliente={cliente} consulta={vehiculos} onCambio={onCambio} />

        <Bloque titulo="Fotos de los ingresos">
          {fotos.error && <Aviso>{fotos.error}</Aviso>}
          {fotos.cargando ? (
            <p className="py-2 text-sm text-acero-500">Cargando fotos…</p>
          ) : !fotos.datos?.length ? (
            <p className="py-2 text-sm text-acero-500">
              Todavía no hay fotos. Se sacan desde la orden de trabajo, cuando el auto entra.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.datos.map((f) => (
                <li key={f.id} className="group relative">
                  {/* El enlace de descarga no puede ir adentro del que abre la
                      foto —un enlace dentro de otro no es HTML válido—, así
                      que va encima, en la esquina. */}
                  <a
                    href={urlDescarga(BUCKET, f.ruta, nombreAlBajar(f))}
                    download={nombreAlBajar(f)}
                    aria-label={`Descargar la foto del ${fecha(f.creada_en)}`}
                    className="absolute right-1 top-1 z-10 rounded-md bg-caucho-950/55 p-1 text-white opacity-0 transition-opacity hover:bg-caucho-950/75 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Download size={13} aria-hidden="true" />
                  </a>
                  <a
                    href={urlDe(f.ruta)}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-concreto-200"
                    title={`${f.ordenes?.vehiculo ?? ''} · ${fecha(f.creada_en)}`}
                  >
                    <img
                      src={urlDe(f.ruta)}
                      alt={`${f.ordenes?.vehiculo ?? 'Vehículo'} · ${fecha(f.creada_en)}`}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition-transform duration-200 hover:scale-105"
                    />
                    {/* Acá el vehículo importa tanto como la fecha: la ficha
                        mezcla los ingresos de todos sus autos. */}
                    <span className="block bg-concreto-100 px-1.5 py-1 text-micro text-acero-500">
                      <span className="block truncate">{f.ordenes?.vehiculo}</span>
                      <span className="tabular-nums">{fecha(f.creada_en)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Bloque>

        <Bloque titulo="Paso por el taller">
          {ordenes.error && <Aviso>{ordenes.error}</Aviso>}
          {ordenes.cargando ? (
            <p className="py-2 text-sm text-acero-500">Cargando órdenes…</p>
          ) : !ordenes.datos?.length ? (
            <p className="py-2 text-sm text-acero-500">Nunca trajo un auto al taller.</p>
          ) : (
            <ul className="divide-y divide-concreto-200">
              {ordenes.datos.map((o) => (
                <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-caucho-900">{o.vehiculo}</p>
                    {o.falla_reportada && (
                      <p className="truncate text-xs text-acero-500">{o.falla_reportada}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Etiqueta tono={etapaDe(o.estado).tono}>{etapaDe(o.estado).texto}</Etiqueta>
                    <span className="text-xs text-acero-500">{fecha(o.creada_en)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloque>

        <div className="flex flex-wrap justify-end gap-2 border-t border-concreto-200 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
          <Boton onClick={() => navigate('/taller', { state: { nueva: true, cliente } })}>
            <Wrench size={15} /> Nueva orden
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function Bloque({ titulo, children, accion }) {
  return (
    <section className="rounded-lg border border-concreto-200">
      <div className="flex items-center justify-between gap-2 border-b border-concreto-200 px-3 py-2">
        <h3 className="text-menor font-bold uppercase tracking-wide text-acero-500">{titulo}</h3>
        {accion}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

function Vehiculos({ cliente, consulta, onCambio }) {
  const [agregando, setAgregando] = useState(false)

  return (
    <Bloque
      titulo="Vehículos"
      accion={
        !agregando ? (
          <Boton variante="fantasma" className="px-2 py-1" onClick={() => setAgregando(true)}>
            <Plus size={14} /> Agregar
          </Boton>
        ) : null
      }
    >
      {consulta.error && <Aviso>{consulta.error}</Aviso>}

      {consulta.cargando ? (
        <p className="py-2 text-sm text-acero-500">Cargando vehículos…</p>
      ) : !consulta.datos?.length ? (
        <p className="py-2 text-sm text-acero-500">
          Sin vehículos cargados. También se dan de alta solos al crear la primera orden.
        </p>
      ) : (
        <ul className="divide-y divide-concreto-200">
          {consulta.datos.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-caucho-900">
                <Car size={15} className="shrink-0 text-acero-400" aria-hidden="true" />
                <span className="truncate">{nombreVehiculo(v)}</span>
              </span>
              <span className="shrink-0 font-mono text-xs uppercase text-acero-500">
                {v.patente || '—'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {agregando && (
        <NuevoVehiculo
          clienteId={cliente.id}
          onCerrar={() => setAgregando(false)}
          onGuardado={() => {
            setAgregando(false)
            consulta.recargar()
            onCambio?.()
          }}
        />
      )}
    </Bloque>
  )
}

function NuevoVehiculo({ clienteId, onCerrar, onGuardado }) {
  const [form, setForm] = useState({ marca: '', modelo: '', patente: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k],
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const guardar = async () => {
    setGuardando(true)
    setError('')

    const { error } = await supabase.from('vehiculos').insert({
      cliente_id: clienteId,
      marca: form.marca.trim(),
      modelo: form.modelo.trim() || null,
      patente: patenteNormal(form.patente),
    })

    if (error) {
      setError(errorDeVehiculo(error))
      setGuardando(false)
    } else onGuardado()
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-concreto-200 bg-concreto-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Marca">
          <input autoFocus className={estiloInput} placeholder="Ford" {...campo('marca')} />
        </Campo>
        <Campo etiqueta="Modelo">
          <input className={estiloInput} placeholder="Ranger 2019" {...campo('modelo')} />
        </Campo>
      </div>
      <Campo etiqueta="Patente">
        <input className={`${estiloInput} uppercase`} placeholder="AB123CD" {...campo('patente')} />
      </Campo>

      <Aviso>{error}</Aviso>

      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={guardando || !form.marca.trim()}>
          {guardando ? 'Guardando…' : 'Agregar vehículo'}
        </Boton>
      </div>
    </div>
  )
}
