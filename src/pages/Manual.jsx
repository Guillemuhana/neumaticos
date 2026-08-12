import { Printer } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { Boton, Encabezado, Etiqueta, Tarjeta } from '../components/UI'

/* El manual vive adentro de la app y no en un PDF aparte para que no se
   desactualice por su cuenta: cuando cambia una pantalla, esto se toca en el
   mismo commit.

   Cada sección declara a qué roles les sirve y se filtra por el rol de quien
   mira. No es seguridad —eso lo decide RLS— sino cortesía: al mecánico no le
   sirve leer cómo se carga un CAE, y un manual con la mitad que no aplica es
   un manual que no se lee. */

const nombreRol = { gerencia: 'Gerencia', vendedor: 'Vendedor', mecanico: 'Mecánico' }

export default function Manual() {
  const { rol, perfil } = useAuth()
  const secciones = SECCIONES.filter((s) => s.roles.includes(rol))

  return (
    <>
      <Encabezado
        titulo="Manual de uso"
        detalle={`Cómo funciona el sistema, paso a paso. Estás viendo lo que le corresponde a tu puesto${
          nombreRol[rol] ? ` (${nombreRol[rol].toLowerCase()})` : ''
        }.`}
      >
        <Boton variante="secundario" className="no-imprimir" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir
        </Boton>
      </Encabezado>

      <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-8">
        <Indice secciones={secciones} />

        <div className="space-y-4">
          {perfil && (
            <Tarjeta className="p-4">
              <p className="text-sm text-caucho-800">
                Entraste como <strong>{perfil.nombre}</strong>, con el puesto de{' '}
                <strong>{nombreRol[rol] ?? '—'}</strong>. El sistema te muestra solo las pantallas
                de tu puesto: si algo de este manual no te aparece en el menú, es porque no te
                corresponde y no porque falte.
              </p>
            </Tarjeta>
          )}

          {secciones.map((s) => (
            <Seccion key={s.id} seccion={s} />
          ))}
        </div>
      </div>
    </>
  )
}

/* En pantalla grande queda fijo al costado; en el celular se ve arriba, que es
   por donde se entra al manual cuando alguien busca una cosa puntual. */
function Indice({ secciones }) {
  return (
    <nav aria-label="Contenido del manual" className="no-imprimir mb-5 lg:mb-0">
      <div className="lg:sticky lg:top-6">
        <p className="mb-2 text-micro font-semibold uppercase tracking-wider text-acero-500">
          Contenido
        </p>
        <ol className="space-y-0.5">
          {secciones.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex gap-2 rounded-md px-2 py-1.5 text-sm text-caucho-800 transition-colors hover:bg-concreto-100 hover:text-perez-700"
              >
                <span className="font-mono text-xs text-acero-400">{i + 1}</span>
                {s.titulo}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}

function Seccion({ seccion }) {
  return (
    /* `scroll-mt` deja aire arriba: sin esto el índice lleva el título justo
       debajo de la cabecera pegajosa del celular y queda tapado. */
    <Tarjeta id={seccion.id} className="scroll-mt-20 p-5">
      <h2 className="display text-lg font-bold text-caucho-950">{seccion.titulo}</h2>
      {seccion.resumen && <p className="mt-1 text-sm text-acero-500">{seccion.resumen}</p>}
      <div className="mt-4 space-y-4">{seccion.contenido}</div>
    </Tarjeta>
  )
}

/* ------------------------------------------------------- piezas del texto */

function Pasos({ children }) {
  return <ol className="space-y-3">{children}</ol>
}

function Paso({ numero, titulo, children }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-perez-50 font-mono text-xs font-bold text-perez-700">
        {numero}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-caucho-900">{titulo}</p>
        {children && <div className="mt-1 space-y-2 text-sm text-caucho-800">{children}</div>}
      </div>
    </li>
  )
}

function Nota({ tono = 'neutro', children }) {
  const tonos = {
    neutro: 'border-concreto-200 bg-concreto-50 text-caucho-800',
    atencion: 'border-atencion-100 bg-atencion-50 text-atencion-700',
    conforme: 'border-conforme-100 bg-conforme-50 text-conforme-700',
  }
  return <p className={`rounded-lg border px-3 py-2 text-sm ${tonos[tono]}`}>{children}</p>
}

function Lista({ children }) {
  return <ul className="space-y-1.5 text-sm text-caucho-800">{children}</ul>
}

function Item({ rotulo, children }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-acero-300" />
      <span>
        {rotulo && <strong className="font-semibold text-caucho-900">{rotulo}: </strong>}
        {children}
      </span>
    </li>
  )
}

