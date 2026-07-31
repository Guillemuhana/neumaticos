import dotenv from 'dotenv'

dotenv.config()

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  console.error('Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const restBase = `${url}/rest/v1`
const adminBase = `${url}/auth/v1/admin`
const headers = {
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  'Content-Type': 'application/json'
}

async function fetchJson(path, options = {}, base = restBase) {
  const res = await fetch(`${base}${path}`, { headers, ...options })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.msg || body?.message || `${res.status} ${res.statusText}`)
  }
  return body
}

async function ensurePerfil(userId, nombre, rol) {
  const existing = await fetchJson(
    `/perfiles?select=id,nombre,rol&id=eq.${encodeURIComponent(userId)}`
  )
  const perfil = Array.isArray(existing) ? existing[0] : null

  if (perfil) {
    const updates = {}
    if (perfil.nombre !== nombre) updates.nombre = nombre
    if (perfil.rol !== rol) updates.rol = rol
    if (Object.keys(updates).length > 0) {
      await fetchJson(
        `/perfiles?id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates)
        }
      )
    }
    return false
  }

  await fetchJson('/perfiles', {
    method: 'POST',
    body: JSON.stringify({ id: userId, nombre, rol, activo: true })
  })
  return true
}

async function main() {
  const usersJson = await fetchJson('/users?limit=1000', {}, adminBase)
  const users = Array.isArray(usersJson)
    ? usersJson
    : usersJson?.users ?? []

  if (users.length === 0) {
    console.log('No se encontraron usuarios en auth.users.')
    return
  }

  let created = 0
  let updated = 0

  for (const user of users) {
    const userId = user.id
    const nombre =
      user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario'
    const rol =
      ['gerencia', 'vendedor', 'mecanico'].includes(user.user_metadata?.rol)
        ? user.user_metadata.rol
        : 'vendedor'

    try {
      const added = await ensurePerfil(userId, nombre, rol)
      if (added) created += 1
      else updated += 1
      console.log(`Perfil asegurado para ${user.email} (${userId})`)
    } catch (err) {
      console.error(`Error asegurando perfil para ${user.email} (${userId}):`, err.message || err)
    }
  }

  console.log(`Perfiles creados: ${created}, actualizados: ${updated}`)
}

main().catch((err) => {
  console.error('Error inesperado:', err.message || err)
  process.exit(1)
})
