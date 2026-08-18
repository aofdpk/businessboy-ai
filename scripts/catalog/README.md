# Product catalog data contract

The catalog is built offline from the Shopee Product Feed. The feed is streamed one logical CSV row at a time and is never loaded into browser memory or deployment output.

Run from the repository root:

```powershell
npm run build:catalog
npm run validate:catalog
```

The production defaults are 20,000 ranked products plus 2,000 unranked reserves. The build declares an 18,000-product safety floor and never relaxes rating, content, price, category, or deduplication gates to fill a shortfall.

Generated artifacts:

- `data/products/catalog.json`: schema-v4 metadata, the unranked featured DKUB book, and ranked products.
- `data/products/catalog-reserve.json`: schema-v4 unranked replacements.
- `data/products/build-report.json`: row counts, filtering diagnostics, category totals, month/season/campaign totals, and quality checks; it contains no raw descriptions.
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
  "metadataVersion": "seasonal-v4",
  "evergreen": false,
  "seasonTags": ["rainy"],
  "seasonScores": { "hot": 0, "rainy": 94, "cool": 0 },
  "seasonReasons": { "rainy": ["เป็นอุปกรณ์กันฝนหรือกันน้ำที่มีความเกี่ยวข้องโดยตรงกับฤดูฝน"] },
  "monthTags": [5, 6, 7, 8, 9, 10],
  "monthScores": { "5": 90, "6": 85, "7": 96, "8": 94, "9": 86, "10": 56 },
  "monthReasons": { "5": ["เริ่มเตรียมรับฤดูฝนในเดือนพฤษภาคม"] },
  "campaignTags": ["rainy-season-prep", "rain-drying-water-management"],
  "seasonalScore": 96,
  "seasonReason": "เหมาะกับการจัดการฝน งานตากผ้า และน้ำบนพื้นในเดือนกรกฎาคม",
  "shopId": "SHOP_ID",
  "itemId": "ITEM_ID"
}
```

Seasonal metadata v4 separates three concepts. `evergreen` means the product has no product-specific climate match. `seasonTags` contains exact climate matches (`hot`, `rainy`, `cool`) or the compatibility value `all-year`. `monthTags` contains only precomputed peak months that have a positive `monthScores` entry; an evergreen product may still have campaign peaks. Runtime month filtering adds evergreen products as fallback instead of fabricating twelve peak tags.

Climate windows include transition months: hot = February-May, rainy = May-October, and cool = October-February. Exact category plus product-token rules determine relevance; category-key substrings never create a match. For example, `Samsung` does not match sun, household tissue does not match school, and a generic cleaning brush does not match rainy.

The deterministic campaign plan covers New Year organizing/planners, explicit Valentine gifts, summer travel preparation, Songkran waterproof items, term 1 and term 2 school preparation, rainy-season preparation and water management, explicit Mother's Day gifts, indoor organizing, year-end gifts, and travel/camping peaks. Marketplace-number campaigns and movable holidays are deliberately excluded. The active engine and golden fixtures live in `seasonal-metadata-v4.mjs`; both a future full-feed build and the retag-only command call the same exported function.

To upgrade a frozen selected catalog without rescanning or changing product selection, run `npm run retag:catalog`. The command asserts that ranked/reserve IDs, order, and every non-seasonal product field remain identical, then updates `catalog.json`, `catalog-reserve.json`, `build-report.json`, and the compressed runtime module.

New higher-risk departments such as vehicle accessories, manual tools, physical books, and non-electric device accessories are admitted only through exact Shopee category-path allowlists plus product-family allowlists and deny rules. Broad department access is not permitted.

Reserve products replace `rank` with `reserveOrder`. The featured DKUB book lives at `catalog.featured`, has no rank, is tagged `all-year`, and is never counted in the ranked total.

No generated catalog or runtime output may contain raw descriptions, commission fields, affiliate links, internal seasonal rule IDs, or the original 4 GB feed.
