# BusinessBoy AI Book

Public page: `/ai-book`. Staff: `/book-admin`. Existing `/promptbook` is unchanged.

## Operations

- Owner signs in with the account supplied directly by the user. Credentials are in Supabase Auth only, not this repository.
- COD: verify order -> ready -> create export batch -> download XLSX/CSV -> import/map in DHL eCommerce Web Portal -> enter tracking -> shipped -> delivered -> finance confirms COD remittance.
- Transfer: view private slip, independently check actual TTB receipt, approve payment -> ready. Uploaded slips are **not automatically bank verified**. Exact duplicate file hashes are rejected across orders.
- Export reserves ready orders atomically. A retry with the same batch ID returns the original snapshot. Download an existing batch to recover a failed download. Export does not mark shipped.
- The export is a generic recipient/COD format. The account-specific DHL bulk template has not yet been verified; column mapping is necessary before first import. No DHL API calls or labels are submitted automatically.
- The 490 THB package must include the printable Prompt QR instructions. Print from the staff page; the access code is fetched only after authentication.
- Payment status and shipping status are separate. Purchase conversions are not fired on order submission. Financial truth is the book database. Meta CAPI is not connected without a server-side Dataset token.
- No customer messages or emails are sent automatically.

## Architecture

Static HTML/CSS/JS on the existing businessboy-ai Vercel project. `/api/book` rewrites to `book-store` on Supabase project `oezzgzzqgsrpvjeesgva`. Its custom session authentication uses HttpOnly Secure SameSite=Strict cookies (8 hours), opaque customer capability keys, server-side prices, address validation, rate limiting and optimistic revisions.

All dedicated `book_*` tables use RLS and deny `anon` / `authenticated` direct access. Only the function service role has table access. Slips are in private `book-slips` storage, signed for 120 seconds for finance/owner. Export writes and audit are in one PostgreSQL transaction. Existing sales/bot tables are untouched.

GA4/Pixel/Clarity IDs are editable by the owner. Event payloads use allowlisted fields and no names, phones, addresses or slip contents. Providers load only on production domain after consent. Checkout is marked for Clarity masking; admin loads no tracking script. Unknown URL parameters are removed before provider initialization. Cookie preference can be withdrawn, stopping trackers after reload.

Daily maintenance at 03:15 Thailand time clears expired staff sessions, old rate limits and events older than 90 days. Order records are not auto-deleted.

## Assets / evidence

- QR image copied byte-for-byte from user original; SHA256 `07293fa4565387b88c16ed3a64c35bdc02e821a3cdbd2aed9f220ff4aac9292d`. Thai payment QR decoded and CRC verified.
- Address dataset: earthchie/jquery.Thailand.js `raw_database.json`, fetched 2026-09-30, 7,498 combinations in 77 provinces. License in `book-assets/ADDRESS-LICENSE.txt`. Both client and server validate against the same snapshot. This is a community-maintained dataset, not live Thailand Post verification.
- Quotes are exact excerpts from S02_C1431594682192758, S01_C1065714015937555, S01_C3995293090772293. Author-teaching section only, with source links. No fabricated book testimonials.

## Verification

`node scripts/book/dev-server.mjs` provides localhost:4310 with API proxy. Secure cookie flag is omitted **only in the local proxy**; deployed endpoint always sets Secure.

`npx deno check supabase/functions/book-store/index.ts`

`node scripts/book/integration.mjs` requires `BOOK_ADMIN_EMAIL` and `BOOK_ADMIN_PASSWORD` in process environment. It creates synthetic QA orders, never makes payments, sends messages, or submits to DHL. Mark generated IDs as `is_test=true` and their batches as tests after checking; records stay for audit. Do not run against customer data. Results in ignored `qa-runs/book/`.

Verified: server-owned price, concurrent request idempotency, address mismatch rejection, private slips, unauthorized API denial, optimistic payment transitions, atomic export recovery, duplicate export refusal, COD settlement gate, logout revocation, consent rejection, XLSX Thai text and leading zeroes.
