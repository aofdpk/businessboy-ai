# Book Meta CAPI activation review

Prepared 2026-10-02. Status: implementation ready for verification; live sharing OFF pending review and a scoped token.

## Scope

- Existing book dataset 300488034391029, BG-01 account 1260051351872176.
- No changes to ad creative, destination, budget, audience, optimization event or campaign state.
- New eligible orders only. Existing consent=false orders are not reinterpreted or backfilled.
- No browser Pixel, advertising cookies, page-view analytics, fingerprinting or cross-site scripts.
- OrderSubmitted reflects a recorded order; Purchase reflects paid/cod_collected, with the real payment timestamp. Pending COD is not revenue received.
- Meta attribution depends on matching and the existing attribution window. Delivered/acknowledged events do not prove attributed orders. Delayed COD payment may fall outside the ad's attribution window. Refunds are reconciled in the finance report and do not automatically subtract from Meta Purchase.

## Proposed legitimate-interest assessment (requires controller review)

Purpose: measure the effectiveness of advertising used to sell this ordinary book and allocate spend based on actual orders and receipts. This is a commercial interest, not contractual necessity for delivery.

Necessity: aggregate reports cannot identify which existing ads result in orders. Changing existing ad links was rejected by the controller because current ads are delivering. Server measurement can match existing click IDs and a hashed phone number. Sending names, addresses, notes, slips, exact location, raw phone numbers, payment account details, full URLs or IP addresses is unnecessary and excluded. Hashing does not anonymize a phone number.

Balancing: buyers may expect advertising measurement, but the current checkout notice promised order handling only, so historical orders are excluded. Meta can use event data for ad delivery and personalization under its terms, beyond producing this advertiser's aggregate report. That wider processing and international transfer remain material risks. A public notice and an objection button alone do not establish a valid lawful basis. The controller must confirm that the documented balance, applicable jurisdictions, transfer safeguards and user expectations support this specific use. If they do not, keep disabled and require consent for any future Meta sharing.

Safeguards implemented: clear inline notice before ordering, full purpose/recipient/retention information, one-click objection without purchase impact, GPC/DNT honored, no event before an eligible order, strict new-notice version gate, minimum matching fields, 90-day local matching-data retention, private tables, encrypted credential storage, stable deduplication IDs, no PII in logs. Objection blocks future sends for the current browser/order; already transmitted events cannot be recalled by that button. Contact handles other devices and data rights. Meta's terms allow up to two years for event data.

## Required before activation

1. Controller's lawful-basis/transfer review reference and date (not merely acceptance of a software feature).
2. CAPI token authorized for dataset 300488034391029, stored only in Supabase Vault as book_meta_access_token. No token in this repository or browser.
3. Synthetic event accepted in Meta Test Events and exact dataset verified. Never generate a fake production purchase to test attribution.
4. Frontend notice/objection flow deployed and verified, then set enabled_at to activation time and enable the private config. No historical backfill.
5. Verify actual new orders: queue acknowledged, Events Manager server receipt, then Ads Manager attribution (asynchronous; not guaranteed one-to-one).

## Primary sources checked

- https://www.facebook.com/legal/technology_terms (logged-in UI read 2026-10-02; effective 2025-11-03), sections 1(e), 2, 3, 4 and 5.
- https://law.prd.go.th/th/file/get/file/20231122b19b536a4647f29a6d99e228909779b4120136.PDF, PDPA sections 19, 23, 24. No claim of legal certification is made by this implementation.
- https://github.com/facebook/facebook-python-business-sdk (CAPI event schema).
- https://supabase.com/docs/guides/functions/background-tasks (non-blocking tasks).

## Operations

Kill switch: UPDATE public.book_meta_config SET enabled=false WHERE id=true;
Worker secret: Vault book_meta_worker_key. Calls require x-book-worker-key; cron reads this encrypted secret internally. Never expose its value in diagnostics.
Retry: stable event_id/event_time, SKIP LOCKED claims, five-minute stale-lock recovery, exponential retry, maximum ten attempts, six-day event expiration. No permanent API errors automatically replayed.
Config and matching context/outbox are private to service_role. The owner/finance authenticated endpoint measurement_status returns status/amount only, no matching identifiers or token.
Code rollback: restore previous book-store version and frontend release; keep config disabled. Retain audit evidence instead of deleting production orders.
