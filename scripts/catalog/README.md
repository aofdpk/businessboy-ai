# Product catalog data contract

The catalog is built offline from the Shopee Product Feed. The builder streams one logical CSV row at a time; the source feed is never loaded into browser memory and is never included in deployment output.

Run from the repository root:

```powershell
npm run build:catalog
npm run validate:catalog
```

Production schema v5 selects 60,000 ranked approved products, a representative 20,000-product bundled fallback, and 6,000 offline reserves. `approved` means that a listing passed the current automated policy and controlled-category gates. It does **not** mean that a person manually reviewed or endorsed the product.

## Taxonomy v5

Every product has exactly one canonical three-level taxonomy path:

- `categoryGroupKey` / `categoryGroup`: one of 16 top-level groups.
- `categoryKey` / `category`: one of 60 middle categories.
- `subcategoryKey` / `subcategory`: one of 167 leaf categories.

The full definitions are embedded in the full and fallback catalogs. Schema v5 adds food, detailed fashion, passive agriculture and gardening, religious items, makeup and cosmetics, pet food, appliances, baby and family items, and shop supplies. Fashion uses canonical leaves while the allowlisted public `merchandisingTags` array supplies the overlapping quick filters `fashion-sleepwear`, `fashion-plus-size`, and `fashion-office`. Internal rule IDs are never exported.

## Generated artifacts

- `data/products/catalog-full.json.gz`: deterministic gzip containing the complete 60,000 ranked approved catalog. Its uncompressed JSON is compact and ends with one newline; gzip uses a zero timestamp.
- `data/products/catalog.json`: compact 20,000-product stratified fallback. It is a subset of the full catalog, preserves relative full-catalog order, and is re-ranked locally from 1 through 20,000. No `fullRank` field is exposed.
- `data/products/catalog-reserve.json`: compact offline reserve with 6,000 products ordered by `reserveOrder`. Reserve records are not shipped in the runtime module.
- `data/products/build-report.json`: human-readable census, rejection, hierarchy, cohort, merchandising-tag, month, season, quality, count, size, and hash diagnostics. Hierarchy count objects include zeroes so all 16 groups, 60 categories, and 167 leaves remain auditable.
- `data/products/catalog-manifest.json`: schema/version metadata plus exact paths, counts, byte sizes, and SHA-256 hashes for the full gzip, fallback, reserve, and report.
- `api/_gen3-products.js`: generated CommonJS payload containing only the bundled fallback and featured book for authenticated, filtered, paginated server endpoints. Browsers receive only the requested page.

Each tracked catalog artifact must remain below 95 MiB. The complete 60,000-product plain JSON is deliberately not tracked; import/export jobs consume `catalog-full.json.gz` and verify it against the manifest.

## Public product contract

Ranked products retain stable `SHOP_ID-ITEM_ID` IDs and public fields such as:

```json
{
  "rank": 1,
  "id": "SHOP_ID-ITEM_ID",
  "categoryGroupKey": "fashion",
  "categoryGroup": "แฟชั่นและเครื่องแต่งกาย",
  "categoryKey": "women-clothing",
  "category": "เสื้อผ้าผู้หญิง",
  "subcategoryKey": "women-dresses",
  "subcategory": "เดรสผู้หญิง",
  "merchandisingTags": ["fashion-plus-size", "fashion-office"],
  "imageUrl": "https://...susercontent.com/...",
  "cleanName": "ชื่อสินค้าแบบอ่านง่าย",
  "summary": "สรุปข้อมูลที่ตรวจสอบได้จากชื่อ หมวด ราคา และคุณภาพร้าน โดยไม่แต่งสรรพคุณ",
  "priceMin": 199,
  "priceMax": 399,
  "checkedAt": "2026-08-17T05:31:45+07:00",
  "productUrl": "https://shopee.co.th/product/SHOP_ID/ITEM_ID",
  "metadataVersion": "seasonal-v4",
  "evergreen": true,
  "seasonTags": ["all-year"],
  "monthTags": [],
  "campaignTags": [],
  "shopId": "SHOP_ID",
  "itemId": "ITEM_ID",
  "reviewStatus": "approved",
  "reviewMethod": "automated-ruleset-v5"
}
```

Summaries must be neutral, 45–190 characters long, and grounded in public listing facts. Controlled cohorts use their required verification wording. The artifacts contain no raw descriptions, commission fields, affiliate links, raw source IDs, internal taxonomy or seasonal rule IDs, unsupported stock claims, or invented review counts.

## Safety and selection

Selection applies exact category-path admission, product-family allowlists, deny rules, price/rating/shop gates, stable ID/image/title deduplication, and per-shop caps before quota filling. Automotive, skincare, and supplements keep their existing controlled gates. Food, pet food, cosmetics, electrical appliances, child items, actual amulets, and other controlled cohorts add trusted-shop and neutral verification requirements where applicable. Passive agriculture excludes live plants, seeds, agricultural chemicals, blades, powered machinery, and batteries. Religious listings must not claim authenticity, supernatural results, luck, or lottery outcomes.

Group and leaf quotas are ceilings, not permission to weaken a gate. Selection fills safe breadth across groups before overflow, enforces minimum coverage for requested cohorts and fashion tags, and reports actual amulets separately from religious accessories. If a required floor cannot be met, the build fails instead of admitting a rejected product.

The bundled fallback is selected with scaled group/leaf representation instead of taking the first 20,000 full ranks. The full catalog keeps ranks 1–60,000; fallback ranks are local and contiguous. The featured DKUB book lives at `catalog.featured`, has no rank, is tagged `all-year`, and is never counted in ranked or reserve totals.

## Seasonal metadata v4

Schema v5 preserves seasonal metadata v4 and its deterministic 12-month behavior. `evergreen` means that a product has no product-specific climate match. `seasonTags` contains exact climate matches (`hot`, `rainy`, `cool`) or the compatibility value `all-year`. `monthTags` contains only precomputed peak months with positive month scores; runtime month filtering may add evergreen fallback products without fabricating twelve peak tags.

Climate windows include transitions: hot = February–May, rainy = May–October, and cool = October–February. Exact leaf plus product-token rules determine relevance. All three seasons and all twelve months must remain nonempty in both the full catalog and bundled fallback.

## Validate and retag

`npm run validate:catalog` verifies artifact hashes and sizes, schema/taxonomy definitions, product fields, controlled gates, deduplication, per-shop caps, local fallback ranks, fallback/full identity, cohort and tag floors, and month/season coverage. It also asserts that the runtime payload contains no reserve.

To refresh seasonal metadata without rescanning or changing product selection, run:

```powershell
npm run retag:catalog
```

The retag command first verifies the schema-v5 manifest and all input hashes. It retags the full gzip, derives the same fallback IDs with the same local ranks, retags the reserve and featured book, rebuilds deterministic compact artifacts, refreshes report and manifest hashes, and writes a fallback-only runtime module. It fails closed on legacy/incomplete artifacts. Use `--dry-run --skip-runtime` to prove ID/order and non-seasonal-field invariants without writing files.
