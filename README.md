# TW Sounds

Directory site for the TW Sounds playlist series. Vite + React, deployed on Vercel from `main`.

## Adding a playlist

Edit `playlists.json` on GitHub and add a new entry at the top (newest first):

```json
{
  "apple": "https://music.apple.com/gb/playlist/...",
  "spotify": "https://open.spotify.com/playlist/..."
}
```

Commit to `main`. Vercel redeploys in about a minute and the site fills in the title, cover, description and track count from the public playlist pages.

Optional overrides on any entry, used if you want to replace what the platforms return:

- `title`
- `cover` (full image URL)
- `description`

## How it works

- `api/playlists.js` is a Vercel function that reads `playlists.json`, fetches each Apple Music and Spotify page, and pulls the preview data (title, artwork, description, song count). Apple is used first, Spotify fills any gaps.
- Results are cached at Vercel's edge for 6 hours. Edits to `playlists.json` show straight away because every commit redeploys.
- No accounts, API keys or subscriptions are involved. If a platform changes its pages and a fetch fails, the site falls back to the overrides above.

## Local development

```
npm install
npm run dev        # front end only, uses playlists.json directly
npx vercel dev     # front end plus the live /api/playlists function
```
