import dotenv from 'dotenv'

dotenv.config()

/* Alta de un usuario con su rol, desde la línea de comandos:
 *
 *   node scripts/crear-usuario.js vendedor@neumaticos.com Demo1234 vendedor "Nombre"
 *
 * Si el mail ya existe no lo duplica: le actualiza la clave, el rol y el
 * nombre. Es el mismo camino que create-admin.js, pero sin depender de las
 * variables ADMIN_* del .env, que sirven para una sola cuenta. */

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  console.error('Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const ROLES = ['gerencia', 'vendedor', 'mecanico']

const [email, password, rol = 'vendedor', nombreArg] = process.argv.slice(2)

if (!email || !password) {
  console.error('Uso: node scripts/crear-usuario.js <email> <clave> [rol] [nombre]')
  console.error(`Roles válidos: ${ROLES.join(', ')}`)
  process.exit(1)
}

if (!ROLES.includes(rol)) {
  console.error(`Rol desconocido: «${rol}». Los válidos son: ${ROLES.join(', ')}`)
  process.exit(1)
}

const nombre = nombreArg || email.split('@')[0]

const adminBase = `${url}/auth/v1/admin`
const restBase = `${url}/rest/v1`
const headers = {
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  'Content-Type': 'application/json'
}

async function fetchJson(path, options = {}, base = adminBase) {
  const res = await fetch(`${base}${path}`, { headers, ...options })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.msg || body?.message || `${res.status} ${res.statusText}`)
  }
  return body
}

/* El perfil lo crea solo el trigger on_auth_user_created, pero solo al dar de
   alta. Para un usuario que ya existía —o si el esquema se desplegó después
   que la cuenta— hay que emparejarlo a mano. */
async function asegurarPerfil(userId) {
  const existing = await fetchJson(
    `/perfiles?select=id,nombre,rol&id=eq.${encodeURIComponent(userId)}`,
    {},
    restBase
  )
  const perfil = Array.isArray(existing) && existing[0]

  if (perfil) {
    await fetchJson(
      `/perfiles?id=eq.${encodeURIComponent(userId)}`,
      { method: 'PATCH', body: JSON.stringify({ nombre, rol, email, activo: true }) },
      restBase
    )
    return
  }

  await fetchJson(
    '/perfiles',
    { method: 'POST', body: JSON.stringify({ id: userId, nombre, rol, email, activo: true }) },
    restBase
  )
}

async function main() {
  // El endpoint admin ignora el filtro ?email= y devuelve todos los usuarios:
  // la coincidencia hay que buscarla acá o se termina pisando otra cuenta.
  const listado = await fetchJson('/users?per_page=1000')
  const users = Array.isArray(listado) ? listado : listado?.users ?? []
  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (user) {
    await fetchJson(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password, user_metadata: { nombre, rol } })
    })
    await asegurarPerfil(user.id)
    console.log(`Usuario actualizado: ${email} (${rol})`)
    return
  }

  const creado = await fetchJson('/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol }
    })
  })

  const userId = creado?.id ?? creado?.user?.id
  if (!userId) throw new Error('No se pudo obtener el ID del usuario creado.')

  await asegurarPerfil(userId)
  console.log(`Usuario creado: ${email} (${rol})`)
}

main().catch((err) => {
  console.error('Error inesperado:', err.message || err)
  process.exit(1)
})
