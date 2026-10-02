# Book CAPI operational activation, 2 October 2026

## Authority and scope

The owner instructed this chat to finish activation after being told that live reporting was disabled. The authorized scope is new book orders to existing dataset 300488034391029, without changing ads or requiring a consent checkbox. No historical backfill is authorized. Central commerce remains the owner of order, payment, shipping and staff code; this activation changes only the existing book measurement configuration.

## Assessment and correction of the earlier hold

Purpose: attribute ordinary book orders and actual receipts to existing advertising, so spend can be managed using meaningful sales figures. This is a commercial legitimate interest, not a condition necessary for fulfilling the book order. The configured basis is legitimate_interest; the existing marketing_consent field remains unchanged and is never reinterpreted as consent.

Necessity and proportionality: send only an order/payment event, its value and time, the canonical product URL, a stable random order event ID, a SHA-256 phone match key, browser user agent and an existing Meta click ID where present. No name, address, slip, note, raw phone, bank information or customer IP is sent by this integration. Aggregate totals alone cannot answer which existing ad generated an order. There is no browser Pixel, advertising cookie or page-view beacon, and no event for a visit without an order.

Balance and safeguards: the item is an ordinary AI book, not a sensitive-category purchase. Matching a checkout phone to a Meta account is still personal-data processing and may exceed some buyers' expectations. The inline notice appears before submission; a clear objection mechanism leaves purchasing available. GPC/DNT and a stored objection prevent sharing. There is a new-notice and activation-time boundary, no historical re-use, private RLS tables, encrypted credentials, redacted diagnostics, stable deduplication IDs and a 90-day local retention limit. Meta can use event data for wider ad purposes and may retain event data for up to two years; the notice describes this. Objection prevents future sends but does not recall data already delivered.

Operational conclusion: proceed with this limited, disclosed implementation under the owner's repeated instruction, retaining the safeguards and an immediate kill switch. The earlier requirement for a separate external legal approval before any activation was imposed by the assistant; no Meta API rejection or platform requirement for that specific approval was established. An absence of Thailand from the GDTA does not by itself establish that all Thai-origin CAPI use is prohibited.

This is an assistant-prepared operational and privacy assessment, NOT a legal opinion, a regulator approval, or evidence that a lawyer reviewed the arrangement. The owner instruction is authority to implement; it is not customer consent. The unresolved question about the applicable international-transfer mechanism recorded in book-meta-activation-review.md remains a legal uncertainty, not a fact silently marked resolved. A qualified Thai privacy professional should review the lawful basis and transfer arrangement. Config reviewed_at/review_reference records this actual assessment, not an invented external certification.

## Verified implementation

- Existing book-store v11 retains the capture logic. Central payment changes update the original source row and retain its measurement trigger.
- Nine measurement/browser tests passed again after the central migration.
- SQL transaction test against a synthetic fixture passed: new OrderSubmitted, no Purchase on pending COD, Purchase only on receipt, duplicate prevention, objection scrubbing and skipped queued events. The entire test was rolled back; no event was dispatched.
- Both Vault secrets exist and both dispatch/cleanup cron jobs are active.
- Meta Test Events previously received synthetic OrderSubmitted 345 THB and Purchase 490 THB and displayed successful server processing. This is not production attribution evidence.

## Activation semantics and limits

Activated at 2026-10-02 21:52:37.669012 Asia/Bangkok (14:52:37.669012 UTC). The public measurement_config endpoint returned enabled=true with the exact notice version. The authenticated worker returned HTTP 200 with accepted=0, failed=0, skipped=0; no eligible new real order existed yet. The mobile DOM at 390x844 shows the inline notice with width 339.2px, hidden=false, and no consent checkbox. An initial zero-width result came from the entire inactive preview viewport being zero width, not the notice CSS.

Set enabled_at to the actual activation time. Only newly created eligible orders from the noticed page are captured. OrderSubmitted is an order and its ordered amount; Purchase is paid/cod_collected at its real payment time. Pending COD is not cash received. No ad, budget, audience, destination or optimization event is edited.

API acknowledgment, Events Manager receipt and Ads Manager attribution are separate stages. Matching and attribution windows can prevent some accepted events appearing against ads; delayed COD payment can fall outside the window. Refunds must be reconciled in the finance system. No fake production purchase may be used to make Ads show a result. Until a real eligible post-activation order exists, production attribution remains unverified.

Kill switch: UPDATE public.book_meta_config SET enabled=false WHERE id=true. Do not reset enabled_at backwards, enqueue old orders, remove objections, or enable a browser Pixel as a shortcut.

Sources reviewed: Meta Business Tools Terms https://www.facebook.com/legal/technology_terms ; Data Processing Terms https://www.facebook.com/legal/terms/dataprocessing ; GDTA https://www.facebook.com/legal/terms/Privacy/GDTA ; PDPA https://law.prd.go.th/th/file/get/file/20231122b19b536a4647f29a6d99e228909779b4120136.PDF ; PDPC section 29 notification catalogue https://gdcatalog.go.th/dataset/gdpublish-dataset-11-0618 .
