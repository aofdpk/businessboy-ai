# Gen 3 catalog database

This directory is deliberately separate from `scripts/catalog`. The existing feed builder stays responsible for selection and safety review. These files prepare an optional future Neon migration; they do not mean Neon is provisioned or active.

## Runtime modes

- Current/default production mode reads `api/_gen3-products.js`. No Neon environment variable is required.
- Set `GEN3_CATALOG_DATABASE_URL` to use Neon as the primary source.
- Alternatively set `GEN3_CATALOG_SOURCE=neon` and provide `DATABASE_URL` from the Vercel Marketplace integration.
- Set `GEN3_CATALOG_SOURCE=bundled` to force the local fallback.

Only set a Neon variable after the schema, import, count checks, controlled-category review, and rollback exercise have passed. The API can fall back to the bundled snapshot before pagination starts. A source/snapshot change during pagination is rejected and the UI safely returns to page 1. Authentication and `private, no-store` response headers remain unchanged.

## One-time setup

1. Create Neon through Vercel Marketplace so production environment variables are managed by the linked project, but do not enable the runtime source yet.
2. Apply `catalog-db/schema.sql` to the database.
3. Export the frozen approved runtime snapshot. The exporter refuses to overwrite an existing file and requires exactly 20,000 approved ranked products plus one featured product:
   `npm run export:catalog-jsonl -- C:\safe\catalog-2026-08-18.jsonl 20000`
4. Run an offline double-check without touching Neon:
   `node catalog-db/import-jsonl-to-neon.mjs C:\safe\catalog-2026-08-18.jsonl run-2026-08-18 20000 --validate-only`
5. Stage into a brand-new run ID with `GEN3_CATALOG_DATABASE_URL` available locally:
   `node catalog-db/import-jsonl-to-neon.mjs C:\safe\catalog-2026-08-18.jsonl run-2026-08-18 20000`
   The importer rejects any run ID that already exists, verifies the JSONL before writing, and verifies actual database counts after writing.
6. Sample every controlled category and run application QA against the staged data.
7. Activate only the verified staged run:
   `node catalog-db/activate-run.mjs run-2026-08-18 20000`
8. Exercise rollback before enabling Neon runtime mode:
   `node catalog-db/rollback-run.mjs <retired-run-id> <that-run-ranked-count>`

Importing never modifies the active run. The database function refuses activation unless status is `staged`, stored and actual approved ranked counts equal the requested count, exactly one approved featured item exists, and there are no extra rows. Rollback accepts only a verified `retired` run. Promotion/rollback retires the previous active run and promotes the target atomically. Keep at least one retired run.

## Required public-data rules

- Only `reviewStatus: "approved"` is served publicly.
- `itemSold` means cumulative sales in the source Product Feed, not monthly sales.
- There is intentionally no review-count or commission field.
- Seller IDs and item IDs remain inside the import pipeline and are not returned by the public API.
- `normalizedSearchText` must be precomputed before import.

## Performance contract

- The browser receives at most 48 rows per request; the UI defaults to 24 and replaces the page rather than growing the DOM.
- API pagination uses an HMAC-signed, snapshot-bound opaque cursor compatible with indexed keyset queries. Neon rejects deep `offset`; legacy `offset` remains bundled-only.
- Bundled mode keeps a bounded 50-page, two-minute per-instance LRU result cache. It contains catalog responses only—never cookies, sessions, or secrets.
- Neon facets are aggregated once per warm runtime and cached for 60 seconds. No 20,000-row payload is sent to a browser.
- Run `npm run benchmark:catalog` to measure cold/warm common queries plus 50 concurrent identical and distinct requests.
- Run `npm run test:catalog-db` for offline JSONL preflight and activation/rollback contract checks; it does not connect to Neon.
