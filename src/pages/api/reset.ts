// Secret demo reset. Runs on Vercel as a serverless function; the token never ships to the browser.
// GET /api/reset?token=<RESET_SECRET>  → clears this browser's CMS data and reseeds on next load.
import type { APIRoute } from 'astro';

export const prerender = false;

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const GET: APIRoute = ({ url }) => {
  const secret = import.meta.env.RESET_SECRET ?? process.env.RESET_SECRET ?? '';
  const token = url.searchParams.get('token') ?? '';
  if (!secret || !safeEqual(token, secret)) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
  }
  const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Reset</title>
<script>
try { Object.keys(localStorage).filter(function (k) { return k.indexOf('stanley-admin:') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
location.replace('/login?reset=1');
</script>`;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
};
