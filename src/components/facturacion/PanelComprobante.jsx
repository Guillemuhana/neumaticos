import { useState } from 'react'
import { Ban, Printer, Stamp } from 'lucide-react'
import { useAuth } from '../../context/AuthProvider'
import { useConsulta } from '../../hooks/useConsulta'
import { supabase } from '../../lib/supabase'
import { fecha, fechaCorta, plataExacta } from '../../lib/formato'
import {
  CONDICIONES_IVA,
  TIPOS_COMPROBANTE,
  condicionDe,
  cuitFormateado,
  cuitValido,
  estadoDe,
  numeroComprobante,
  tipoDe,
} from '../../lib/fiscal'
import { Aviso, Boton, Campo, Cargando, Etiqueta, Modal, estiloInput } from '../UI'
import ComprobanteImpreso from './ComprobanteImpreso'

/* El escritorio de administración. Un comprobante pendiente se corrige y se
   emite; uno emitido solo se lee y se imprime.

   Mientras el CAE se copia a mano del portal de ARCA, esta pantalla es el
   paso a paso: muestra exactamente los datos que hay que cargar allá y
   recibe de vuelta los tres que ARCA devuelve. */

export default function PanelComprobante({ comprobante, empresa, onCerrar, onCambio }) {
  const { rol } = useAuth()
  const tipo = tipoDe(comprobante.tipo)
  const estado = estadoDe(comprobante.estado)
  const pendiente = comprobante.estado === 'pendiente'

  const items = useConsulta(
    () => supabase.from('comprobante_items').select('*').eq('comprobante_id', comprobante.id),
    [comprobante.id]
  )

  return (
    <Modal titulo={`${tipo.texto} · ${numeroComprobante(comprobante)}`} onCerrar={onCerrar}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
          <span className="text-xs text-acero-500">{fechaCorta(comprobante.fecha)}</span>
          <span className="text-xs text-acero-500">{comprobante.cliente_nombre}</span>
        </div>

        <Receptor comprobante={comprobante} editable={pendiente} onGuardado={onCambio} />

        <Renglones items={items} comprobante={comprobante} tipo={tipo} />

        {pendiente ? (
          <Emitir comprobante={comprobante} onEmitido={onCambio} />
        ) : (
          <Autorizacion comprobante={comprobante} />
        )}

        {pendiente && rol === 'gerencia' && (
          <Anular comprobante={comprobante} onAnulado={onCambio} />
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-concreto-200 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
          {/* Solo se imprime lo emitido: un pendiente todavía no tiene CAE, y
              un papel con forma de factura sin CAE no es una factura. */}
          {comprobante.estado === 'emitido' && (
            <Boton onClick={() => window.print()}>
              <Printer size={15} /> Imprimir
            </Boton>
          )}
        </div>
      </div>

      {comprobante.estado === 'emitido' && !items.cargando && items.datos && (
        <ComprobanteImpreso comprobante={comprobante} items={items.datos} empresa={empresa} />
      )}
    </Modal>
  )
}

function Bloque({ titulo, children, accion }) {
  return (
    <section className="rounded-lg border border-concreto-200">
      <div className="flex items-center justify-between gap-2 border-b border-concreto-200 px-3 py-2">
        <h3 className="text-menor font-bold uppercase tracking-wide text-acero-500">
          {titulo}
        </h3>
        {accion}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

function Dato({ etiqueta, children }) {
  return (
    <div>
      <p className="text-xs text-acero-500">{etiqueta}</p>
      <p className="text-sm text-caucho-900">{children || '—'}</p>
    </div>
  )
}

/* Los datos fiscales del cliente se copiaron de su ficha al facturar, pero
   son los que van impresos: acá se corrigen antes de emitir, y solo acá,
   porque después el comprobante queda congelado. */
function Receptor({ comprobante, editable, onGuardado }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    tipo: comprobante.tipo,
    fecha: comprobante.fecha,
    cliente_nombre: comprobante.cliente_nombre ?? '',
    cliente_cuit: comprobante.cliente_cuit ?? '',
    cliente_condicion: comprobante.cliente_condicion,
    cliente_domicilio: comprobante.cliente_domicilio ?? '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k] ?? '',
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const cuitCargado = form.cliente_cuit.trim()
  const cuitMal = cuitCargado && !cuitValido(cuitCargado)

  const guardar = async () => {
    if (form.tipo === 'factura_a' && !cuitCargado)
      return setError('Una Factura A necesita el CUIT del cliente.')
    if (cuitMal) return setError('El CUIT no es válido: revisá el dígito verificador.')

    setGuardando(true)
    setError('')

    const { error } = await supabase
      .from('comprobantes')
      .update({
        tipo: form.tipo,
        fecha: form.fecha,
        cliente_nombre: form.cliente_nombre.trim(),
        cliente_cuit: cuitCargado || null,
        cliente_condicion: form.cliente_condicion,
        cliente_domicilio: form.cliente_domicilio.trim() || null,
      })
      .eq('id', comprobante.id)

    if (error) setError(error.message)
    else {
      setEditando(false)
      onGuardado()
    }
    setGuardando(false)
  }

  const condicion = condicionDe(comprobante.cliente_condicion)
  const faltaCuit = condicion.exigeCuit && !comprobante.cliente_cuit

  return (
    <Bloque
      titulo="Datos del comprobante"
      accion={
        editable && !editando ? (
          <Boton variante="fantasma" className="px-2 py-1" onClick={() => setEditando(true)}>
            Corregir
          </Boton>
        ) : null
      }
    >
      {editando ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Tipo" ayuda="La A exige CUIT del cliente.">
              <select className={estiloInput} {...campo('tipo')}>
                {TIPOS_COMPROBANTE.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Fecha de emisión">
              <input type="date" className={estiloInput} {...campo('fecha')} />
            </Campo>
          </div>

          <Campo etiqueta="Razón social o nombre">
            <input className={estiloInput} {...campo('cliente_nombre')} />
          </Campo>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="CUIT / DNI" ayuda={cuitMal ? 'Dígito verificador incorrecto.' : null}>
              <input
                className={estiloInput}
                placeholder="30-12345678-9"
                {...campo('cliente_cuit')}
              />
            </Campo>
            <Campo etiqueta="Condición frente al IVA">
              <select className={estiloInput} {...campo('cliente_condicion')}>
                {CONDICIONES_IVA.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.texto}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo etiqueta="Domicilio">
            <input className={estiloInput} {...campo('cliente_domicilio')} />
          </Campo>

          <Aviso>{error}</Aviso>

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setEditando(false)}>
              Cancelar
            </Boton>
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Dato etiqueta="Tipo">{tipoDe(comprobante.tipo).texto}</Dato>
            <Dato etiqueta="Fecha de emisión">{fechaCorta(comprobante.fecha)}</Dato>
            <Dato etiqueta="Cliente">{comprobante.cliente_nombre}</Dato>
            <Dato etiqueta="CUIT / DNI">{cuitFormateado(comprobante.cliente_cuit)}</Dato>
            <Dato etiqueta="Condición frente al IVA">{condicion.texto}</Dato>
            <Dato etiqueta="Domicilio">{comprobante.cliente_domicilio}</Dato>
          </div>

          {/* Se avisa antes de que ARCA lo rechace: a esta altura el cliente
              todavía se puede llamar por teléfono. */}
          {editable && faltaCuit && (
            <Aviso tono="atencion">
              El cliente figura como {condicion.texto} pero no tiene CUIT cargado. Corregilo antes
              de emitir, o el comprobante sale como Factura B.
            </Aviso>
          )}
        </div>
      )}
    </Bloque>
  )
}

function Renglones({ items, comprobante, tipo }) {
  if (items.cargando) return <Cargando texto="Cargando el detalle…" alto="min-h-[6rem]" />

  return (
    <Bloque titulo="Detalle">
      {items.error && <Aviso>{items.error}</Aviso>}

      <ul className="divide-y divide-concreto-200">
        {items.datos?.map((i) => (
          <li key={i.id} className="flex items-start gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-caucho-900">{i.descripcion}</p>
              <p className="text-xs text-acero-500">
                {Number(i.cantidad)} × {plataExacta(i.precio_unitario)} · IVA {Number(i.alicuota)}%
              </p>
            </div>
            <p className="shrink-0 font-mono text-sm font-semibold">{plataExacta(i.importe)}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-2 space-y-1 border-t border-concreto-200 pt-2 text-sm">
        {/* En la B el IVA no se discrimina en el papel, pero administración lo
            necesita a la vista: es lo que hay que cargar en el portal. */}
        <Renglon rotulo={tipo.discriminaIva ? 'Neto gravado' : 'Neto (no se imprime en la B)'}>
          {plataExacta(comprobante.neto)}
        </Renglon>
        <Renglon rotulo="IVA 21%">{plataExacta(comprobante.iva)}</Renglon>
        <Renglon rotulo="Total" destacado>
          {plataExacta(comprobante.total)}
        </Renglon>
      </dl>
    </Bloque>
  )
}

function Renglon({ rotulo, destacado = false, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={destacado ? 'font-semibold text-caucho-800' : 'text-acero-500'}>{rotulo}</dt>
      <dd className={`font-mono tabular-nums ${destacado ? 'display text-base font-bold' : ''}`}>
        {children}
      </dd>
    </div>
  )
}

/* Los tres datos que ARCA devuelve. Hoy se copian del portal; el día que
   entre el certificado digital los va a completar el servicio y este bloque
   pasa a ser el registro de lo que pasó, no un formulario. */
function Emitir({ comprobante, onEmitido }) {
  const [form, setForm] = useState({ numero: '', cae: '', cae_vencimiento: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k],
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const listo = form.numero.trim() && form.cae.trim() && form.cae_vencimiento

  const emitir = async () => {
    setGuardando(true)
    setError('')

    const { error } = await supabase
      .from('comprobantes')
      .update({
        estado: 'emitido',
        numero: Number(form.numero),
        cae: form.cae.trim(),
        cae_vencimiento: form.cae_vencimiento,
      })
      .eq('id', comprobante.id)

    if (error) setError(error.message)
    else onEmitido()
    setGuardando(false)
  }

  return (
    <Bloque titulo="Autorización de ARCA">
      <p className="mb-3 text-sm text-acero-500">
        Cargá el comprobante en el portal de ARCA con el detalle de arriba y copiá acá lo que te
        devuelva. Una vez guardado, el comprobante queda cerrado y se puede imprimir.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Número">
          <input
            type="number"
            min="1"
            className={estiloInput}
            placeholder="123"
            {...campo('numero')}
          />
        </Campo>
        <Campo etiqueta="CAE">
          <input className={estiloInput} placeholder="75123456789012" {...campo('cae')} />
        </Campo>
        <Campo etiqueta="Vencimiento del CAE">
          <input type="date" className={estiloInput} {...campo('cae_vencimiento')} />
        </Campo>
      </div>

      <Aviso>{error}</Aviso>

      <div className="mt-3 flex justify-end">
        <Boton onClick={emitir} disabled={guardando || !listo}>
          <Stamp size={15} /> {guardando ? 'Guardando…' : 'Marcar como emitida'}
        </Boton>
      </div>
    </Bloque>
  )
}

function Autorizacion({ comprobante }) {
  return (
    <Bloque titulo="Autorización de ARCA">
      <div className="grid gap-3 sm:grid-cols-2">
        <Dato etiqueta="Número">{numeroComprobante(comprobante)}</Dato>
        <Dato etiqueta="CAE">{comprobante.cae}</Dato>
        <Dato etiqueta="Vencimiento del CAE">{fechaCorta(comprobante.cae_vencimiento)}</Dato>
        <Dato etiqueta={comprobante.anulado_en ? 'Anulado' : 'Emitido'}>
          {fecha(comprobante.anulado_en ?? comprobante.emitido_en)}
        </Dato>
      </div>
      {comprobante.motivo_anulacion && (
        <p className="mt-3 text-sm text-acero-500">Motivo: {comprobante.motivo_anulacion}</p>
      )}
    </Bloque>
  )
}

/* Se anula lo que nunca llegó a emitirse: una venta cargada por error, un
   comprobante duplicado. Lo que ya tiene CAE no se toca desde acá —eso se
   corrige con una nota de crédito— y por eso solo aparece en los pendientes. */
function Anular({ comprobante, onAnulado }) {
  const [motivo, setMotivo] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const anular = async () => {
    setGuardando(true)
    setError('')

    const { error } = await supabase
      .from('comprobantes')
      .update({ estado: 'anulado', motivo_anulacion: motivo.trim() })
      .eq('id', comprobante.id)

    if (error) setError(error.message)
    else onAnulado()
    setGuardando(false)
  }

  if (!abierto) {
    return (
      <div className="flex justify-end">
        <Boton variante="fantasma" className="px-2 py-1" onClick={() => setAbierto(true)}>
          <Ban size={14} /> Anular pendiente
        </Boton>
      </div>
    )
  }

  return (
    <Bloque titulo="Anular">
      <p className="mb-3 text-sm text-acero-500">
        El comprobante deja de figurar como pendiente. La venta y el movimiento de stock quedan
        como están: esto solo saca de la cola un papel que no se va a emitir.
      </p>
      <Campo etiqueta="Motivo">
        <input
          className={estiloInput}
          placeholder="Venta cargada por error"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Campo>

      <Aviso>{error}</Aviso>

      <div className="mt-3 flex justify-end gap-2">
        <Boton variante="secundario" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
        <Boton variante="peligro" onClick={anular} disabled={guardando || !motivo.trim()}>
          {guardando ? 'Anulando…' : 'Anular'}
        </Boton>
      </div>
    </Bloque>
  )
}
