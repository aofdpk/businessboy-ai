# Book Meta CAPI activation review

Current status, 2026-10-02 21:52:37 Asia/Bangkok: live sharing is enabled for eligible new orders. See [operational activation record](book-meta-operational-activation-20261002.md). The earlier assistant-imposed operational hold below is superseded; the legal evidence gap is not represented as resolved or externally certified. Preserve the following as the earlier review record.

## Setup and evidence completed

The user's direct instruction to proceed authorized creation and storage of the CAPI token. No further token permission is pending. The token was generated without Dataset Quality API and saved only as book_meta_access_token in Supabase Vault. No credential is included in this document.

Synthetic OrderSubmitted (345 THB) and Purchase (490 THB) were submitted using TEST29272, with a fabricated external identifier and no customer data. Meta returned HTTP 200, events_received=2, messages=[]. Events Manager visibly marked both server events processed successfully on 2026-10-02 at 16:24:05 Asia/Bangkok. Purchase details showed 490 and THB. These tests did not create book orders or production sales. They establish credential/API receipt, not ad attribution or a full live checkout-to-worker run.

## Review finding from primary sources

The user delegated setup and review to the assistant; this is not evidence that an external lawyer or company privacy officer approved a legal basis. The legitimate-interest analysis below is an assessment draft, not a certification.

Meta's Data Processing Terms (effective 2025-08-23) and Global Data Transfer Addendum were read in the signed-in browser on 2026-10-02. The processing terms incorporate GDTA only insofar as the transfer is subject to a law listed in that addendum. Its listed jurisdictions are Brazil, Saudi Arabia, LATAM/Canada, Turkey and the USA; Thailand is not listed. Therefore this implementation cannot treat the GDTA link alone as a verified safeguard for Thai-origin transfers. This does not establish that the transfer is prohibited; it establishes a gap in the evidence available here. No separate Thai-applicable transfer agreement or assessment was located. Do not populate reviewed_at/review_reference as approved or enable live sharing on the strength of software authorization alone.

To resolve this specific gap, establish the applicable transfer mechanism and effective data-subject remedies under PDPA sections 28/29 for this Meta data flow, and finish the balancing assessment for matching customer phone hashes. No additional checkbox is being imposed by this review. The deployed kill switch remains off while those facts are unresolved.

Sources: https://www.facebook.com/legal/terms/dataprocessing ; https://www.facebook.com/legal/terms/Privacy/GDTA ; https://data.go.th/th/dataset/dataset_11_0611 .

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
2. DONE: CAPI token authorized for dataset 300488034391029, stored only in Supabase Vault as book_meta_access_token. No token in this repository or public frontend.
3. DONE: synthetic events accepted in Meta Test Events and exact dataset verified. Never generate a fake production purchase to test attribution.
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
