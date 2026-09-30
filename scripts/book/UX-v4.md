# AI book checkout usability revision, 30 September 2026

User requested larger readable text, compact package choices, transfer before COD, the TTB logo, and a detailed independent agent audit before delivery.

## Changes

- Main body/form text 18 to 22px; secondary explanations and controls 16px minimum. Increased line spacing and darker muted text. Brand subtitle is 14px. Thai book screenshots retain their original text and the enlarge dialog.
- Two native radio rows with the package difference, price and free delivery. Whole rows are clickable; selected state includes text and a keyboard focus outline. The shared lesson bonus is stated once below both choices.
- Transfer is first and selected for a fresh visit. A customer's saved COD choice is preserved. TTB logo in the payment option and bank details.
- Bank details and QR precede upload on mobile. Instructions explain using one phone and returning to the same tab. Thai file picker label, local preview and inline validation before any order request.
- Address selection announces completion, supports Enter/Escape, saves all filled address fields, and keeps province/district controls full width on small screens.
- Floating order link hides while checkout is visible. Totals announce changes to assistive technology.

## Independent agent review

Read-only review of HTML, all existing CSS, store.js and media-v2.js. Eight findings covered typography, package hierarchy, initial payment state, transfer sequence, address feedback, inline slip errors, floating CTA overlap and keyboard behavior. Incorporated the relevant changes. A second review found two draft races: asynchronous address loading could reset a recently changed package/payment, and early edits could replace saved address data with blank selects. Both corrected. Final code review found no remaining blockers; this is not a formal accessibility certification.

## Verification

- Node syntax check and git diff whitespace checks pass.
- Visual checks at 320px, 390px and 1280px. No horizontal document or checkout overflow at the two phone sizes. 390px package rows approximately 123/140px tall.
- Computed mobile styles verified: input 20px, field labels 19px, helper/privacy/review hints 16px, file picker input 17px.
- Fresh transfer default, bundle price 490, switch COD hides bank panel, reload preserves COD/bundle, transfer reload preserves address and reminds to attach slip again.
- Address Enter selects and fills all four address fields, announces completion, closes list and focuses province for checking.
- Missing slip stops before order creation and focuses upload. Invalid text file is rejected inline. Local test image displays preview and clears invalid state. No order was submitted during this revision.
- Slow local fixture delayed addresses by 8 seconds: restored bundle/transfer, switched to book/COD while province had only its placeholder, reloaded again before addresses arrived. On completion, book/COD remained selected and all four saved address values were preserved.
- Existing image/video modal and payment QR asset are unchanged. No database/admin modifications.

## Asset source

`book-assets/ttb-logo-v4.png`: exact official bank asset https://www.ttbbank.com/global/assets/img/media-img/logo-default.png discovered from https://www.ttbbank.com/th on 2026-09-30. Used to identify the receiving bank only.
