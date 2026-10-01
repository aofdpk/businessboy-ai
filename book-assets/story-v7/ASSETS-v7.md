# AI book image story v7

Created 2026-10-01 using the built-in imagegen tool. Final web assets are `book-assets/story-v7/panel-01.webp` through `panel-09.webp`. Source image references, dimensions, sizes and SHA-256 hashes are in `scripts/book/story-v7-sources.json`. The nine panels total 1,398,404 bytes. WebP conversion changes format only; Thai lettering was not patched programmatically.

## Final prompt set / art direction

Shared direction: a centered Thai direct-response sales narrative, navy/gold/ivory, warm and approachable for older beginners. Large Thai headlines and very short supporting copy. One idea per panel. Preserve the supplied real book cover and author identity where referenced. No fabricated testimonials, earnings, countdowns, scarce stock, guarantees, bank QR, or website credentials. Generated scenes illustrate the learning process, not customer results. Book pages and reviews are separate original images.

1. Pain: a Thai woman around 50 at a laptop, mildly puzzled but capable. Headline: อยากทำคลิป AI ปักตะกร้า แต่ไม่รู้จะเริ่มตรงไหน? Three pain points: ไม่รู้จะทำช่องเรื่องอะไร / ไม่รู้ต้องใช้ AI ตัวไหนก่อน / ไม่รู้จะเขียนคำสั่งอย่างไร.
2. Sequence: ดูหลายคลิปแล้ว แต่ยังเรียงขั้นตอนไม่ถูก? Four large steps: คิดแนวช่อง / เตรียมคำสั่ง / สร้างภาพและคลิป / ตัดต่อ. Show an understandable visual sequence, not a crowded software dashboard.
3. Product: preserve the real supplied cover on a physical book. รวมวิธีทำไว้ในเล่มเดียว เปิดอ่านแล้วลองทำทีละขั้น. 256 หน้า, 26 บท, QR ดูคลิปสอนฟรี. หนังสือ 1 เล่ม 345 บาท ส่งฟรีทั่วไทย.
4. Contents introduction: จากยังไม่มีแนวช่อง สู่ขั้นตอนทำคลิปขายของ. วางแนวช่อง / เขียนคำสั่ง / สร้างภาพและคลิป / ทำคลิปขายของ / ตัดต่อพร้อมโพสต์. Direct viewers to tap the real table-of-contents images below. Do not fabricate book pages.
5. Sample introduction: มีตัวอย่างให้ดู มีขั้นตอนให้ลองทำตาม. คิดแนวช่อง / ทำคลิปขายของ / เปิดคลิปให้น่าสนใจ. Short landscape panel above three actual page samples.
6. Included lessons: อ่านแล้วอยากเห็นวิธีทำ? สแกน QR ดูคลิปสอนฟรี มูลค่า 3,990 บาท รับฟรีทั้งสองแพ็ก. Final revision uses a closed real-cover book and a conceptual phone lesson illustration. No fabricated open pages, instructor thumbnail, playable video button or scannable invented QR.
7. Prompt option: ไม่อยากพิมพ์คำสั่งเอง? เพิ่ม 145 บาท มีเว็บให้กดคัดลอก. หนังสือพร้อมเว็บ Prompt 490 บาท ส่งฟรี. พร้อมใบ QR รหัสเข้าเว็บ และวิธีใช้. Conceptual laptop/book illustration followed on the page by a separate real website screenshot.
8. Author: preserve the supplied author photograph identity. ผู้เขียนหนังสือเล่มนี้ อ๊อฟ เด็กประกอบการ. ผู้เรียนพูดถึงการสอนของอ๊อฟ. Original review screenshots appear separately below; no generated quotes or ratings.
9. Offer: เลือกแบบที่สะดวก ส่งฟรีทั้งสองแพ็ก. หนังสือ 1 เล่ม 345 บาท / หนังสือพร้อมเว็บ Prompt 490 บาท. Both include QR lessons valued 3,990 บาท. Final revision removes the AI brand logo and uses a gift symbol instead of a play button.

## Original evidence

- Cover reference: `book-assets/book.jpg`.
- Author reference: `book-assets/author.png`.
- Actual pages: `page-12-v3.png`, `page-13-v3.png`, `page-35-v3.png`, `page-102-v2.png`, `page-223-v3.png` in `book-assets`.
- Original learner comments: `review-natty-v2.png`, `review-lalitaporn-v2.png`, `review-pareenart-v2.png` in `book-assets`. The section identifies them as comments about the author's teaching.
- `prompt-real-v7.png`: an unaltered browser viewport screenshot of the real Prompt site's Workshop section, captured 2026-10-01. It shows the page-35 example and copy button. No access credential is visible.
- User-supplied payment QR and TTB logo remain unchanged in their original assets.

## Verification before deployment

- Inspected all final generated images at full resolution; regenerated the lesson illustration and revised the offer panel before acceptance.
- Browser widths 320, 390 and 1280: no horizontal overflow; centered story width capped at 800 px.
- Nine narrative panels; no video or iframe elements.
- Original images open in the same-page dialog; enlarge and close controls work.
- Bundle CTA selects 490 THB; bank amount and submit button follow the selected package.
- Transfer and COD toggle correctly; transfer remains the default and first choice.
- Address search fills all four fields; selected address is summarized; reload restores the draft.
- Manual address editing and incomplete-field validation work, including opening the collapsed section and focusing the missing field.
- Optional note disclosure and required recipient-field validation work.
- All visible image assets load; no browser console errors observed.
- JavaScript syntax and Git whitespace checks pass. No real order was submitted during these browser tests. Backend and admin were not changed.

Local proof screenshots are under ignored `qa-runs/book/`. Production verification is performed after the deployment reaches READY.
