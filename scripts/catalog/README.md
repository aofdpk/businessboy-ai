# Product catalog data contract

The catalog is built offline from the Shopee Product Feed. The feed is streamed one logical CSV row at a time and is never loaded into browser memory or deployment output.

Run from the repository root:

```powershell
npm run build:catalog
npm run validate:catalog
```

Generated artifacts:

- `data/products/catalog.json`: metadata, the unranked featured DKUB book, and 500 ranked products.
- `data/products/catalog-reserve.json`: 100 unranked replacements.
- `data/products/build-report.json`: row counts and filtering diagnostics; it contains no raw descriptions.
- `api/_gen3-products.js`: generated CommonJS payload used by authenticated serverless endpoints.

Ranked product contract:

```json
{
  "rank": 1,
  "id": "SHOP_ID-ITEM_ID",
  "category": "ของใช้ในบ้าน",
  "imageUrl": "https://...susercontent.com/...",
  "cleanName": "ชื่อสินค้าแบบอ่านง่าย",
  "summary": "รายละเอียดสรุปไม่เกิน 180 ตัวอักษร",
  "priceMin": 59,
  "priceMax": 129,
  "checkedAt": "2026-08-17T05:31:45+07:00",
  "productUrl": "https://shopee.co.th/product/SHOP_ID/ITEM_ID",
  "shopId": "SHOP_ID",
  "itemId": "ITEM_ID"
}
```

Reserve products replace `rank` with `reserveOrder`. The featured book lives at `catalog.featured`, has no rank, and is never counted in the Top 500.

No output may contain raw descriptions, commission fields, affiliate links, or the original 4 GB feed.
