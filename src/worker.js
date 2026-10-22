// Password gate for the Cloudflare deployment. Every request, static assets
// included, must carry HTTP Basic credentials whose password matches the
// APP_PASSWORD secret (any username works). Set it with:
//
//   npx wrangler secret put APP_PASSWORD
//
// Fails closed: with no secret configured nothing is served.
const enc = new TextEncoder();

async function same(a, b) {
  // Compare digests so the check takes the same time however much matches.
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return crypto.subtle.timingSafeEqual(x, y);
}

function challenge() {
  return new Response('Password required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="CardWise", charset="UTF-8"', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    if (!env.APP_PASSWORD) return new Response('APP_PASSWORD is not configured.', { status: 503 });
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Basic ')) return challenge();
    let pass;
    try {
      const decoded = new TextDecoder().decode(Uint8Array.from(atob(auth.slice(6)), (c) => c.charCodeAt(0)));
      pass = decoded.slice(decoded.indexOf(':') + 1);
    } catch {
      return challenge();
    }
    if (!(await same(pass, env.APP_PASSWORD))) return challenge();
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'private, no-store');
    return out;
  },
};
