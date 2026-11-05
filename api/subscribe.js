// Adds a TW Sounds subscriber to Kit without the visitor leaving the site.
// Needs two environment variables in Vercel:
//   KIT_API_KEY  – a v4 API key from Kit (Settings > Developer)
//   KIT_FORM_ID  – the Kit form subscribers should join (the number in the form's URL)
// And two custom fields created in Kit with the keys `city` and `note`.

const KIT = 'https://api.kit.com/v4'

async function kit(path, body) {
  const r = await fetch(KIT + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Kit-Api-Key': process.env.KIT_API_KEY },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Kit ${path} ${r.status}: ${await r.text()}`)
  return r.json().catch(() => ({}))
}

const clean = (v, max) => String(v ?? '').trim().slice(0, max)

// Tidy a city into title case: "london" -> "London", "new york city" -> "New York City",
// "stoke-on-trent" -> "Stoke-on-Trent". Short words typed in capitals ("NYC", "LA") stay as typed,
// and well-known abbreviations are capitalised even if typed in lowercase ("nyc" -> "NYC").
const ABBR = new Set(['nyc', 'la', 'sf', 'dc', 'uk', 'usa', 'us', 'uae', 'ldn', 'bk', 'nola', 'atl', 'phx', 'cdmx'])
const SMALL = new Set(['on', 'upon', 'of', 'the', 'de', 'del', 'da', 'di', 'du', 'la', 'le', 'sur', 'am', 'and'])
function tidyCity(raw) {
  const text = raw.replace(/\s+/g, ' ').trim()
  let first = true
  const single = !/[\s-]/.test(text)
  return text.replace(/[^\s-]+/g, word => {
    const lower = word.toLowerCase(), isFirst = first
    first = false
    if (single && ABBR.has(lower.replace(/\./g, ''))) return word.replace(/\./g, '').toUpperCase()   // only when it's the whole answer, so "la paz" stays "La Paz"
    if (word.length <= 4 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word
    if (!isFirst && SMALL.has(lower)) return lower
    return lower.replace(/^(\p{L})/u, c => c.toUpperCase()).replace(/(['’]\p{L})/gu, m => m.toUpperCase())
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})

  // hidden field real people never fill in; bots usually do
  if (b.website) return res.status(200).json({ ok: true })

  const name = clean(b.name, 100), city = tidyCity(clean(b.city, 100)), note = clean(b.note, 1000)
  const email = clean(b.email, 254).toLowerCase()
  if (!name) return res.status(422).json({ error: 'Add your name to complete sign-up.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(422).json({ error: 'Add an email address to complete sign-up.' })
  if (b.consent !== true && b.consent !== 'yes') return res.status(422).json({ error: 'Confirm consent to complete sign-up.' })
  if (!process.env.KIT_API_KEY) return res.status(500).json({ error: 'Mailing list not configured.' })

  try {
    // create (or update, if the email already exists) the subscriber with their details
    await kit('/subscribers', { email_address: email, first_name: name, state: 'active', fields: { city, note } })   // consent is given on the form, so no separate confirmation step
    // then add them to the TW Sounds form so they land in the right list
    if (process.env.KIT_FORM_ID) await kit(`/forms/${process.env.KIT_FORM_ID}/subscribers`, { email_address: email, referrer: 'tw-sounds-site (consent given via form)' })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(502).json({ error: 'That didn’t go through. Try again in a moment.' })
  }
}
