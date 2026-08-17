# Product catalog data contract

The catalog is built offline from the Shopee Product Feed. The feed is streamed one logical CSV row at a time and is never loaded into browser memory or deployment output.

Run from the repository root:

```powershell
npm run build:catalog
npm run validate:catalog
```

The production defaults are a dynamic catalog target of 2,000 ranked products plus 300 unranked reserves. The build declares a 1,500-product safety floor and never relaxes rating, content, price, category, or deduplication gates to fill a shortfall.

Generated artifacts:

- `data/products/catalog.json`: schema-v2 metadata, the unranked featured DKUB book, and ranked products.
- `data/products/catalog-reserve.json`: schema-v2 unranked replacements.
- `data/products/build-report.json`: row counts, filtering diagnostics, category totals, month/season totals, and internal seasonal rule traces; it contains no raw descriptions.
- `api/_gen3-products.js`: generated gzip-compressed CommonJS payload for authenticated, filtered, paginated server endpoints. It expands server-side; browsers receive only the requested page.

Ranked product contract:

```json
{
  "rank": 1,
  "id": "SHOP_ID-ITEM_ID",
  "categoryKey": "organizing",
  "category": "อุปกรณ์จัดระเบียบและจัดเก็บ",
  "imageUrl": "https://...susercontent.com/...",
  "cleanName": "ชื่อสินค้าแบบอ่านง่าย",
  "summary": "รายละเอียดสรุปไม่เกิน 170 ตัวอักษร",
  "priceMin": 59,
  "priceMax": 129,
  "checkedAt": "2026-08-17T05:31:45+07:00",
  "productUrl": "https://shopee.co.th/product/SHOP_ID/ITEM_ID",
  "seasonTags": ["rainy"],
  "monthTags": [6, 7, 8, 9, 10],
  "seasonalScore": 88,
  "seasonReason": "เหมาะทำคอนเทนต์เรื่องจัดการงานซักและตากผ้าในช่วงฝน",
  "shopId": "SHOP_ID",
  "itemId": "ITEM_ID"
}
```

`seasonTags` accepts `all-year`, `hot`, `rainy`, and `cool`. All-year products use an empty `monthTags` array. Seasonal month mappings use hot = March-May, rainy = June-October, and cool = November-February; separate deterministic merchandising rules may tag opening-school or holiday months.

New higher-risk departments such as vehicle accessories, manual tools, physical books, and non-electric device accessories are admitted only through exact Shopee category-path allowlists plus product-family allowlists and deny rules. Broad department access is not permitted.

Reserve products replace `rank` with `reserveOrder`. The featured DKUB book lives at `catalog.featured`, has no rank, is tagged `all-year`, and is never counted in the ranked total.

No generated catalog or runtime output may contain raw descriptions, commission fields, affiliate links, internal seasonal rule IDs, or the original 4 GB feed.
