import { useEffect, useRef, useState } from 'react'
import raw from '../playlists.json'

// Shown instantly and used if the live fetch fails (e.g. plain `npm run dev`).
const fallback = raw
  .filter(p => p.apple || p.spotify)
  .map((p, i) => ({ id: i, title: p.title || 'Untitled', cover: p.cover || null, description: p.description || '', tracks: null, apple: p.apple || null, spotify: p.spotify || null }))

const SIDES = [-1, .6, -.3, 1, -.8, .2, .9, -.6, .4]
const pad = n => String(n).padStart(3, '0')

function Placeholder({ seed }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current, s = 600; c.width = c.height = s
    const g = c.getContext('2d'), h = (seed * 47) % 360
    const lg = g.createLinearGradient(0, 0, s, s)
    lg.addColorStop(0, `hsl(${h} 35% 28%)`); lg.addColorStop(1, `hsl(${(h + 40) % 360} 40% 11%)`)
    g.fillStyle = lg; g.fillRect(0, 0, s, s)
    for (let i = 0; i < 5; i++) {
      const x = (Math.sin(seed * 9.1 + i * 3.7) + 1) / 2 * s, y = (Math.cos(seed * 4.3 + i * 1.9) + 1) / 2 * s
      const rg = g.createRadialGradient(x, y, 0, x, y, s * .4)
      rg.addColorStop(0, `hsla(${h + i * 14} 60% 60% / .45)`); rg.addColorStop(1, 'transparent')
      g.fillStyle = rg; g.fillRect(0, 0, s, s)
    }
  }, [seed])
  return <canvas ref={ref} aria-hidden="true" />
}

function Cover({ p, vol }) {
  const [broken, setBroken] = useState(false)
  if (p.cover && !broken) return <div className="cover"><img src={p.cover} alt="" loading="lazy" onError={() => setBroken(true)} /></div>
  return <div className="cover"><Placeholder seed={vol} /><span className="name">{p.title}</span></div>
}

export default function App() {
  const [list, setList] = useState(fallback)
  const [open, setOpen] = useState(null)
  const cards = useRef([])

  useEffect(() => {
    fetch('/api/playlists').then(r => r.ok ? r.json() : null).then(d => { if (d?.playlists?.length) setList(d.playlists) }).catch(() => {})
  }, [])

  // depth from distance to viewport centre, tilt from cursor
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let mx = 0, my = 0, tx = 0, ty = 0, raf
    const move = e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5 }
    addEventListener('pointermove', move, { passive: true })
    const frame = () => {
      tx += (mx - tx) * .08; ty += (my - ty) * .08
      const vh = innerHeight, spread = Math.max(0, Math.min(260, (innerWidth - 380) / 3))
      cards.current.forEach((c, i) => {
        if (!c) return
        const r = c.getBoundingClientRect(), d = (r.top + r.height / 2 - vh / 2) / vh, side = SIDES[i % SIDES.length]
        c.style.transform = `translateX(${side * spread}px) translateZ(${-Math.abs(d) * 220}px) rotateX(${d * -18 + ty * -10}deg) rotateY(${side * -8 + tx * 14}deg) scale(${1 - Math.min(.18, Math.abs(d) * .14)})`
        c.style.opacity = 1 - Math.min(.55, Math.abs(d) * .45)
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', move) }
  }, [list])

  useEffect(() => {
    const k = e => e.key === 'Escape' && setOpen(null)
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [])

  const total = list.length
  const sel = open != null ? list.find(p => p.id === open) : null
  const selVol = sel ? total - list.indexOf(sel) : 0

  return (
    <>
      <header>
        <div className="bar">
          <span className="wordmark">TW Sounds</span>
          <span className="meta">{pad(total)} playlists</span>
        </div>
      </header>

      <section className="intro">
        <h1>TW Sounds</h1>
        <p>A running playlist series by STUDIO TW. Scroll to browse, tap a cover to listen on Apple Music or Spotify.</p>
      </section>

      <main className="stage">
        {total === 0 && <p className="empty">First playlists coming soon</p>}
        {list.map((p, i) => {
          const vol = total - i
          return (
            <button key={p.id} ref={el => (cards.current[i] = el)} className="card" type="button" onClick={() => setOpen(p.id)} aria-label={`Vol. ${pad(vol)}, ${p.title}`}>
              <Cover p={p} vol={vol} />
              <div className="cap"><span>{pad(vol)} · {p.title}</span><span>{p.tracks ? `${p.tracks} tracks` : ''}</span></div>
            </button>
          )
        })}
      </main>

      <footer>© STUDIO TW · <a href="https://studio-tw.com" target="_blank" rel="noopener">studio-tw.com</a></footer>

      {sel && (
        <div className="sheet" onClick={e => e.target === e.currentTarget && setOpen(null)}>
          <div className="panel" role="dialog" aria-modal="true" aria-labelledby="d-title">
            <Cover p={sel} vol={selVol} />
            <div className="detail">
              <button className="close" type="button" onClick={() => setOpen(null)} autoFocus>Close</button>
              <span className="meta">TW Sounds {pad(selVol)}{sel.tracks ? ` · ${sel.tracks} tracks` : ''}</span>
              <h2 id="d-title">{sel.title}</h2>
              {sel.description && <p>{sel.description}</p>}
              <div className="links">
                {sel.apple && <a className="btn" href={sel.apple} target="_blank" rel="noopener">Apple Music ↗</a>}
                {sel.spotify && <a className={sel.apple ? 'btn alt' : 'btn'} href={sel.spotify} target="_blank" rel="noopener">Spotify ↗</a>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
