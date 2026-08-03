import { useMemo, useState } from 'react'
import { Building2, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { fechaCorta, plataExacta } from '../lib/formato'
import {
  CONDICIONES_IVA,
  cuitFormateado,
  cuitValido,
  estadoDe,
  numeroComprobante,
  tipoDe,
} from '../lib/fiscal'
import PanelComprobante from '../components/facturacion/PanelComprobante'
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Etiqueta,
  Modal,
  Tabla,
  Tarjeta,
  Vacio,
  estiloInput,
} from '../components/UI'

/* El final del circuito. El taller termina, recepción entrega, y lo que se
   facturó cae acá esperando su CAE.

   Arranca en «Pendientes» a propósito: lo que importa de esta pantalla no es
   el archivo de comprobantes viejos sino lo que todavía le debe ARCA. */

const FILTROS = [
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'emitido', texto: 'Emitidos' },
  { valor: 'anulado', texto: 'Anulados' },
]

export default function Facturacion() {
  const { rol } = useAuth()
  const [filtro, setFiltro] = useState('pendiente')
  const [abiertoId, setAbiertoId] = useState(null)
  const [editandoEmisor, setEditandoEmisor] = useState(false)

  const { datos, cargando, error, recargar } = useConsulta(async () => {
    const [comprobantes, empresa] = await Promise.all([
      supabase
        .from('comprobantes')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(300),
      supabase.from('empresa').select('*').maybeSingle(),
    ])

    const fallo = comprobantes.error || empresa.error
    if (fallo) return { error: fallo }

    return { data: { comprobantes: comprobantes.data, empresa: empresa.data } }
  }, [])

  const listado = useMemo(
    () => (datos?.comprobantes ?? []).filter((c) => c.estado === filtro),
    [datos, filtro]
  )

  const pendientes = (datos?.comprobantes ?? []).filter((c) => c.estado === 'pendiente').length

  /* El comprobante abierto sale de la lista y no de una copia: así el panel se
     actualiza solo cuando emitir o corregir recargan la pantalla. */
  const abierto = useMemo(
    () => (datos?.comprobantes ?? []).find((c) => c.id === abiertoId) ?? null,
    [datos, abiertoId]
  )

  const emisorIncompleto =
    datos?.empresa && (!datos.empresa.razon_social || !datos.empresa.cuit)

  return (
    <>
      <Encabezado
        titulo="Facturación"
        detalle="Lo que el taller y el mostrador cerraron, esperando su comprobante de ARCA."
      >
        {rol === 'gerencia' && (
          <Boton variante="secundario" onClick={() => setEditandoEmisor(true)}>
            <Building2 size={16} /> Datos del emisor
          </Boton>
        )}
      </Encabezado>

      {error && <Aviso>{error}</Aviso>}

      {/* Sin razón social ni CUIT del emisor, el comprobante impreso sale
          incompleto. Se avisa acá porque es el único lugar donde se nota. */}
      {emisorIncompleto && (
        <Aviso tono="atencion">
          Faltan los datos del emisor: sin razón social y CUIT, los comprobantes salen impresos a
          medias.{' '}
          {rol === 'gerencia' ? 'Cargalos desde «Datos del emisor».' : 'Pedíselos a gerencia.'}
        </Aviso>
      )}

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              filtro === f.valor
                ? 'border-perez-600 bg-perez-50 font-semibold text-perez-700'
                : 'border-acero-200 bg-white text-caucho-800 hover:bg-concreto-100'
            }`}
          >
            {f.texto}
            {f.valor === 'pendiente' && pendientes > 0 && (
              <span className="ml-2 font-mono text-xs">{pendientes}</span>
            )}
          </button>
        ))}
      </div>

      <Tarjeta>
        {cargando ? (
          <Cargando texto="Buscando comprobantes…" alto="min-h-[40vh]" />
        ) : !listado.length ? (
          <Vacio
            icono={FileText}
            titulo={
              filtro === 'pendiente' ? 'No hay nada pendiente de facturar' : 'No hay comprobantes acá'
            }
            detalle={
              filtro === 'pendiente'
                ? 'Cuando se entregue una orden de taller o se confirme una venta, el comprobante aparece en esta lista.'
                : 'Probá con otro filtro.'
            }
          />
        ) : (
          <Tabla columnas={['Fecha', 'Comprobante', 'Cliente', 'Neto', 'IVA', 'Total', 'Estado']}>
            {listado.map((c) => {
              const tipo = tipoDe(c.tipo)
              const estado = estadoDe(c.estado)

              return (
                <tr
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setAbiertoId(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setAbiertoId(c.id)
                    }
                  }}
                  className="cursor-pointer rounded-xl bg-white shadow-sm hover:bg-concreto-50 sm:bg-transparent sm:shadow-none"
                >
                  <td data-label="Fecha" className="whitespace-nowrap px-4 py-3 text-acero-500">
                    {fechaCorta(c.fecha)}
                  </td>
                  <td data-label="Comprobante" className="px-4 py-3">
                    <span className="font-semibold">{tipo.texto}</span>{' '}
                    <span className="font-mono text-xs text-acero-500">
                      {numeroComprobante(c)}
                    </span>
                  </td>
                  <td data-label="Cliente" className="px-4 py-3">
                    <span className="font-medium">{c.cliente_nombre}</span>
                    {c.cliente_cuit && (
                      <span className="ml-2 font-mono text-xs text-acero-500">
                        {cuitFormateado(c.cliente_cuit)}
                      </span>
                    )}
                  </td>
                  <td data-label="Neto" className="px-4 py-3 tabular-nums text-acero-500">
                    {plataExacta(c.neto)}
                  </td>
                  <td data-label="IVA" className="px-4 py-3 tabular-nums text-acero-500">
                    {plataExacta(c.iva)}
                  </td>
                  <td data-label="Total" className="px-4 py-3 font-semibold tabular-nums">
                    {plataExacta(c.total)}
                  </td>
                  <td data-label="Estado" className="px-4 py-3">
                    <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
                  </td>
                </tr>
              )
            })}
          </Tabla>
        )}
      </Tarjeta>

      {abierto && (
        <PanelComprobante
          comprobante={abierto}
          empresa={datos?.empresa}
          onCerrar={() => setAbiertoId(null)}
          onCambio={recargar}
        />
      )}

      {editandoEmisor && (
        <DatosEmisor
          empresa={datos?.empresa}
          onCerrar={() => setEditandoEmisor(false)}
          onGuardado={() => {
            setEditandoEmisor(false)
            recargar()
          }}
        />
      )}
    </>
  )
}

/* Los datos del negocio, que van impresos en cada comprobante. Se cargan una
   vez y no se vuelven a mirar, salvo que ARCA habilite otro punto de venta. */
function DatosEmisor({ empresa, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
    razon_social: empresa?.razon_social ?? '',
    cuit: empresa?.cuit ?? '',
    condicion_iva: empresa?.condicion_iva ?? 'responsable_inscripto',
    domicilio: empresa?.domicilio ?? '',
    ingresos_brutos: empresa?.ingresos_brutos ?? '',
    inicio_actividades: empresa?.inicio_actividades ?? '',
    punto_venta: empresa?.punto_venta ?? 1,
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k] ?? '',
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const cuitMal = form.cuit.trim() && !cuitValido(form.cuit)

  const guardar = async (e) => {
    e.preventDefault()
    if (cuitMal) return setError('El CUIT no es válido: revisá el dígito verificador.')

    setGuardando(true)
    setError('')

    const { error } = await supabase
      .from('empresa')
      .update({
        razon_social: form.razon_social.trim(),
        cuit: form.cuit.trim(),
        condicion_iva: form.condicion_iva,
        domicilio: form.domicilio.trim(),
        ingresos_brutos: form.ingresos_brutos.trim() || null,
        inicio_actividades: form.inicio_actividades || null,
        punto_venta: Number(form.punto_venta) || 1,
      })
      .eq('id', true)

    if (error) {
      setError(error.message)
      setGuardando(false)
    } else onGuardado()
  }

  return (
    <Modal titulo="Datos del emisor" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <Campo etiqueta="Razón social">
          <input required className={estiloInput} {...campo('razon_social')} />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="CUIT" ayuda={cuitMal ? 'Dígito verificador incorrecto.' : null}>
            <input required className={estiloInput} placeholder="30-12345678-9" {...campo('cuit')} />
          </Campo>
          <Campo etiqueta="Condición frente al IVA">
            <select className={estiloInput} {...campo('condicion_iva')}>
              {CONDICIONES_IVA.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.texto}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo etiqueta="Domicilio comercial">
          <input className={estiloInput} {...campo('domicilio')} />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Ingresos Brutos">
            <input className={estiloInput} {...campo('ingresos_brutos')} />
          </Campo>
          <Campo etiqueta="Inicio de actividades">
            <input type="date" className={estiloInput} {...campo('inicio_actividades')} />
          </Campo>
        </div>

        <Campo
          etiqueta="Punto de venta"
          ayuda="El que habilitó ARCA para facturación electrónica. Va impreso en el número del comprobante."
        >
          <input
            type="number"
            min="1"
            max="99999"
            className={estiloInput}
            {...campo('punto_venta')}
          />
        </Campo>

        <Aviso>{error}</Aviso>

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
