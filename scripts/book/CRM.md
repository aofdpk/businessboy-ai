# Book CRM and telesales, 30 September 2026

## Current operation: shipping only (1 October 2026)

Owner requested a temporary pause of telesales and all upsells. `book_sales_settings.telesales_enabled=false` gates staff login, sales APIs, addon payment APIs and the sales mutation RPC. All five telesales accounts are inactive and their custom sessions have been revoked. Records remain intact. There is no UI switch to reactivate sales; wait for a new explicit owner instruction before changing the flag and reactivating staff.

`natlogis` and `muaylogis` are active fulfillment accounts using the owner's requested credentials in Supabase Auth only. They can view orders, confirm COD orders, export ready parcels, print packing lists/Prompt inserts and record tracking. They cannot approve payments, view private slips, change prices or manage staff.

Shipping users see three primary menus: orders, prepare shipments and shipped. Owner also sees payment review and team settings. Exported orders have their own queue awaiting tracking; export never marks a parcel shipped. Each batch shows time, creator, count, books/Prompt inserts and total COD. Re-download the existing snapshot rather than creating another batch.

Exports include product, book quantity, packing instructions, payment method, payment status and separate order/COD amounts. Thai-header packing XLSX is separate from carrier XLSX/CSV. The latter is a generic mapping file; this account's exact DHL Web Portal template is still unverified. No DHL API, label purchase or automatic customer messaging is involved.

Verified with `shipping-verification.mjs` (credentials only via process environment) and `shipping-transaction-test.sql` (all synthetic writes rolled back): both account scopes, five denied telesales logins, disabled sales APIs, paid-transfer gate, COD readiness, four offer/payment combinations, snapshot retry, duplicate export rejection, tracking, file integrity and leading zeroes. Browser checked at 1280, 390 and 320px, including 21px large text and batch summary. Public checkout and its current tracking behavior are unchanged.

## Staff workflow

The same `/book-admin` accepts an email or a username. Owner can create or disable staff. The five requested accounts use usernames boatadmin, aeadmin, armadmin, pookieadmin and gunadmin, with Thai display names. Role: telesales. Passwords are held only by Supabase Auth, are not stored here, and are not forced to rotate per the owner's explicit instruction.

Telesales can claim an unassigned order, see only assigned customer details, record call outcomes, schedule a callback in Thailand time, create an agreed upsell, copy its payment link, upload a customer-provided slip, and record manual KCUT delivery. It cannot approve money, export addresses, view private bank slips, edit tracking settings or manage users. The unassigned list hides the phone and address until claimed. Assignment uses an atomic order lock and revision; another caller cannot steal an assigned order. Owner can reassign.

## Prices and money

Owner-confirmed prices for this task:
- Prompt upgrade: additional 145 THB, book package total 490 THB.
- KCUT 1 month: 390 THB.
- KCUT 1 year: 3,900 THB.
- KCUT lifetime: 5,900 THB.

KCUT is paid separately by transfer and never added to the DHL COD amount. One active KCUT package per book order; cancel an unpaid choice before replacing it. A paid choice requires finance to confirm a real refund before it is replaced. These are manual financial records, not bank/refund API calls.

For COD Prompt upgrades, the parcel amount becomes 490 and the 145 addon remains COD pending. A confirmed DHL remittance marks its addon paid atomically. For a previously paid transfer book, the original 345 remains received; the order is held until the 145 is verified or the unpaid addon is cancelled. The private original slip is preserved. The package then becomes 490 and the packing slip includes the Prompt QR insert.

No Prompt change is permitted once exported to DHL. KCUT can be sold independently after shipment. `base_amount` preserves the original book revenue so addon reporting does not count it twice. Cash totals use paid_at; order counts use created_at. Refunded items are excluded from received totals. For a transferred Prompt refund, cancel/return the book, confirm refund of the 145, then confirm refund of the original book amount. COD Prompt refunds follow the main book refund.

Customer payment links use `/book-payment#id.capability`, without UTM or trackers. The server derives the capability with HMAC; it is not an order ID alone. Public responses contain no name, address, phone or activation code. Slip hashes are unique across book and addon payments, including historical uploads. Signed slip viewing is limited to owner/finance. A slip is not automatically validated against the bank.

## KCUT delivery

Owner chose manual LINE delivery: customer adds LINE; staff sends the access link, guide link and a customer-specific code. The three shared links are intentionally blank until the owner supplies them. Configure in Team and Settings. The copy-message button requires the access/guide links and a code, avoiding incomplete delivery messages. Copying does not send or mark delivered. Staff records LINE identity and marks sent only after actual delivery. No LINE API, license generation, automatic activation, renewal, or expiry engine is connected.

## UX

Local Sarabun fonts (OFL license shipped), 18px body and 16px minimum secondary labels, optional persistent 21px large-text mode. Minimum 50px buttons. Centered page container, cards instead of a wide order table, role-specific Thai menus with emoji, global server-side search and 50-row pagination. Phone/desktop layouts verified at 320, 390 and 1280 pixels. Tracking configuration remains owner-only; the unnecessary UTM link builder is removed from the active UI.

## Verification

- Deno type check, JS syntax checks, git whitespace check.
- API integration: five logins, permission denial, claiming and stale revision rejection, cross-agent isolation, all four prices, COD versus transfer accounting, duplicate active plan rejection, private slip review, global duplicate slip prevention, paid-before-delivery gate, callbacks and QA exclusion.
- Database transaction tests rolled back: DHL snapshot COD 490, lock after export, atomic COD addon receipt, no duplicate revenue, actual receipt date across older orders, and split transfer refund reconciliation.
- Test orders were inserted as `is_test=true` from the start, never sent to DHL and never messaged. Browser fixture list interception was local to the test browser; production list visibility was unchanged. Proof and test reports are in ignored `qa-runs/`.
- RLS and function grants checked. New private tables intentionally have no public policies; only service-role endpoint access. Advisor warnings on other product tables were left untouched.

## Deployment

Apply the three new migrations in chronological order; deploy book-store with index.ts, crm.ts and addresses.json and custom session authentication (`verify_jwt=false` as before). Publish static HTML/CSS/JS and Vercel rewrites together. Retain `/book-admin`, `/ai-book` and `/promptbook` paths.
