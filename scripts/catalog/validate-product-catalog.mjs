import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  CATALOG_CATEGORY_DEFINITIONS,
  CATALOG_GROUP_DEFINITIONS,
  CATALOG_SCHEMA_VERSION,
  DEFAULT_RANKED_TARGET,
  DEFAULT_RESERVE_TARGET,
  forbiddenPublicText,
  hasControlledPublicClaim,
  hasListingPriceNoise,
  hasPublicPromoNoise,
  hasUppercaseCodNoise,
  isActiveCleaningProduct,
  isUnsafeAutomotiveText,
  makeSearchText,
} from './sellable-catalog-lib.mjs';

function parseArgs(argv) {
  const args = {
    catalog: resolve('data', 'products', 'catalog.json'),
    reserve: resolve('data', 'products', 'catalog-reserve.json'),
    runtimeModule: resolve('api', '_gen3-products.js'),
    rankedTarget: DEFAULT_RANKED_TARGET,
    reserveTarget: DEFAULT_RESERVE_TARGET,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--catalog') args.catalog = resolve(next), index += 1;
    else if (value === '--reserve') args.reserve = resolve(next), index += 1;
    else if (value === '--runtime-module') args.runtimeModule = resolve(next), index += 1;
    else if (value === '--ranked-target') args.rankedTarget = Number(next), index += 1;
    else if (value === '--reserve-target') args.reserveTarget = Number(next), index += 1;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const CATEGORY_BY_KEY = new Map(CATALOG_CATEGORY_DEFINITIONS.map((definition) => [definition.key, definition]));
const GROUP_BY_KEY = new Map(CATALOG_GROUP_DEFINITIONS.map((definition) => [definition.key, definition.label]));
const REASON_CODES = new Set([
  'high-cumulative-sales', 'strong-cumulative-sales', 'established-sales-signal',
  'high-rating', 'official-shop', 'preferred-shop', 'high-like-signal',
  'season-fit', 'clear-fixed-price',
]);
const CONTROLLED_GROUPS = new Set(['automotive', 'beauty', 'supplements']);
const ALLOWED_PRODUCT_KEYS = new Set([
  'rank', 'reserveOrder', 'id', 'categoryGroupKey', 'categoryGroup', 'categoryKey', 'category',
  'subcategoryKey', 'subcategory', 'imageUrl', 'cleanName', 'summary', 'priceMin', 'priceMax',
  'priceType', 'checkedAt', 'productUrl', 'shopId', 'itemId', 'itemSold', 'rating', 'likes',
  'shopRating', 'shopType', 'sellerVerified', 'stockStatus', 'stockLevel', 'riskTier',
  'reviewStatus', 'reviewMethod', 'recommendationScore', 'reasonCodes', 'seasonTags',
  'monthTags', 'seasonalScore', 'seasonReason', 'normalizedSearchText',
]);
const REQUIRED_COMMON_KEYS = [...ALLOWED_PRODUCT_KEYS].filter((key) => key !== 'rank' && key !== 'reserveOrder');

function validHttps(value, hosts) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function titleFingerprint(value) {
  return String(value).normalize('NFKC').toLocaleLowerCase('th-TH')
    .replace(/\b(?:สี|color)\s*[\p{L}\p{N}-]+/giu, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:ชิ้น|pcs?|cm|mm|ml|g|kg)\b/giu, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function validateProduct(product, kind, expectedOrder) {
  const id = `${kind}[${expectedOrder}]`;
  const keys = Object.keys(product);
  for (const key of REQUIRED_COMMON_KEYS) assert(Object.hasOwn(product, key), `${id}: missing ${key}`);
  for (const key of keys) assert(ALLOWED_PRODUCT_KEYS.has(key), `${id}: unexpected field ${key}`);
  if (kind === 'ranked') {
    assert(product.rank === expectedOrder && !Object.hasOwn(product, 'reserveOrder'), `${id}: invalid rank`);
  } else {
    assert(product.reserveOrder === expectedOrder && !Object.hasOwn(product, 'rank'), `${id}: invalid reserve order`);
  }
  assert(/^\d+-\d+$/u.test(product.id) && product.id === `${product.shopId}-${product.itemId}`, `${id}: invalid ID`);
  const definition = CATEGORY_BY_KEY.get(product.categoryKey);
  assert(definition, `${id}: unknown category ${product.categoryKey}`);
  assert(product.category === definition.label && product.subcategoryKey === definition.key && product.subcategory === definition.label, `${id}: category/subcategory mismatch`);
  assert(product.categoryGroupKey === definition.groupKey && product.categoryGroup === definition.group && GROUP_BY_KEY.get(product.categoryGroupKey) === product.categoryGroup, `${id}: group hierarchy mismatch`);
  assert(validHttps(product.imageUrl, ['susercontent.com', 'shopee.co.th']), `${id}: invalid image URL`);
  assert(product.productUrl === `https://shopee.co.th/product/${product.shopId}/${product.itemId}`, `${id}: non-canonical product URL`);
  assert(typeof product.cleanName === 'string' && product.cleanName.length >= 8 && product.cleanName.length <= 105 && !/[\n\r\\<>#*`]/u.test(product.cleanName), `${id}: invalid clean name`);
  assert(!hasPublicPromoNoise(product.cleanName), `${id}: clean name still contains promotion/coupon noise`);
  assert(!hasListingPriceNoise(product.cleanName), `${id}: clean name still contains listing-price/order noise`);
  assert(!hasUppercaseCodNoise(product.cleanName), `${id}: clean name still contains a glued COD marker`);
  assert(typeof product.summary === 'string' && product.summary.length >= 45 && product.summary.length <= 190 && !/[\n\r\\#*`]/u.test(product.summary), `${id}: invalid summary`);
  assert(!hasPublicPromoNoise(product.summary), `${id}: summary still contains promotion/coupon noise`);
  assert(!hasListingPriceNoise(product.summary), `${id}: summary still contains listing-price/order noise`);
  assert(!hasUppercaseCodNoise(product.summary), `${id}: summary still contains a glued COD marker`);
  assert(!forbiddenPublicText(`${product.cleanName} ${product.summary}`), `${id}: public text contains a blocked claim or product`);
  assert(!isActiveCleaningProduct(product.cleanName), `${id}: active cleaner/disinfectant leaked public`);
  assert(Number.isFinite(product.priceMin) && Number.isFinite(product.priceMax) && product.priceMin >= 10 && product.priceMax >= product.priceMin, `${id}: invalid price range`);
  assert(product.priceType === (product.priceMin === product.priceMax ? 'fixed' : 'range'), `${id}: price type mismatch`);
  assert(product.priceMax / product.priceMin <= (product.riskTier === 'amber' ? 5 : 8), `${id}: price-bait range`);
  assert(!Number.isNaN(Date.parse(product.checkedAt)), `${id}: invalid checked time`);
  assert(Number.isInteger(product.itemSold) && product.itemSold >= 0, `${id}: invalid cumulative sold count`);
  assert(Number.isInteger(product.likes) && product.likes >= 0, `${id}: invalid likes`);
  assert(Number.isFinite(product.rating) && product.rating >= (product.riskTier === 'amber' ? 4.7 : 4.5) && product.rating <= 5, `${id}: invalid rating`);
  assert(Number.isFinite(product.shopRating) && product.shopRating >= (product.riskTier === 'amber' ? 4.6 : 4.4) && product.shopRating <= 5, `${id}: invalid shop rating`);
  assert(['official', 'preferred', 'general'].includes(product.shopType), `${id}: invalid shop type`);
  assert(typeof product.sellerVerified === 'boolean', `${id}: invalid seller verification flag`);
  assert(product.stockStatus === 'in-stock' && ['low', 'available', 'high'].includes(product.stockLevel), `${id}: invalid sanitized stock metadata`);
  assert(['green', 'amber'].includes(product.riskTier), `${id}: red/unknown risk lane leaked public`);
  assert(product.riskTier === (CONTROLLED_GROUPS.has(product.categoryGroupKey) ? 'amber' : 'green'), `${id}: risk lane/category mismatch`);
  const expectedReviewMethod = product.riskTier === 'amber' ? 'automated-controlled-policy-v3' : 'automated-ruleset-v3';
  assert(product.reviewStatus === 'approved' && product.reviewMethod === expectedReviewMethod, `${id}: unapproved or incorrectly reviewed product leaked public`);
  assert(Number.isFinite(product.recommendationScore) && product.recommendationScore >= 0 && product.recommendationScore <= 100, `${id}: invalid recommendation score`);
  assert(Array.isArray(product.reasonCodes) && product.reasonCodes.length >= 1 && product.reasonCodes.length <= 4 && product.reasonCodes.every((reason) => REASON_CODES.has(reason)), `${id}: invalid reason codes`);
  assert(Array.isArray(product.seasonTags) && product.seasonTags.length >= 1 && product.seasonTags.every((tag) => ['all-year', 'hot', 'rainy', 'cool'].includes(tag)), `${id}: invalid season tags`);
  assert(Array.isArray(product.monthTags) && product.monthTags.every((month) => Number.isInteger(month) && month >= 1 && month <= 12), `${id}: invalid month tags`);
  assert(Number.isFinite(product.seasonalScore) && product.seasonalScore >= 0 && product.seasonalScore <= 100 && typeof product.seasonReason === 'string', `${id}: invalid seasonal metadata`);
  assert(product.normalizedSearchText === makeSearchText(product) && product.normalizedSearchText.length >= product.category.length, `${id}: stale normalized search text`);
  if (product.categoryGroupKey === 'supplements') {
    assert(!hasControlledPublicClaim(product.categoryGroupKey, product.cleanName), `${id}: supplement name contains an efficacy/safety claim`);
    assert(product.shopType !== 'general', `${id}: controlled supplement is not from official/preferred shop`);
    assert(/โปรดตรวจสอบส่วนประกอบ/u.test(product.summary), `${id}: supplement summary is not neutral label guidance`);
  }
  if (product.categoryGroupKey === 'beauty') {
    assert(!hasControlledPublicClaim(product.categoryGroupKey, product.cleanName), `${id}: beauty name contains an efficacy/safety claim`);
    assert(/โปรดตรวจสอบสูตร/u.test(product.summary), `${id}: beauty summary is not neutral label guidance`);
    assert(!/(?:spf\s*\d+|pa\s*\+)/iu.test(`${product.cleanName} ${product.summary}`), `${id}: unsupported SPF/PA claim leaked public`);
  }
  if (product.categoryGroupKey === 'automotive') {
    assert(!isUnsafeAutomotiveText(product.cleanName), `${id}: safety-critical automotive product leaked public`);
    assert(!hasControlledPublicClaim(product.categoryGroupKey, product.cleanName), `${id}: automotive name contains an unsupported claim`);
    assert(/ตรวจสอบรุ่นรถ/u.test(product.summary), `${id}: automotive fitment safeguard is missing`);
  }
}

const args = parseArgs(process.argv.slice(2));
const [catalogText, reserveText, runtimeText] = await Promise.all([
  readFile(args.catalog, 'utf8'), readFile(args.reserve, 'utf8'), readFile(args.runtimeModule, 'utf8'),
]);
for (const [name, text] of [['catalog', catalogText], ['reserve', reserveText], ['runtime', runtimeText]]) {
  assert(!text.includes('\0'), `${name}: contains NUL`);
  assert(!/(?:commission|extra\s*_?comm|review\s*_?count|"reviewCount"|"description"\s*:)/iu.test(text), `${name}: contains commission, invented review count, or raw description`);
  assert(!/"stock"\s*:/u.test(text), `${name}: exposes raw stock count`);
}

const catalog = JSON.parse(catalogText);
const reserveCatalog = JSON.parse(reserveText);
assert(catalog.schemaVersion === CATALOG_SCHEMA_VERSION && reserveCatalog.schemaVersion === CATALOG_SCHEMA_VERSION, 'schema version mismatch');
assert(catalog.catalogName === 'คลังสินค้าน่าขาย', 'catalog name mismatch');
assert(catalog.targetRankedCount === args.rankedTarget && catalog.rankedCount === args.rankedTarget && catalog.ranked.length === args.rankedTarget, 'ranked target/count mismatch');
assert(catalog.targetReserveCount === args.reserveTarget && catalog.reserveCount === args.reserveTarget && reserveCatalog.reserve.length === args.reserveTarget, 'reserve target/count mismatch');
assert(catalog.selectionStatus === 'target-met', 'catalog target was not met');
assert(catalog.featured?.id === 'featured-dkub-book' && catalog.featured.rank === undefined && catalog.featured.reserveOrder === undefined, 'featured book must stay outside ranking');
assert(!Number.isNaN(Date.parse(catalog.generatedAt)) && !Number.isNaN(Date.parse(catalog.sourceCheckedAt)), 'catalog timestamps invalid');

catalog.ranked.forEach((product, index) => validateProduct(product, 'ranked', index + 1));
reserveCatalog.reserve.forEach((product, index) => validateProduct(product, 'reserve', index + 1));
const all = [...catalog.ranked, ...reserveCatalog.reserve];
assert(new Set(all.map((product) => product.id)).size === all.length, 'duplicate product IDs across ranked/reserve');
assert(new Set(all.map((product) => new URL(product.imageUrl).pathname.split('/').filter(Boolean).at(-1))).size === all.length, 'duplicate image IDs across ranked/reserve');
assert(new Set(all.map((product) => titleFingerprint(product.cleanName))).size === all.length, 'duplicate normalized product names across ranked/reserve');
const uniqueSummaries = new Set(all.map((product) => product.summary));
assert(uniqueSummaries.size >= Math.floor(all.length * 0.95), 'summaries are mostly repeated generic templates instead of product-specific facts');
const summaryCounts = all.reduce((counts, product) => counts.set(product.summary, (counts.get(product.summary) ?? 0) + 1), new Map());
assert(Math.max(...summaryCounts.values()) <= 5, 'a generic summary template is repeated too many times');
const rankedShopCounts = catalog.ranked.reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map());
const allShopCounts = all.reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map());
assert(Math.max(...rankedShopCounts.values()) <= 6, 'ranked per-shop cap exceeded');
assert(Math.max(...allShopCounts.values()) <= 15, 'ranked/reserve per-shop cap exceeded');
const selectedCategories = new Set(catalog.ranked.map((product) => product.categoryKey));
assert(CATALOG_CATEGORY_DEFINITIONS.length === 40 && selectedCategories.size >= 30 && selectedCategories.size <= 40, 'catalog does not provide the planned 30-40-category taxonomy');
const automotiveCount = catalog.ranked.filter((product) => product.categoryGroupKey === 'automotive').length;
const skincareCount = catalog.ranked.filter((product) => product.categoryGroupKey === 'beauty').length;
const supplementCount = catalog.ranked.filter((product) => product.categoryGroupKey === 'supplements').length;
const targetScale = args.rankedTarget / DEFAULT_RANKED_TARGET;
assert(automotiveCount >= Math.max(10, Math.floor(100 * targetScale)), 'automotive inventory is still too small');
// Safety-first floor: strict source/claim/expiry gates take precedence over category volume.
assert(skincareCount >= Math.max(8, Math.floor(80 * targetScale)), 'strict-gated skincare inventory is too small');
// Strict controlled-source gates intentionally leave a narrow supplement subset.
// Safety wins over the former 100-item target; never relax claims to inflate count.
assert(supplementCount >= Math.max(2, Math.floor(20 * targetScale)), 'strict-gated supplement inventory is too small');
assert(!all.some((product) => product.id === `${catalog.featured.shopId}-${catalog.featured.itemId}`), 'featured book leaked into ranked/reserve');

const runtimeUrl = `${pathToFileURL(args.runtimeModule).href}?validation=${Date.now()}`;
const runtime = (await import(runtimeUrl)).default;
assert(runtime.schemaVersion === CATALOG_SCHEMA_VERSION, 'runtime schema mismatch');
assert(JSON.stringify(runtime.ranked) === JSON.stringify(catalog.ranked), 'runtime ranked payload differs from catalog JSON');
assert(JSON.stringify(runtime.reserve) === JSON.stringify(reserveCatalog.reserve), 'runtime reserve payload differs from reserve JSON');
assert(JSON.stringify(runtime.featured) === JSON.stringify(catalog.featured), 'runtime featured payload differs from catalog JSON');

process.stdout.write(`${JSON.stringify({
  status: 'valid',
  schemaVersion: CATALOG_SCHEMA_VERSION,
  rankedCount: catalog.ranked.length,
  reserveCount: reserveCatalog.reserve.length,
  categoryCount: selectedCategories.size,
  groupCount: new Set(catalog.ranked.map((product) => product.categoryGroupKey)).size,
  automotiveCount,
  skincareCount,
  supplementCount,
  approvedPublicCount: all.filter((product) => product.reviewStatus === 'approved').length,
  uniqueProductCount: new Set(all.map((product) => product.id)).size,
  sourceCheckedAt: catalog.sourceCheckedAt,
}, null, 2)}\n`);
