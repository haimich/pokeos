// Tiny PokeAPI client: in-memory promise cache (PokeAPI asks for fair use + caching).
export const BASE = 'https://pokeapi.co/api/v2/'
const cache = new Map()
let logger = null
export const setLogger = (fn) => (logger = fn)
export const netStats = { requests: 0, hits: 0 }

export function toUrl(path) {
  let url = /^https?:/.test(path) ? path : BASE + String(path).replace(/^\/+/, '').replace(/^api\/v2\//, '')
  if (!url.includes('?')) url = url.replace(/\/+$/, '')
  return url
}

export function get(path) {
  const url = toUrl(path)
  if (cache.has(url)) {
    netStats.hits++
    return cache.get(url)
  }
  netStats.requests++
  const t0 = performance.now()
  const p = fetch(url).then(async (r) => {
    logger?.({ url, status: r.status, ms: Math.round(performance.now() - t0) })
    if (!r.ok) {
      const e = new Error(r.status === 404 ? `404 not found: ${url.replace(BASE, '/')}` : `HTTP ${r.status} for ${url}`)
      e.status = r.status
      throw e
    }
    return r.json()
  })
  cache.set(url, p)
  p.catch(() => cache.delete(url))
  return p
}
