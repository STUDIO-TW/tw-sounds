# TW Sounds

Directory site for the TW Sounds playlist series. Plain HTML, CSS and JavaScript built with Vite, deployed on Vercel from `main`.

## Admin

Go to sounds.studio-tw.com/admin and sign in with GitHub. You can add or reorder playlists, upload covers and edit every bit of site text. Each save is a commit to `main`, so the site redeploys in about a minute and every change can be undone from the repo history.

Sign-in uses a GitHub OAuth app. Vercel needs `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, and the app's callback URL is `https://sounds.studio-tw.com/api/callback`. Only people with write access to this repo can save changes.

## Editing content by hand

Everything you'd want to change lives in two files. Commit to `main` and Vercel redeploys in about a minute.

- `content/playlists.json` – the playlists, newest first, under a `playlists` key. Each entry has `title`, `cover`, `apple`, `spotify` and an optional `runtime` (HH:MM). Leave `runtime` empty and it's read from the Apple Music page.
- `content/site.json` – the bio, footer and SOUNDS links, subscribe form copy and error messages, privacy notice, and loader lines. Email and web addresses in the text become links automatically.
- `public/covers/` – cover images. Point a playlist's `cover` at `/covers/your-file.jpg`.

Numbers in the list are worked out from the order, so the bottom entry is 01.

## Functions

- `api/playlists.js` reads `content/playlists.json` and fills in anything left blank from the public Apple Music and Spotify pages, mainly runtimes. Cached for 6 hours.
- `api/subscribe.js` adds sign-ups to Kit. Needs `KIT_API_KEY` and `KIT_FORM_ID` set in Vercel, and custom fields `city` and `note` in Kit.

## Local development

```
npm install
npm run dev        # site only
npx vercel dev     # site plus the /api functions
```