/* La misma tabla de etapas que usa el tablero, escrita para leer. */
function Etapas() {
  const etapas = [
    ['Orden creada', 'atencion', 'Mostrador', 'La orden está cargada y esperando que el taller la tome.'],
    ['En proceso', 'marca', 'Taller', 'Un mecánico la tomó y está trabajando.'],
    ['Control de calidad', 'atencion', 'Taller', 'El trabajo está hecho y se está revisando antes de avisar.'],
    ['Listo para entrega', 'conforme', 'Taller', 'Pasó el control. Vuelve al mostrador para entregar y cobrar.'],
    ['Entregada', 'neutro', 'Mostrador', 'Se entregó el vehículo y se cerró la orden.'],
  ]

  return (
    <ol className="space-y-2">
      {etapas.map(([texto, tono, puesto, detalle]) => (
        <li key={texto} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <Etiqueta tono={tono}>{texto}</Etiqueta>
          <span className="text-xs text-acero-500">{puesto}</span>
          <span className="w-full text-caucho-800 sm:w-auto sm:flex-1">{detalle}</span>
        </li>
      ))}
    </ol>
  )
}

/* --------------------------------------------------------- las secciones */

const TODOS = ['gerencia', 'vendedor', 'mecanico']
const MOSTRADOR = ['gerencia', 'vendedor']

