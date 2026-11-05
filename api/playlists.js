// Reads content/playlists.json and fills in anything left blank from the public
// Apple Music and Spotify pages: runtime (HH:MM), and title or cover if missing.
// No accounts or API keys. Responses are cached at Vercel's edge for 6 hours.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const readList = () => JSON.parse(readFileSync(join(process.cwd(), 'content', 'playlists.json'), 'utf8'))

const UA = 'Mozilla/5.0 (compatible; TWSoundsBot/1.0; +https://sounds.studio-tw.com)'

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
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')
  return decode((html.match(a) || html.match(b) || [])[1])
}

// "TW Sounds: Magic Tricks" -> "Magic Tricks"
const cleanTitle = t => t && t.replace(/\s+(on|-|\|)\s+(Apple Music|Spotify)$/i, '').replace(/ by STUDIO TW$/i, '').replace(/^TW Sounds:\s*/i, '').trim()

const hhmm = mins => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`

// Pulls a total duration out of text like "2 hours 4 minutes", "1 hr 52 min" or "PT2H4M"
function minutesFrom(text) {
  if (!text) return null
  const iso = text.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (iso && (iso[1] || iso[2])) return (+iso[1] || 0) * 60 + (+iso[2] || 0)
  const h = text.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i), m = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i)
  return h || m ? (h ? +h[1] : 0) * 60 + (m ? +m[1] : 0) : null
}

// Sums the per-song durations Apple puts in the page, e.g. <meta property="music:song:duration" content="PT8M29S">
function songSeconds(html) {
  const re = /<meta[^>]+(?:property|name)=["']music:song:duration["'][^>]*content=["']PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?["']/gi
  let total = 0, n = 0, m
  while ((m = re.exec(html))) { total += (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); n++ }
  return n ? total : null
}

async function fromApple(url) {
  if (!url) return {}
  const r = await get(url)
  if (!r) return {}
  const html = await r.text()
  let image = meta(html, 'og:image')
  if (image) image = image.replace(/\/\d+x\d+[a-z]*(-\d+)?\.(png|jpg|jpeg|webp)$/i, '/1200x1200cc.jpg')
  const desc = [meta(html, 'og:description'), meta(html, 'description')].join(' ')
  // Apple's page summary drops the seconds ("1 hour 12 minutes"), but each song also carries its own exact
  // duration. Add those up and round up to the minute, which matches what the Apple Music app shows.
  const secs = songSeconds(html)
  const mins = secs ? Math.ceil(secs / 60) : minutesFrom(/Duration:[^.]*/i.exec(desc)?.[0])
  return { title: cleanTitle(meta(html, 'og:title')), image, runtime: mins ? hhmm(mins) : null }
}

async function fromSpotify(url) {
  if (!url) return {}
  const o = await get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
  if (!o) return {}
  try { const j = await o.json(); return { title: cleanTitle(j.title), image: j.thumbnail_url } } catch { return {} }
}

export default async function handler(req, res) {
  const items = await Promise.all(readList().map(async p => {
    const needsApple = p.apple && (!p.runtime || !p.title || !p.cover)
    const a = needsApple ? await fromApple(p.apple) : {}
    const s = (!p.title || !p.cover) && !a.title ? await fromSpotify(p.spotify) : {}
    return {
      title: p.title || a.title || s.title || 'Untitled',
      cover: p.cover || a.image || s.image || null,
      runtime: p.runtime || a.runtime || null,
      apple: p.apple || null,
      spotify: p.spotify || null,
    }
  }))
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
  res.status(200).json({ updated: new Date().toISOString(), playlists: items })
}
