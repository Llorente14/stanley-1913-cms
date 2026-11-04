# Stanley 1913 Admin (prototype)

Admin dashboard for the **Stanley 1913 Online Store**, built from the course document
*Langkah Desain Konseptual ke Logikal*: the 13 logical relations (Step 2.1) and the integrity
constraints (Step 2.4). There is no backend; all data lives in the browser's `localStorage`.

## Sign in

| Email | Password |
|---|---|
| `admin@stanley1913.id` | `Stanley1913!` |

These credentials are for the prototype only (checked in the browser, `src/lib/auth.ts`).

## Run locally

```bash
npm install
cp .env.example .env    # set RESET_SECRET
npm run dev             # http://localhost:4321
npm run build           # Vercel output in .vercel/output
npm run check:seed      # validate the seed data through the constraint engine
```

## Secret demo reset

There is no reset button in the UI. Open:

```
https://<domain>/api/reset?token=<RESET_SECRET>
```

The token is checked on the server (Vercel Function) against the `RESET_SECRET` environment
variable, so it never ships to the browser. A wrong or missing token returns `404`. A valid
token clears the admin data in that browser, signs out, and the original seed loads on the
next sign-in. Because data is stored per browser, a reset only affects the browser that opens
the link.

## Deploy to Vercel

1. In Vercel: **Add New → Project → Import** `Llorente14/stanley-1913-cms`.
2. Framework preset: Astro (auto-detected). Root Directory: `./` (default).
3. **Environment Variables**: add `RESET_SECRET` (a long random string).
4. Deploy. Pages are prerendered as static files; only `/api/reset` runs as a function.
   Canonical and `og:image` URLs use the Vercel production domain
   (`VERCEL_PROJECT_PRODUCTION_URL`); set `SITE_URL` when using a custom domain.

## What is enforced

- **Required data / domains**: required fields, allowed options, text lengths, postal code /
  phone / email formats.
- **Checks**: rating 1–5; price, stock and points ≥ 0; quantity ≥ 1; latitude/longitude ranges;
  compare-at price > price; end date after start date; rejected claims need a reason; online
  claims need the original order and in-store claims need a purchase date; replacement orders
  are free.
- **Unique values**: email, slug, SKU, promo code, order number, payment reference, claim number,
  one membership per customer, one payment and one shipment per order.
- **Foreign keys and delete rules** (Table 2.4): restrict, cascade or set null, including the
  composite key from warranty claims to order items.
- **Workflows**: paid → order confirmed and packed; delivered → order completed, member points
  (1 point per Rp10.000) and tier upgrade (VIP at 300, All-Access at 600); cancelled or expired
  → stock returned; approved claim → free replacement order without a payment.

## Data

- Products, prices (USD × 16,000, rounded to Rp1.000) and images come from stanley1913.com;
  images are hotlinked from the Shopify CDN.
- Customers, orders, stores, reviews and claims are fictional.
- Seed dates shift to "today" automatically so the dashboard always looks current.
- Regenerate the seed: `node scripts/gen-seed.mjs <products.json>`.

Font: Space Grotesk (a free stand-in for the licensed StanleyFavorit). Favicon: the winged bear
from stanley1913.com.