const SECCIONES = [
  {
    id: 'arranque',
    titulo: 'Para empezar',
    roles: TODOS,
    resumen: 'Entrar, entender qué ves y marcar tu jornada.',
    contenido: (
      <>
        <Pasos>
          <Paso numero={1} titulo="Entrá con tu correo y contraseña">
            <p>
              Te las da gerencia. Si te dice que tu usuario no tiene perfil cargado, no es un error
              tuyo: falta que te den de alta.
            </p>
          </Paso>
          <Paso numero={2} titulo="Mirá el menú de la izquierda">
            <p>
              En el celular está detrás del botón de las tres rayas, arriba a la derecha. Solo
              aparecen las pantallas de tu puesto.
            </p>
          </Paso>
          <Paso numero={3} titulo="Fichá tu entrada">
            <p>
              En <strong>Personal</strong> tenés un botón para marcar ingreso y egreso. Alterna
              solo: si tu última marca fue un ingreso, el botón te ofrece el egreso.
            </p>
          </Paso>
        </Pasos>
        <Nota>
          El <strong>Panel</strong> es la pantalla de inicio y resume el día: lo facturado, los
          vehículos en el taller, las órdenes listas para entregar y el stock que hay que reponer.
          Cada recuadro es un atajo, se puede hacer clic.
        </Nota>
      </>
    ),
  },
  {
    id: 'circuito',
    titulo: 'El circuito de una orden',
    roles: TODOS,
    resumen: 'De izquierda a derecha, como se ve en el tablero del taller.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          Todo empieza cuando entra un cliente con el vehículo. El mostrador arma la orden, el
          taller la trabaja, y el mostrador la entrega y la factura.
        </p>
        <Etapas />
        <Nota>
          Las etapas no son un rótulo suelto: el sistema no deja saltearlas. No se arranca un
          trabajo sin mecánico asignado, no se entrega algo que no está terminado, y una orden
          entregada no se reabre ni se corrige. Si algo no te deja avanzar, es porque falta un paso
          antes.
        </Nota>
      </>
    ),
  },
  {
    id: 'recibir',
    titulo: 'Recibir un vehículo',
    roles: MOSTRADOR,
    resumen: 'Cargar la orden con el cliente delante.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          El botón <strong>Nueva orden de trabajo</strong> está en tres lugares: en el Panel, en
          Taller y en la ficha de cada cliente. El formulario tiene tres pasos.
        </p>
        <Pasos>
          <Paso numero={1} titulo="Cliente">
            <p>
              Buscalo por nombre. Si es la primera vez que viene, se da de alta ahí mismo sin salir
              de la pantalla.
            </p>
          </Paso>
          <Paso numero={2} titulo="Vehículo">
            <p>
              Vehículo y patente, el kilometraje y —lo más importante— <strong>qué viene a
              resolver</strong>, con las palabras del cliente. Eso es lo que va a leer el mecánico.
            </p>
          </Paso>
          <Paso numero={3} titulo="Taller">
            <p>
              Asignás el mecánico. Se puede dejar sin asignar y resolverlo después, pero el trabajo
              no arranca hasta que alguien lo tome.
            </p>
          </Paso>
        </Pasos>
        <Nota>
          Al guardar, la orden se abre sola para que veas el paso siguiente y ya aparece en el
          tablero del taller. No hace falta avisarle a nadie.
        </Nota>
      </>
    ),
  },
  {
    id: 'taller',
    titulo: 'Trabajar una orden',
    roles: ['gerencia', 'mecanico'],
    resumen: 'Lo que hace el taller, de la cola a la entrega.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          En <strong>Taller</strong> vas a ver cuatro columnas. La que te toca está marcada con{' '}
          <span className="font-semibold text-perez-700">Te toca</span>. Tocá una tarjeta para abrir
          la orden.
        </p>
        <Pasos>
          <Paso numero={1} titulo="Tomá el trabajo">
            <p>
              Con <strong>Tomar y empezar</strong> la orden pasa a «En proceso». Si no tenía
              mecánico asignado, queda a tu nombre automáticamente.
            </p>
          </Paso>
          <Paso numero={2} titulo="Mirá el plan de trabajo">
            <p>
              Es la lista de lo que hay que hacer y los repuestos que lleva. La carga el mostrador.
              Si ves que falta algo o que el repuesto no está en stock, avisá: vos no podés
              cambiarlo.
            </p>
          </Paso>
          <Paso numero={3} titulo="Cargá hallazgos y diagnóstico">
            <p>
              <strong>Hallazgos</strong> es lo que encontraste; <strong>diagnóstico</strong>, qué lo
              explica y qué hay que hacer. No son lo mismo, y tenerlos separados es lo que después
              sostiene un adicional cuando el cliente pregunta por qué salió más de lo hablado.
              Sacale fotos al auto mientras trabajás: quedan guardadas en la orden.
            </p>
          </Paso>
          <Paso numero={4} titulo="Mandala a control de calidad">
            <p>
              Cuando el vehículo está listo, <strong>Mandar a control</strong>. Ahí se revisan cuatro
              puntos —nivel de aceite, presión de neumáticos, frenos y luces— y recién con los cuatro
              tildados se puede dar el trabajo por listo. No se puede saltear: el sistema lo rechaza.
            </p>
          </Paso>
          <Paso numero={5} titulo="Dala por lista">
            <p>
              Con <strong>Dar por listo</strong> la orden vuelve al mostrador para que entreguen y
              cobren. Si al revisar aparece algo, devolvela a «En proceso»: el control se destilda
              solo, porque lo que se revisó ya no describe cómo quedó el auto.
            </p>
          </Paso>
        </Pasos>
        <Nota>
          Si tomaste una orden por error, o quedó frenada esperando un repuesto,{' '}
          <strong>devolvela a la cola</strong> para que otro la pueda agarrar. Es preferible a
          dejarla tomada sin avanzar.
        </Nota>
        <Nota tono="atencion">
          Desde el taller se cambia el estado, el diagnóstico y el control de calidad. Los precios y los datos del
          cliente no se tocan, y el sistema los rechaza aunque se intente. No es desconfianza: es
          para que nadie cargue con un error que no cometió.
        </Nota>
      </>
    ),
  },
  {
    id: 'plan',
    titulo: 'El plan de trabajo',
    roles: MOSTRADOR,
    resumen: 'Lo que se le va a cobrar al cliente.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          Dentro de cada orden, el bloque <strong>Plan de trabajo</strong>. Cada renglón es una de
          dos cosas:
        </p>
        <Lista>
          <Item rotulo="Mano de obra">
            Un trabajo, con las horas y el precio. Admite medias horas.
          </Item>
          <Item rotulo="Repuesto">
            Un artículo del stock. Se elige de la lista y trae su precio, que se puede cambiar si
            hacés un descuento. Al entregar, se descuenta del inventario solo.
          </Item>
        </Lista>
        <Nota>
          El plan se puede completar <strong>hasta el momento de la entrega</strong>, porque recién
          ahí se sabe qué llevó de verdad el trabajo. No hace falta tenerlo listo para mandar el
          vehículo al taller.
        </Nota>
        <Nota tono="atencion">
          Si un repuesto no tiene stock suficiente, el renglón te lo avisa en rojo. Podés cargarlo
          igual, pero al entregar el stock queda en negativo.
        </Nota>
      </>
    ),
  },
  {
    id: 'entrega',
    titulo: 'Entregar y facturar',
    roles: MOSTRADOR,
    resumen: 'El paso que cierra el trabajo y arma el comprobante.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          Cuando el taller marca una orden como terminada, vuelve a vos. Abrila y usá{' '}
          <strong>Entregar y facturar</strong>. Con ese solo botón pasan cuatro cosas:
        </p>
        <Lista>
          <Item>La orden se cierra y queda en el historial.</Item>
          <Item>Se registra la venta, con todo lo que tenía el plan.</Item>
          <Item>Se descuentan del stock los repuestos usados.</Item>
          <Item>Queda armado el comprobante, esperando en Facturación.</Item>
        </Lista>
        <Nota tono="conforme">
          Las cuatro pasan juntas o no pasa ninguna. Si se corta internet en el medio, no queda un
          vehículo entregado sin venta: podés reintentar sin miedo a duplicar nada.
        </Nota>
        <Nota tono="atencion">
          Una vez entregada, la orden <strong>no se reabre ni se corrige</strong>. Revisá el plan
          antes de tocar el botón: es la última oportunidad de cambiar un precio.
        </Nota>
        <p className="text-sm text-caucho-800">
          Si la orden no tenía ningún renglón cargado, se cierra igual pero no genera venta ni
          comprobante: no había nada que cobrar.
        </p>
      </>
    ),
  },
  {
    id: 'facturacion',
    titulo: 'Emitir el comprobante',
    roles: MOSTRADOR,
    resumen: 'Cómo se saca la factura con ARCA.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          La <strong>venta</strong> y el <strong>comprobante</strong> son dos cosas distintas. La
          venta es el movimiento interno, que mueve el stock. El comprobante es el papel que se
          lleva el cliente, y ese lo numera ARCA. Por eso entregar no exige tener el CAE a mano: el
          cliente se va con el auto y la factura se emite después.
        </p>
        <p className="text-sm text-caucho-800">
          Todo lo que quedó por facturar está en <strong>Facturación</strong>, en la solapa{' '}
          <strong>Pendientes</strong>.
        </p>
        <Pasos>
          <Paso numero={1} titulo="Abrí el comprobante pendiente">
            <p>Vas a ver los datos del cliente y el detalle de lo que se le cobró.</p>
          </Paso>
          <Paso numero={2} titulo="Revisá los datos fiscales">
            <p>
              Con <strong>Corregir</strong> podés cambiar la letra, el CUIT, el domicilio y la
              fecha. Es el último momento para hacerlo.
            </p>
          </Paso>
          <Paso numero={3} titulo="Cargá el comprobante en el portal de ARCA">
            <p>
              Entrá a ARCA con tu clave fiscal y cargalo con el mismo detalle que ves en pantalla.
              Los importes ya están calculados: neto, IVA y total.
            </p>
          </Paso>
          <Paso numero={4} titulo="Copiá lo que ARCA te devuelve">
            <p>
              Son tres datos: el <strong>número</strong>, el <strong>CAE</strong> y su{' '}
              <strong>vencimiento</strong>. Se cargan en el bloque «Autorización de ARCA» y se
              guarda con <strong>Marcar como emitida</strong>.
            </p>
          </Paso>
          <Paso numero={5} titulo="Imprimí y entregá">
            <p>El botón Imprimir aparece recién cuando el comprobante está emitido.</p>
          </Paso>
        </Pasos>
        <Nota>
          <strong>Qué letra sale.</strong> La decide la condición del cliente frente al IVA:
          Responsable Inscripto lleva <strong>Factura A</strong>, con el IVA discriminado renglón
          por renglón. Todos los demás llevan <strong>Factura B</strong>, con el IVA adentro del
          precio. Si un cliente es Responsable Inscripto pero no tiene el CUIT cargado, sale como B
          y la pantalla te lo avisa para que lo corrijas antes.
        </Nota>
        <Nota tono="atencion">
          Un comprobante emitido queda congelado: no se corrige ni se borra, porque respalda un CAE
          que ARCA ya otorgó. Si salió con un error, se arregla con una nota de crédito. Lo que sí
          se puede es <strong>anular un pendiente</strong> que no se va a emitir, y eso solo lo hace
          gerencia.
        </Nota>
      </>
    ),
  },
  {
    id: 'clientes',
    titulo: 'Clientes',
    roles: MOSTRADOR,
    resumen: 'La base de gente del local, y lo que hace falta para facturarles.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          Se busca por nombre, teléfono, documento o CUIT. Desde cada ficha se puede abrir una orden
          nueva con el cliente ya puesto, que es el camino más corto cuando alguien vuelve.
        </p>
        <p className="text-sm text-caucho-800">
          Abajo del formulario hay un bloque <strong>Facturación</strong> con tres campos que no son
          obligatorios pero deciden cómo sale la factura:
        </p>
        <Lista>
          <Item rotulo="Condición frente al IVA">
            Decide la letra del comprobante. Si no sabés, dejalo en Consumidor Final.
          </Item>
          <Item rotulo="CUIT">
            Obligatorio para Responsable Inscripto y Monotributo. El sistema verifica el dígito
            verificador y te avisa si está mal tipeado.
          </Item>
          <Item rotulo="Domicilio">Va impreso en el comprobante.</Item>
        </Lista>
        <Nota>
          No hace falta completarlos con el cliente esperando en el mostrador. Se pueden cargar
          después, siempre que sea antes de emitir la factura.
        </Nota>
      </>
    ),
  },
  {
    id: 'stock',
    titulo: 'Stock',
    roles: MOSTRADOR,
    resumen: 'El inventario del local.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          Arriba de la lista está el resumen: cuántos artículos, cuántas unidades y cuánto vale el
          inventario a costo. Se busca por marca, medida, código o precio, y tocando una fila se
          abre la ficha del artículo.
        </p>
        <Lista>
          <Item rotulo="Stock mínimo">
            Cuando un artículo llega o baja de ese número, aparece en «Hay que reponer», en el
            Panel.
          </Item>
          <Item rotulo="Descuentos automáticos">
            El stock baja solo, al confirmar una venta o al entregar una orden con repuestos. No hay
            que descontarlo a mano.
          </Item>
        </Lista>
        <Nota tono="atencion">
          Cargar y editar artículos lo hace gerencia. El resto del mostrador consulta, que es lo que
          se necesita para vender.
        </Nota>
      </>
    ),
  },
  {
    id: 'ventas',
    titulo: 'Ventas de mostrador',
    roles: MOSTRADOR,
    resumen: 'Lo que se vende sin pasar por el taller.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          Para vender un juego de cubiertas sin orden de trabajo. Una venta arranca como{' '}
          <strong>cotización</strong>: se arma con los artículos y todavía no toca el stock.
        </p>
        <Pasos>
          <Paso numero={1} titulo="Cargá la cotización">
            <p>
              Si el cliente no existe, se crea escribiendo el nombre. Si lo dejás vacío, va como
              consumidor final.
            </p>
          </Paso>
          <Paso numero={2} titulo="Confirmala">
            <p>Ahí se descuenta el stock. Hasta ese momento no se movió nada.</p>
          </Paso>
          <Paso numero={3} titulo="Facturala">
            <p>
              El botón <strong>Facturar</strong> arma el comprobante y te lleva a Facturación para
              cargar el CAE.
            </p>
          </Paso>
        </Pasos>
        <Nota>
          Las órdenes de taller no necesitan este paso: al entregar ya generan su venta y su
          comprobante.
        </Nota>
      </>
    ),
  },
  {
    id: 'personal',
    titulo: 'Personal',
    roles: TODOS,
    resumen: 'Fichadas de entrada y salida.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          Cada uno marca su propia jornada con un botón, y el sistema sabe si te toca ingreso o
          egreso según cuál fue tu última marca.
        </p>
        <Nota tono="atencion">
          Una fichada no se edita ni se borra después. Si te olvidaste de marcar o marcaste de más,
          avisale a gerencia en vez de intentar arreglarlo.
        </Nota>
        <p className="text-sm text-caucho-800">
          Gerencia ve además el listado del equipo y puede dar de alta, editar y desactivar
          usuarios.
        </p>
      </>
    ),
  },
  {
    id: 'estadisticas',
    titulo: 'Estadísticas',
    roles: ['gerencia'],
    resumen: 'Cómo viene el negocio.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          Los gráficos de ventas y de la actividad del taller. Es la única pantalla que ve solo
          gerencia.
        </p>
        <Nota>
          Los números salen de las ventas <strong>confirmadas</strong>, no de las cotizaciones. Una
          cotización que nunca se cerró no ensucia el resultado.
        </Nota>
      </>
    ),
  },
  {
    id: 'configuracion',
    titulo: 'Datos del emisor',
    roles: ['gerencia'],
    resumen: 'Lo que se imprime en cada factura. Se carga una sola vez.',
    contenido: (
      <>
        <p className="text-sm text-caucho-800">
          En <strong>Facturación</strong>, el botón <strong>Datos del emisor</strong>. Van la razón
          social, el CUIT, la condición frente al IVA, el domicilio comercial, Ingresos Brutos, la
          fecha de inicio de actividades y el punto de venta.
        </p>
        <Nota tono="atencion">
          Sin razón social y CUIT, los comprobantes salen impresos a medias. Conviene cargarlo antes
          de emitir la primera factura.
        </Nota>
        <p className="text-sm text-caucho-800">
          El <strong>punto de venta</strong> es el que habilitó ARCA para facturación electrónica, y
          es el primer número del comprobante: en <span className="font-mono">0003-00000125</span>,
          el punto de venta es el 3.
        </p>
      </>
    ),
  },
  {
    id: 'problemas',
    titulo: 'Si algo no funciona',
    roles: TODOS,
    resumen: 'Los tropiezos más comunes, y qué significan.',
    contenido: (
      <Lista>
        <Item rotulo="«Asigná un mecánico antes de iniciar el trabajo»">
          La orden no tiene responsable. Elegilo en el bloque Taller de la orden.
        </Item>
        <Item rotulo="«La orden ya fue entregada y no admite cambios»">
          Está cerrada a propósito. Si hay un error, habrá que corregirlo desde Facturación o con
          una nota de crédito.
        </Item>
        <Item rotulo="«Una Factura A necesita el CUIT del cliente»">
          Cargale el CUIT al cliente, o cambiá el comprobante a Factura B si corresponde.
        </Item>
        <Item rotulo="«Tu usuario no tiene perfil asignado»">
          Falta que gerencia te dé de alta. No es algo que puedas resolver vos.
        </Item>
        <Item rotulo="No me aparece una pantalla del menú">
          No corresponde a tu puesto. Cada rol ve lo suyo.
        </Item>
        <Item rotulo="Un dato quedó viejo en pantalla">
          Recargá la página. La app consulta al abrir cada pantalla, no todo el tiempo.
        </Item>
      </Lista>
    ),
  },
]
