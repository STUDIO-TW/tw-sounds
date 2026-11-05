// Step 2 of signing in to /admin: GitHub sends the editor back here with a code, which is swapped for an
// access token and handed to the admin window. Needs GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Vercel.

const page = (origin, status, payload) => `<!doctype html><meta charset="utf-8"><title>Signing in</title>
<body style="background:#08090a;color:#efede8;font:11px ui-monospace,Menlo,monospace;text-transform:uppercase;padding:24px">
${status === 'success' ? 'Signed in. Returning to TW Sounds…' : 'Sign-in failed. Close this window and try again.'}
<script>
(() => {
  const origin = ${JSON.stringify(origin)};
  const message = 'authorization:github:${status}:' + ${JSON.stringify(JSON.stringify(payload))};
  if (!window.opener) return;
  // the admin page answers this handshake, then receives the token; only the site's own origin is trusted
  window.addEventListener('message', e => {
    if (e.origin !== origin) return;
    window.opener.postMessage(message, origin);
    setTimeout(() => window.close(), 300);
  }, { once: true });
  window.opener.postMessage('authorizing:github', origin);
})();
</script>`

export default async function handler(req, res) {
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  const fail = msg => res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(page(origin, 'error', { message: msg }))

  const { code, state } = req.query || {}
  const cookieState = (req.headers.cookie || '').match(/(?:^|;\s*)tw_oauth_state=([a-f0-9]+)/)?.[1]
  if (!code) return fail('No code from GitHub.')
  if (!state || state !== cookieState) return fail('Sign-in expired or didn’t match. Try again.')

  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/api/callback`,
      }),
    })
    const data = await r.json()
    if (!data.access_token) return fail(data.error_description || 'GitHub didn’t return a token.')
    res.setHeader('Set-Cookie', 'tw_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(page(origin, 'success', { token: data.access_token, provider: 'github' }))
  } catch {
    return fail('Couldn’t reach GitHub.')
  }
}
