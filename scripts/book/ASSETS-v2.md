# AI book visual redesign v2

User-directed redesign, 30 September 2026: centered sales layout, navy/gold palette from `/ai-page-gen4`, playable sample clips and real review screenshots without outbound source links in the sales flow. Checkout and backend remain the existing implementation.

## Sources

- `book-assets/hero-v2.webp`: built-in imagegen, reference `book-assets/book.jpg`; generated original retained in the local generated_images directory. Compressed to WebP for delivery. Product illustration, not a new book edition.
- `book-assets/page-43-v2.png` and `page-102-v2.png`: rendered from the user-owned 256-page book PDF. Printer margins excluded, page content preserved.
- `book-assets/prompt-preview-v2.jpg`: screenshot of the real `/promptbook` workshop UI, captured 2026-09-30. No access code in image.
- Clips and posters reused without alteration from the existing Gen4 page: `/gen4-assets/fad-identity.mp4`, `fad-sales.mp4`, `plus.mp4` and corresponding `.jpg` files. Labeled as examples from BusinessBoy pages, without view or income claims.
- `review-natty-v2.png`: original S02_C1431594682192758, Natty Vega. https://www.facebook.com/thebusinessboythailand/posts/pfbid0aFqXd7XtV3cRtC68Zvh2rPio9v7C8MKqFXJXWg5rDTDcMvWxdZuBizZ7frHCHJtRl?comment_id=1431594682192758
- `review-lalitaporn-v2.png`: original S01_C1065714015937555, Lalitaporn Yajinda. https://www.facebook.com/thebusinessboythailand/posts/pfbid0PhiTsdXJejAvkgkvb9cBzJBmxsBocqBg4aukNViC5gmvn9UNE9Eg3SNUEYW1om9xl?comment_id=1065714015937555
- `review-pareenart-v2.png`: original S01_C3995293090772293, Pareenart Candy Poomprakobsri. https://www.facebook.com/thebusinessboythailand/posts/pfbid0PhiTsdXJejAvkgkvb9cBzJBmxsBocqBg4aukNViC5gmvn9UNE9Eg3SNUEYW1om9xl?comment_id=3995293090772293
- All three review screenshots copied byte-for-byte from `คลังรีวิว/07_reviews_final/04_การสอนเข้าใจง่ายและไม่กั๊ก`, inspected in full. Placement: author section, “ผู้เรียนพูดถึงการสอนของอ๊อฟ”. Source links are documented here rather than displayed on the sales page. They are not represented as book purchase reviews.

## Imagegen prompt

Use case: product-mockup. Create a premium centered hero product photograph for a Thai AI book sales landing page. The reference image is the source of the ACTUAL BOOK COVER only. Preserve that exact book cover design, all its Thai lettering and colors, its author portrait, and its cover proportions. Remove ALL advertising text outside the book from the reference. One single physical book standing upright, front cover almost facing camera with slight elegant perspective, centered on a low dark navy plinth. Midnight navy studio background (#071429) with soft royal-blue halo and subtle warm champagne-gold rim lighting. Spacious calm editorial photography, sophisticated rather than flashy. Realistic white paper edges, soft shadow. A very subtle gold arc in the far background. No extra books, no screens, no extra captions, no logos beyond what is on the original cover, no money, no coins outside cover, no badges. Portrait-leaning square composition. Book fills about 72% of height and is centered. It must look like a real book sold in a premium bookstore, not an abstract technology illustration. Keep every cover word faithful to reference.

## UI checks

- Three video assets play after a deliberate click; no video loads on initial page view. Closing stops playback and releases the source.
- Native dialog traps focus, Escape closes, focus returns to the triggering button. Images have an explicit enlarge toggle for phone reading.
- Product/bank/price data and checkout field IDs unchanged. Bundle CTA sets 490 THB; transfer QR, copy account and slip input preserved.
- Layout checked at desktop and 390px phone size. Headings, product art, content and primary actions center aligned. Form labels stay directly above their inputs for readability.
