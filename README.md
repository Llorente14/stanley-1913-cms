# Stanley 1913 Admin CMS (prototype)

Dashboard admin untuk **Stanley 1913 Online Store**, dibangun dari
dokumen *Langkah Desain Konseptual ke Logikal*: 13 relasi DBDL (Step 2.1) dan batasan
integritas (Step 2.4). Tanpa backend: semua data disimpan di `localStorage` browser.

## Login

| Email | Password |
|---|---|
| `admin@stanley1913.id` | `Stanley1913!` |

Kredensial ini khusus prototype (dicek di browser, `src/lib/auth.ts`), bukan keamanan sungguhan.

## Menjalankan

```bash
npm install
cp .env.example .env    # isi RESET_SECRET
npm run dev             # http://localhost:4321
npm run build           # output Vercel di .vercel/output
npm run check:seed      # validasi data seed lewat constraint engine
```

## Reset data demo (rahasia)

Tidak ada tombol reset di UI. Buka:

```
https://<domain>/api/reset?token=<RESET_SECRET>
```

Token dicek di server (Vercel Function) terhadap env `RESET_SECRET`, jadi tidak ikut
ke bundle browser. Token salah atau kosong → `404`. Token benar → data CMS di browser
itu dihapus, sesi logout, dan seed awal dimuat ulang saat login berikutnya.
Karena data ada di `localStorage`, reset berlaku per browser.

## Deploy ke Vercel

1. Di Vercel: **Add New → Project → Import** `Llorente14/stanley-1913-cms`.
2. Framework preset: Astro (terdeteksi otomatis), Root Directory: `./` (biarkan default).
3. **Environment Variables**: tambahkan `RESET_SECRET` (string acak panjang).
4. Deploy. Halaman di-prerender statis; hanya `/api/reset` yang berjalan sebagai function.
   URL canonical dan `og:image` otomatis memakai domain produksi Vercel
   (`VERCEL_PROJECT_PRODUCTION_URL`); set `SITE_URL` bila memakai domain sendiri.

## Apa yang ditegakkan

- **Required data / domain**: NOT NULL, ENUM, panjang VARCHAR/CHAR, pola kode pos/telepon/email.
- **CHECK**: rating 1–5; price, stock_qty, total_points ≥ 0; quantity ≥ 1; latitude/longitude;
  `compare_at_price > price`; `ends_at > starts_at`; klaim rejected wajib alasan; klaim website
  wajib `order_id`, retailer wajib `purchase_date`; pesanan pengganti harus Rp0.
- **UNIQUE**: email, slug, sku, code, order_number, reference_no, claim_number,
  membership.customer_id, payment.order_id, shipment.order_id, replacement_order_id.
- **FOREIGN KEY + ON DELETE** sesuai Tabel 2.4 (RESTRICT / CASCADE / SET NULL), termasuk FK
  komposit `warranty_claim (order_id, product_id) → order_item`.
- **Workflow**: Payment `paid` → Order `confirmed` + Shipment `packed`; Shipment `delivered` →
  Order `completed` + poin member (1 poin / Rp10.000) + naik tier (VIP ≥ 300, All-Access ≥ 600);
  Order dibatalkan / payment kedaluwarsa → stok kembali; klaim disetujui → pesanan
  `warranty_replacement` Rp0 tanpa Payment.

## Data

- Produk, harga (USD × 16.000, dibulatkan Rp1.000), dan gambar diambil dari
  stanley1913.com; gambar di-hotlink dari CDN Shopify.
- Customer, pesanan, toko, ulasan, dan klaim adalah data fiktif.
- Tanggal seed digeser otomatis ke "hari ini" agar dashboard selalu terlihat aktual.
- Regenerasi seed: `node scripts/gen-seed.mjs <products.json>`.

Font: Space Grotesk (pengganti gratis StanleyFavorit yang berlisensi). Favicon: winged bear
dari stanley1913.com.
