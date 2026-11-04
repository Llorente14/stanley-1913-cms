// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Static site; only /api/reset runs as a serverless function (prerender = false).
// Vercel exposes the production domain at build time; used for canonical / og:image URLs.
const site = process.env.SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:4321');

export default defineConfig({
  site,
  output: 'static',
  adapter: vercel(),
  devToolbar: { enabled: false },
});
