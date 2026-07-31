import dotenv from 'dotenv'

dotenv.config()

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json'
}

async function main() {
  for (const path of [
    '/rest/v1/perfiles?select=id,nombre,rol,activo&limit=10',
    '/rest/v1/rpc/mi_rol',
  ]) {
    try {
      const urlWithPath = `${url}${path}`
      const res = await fetch(urlWithPath, { headers, method: 'GET' })
      const text = await res.text()
      console.log('PATH:', path)
      console.log('STATUS:', res.status)
      console.log('BODY:', text)
    } catch (err) {
      console.error('ERROR querying', path, err)
    }
    console.log('---')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})