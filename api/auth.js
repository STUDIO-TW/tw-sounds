// Step 1 of signing in to /admin: send the editor to GitHub to approve access.
// Needs GITHUB_CLIENT_ID (from the GitHub OAuth app) set in Vercel.
import { randomBytes } from 'node:crypto'

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return res.status(500).send('Sign-in isn’t set up yet: GITHUB_CLIENT_ID is missing.')

  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  const state = randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/callback`,
    scope: 'repo',            // read and write the site's content in the repo
    state,
  })
  // short-lived cookie so the callback can check the reply really came from this sign-in
  res.setHeader('Set-Cookie', `tw_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`)
}
