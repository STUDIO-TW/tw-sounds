// Reads playlists.json and fills in title, cover, description and track count
// from the public Apple Music and Spotify pages. No accounts or API keys.
// Responses are cached at Vercel's edge for 6 hours.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const readList = () => JSON.parse(readFileSync(join(process.cwd(), 'playlists.json'), 'utf8'))

const UA = 'Mozilla/5.0 (compatible; TWSoundsBot/1.0; +https://github.com/STUDIO-TW/tw-sounds)'

async function get(url, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-GB,en' }, signal: ctrl.signal })
    return r.ok ? r : null
  } catch { return null } finally { clearTimeout(t) }
}

const decode = s => s && s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')
  return decode((html.match(re) || html.match(re2) || [])[1])
}

async function fromApple(url) {
  if (!url) return {}
  const r = await get(url)
  if (!r) return {}
  const html = await r.text()
  let image = meta(html, 'og:image')
  // Apple serves a 1200x630 share image; ask its image server for a square crop instead
  if (image) image = image.replace(/\/\d+x\d+[a-z]*(-\d+)?\.(png|jpg|jpeg|webp)$/i, '/1200x1200cc.jpg')
  const title = (meta(html, 'og:title') || '').replace(/\s+(on|-|\|)\s+Apple Music$/i, '').replace(/ by STUDIO TW$/i, '')
  const desc = meta(html, 'og:description') || meta(html, 'description')
  const songs = (desc || '').match(/(\d+)\s+songs?/i)
  return { title: title || undefined, image, description: cleanDesc(desc), tracks: songs ? +songs[1] : undefined }
}

async function fromSpotify(url) {
  if (!url) return {}
  const out = {}
  const o = await get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
  if (o) { try { const j = await o.json(); out.title = j.title; out.image = j.thumbnail_url } catch {} }
  const p = await get(url)
  if (p) {
    const html = await p.text()
    const d = meta(html, 'og:description') || ''
    const n = d.match(/(\d[\d,]*)\s+(items|songs)/i)
    if (n) out.tracks = +n[1].replace(/,/g, '')
    out.image = meta(html, 'og:image') || out.image
    const md = meta(html, 'description')
    if (md && !/^Listen to/i.test(md) && !/Playlist\s·/.test(md)) out.description = md
  }
  return out
}

// Strip Apple's boilerplate ("Listen to X by Y on Apple Music. N Songs. Duration...")
function cleanDesc(d) {
  if (!d) return undefined
  if (/^Listen to .* on Apple Music/i.test(d)) return undefined
  return d.replace(/\s*\d+\s+Songs?\.?.*$/i, '').trim() || undefined
}

export default async function handler(req, res) {
  const rows = readList().filter(p => p.apple || p.spotify)
  const items = await Promise.all(rows.map(async (p, i) => {
    const [a, s] = await Promise.all([fromApple(p.apple), fromSpotify(p.spotify)])
    return {
      id: i,
      title: p.title || a.title || s.title || 'Untitled',
      cover: p.cover || a.image || s.image || null,
      description: p.description || a.description || s.description || '',
      tracks: a.tracks || s.tracks || null,
      apple: p.apple || null,
      spotify: p.spotify || null,
    }
  }))
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
  res.status(200).json({ updated: new Date().toISOString(), playlists: items })
}
