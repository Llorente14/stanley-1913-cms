# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro 5 + TypeScript, vanilla client scripts, data in browser localStorage (no backend). Deployed on Vercel with `@astrojs/vercel`; the only server code is the secret `/api/reset` endpoint.

## Users

Store admin / staff of the Stanley 1913 Online Store (Indonesia), working on a laptop. They maintain the catalog, process orders through payment and shipment, moderate reviews, and decide warranty claims. Secondary audience: the course lecturer evaluating whether the prototype reflects the logical data model.

## Product Purpose

A CMS prototype that makes the logical database design of `stanley_store` tangible: every screen maps to one of the 13 relations in "Langkah Desain Konseptual ke Logikal" (Step 2.1), and the integrity constraints of Step 2.4 are enforced live. Success = an admin can run the full order and warranty workflow end to end, and constraint violations are visibly refused.

## Positioning

Not a generic admin template: table and column names, ENUM values, keys, and ON DELETE actions are the exact ones from the course design document, so the UI doubles as a demonstration of the data model.

## Operating Context

- Single admin login (`admin@stanley1913.id`), session in localStorage.
- Data seeded with real Stanley 1913 products (images hotlinked from Shopify CDN), prices in Rupiah.
- Demo data reset only through a secret token endpoint known to the owner.

## Capabilities and Constraints

- CRUD: Product, Category, PromoCode, Store, Customer (+ Membership, CustomerAddress).
- Status workflows: Orders, Payment, Shipment, WarrantyClaim; Review moderation (delete).
- Chained effects: paid → order confirmed + shipment packed; delivered → order completed + member points/tier; cancelled → stock restored; claim approved → Rp0 replacement order.
- Search, filter, sort, CSV export, activity log, sales chart.
- localStorage quota (~5 MB) bounds uploaded images; uploads are compressed.
- UI copy in Indonesian; table and column identifiers stay in English as in the ERD.

## Brand Commitments

Visual language follows stanley1913.com: near-black `#101010` on white, square 2px-bordered buttons with inverted hover and lowercase labels, the winged-bear favicon. StanleyFavorit is licensed, so Space Grotesk stands in; Inter is not allowed.

## Evidence on Hand

- `../final/Langkah Desain Konseptual ke Logikal.docx` — source of all relations and rules.
- Product names, prices (USD, converted ×16.000), and images from stanley1913.com/products.json.
- Customers, orders, stores, and reviews are fictional demo data.

## Product Principles

1. The data model is the product: never invent columns the document does not have.
2. Refuse invalid writes with the constraint's name and a recovery hint.
3. Every workflow step shows its consequence on related rows.
4. Dense, scannable tables over decorative surfaces.
