import { useMemo, useState } from 'react'
import { HandCoins, Percent } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { fechaCorta, plata } from '../lib/formato'
import {
  Aviso,
  Boton,
  Cargando,
  Encabezado,
  Metrica,
  Tabla,
  Tarjeta,
  Vacio,
  estiloInput,
} from '../components/UI'

/* Lo que le toca a cada uno y el botón para saldarlo.

   Los números no se calculan acá: salen de `comisiones_pendientes()`, que
   cruza ventas, órdenes y liquidaciones en la base. Es lo que permite que un
   vendedor vea lo suyo sin que RLS le tenga que abrir las ventas de los demás,
   y lo que evita que la pantalla pueda proponer un importe a liquidar. */

const ROTULO = {
  vendedor: { titulo: 'Vendedores', base: 'Vendido', pie: 'Sobre lo vendido' },
  mecanico: { titulo: 'Mecánicos', base: 'Mano de obra', pie: 'Sobre la mano de obra' },
}

export default function Comisiones() {
  const { rol } = useAuth()
  const [error, setError] = useState('')
  const [elegido, setElegido] = useState(null)

  const { datos, cargando, error: errorConsulta, recargar } = useConsulta(
    () => supabase.rpc('comisiones_pendientes'),
    []
  )

  const liquidaciones = useConsulta(
    () =>
      supabase
        .from('liquidaciones')
        .select('*, perfiles:perfil_id (nombre)')
        .order('creada_en', { ascending: false })
        .limit(20),
    []
  )

  const filas = datos ?? []
  const total = useMemo(() => filas.reduce((a, f) => a + Number(f.comision), 0), [filas])

  /* La persona del detalle se elige acá arriba para que las dos tablas
     compartan el mismo panel de abajo: son la misma pregunta —de dónde salió
     este número— hecha sobre gente distinta. */
  const activo = elegido ?? filas[0]?.perfil_id ?? null

  const recargarTodo = () => {
    recargar()
    liquidaciones.recargar()
  }

  return (
    <>
      <Encabezado
        titulo="Comisiones"
        detalle="El vendedor cobra sobre lo que vendió; el mecánico, sobre la mano de obra que trabajó."
      />

      {error && <Aviso>{error}</Aviso>}
      {errorConsulta && <Aviso>{errorConsulta}</Aviso>}

      {cargando ? (
        <Cargando texto="Calculando comisiones…" alto="min-h-[40vh]" />
      ) : !filas.length ? (
        <Tarjeta>
          <Vacio
            icono={HandCoins}
            titulo="No hay nadie con comisión"
            detalle="Las comisiones se calculan para vendedores y mecánicos activos. Cargá el equipo desde Personal."
          />
        </Tarjeta>
      ) : (
        <div className="space-y-6">
          <div className="cascada grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metrica
              icono={HandCoins}
              tono="marca"
              titulo="Total a pagar"
              valor={plata(total)}
              pie="Acumulado desde la última liquidación"
            />
            <Metrica
              icono={Percent}
              titulo="Personas con saldo"
              valor={String(filas.filter((f) => Number(f.comision) > 0).length)}
              pie={`De ${filas.length} en el equipo`}
            />
          </div>

          {['vendedor', 'mecanico'].map((r) => (
            <TablaRol
              key={r}
              rol={r}
              filas={filas.filter((f) => f.rol === r)}
              puedeEditar={rol === 'gerencia'}
              elegido={activo}
              onElegir={setElegido}
              onCambio={recargarTodo}
              onError={setError}
            />
          ))}

          {activo && <Detalle perfilId={activo} filas={filas} />}

          <Liquidaciones consulta={liquidaciones} />
        </div>
      )}
    </>
  )
}

function TablaRol({ rol, filas, puedeEditar, elegido, onElegir, onCambio, onError }) {
  const rotulo = ROTULO[rol]

  if (!filas.length) return null

  return (
    <section>
      <h2 className="display mb-3 text-base font-bold">{rotulo.titulo}</h2>
      <Tarjeta>
        <Tabla
          columnas={[
            'Nombre',
            { texto: '%', cifra: true },
            { texto: rotulo.base, cifra: true },
            { texto: 'Comisión', cifra: true },
            '',
          ]}
        >
          {filas.map((f) => (
            <Fila
              key={f.perfil_id}
              fila={f}
              rotulo={rotulo}
              puedeEditar={puedeEditar}
              destacada={elegido === f.perfil_id}
              onElegir={onElegir}
              onCambio={onCambio}
              onError={onError}
            />
          ))}
        </Tabla>
      </Tarjeta>
    </section>
  )
}

