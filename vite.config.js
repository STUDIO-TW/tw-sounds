import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

// At build time, write the playlists into the page in a form search engines read without running any script:
// structured data (JSON-LD) describing the series, plus a plain list for crawlers that skip JavaScript.
// Visitors never see either; the live site is still built by src/main.js.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function searchPlaylists() {
  return {
    name: 'search-playlists',
    transformIndexHtml(html) {
      const { playlists = [] } = JSON.parse(readFileSync('content/playlists.json', 'utf8'))
      const site = 'https://sounds.studio-tw.com'
      const total = playlists.length
      const data = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'TW Sounds',
        description: 'A series of sounds curated by Tom Winslade of STUDIO TW.',
        url: site,
        numberOfItems: total,
        itemListElement: playlists.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'MusicPlaylist',
            name: `TW Sounds: ${p.title}`,
            url: p.spotify || p.apple || site,
            sameAs: [p.apple, p.spotify].filter(Boolean),
            image: p.cover ? site + p.cover : undefined,
            creator: { '@type': 'Organization', name: 'STUDIO TW', url: 'https://studio-tw.com' },
          },
        })),
      }
      const list = playlists.map((p, i) => {
        const links = [p.apple && `<a href="${esc(p.apple)}">Apple Music</a>`, p.spotify && `<a href="${esc(p.spotify)}">Spotify</a>`].filter(Boolean).join(' · ')
        return `<li>${String(total - i).padStart(2, '0')} TW Sounds: ${esc(p.title)}${links ? ' – ' + links : ''}</li>`
      }).join('')
      return html
        .replace('</head>', `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>\n</head>`)
        .replace('<body>', `<body>\n<noscript><h1>TW Sounds</h1><p>A series of sounds curated by Tom Winslade of STUDIO TW.</p><ol>${list}</ol></noscript>`)
    },
  }
}

export default defineConfig({ plugins: [searchPlaylists()] })
