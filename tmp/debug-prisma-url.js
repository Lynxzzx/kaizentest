
const dotenv = require('dotenv');
dotenv.config();

function effectiveDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) return undefined

  const qIndex = url.indexOf('?')
  let base = qIndex === -1 ? url : url.slice(0, qIndex)
  const rawQuery = qIndex === -1 ? '' : url.slice(qIndex + 1)

  const pairs = []
  const seenKeys = new Set()

  if (rawQuery) {
    for (const part of rawQuery.split('&')) {
      if (!part) continue
      const eq = part.indexOf('=')
      const keyRaw = eq === -1 ? part : part.slice(0, eq)
      const key = keyRaw.toLowerCase()
      if (key === 'readpreference' || key === 'maxstalenessseconds') {
        continue
      }
      pairs.push(part)
      seenKeys.add(key)
    }
  }

  const addIfMissing = (key, value) => {
    if (!seenKeys.has(key.toLowerCase())) {
      pairs.push(`${key}=${value}`)
      seenKeys.add(key.toLowerCase())
    }
  }

  addIfMissing('maxPoolSize', '10')
  addIfMissing('minPoolSize', '0')
  addIfMissing('serverSelectionTimeoutMS', '45000')
  addIfMissing('connectTimeoutMS', '15000')

  const protocolEndIndex = base.indexOf('://')
  if (protocolEndIndex !== -1) {
    const afterProtocol = base.slice(protocolEndIndex + 3)
    if (!afterProtocol.includes('/')) {
      base += '/'
    }
  }

  if (pairs.length === 0) return base
  return `${base}?${pairs.join('&')}`
}

console.log('Original DATABASE_URL:', process.env.DATABASE_URL);
console.log('Effective DATABASE_URL:', effectiveDatabaseUrl());