function Fila({ fila, rotulo, puedeEditar, destacada, onElegir, onCambio, onError }) {
  const [pct, setPct] = useState(String(fila.porcentaje ?? 0))
  const [trabajando, setTrabajando] = useState(false)

  /* El porcentaje se guarda al salir del campo y no en cada tecla: escribir
     "12" pasa por "1", y guardar ese 1 dejaría a alguien con la comisión mal
     durante el instante en que se sigue tipeando. */
  const guardarPct = async () => {
    const valor = Number(pct)
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      setPct(String(fila.porcentaje ?? 0))
      return onError('El porcentaje va entre 0 y 100.')
    }
    if (valor === Number(fila.porcentaje)) return

    const { error } = await supabase
      .from('perfiles')
      .update({ comision_pct: valor })
      .eq('id', fila.perfil_id)

    if (error) {
      setPct(String(fila.porcentaje ?? 0))
      onError(error.message)
    } else {
      onError('')
      onCambio()
    }
  }

  const liquidar = async () => {
    setTrabajando(true)
    const { error } = await supabase.rpc('liquidar_comision', { p_perfil: fila.perfil_id })
    if (error) onError(error.message)
    else onError('')
    setTrabajando(false)
    onCambio()
  }

  const comision = Number(fila.comision)

  return (
    <tr
      onClick={() => onElegir(fila.perfil_id)}
      className={`cursor-pointer rounded-xl bg-white shadow-sm hover:bg-concreto-50 sm:bg-transparent sm:shadow-none ${
        destacada ? 'sm:bg-perez-50/60' : ''
      }`}
    >
      <td data-label="Nombre" className="px-4 py-3 font-medium">
        {fila.nombre}
      </td>
      <td data-label="%" className="cifra px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {puedeEditar ? (
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            onBlur={guardarPct}
            aria-label={`Comisión de ${fila.nombre} en porcentaje`}
            className={`${estiloInput} w-20 py-1 text-right`}
          />
        ) : (
          `${fila.porcentaje}%`
        )}
      </td>
      <td data-label={rotulo.base} className="cifra px-4 py-3">
        {plata(fila.base)}
      </td>
      <td data-label="Comisión" className="cifra px-4 py-3 font-semibold">
        {plata(comision)}
      </td>
      <td data-label="Acciones" className="px-4 py-3 text-right">
        {puedeEditar && (
          <div onClick={(e) => e.stopPropagation()}>
            <Boton
              variante="secundario"
              className="px-2 py-1"
              onClick={liquidar}
              disabled={trabajando || comision <= 0}
              title={comision <= 0 ? 'No hay nada pendiente.' : undefined}
            >
              {trabajando ? 'Liquidando…' : 'Liquidar'}
            </Boton>
          </div>
        )}
      </td>
    </tr>
  )
}

/* De dónde salió el número, día por día. Siete días es el tramo en que alguien
   todavía se acuerda de lo que hizo: más atrás, la pregunta ya no es esta. */
function Detalle({ perfilId, filas }) {
  const quien = filas.find((f) => f.perfil_id === perfilId)

  const { datos, cargando, error } = useConsulta(
    () => supabase.rpc('comisiones_por_dia', { p_perfil: perfilId, p_dias: 7 }),
    [perfilId]
  )

  const dias = datos ?? []
  const suma = dias.reduce((a, d) => a + Number(d.comision), 0)

  return (
    <section>
      <h2 className="display mb-3 text-base font-bold">
        Últimos 7 días · {quien?.nombre ?? '—'}
      </h2>
      <Tarjeta>
        {error && <Aviso>{error}</Aviso>}
        {cargando ? (
          <p className="px-4 py-6 text-sm text-acero-500">Cargando el detalle…</p>
        ) : (
          <>
            <Tabla
              columnas={[
                'Día',
                { texto: quien?.rol === 'mecanico' ? 'Mano de obra' : 'Vendido', cifra: true },
                { texto: 'Comisión', cifra: true },
              ]}
            >
              {dias.map((d) => (
                <tr key={d.dia} className="rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none">
                  <td data-label="Día" className="px-4 py-2.5">
                    {fechaCorta(d.dia)}
                  </td>
                  <td data-label="Base" className="cifra px-4 py-2.5 text-acero-500">
                    {plata(d.base)}
                  </td>
                  <td data-label="Comisión" className="cifra px-4 py-2.5 font-medium">
                    {plata(d.comision)}
                  </td>
                </tr>
              ))}
            </Tabla>
            <p className="border-t border-concreto-200 px-4 py-2.5 text-right text-sm">
              <span className="text-acero-500">Comisión de la semana </span>
              <span className="font-semibold">{plata(suma)}</span>
            </p>
          </>
        )}
      </Tarjeta>
    </section>
  )
}

/* El recibo de lo ya pagado. No se edita ni se borra: si una liquidación salió
   mal, se corrige liquidando la diferencia, igual que con un comprobante. */
function Liquidaciones({ consulta }) {
  if (consulta.cargando || !consulta.datos?.length) return null

  return (
    <section>
      <h2 className="display mb-3 text-base font-bold">Liquidaciones hechas</h2>
      <Tarjeta>
        <Tabla
          columnas={[
            'Persona',
            'Tramo',
            { texto: 'Base', cifra: true },
            { texto: '%', cifra: true },
            { texto: 'Pagado', cifra: true },
          ]}
        >
          {consulta.datos.map((l) => (
            <tr key={l.id} className="rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none">
              <td data-label="Persona" className="px-4 py-2.5 font-medium">
                {l.perfiles?.nombre ?? '—'}
              </td>
              <td data-label="Tramo" className="px-4 py-2.5 text-acero-500">
                {fechaCorta(l.desde)} — {fechaCorta(l.hasta)}
              </td>
              <td data-label="Base" className="cifra px-4 py-2.5 text-acero-500">
                {plata(l.base)}
              </td>
              <td data-label="%" className="cifra px-4 py-2.5 text-acero-500">
                {l.porcentaje}%
              </td>
              <td data-label="Pagado" className="cifra px-4 py-2.5 font-semibold">
                {plata(l.monto)}
              </td>
            </tr>
          ))}
        </Tabla>
      </Tarjeta>
    </section>
  )
}
