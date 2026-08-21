import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';
import {
  CAMPAIGN_RULES, CAMPAIGN_TAGS, CATALOG_CATEGORY_DEFINITIONS, CATALOG_GROUP_DEFINITIONS,
  CATALOG_MERCHANDISING_TAG_DEFINITIONS, CATALOG_SCHEMA_VERSION, CATALOG_SUBCATEGORY_DEFINITIONS,
  CLIMATE_MONTH_PROFILES, CLIMATE_SEASONS, DEFAULT_BUNDLED_FALLBACK_RANKED_COUNT,
  DEFAULT_RANKED_TARGET, DEFAULT_RESERVE_TARGET, forbiddenPublicText, hasControlledPublicClaim,
  hasDefectiveListingTitle, hasListingPriceNoise, hasNonRetailListingMarker, hasPublicPromoNoise,
  hasSourceListingPolicyRisk, hasUppercaseCodNoise, isActiveCleaningProduct, isNonInformativePublicName,
  isUnsafeAutomotiveText, INTENTIONAL_WHOLE_CATEGORY_CAMPAIGN_RULE_IDS, makeSeasonalMetadataV4,
  makeSearchText, semanticSummaryFingerprint, SEASONAL_METADATA_VERSION, SEASONAL_V4_GOLDEN_FIXTURES,
  SOURCE_POLICY_V5_GOLDEN_FIXTURES, STRICT_SUN_TOKEN,
} from './sellable-catalog-lib.mjs';
import {
  classifyNewRuleV5, MERCHANDISING_TAG_V5_GOLDEN_FIXTURES, merchandisingTagsV5,
  NEW_RULE_SPECS_V5, TABLET_CASE_IDENTITY_V5, TABLET_CASE_IDENTITY_V5_GOLDEN_FIXTURES,
  TAXONOMY_V5_POLICY_GOLDEN_FIXTURES,
} from './taxonomy-v5.mjs';

function parseArgs(argv) {
  const args = {
    fullCatalog: resolve('data', 'products', 'catalog-full.json.gz'),
    catalog: resolve('data', 'products', 'catalog.json'),
    reserve: resolve('data', 'products', 'catalog-reserve.json'),
    manifest: resolve('data', 'products', 'catalog-manifest.json'),
    runtimeModule: resolve('api', '_gen3-products.js'),
    rankedTarget: DEFAULT_RANKED_TARGET,
    fallbackTarget: DEFAULT_BUNDLED_FALLBACK_RANKED_COUNT,
    reserveTarget: DEFAULT_RESERVE_TARGET,
    skipRuntime: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--full-catalog') args.fullCatalog = resolve(next), index += 1;
    else if (value === '--catalog') args.catalog = resolve(next), index += 1;
    else if (value === '--reserve') args.reserve = resolve(next), index += 1;
    else if (value === '--manifest') args.manifest = resolve(next), index += 1;
    else if (value === '--runtime-module') args.runtimeModule = resolve(next), index += 1;
    else if (value === '--ranked-target') args.rankedTarget = Number(next), index += 1;
    else if (value === '--fallback-target') args.fallbackTarget = Number(next), index += 1;
    else if (value === '--reserve-target') args.reserveTarget = Number(next), index += 1;
    else if (value === '--skip-runtime') args.skipRuntime = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

const CATEGORY_BY_KEY = new Map(CATALOG_CATEGORY_DEFINITIONS.map((definition) => [definition.key, definition]));
const SUBCATEGORY_BY_KEY = new Map(CATALOG_SUBCATEGORY_DEFINITIONS.map((definition) => [definition.key, definition]));
const GROUP_BY_KEY = new Map(CATALOG_GROUP_DEFINITIONS.map((definition) => [definition.key, definition.label]));
const MERCHANDISING_TAG_SET = new Set(CATALOG_MERCHANDISING_TAG_DEFINITIONS.map(({ key }) => key));
const CAMPAIGN_TAG_SET = new Set(CAMPAIGN_TAGS);
const REASON_CODES = new Set([
  'high-cumulative-sales', 'strong-cumulative-sales', 'established-sales-signal', 'high-rating',
  'official-shop', 'preferred-shop', 'high-like-signal', 'season-fit', 'clear-fixed-price',
]);
const ALLOWED_PRODUCT_KEYS = new Set([
  'rank', 'reserveOrder', 'id', 'categoryGroupKey', 'categoryGroup', 'categoryKey', 'category',
  'subcategoryKey', 'subcategory', 'merchandisingTags', 'imageUrl', 'cleanName', 'summary',
  'priceMin', 'priceMax', 'priceType', 'checkedAt', 'productUrl', 'shopId', 'itemId', 'itemSold',
  'rating', 'likes', 'shopRating', 'shopType', 'sellerVerified', 'stockStatus', 'stockLevel',
  'riskTier', 'reviewStatus', 'reviewMethod', 'recommendationScore', 'reasonCodes', 'seasonTags',
  'monthTags', 'seasonalScore', 'seasonReason', 'normalizedSearchText', 'metadataVersion', 'evergreen',
  'seasonScores', 'seasonReasons', 'monthScores', 'monthReasons', 'campaignTags',
]);
const REQUIRED_COMMON_KEYS = [...ALLOWED_PRODUCT_KEYS].filter((key) => key !== 'rank' && key !== 'reserveOrder');
const SEASONAL_PRODUCT_KEYS = Object.freeze([
  'metadataVersion', 'evergreen', 'seasonTags', 'seasonScores', 'seasonReasons', 'monthTags',
  'monthScores', 'monthReasons', 'campaignTags', 'seasonalScore', 'seasonReason',
]);
const FULL_COHORT_FLOORS = Object.freeze({ food: 2_500, fashion: 10_000, agriculture: 900, cosmetics: 1_000, 'pet-food': 500, religious: 250, 'shop-supplies': 1_000 });
const FALLBACK_COHORT_FLOORS = Object.freeze({ food: 1_500, fashion: 3_000, agriculture: 700, cosmetics: 800, 'pet-food': 400, religious: 200, 'shop-supplies': 400 });
const FULL_TAG_FLOORS = Object.freeze({ 'fashion-sleepwear': 200, 'fashion-plus-size': 500, 'fashion-office': 100 });
const FALLBACK_TAG_FLOORS = Object.freeze({ 'fashion-sleepwear': 50, 'fashion-plus-size': 100, 'fashion-office': 10 });

function exactKeys(record, expected) {
  return isDeepStrictEqual(Object.keys(record).sort((a, b) => a.localeCompare(b, 'en')), [...expected].sort((a, b) => a.localeCompare(b, 'en')));
}
function validReasonArray(value) {
  return Array.isArray(value) && value.length >= 1 && value.length <= 4 && value.every((reason) =>
    typeof reason === 'string' && reason.length >= 8 && reason.length <= 120 && !/[\n\r\\#*`<>]/u.test(reason));
}

function validateSeasonalMetadata(product, id) {
  assert(product.metadataVersion === SEASONAL_METADATA_VERSION, `${id}: stale seasonal metadata version`);
  assert(typeof product.evergreen === 'boolean', `${id}: invalid evergreen flag`);
  assert(Array.isArray(product.seasonTags) && product.seasonTags.length >= 1 && product.seasonTags.length <= 3 &&
    product.seasonTags.every((tag) => tag === 'all-year' || CLIMATE_SEASONS.includes(tag)) && new Set(product.seasonTags).size === product.seasonTags.length, `${id}: invalid season tags`);
  assert(exactKeys(product.seasonScores, CLIMATE_SEASONS) && Object.values(product.seasonScores).every((score) => Number.isInteger(score) && score >= 0 && score <= 100), `${id}: invalid season scores`);
  assert(product.seasonReasons && typeof product.seasonReasons === 'object' && !Array.isArray(product.seasonReasons) &&
    Object.keys(product.seasonReasons).every((season) => CLIMATE_SEASONS.includes(season) && validReasonArray(product.seasonReasons[season])), `${id}: invalid season reasons`);
  if (product.evergreen) {
    assert(isDeepStrictEqual(product.seasonTags, ['all-year']) && Object.values(product.seasonScores).every((score) => score === 0) && Object.keys(product.seasonReasons).length === 0, `${id}: inconsistent evergreen state`);
  } else {
    assert(!product.seasonTags.includes('all-year') && isDeepStrictEqual(product.seasonTags, CLIMATE_SEASONS.filter((season) => product.seasonScores[season] > 0)), `${id}: climate tags/scores differ`);
    for (const season of product.seasonTags) {
      assert(product.seasonScores[season] > 0 && validReasonArray(product.seasonReasons[season]), `${id}: missing ${season} score/reason`);
      assert(Object.keys(CLIMATE_MONTH_PROFILES[season]).map(Number).every((month) => product.monthTags.includes(month)), `${id}: ${season} transition months incomplete`);
    }
  }
  assert(Array.isArray(product.monthTags) && product.monthTags.every((month) => Number.isInteger(month) && month >= 1 && month <= 12) &&
    isDeepStrictEqual(product.monthTags, [...new Set(product.monthTags)].sort((a, b) => a - b)), `${id}: invalid month tags`);
  assert(product.monthScores && product.monthReasons && typeof product.monthScores === 'object' && typeof product.monthReasons === 'object', `${id}: invalid month maps`);
  const scoreMonths = Object.keys(product.monthScores).map(Number).sort((a, b) => a - b);
  const reasonMonths = Object.keys(product.monthReasons).map(Number).sort((a, b) => a - b);
  assert(isDeepStrictEqual(scoreMonths, product.monthTags) && isDeepStrictEqual(reasonMonths, product.monthTags), `${id}: month maps differ from tags`);
  for (const month of product.monthTags) {
    assert(Number.isInteger(product.monthScores[String(month)]) && product.monthScores[String(month)] > 0 && product.monthScores[String(month)] <= 100, `${id}: invalid month score`);
    assert(validReasonArray(product.monthReasons[String(month)]), `${id}: invalid month reason`);
  }
  assert(Array.isArray(product.campaignTags) && product.campaignTags.every((tag) => CAMPAIGN_TAG_SET.has(tag)) && new Set(product.campaignTags).size === product.campaignTags.length, `${id}: invalid campaign tags`);
  assert(Number.isInteger(product.seasonalScore) && product.seasonalScore >= 50 && product.seasonalScore <= 100 && typeof product.seasonReason === 'string', `${id}: invalid legacy seasonal fields`);
  const expected = makeSeasonalMetadataV4(product.subcategoryKey, product.cleanName, product.summary);
  const actual = Object.fromEntries(SEASONAL_PRODUCT_KEYS.map((key) => [key, product[key]]));
  assert(isDeepStrictEqual(actual, expected), `${id}: deterministic seasonal metadata differs`);
}

function validateGoldenFixtures() {
  assert(!STRICT_SUN_TOKEN.test('Samsung') && STRICT_SUN_TOKEN.test('sun'), 'sun token boundary failed');
  for (const fixture of SOURCE_POLICY_V5_GOLDEN_FIXTURES.blocked) {
    assert(hasSourceListingPolicyRisk(fixture.title, fixture.description ?? ''), `source-policy fixture ${fixture.name}: blocker missed`);
  }
  for (const fixture of SOURCE_POLICY_V5_GOLDEN_FIXTURES.allowed) {
    assert(!hasSourceListingPolicyRisk(fixture.title, fixture.description ?? ''), `source-policy fixture ${fixture.name}: false positive`);
  }
  for (const name of SOURCE_POLICY_V5_GOLDEN_FIXTURES.rejectedPublicNames) {
    assert(isNonInformativePublicName(name), `public-name fixture ${name}: wrapper-only name accepted`);
  }
  for (const name of SOURCE_POLICY_V5_GOLDEN_FIXTURES.allowedPublicNames) {
    assert(!isNonInformativePublicName(name), `public-name fixture ${name}: informative name rejected`);
  }
  for (const value of SOURCE_POLICY_V5_GOLDEN_FIXTURES.blockedPublicText) {
    assert(hasNonRetailListingMarker(value), `public-policy fixture ${value}: blocker missed`);
  }
  for (const value of SOURCE_POLICY_V5_GOLDEN_FIXTURES.allowedPublicText) {
    assert(!hasNonRetailListingMarker(value), `public-policy fixture ${value}: false positive`);
  }
  for (const fixture of SEASONAL_V4_GOLDEN_FIXTURES.positive) {
    const metadata = makeSeasonalMetadataV4(fixture.categoryKey, fixture.cleanName, fixture.summary ?? '');
    if (fixture.seasons) assert(fixture.seasons.every((season) => metadata.seasonTags.includes(season)), `season fixture ${fixture.name} failed`);
    if (fixture.months) assert(fixture.months.every((month) => metadata.monthTags.includes(month)), `month fixture ${fixture.name} failed`);
    if (fixture.campaigns) assert(fixture.campaigns.every((campaign) => metadata.campaignTags.includes(campaign)), `campaign fixture ${fixture.name} failed`);
  }
  for (const fixture of SEASONAL_V4_GOLDEN_FIXTURES.negative) {
    const metadata = makeSeasonalMetadataV4(fixture.categoryKey, fixture.cleanName, fixture.summary ?? '');
    if (fixture.excludedSeasons) assert(fixture.excludedSeasons.every((season) => !metadata.seasonTags.includes(season)), `negative season fixture ${fixture.name} failed`);
    if (fixture.excludedMonths) assert(fixture.excludedMonths.every((month) => !metadata.monthTags.includes(month)), `negative month fixture ${fixture.name} failed`);
    if (fixture.excludedCampaignPrefixes) assert(metadata.campaignTags.every((tag) => !fixture.excludedCampaignPrefixes.some((prefix) => tag.startsWith(prefix))), `negative campaign fixture ${fixture.name} failed`);
  }
  assert(isDeepStrictEqual(CAMPAIGN_RULES.filter((rule) => rule.wholeCategory).map((rule) => rule.id), [...INTENTIONAL_WHOLE_CATEGORY_CAMPAIGN_RULE_IDS]), 'whole-category campaign allowlist drifted');
  for (const fixture of MERCHANDISING_TAG_V5_GOLDEN_FIXTURES) {
    const tags = merchandisingTagsV5(fixture.category, fixture.cleanName, fixture.rawTitle ?? '');
    if (fixture.includes) assert(fixture.includes.every((tag) => tags.includes(tag)), `merch fixture ${fixture.name}: missing tag`);
    if (fixture.excludes) assert(fixture.excludes.every((tag) => !tags.includes(tag)), `merch fixture ${fixture.name}: leaked tag`);
  }
  for (const fixture of TABLET_CASE_IDENTITY_V5_GOLDEN_FIXTURES.positive) {
    assert(TABLET_CASE_IDENTITY_V5.test(fixture.title), `tablet identity fixture ${fixture.name}: expected match`);
  }
  for (const fixture of TABLET_CASE_IDENTITY_V5_GOLDEN_FIXTURES.negative) {
    assert(!TABLET_CASE_IDENTITY_V5.test(fixture.title), `tablet identity fixture ${fixture.name}: unexpected phone match`);
  }
  for (const fixture of TAXONOMY_V5_POLICY_GOLDEN_FIXTURES) {
    const matches = NEW_RULE_SPECS_V5.filter((category) => category.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title));
    assert(matches.length === 1, `taxonomy fixture ${fixture.name}: expected one leaf, got ${matches.map(({ key }) => key).join(', ') || 'none'}`);
    const category = classifyNewRuleV5(fixture.c1, fixture.c2, fixture.c3, fixture.title);
    assert(category?.key === fixture.expectedKey, `taxonomy fixture ${fixture.name}: got ${category?.key ?? 'none'}`);
    assert(Boolean(category.deny?.test(fixture.title)) === fixture.denied, `taxonomy fixture ${fixture.name}: deny expectation failed`);
  }
}

function validHttps(value, hosts) {
  try { const url = new URL(value); return url.protocol === 'https:' && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)); } catch { return false; }
}
function titleFingerprint(value) {
  return String(value).normalize('NFKC').toLocaleLowerCase('th-TH')
    .replace(/\b(?:สี|color)\s*[\p{L}\p{N}-]+/giu, '').replace(/\b\d+(?:[.,]\d+)?\s*(?:ชิ้น|pcs?|cm|mm|ml|g|kg)\b/giu, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function validateProduct(product, kind, expectedOrder) {
  const id = `${kind}[${expectedOrder}]`;
  for (const key of REQUIRED_COMMON_KEYS) assert(Object.hasOwn(product, key), `${id}: missing ${key}`);
  for (const key of Object.keys(product)) assert(ALLOWED_PRODUCT_KEYS.has(key), `${id}: unexpected field ${key}`);
  if (kind === 'reserve') assert(product.reserveOrder === expectedOrder && !Object.hasOwn(product, 'rank'), `${id}: invalid reserve order`);
  else assert(product.rank === expectedOrder && !Object.hasOwn(product, 'reserveOrder'), `${id}: invalid rank`);
  assert(/^\d+-\d+$/u.test(product.id) && product.id === `${product.shopId}-${product.itemId}`, `${id}: invalid ID`);
  const category = CATEGORY_BY_KEY.get(product.categoryKey);
  const subcategory = SUBCATEGORY_BY_KEY.get(product.subcategoryKey);
  assert(category && subcategory, `${id}: unknown taxonomy key`);
  assert(product.category === category.label && product.subcategory === subcategory.label, `${id}: taxonomy label mismatch`);
  assert(subcategory.categoryKey === product.categoryKey && subcategory.groupKey === product.categoryGroupKey, `${id}: hierarchy mismatch`);
  assert(product.categoryGroup === GROUP_BY_KEY.get(product.categoryGroupKey) && category.groupKey === product.categoryGroupKey, `${id}: group mismatch`);
  assert(Array.isArray(product.merchandisingTags) && product.merchandisingTags.every((tag) => MERCHANDISING_TAG_SET.has(tag)) && new Set(product.merchandisingTags).size === product.merchandisingTags.length, `${id}: invalid merchandising tags`);
  assert(product.categoryGroupKey === 'fashion' || product.merchandisingTags.length === 0, `${id}: fashion tag outside fashion`);
  assert(validHttps(product.imageUrl, ['susercontent.com', 'shopee.co.th']), `${id}: invalid image URL`);
  assert(product.productUrl === `https://shopee.co.th/product/${product.shopId}/${product.itemId}`, `${id}: non-canonical URL`);
  assert(typeof product.cleanName === 'string' && product.cleanName.length >= 8 && product.cleanName.length <= 105 && !/[\n\r\\<>#*`]/u.test(product.cleanName), `${id}: invalid clean name`);
  assert(!isNonInformativePublicName(product.cleanName), `${id}: non-informative wrapper-only clean name`);
  assert(!hasPublicPromoNoise(product.cleanName) && !hasListingPriceNoise(product.cleanName) && !hasUppercaseCodNoise(product.cleanName), `${id}: noisy clean name`);
  assert(typeof product.summary === 'string' && product.summary.length >= 45 && product.summary.length <= 190 && !/[\n\r\\#*`]/u.test(product.summary), `${id}: invalid summary`);
  assert(!hasPublicPromoNoise(product.summary) && !hasListingPriceNoise(product.summary) && !hasUppercaseCodNoise(product.summary), `${id}: noisy summary`);
  assert(!hasNonRetailListingMarker(`${product.cleanName} ${product.summary}`) && !hasDefectiveListingTitle(product.cleanName), `${id}: non-retail listing leaked`);
  assert(!forbiddenPublicText(`${product.cleanName} ${product.summary}`) && !isActiveCleaningProduct(product.cleanName), `${id}: blocked public content`);
  assert(Number.isFinite(product.priceMin) && Number.isFinite(product.priceMax) && product.priceMin >= 10 && product.priceMax >= product.priceMin, `${id}: invalid price`);
  assert(product.priceType === (product.priceMin === product.priceMax ? 'fixed' : 'range') && product.priceMax / product.priceMin <= (product.riskTier === 'amber' ? 5 : 8), `${id}: invalid price range`);
  assert(!Number.isNaN(Date.parse(product.checkedAt)), `${id}: invalid checkedAt`);
  assert(Number.isInteger(product.itemSold) && product.itemSold >= 0 && Number.isInteger(product.likes) && product.likes >= 0, `${id}: invalid demand fields`);
  assert(Number.isFinite(product.rating) && product.rating >= (product.riskTier === 'amber' ? 4.7 : 4.5) && product.rating <= 5, `${id}: invalid rating`);
  assert(Number.isFinite(product.shopRating) && product.shopRating >= (product.riskTier === 'amber' ? 4.6 : 4.4) && product.shopRating <= 5, `${id}: invalid shop rating`);
  assert(['official', 'preferred', 'general'].includes(product.shopType) && typeof product.sellerVerified === 'boolean', `${id}: invalid shop metadata`);
  assert(product.stockStatus === 'in-stock' && ['low', 'available', 'high'].includes(product.stockLevel), `${id}: invalid stock metadata`);
  assert(product.riskTier === subcategory.riskTier && ['green', 'amber'].includes(product.riskTier), `${id}: risk mismatch`);
  assert(product.reviewStatus === 'approved' && product.reviewMethod === (product.riskTier === 'amber' ? 'automated-controlled-policy-v5' : 'automated-ruleset-v5'), `${id}: review mismatch`);
  assert(Number.isFinite(product.recommendationScore) && product.recommendationScore >= 0 && product.recommendationScore <= 100, `${id}: invalid score`);
  assert(Array.isArray(product.reasonCodes) && product.reasonCodes.length >= 1 && product.reasonCodes.length <= 4 && product.reasonCodes.every((reason) => REASON_CODES.has(reason)), `${id}: invalid reason codes`);
  validateSeasonalMetadata(product, id);
  assert(product.normalizedSearchText === makeSearchText(product), `${id}: stale search text`);

  const skincare = product.subcategoryKey.startsWith('skincare-') || product.subcategoryKey === 'hair-body-care';
  const cosmetics = product.categoryKey === 'makeup' || product.categoryKey === 'beauty-tools';
  if (product.categoryGroupKey === 'supplements') assert(!hasControlledPublicClaim('supplements', product.cleanName) && product.shopType !== 'general' && /โปรดตรวจสอบส่วนประกอบ/u.test(product.summary), `${id}: supplement safeguard`);
  if (skincare) {
    assert(!hasControlledPublicClaim('beauty', product.cleanName) && /โปรดตรวจสอบสูตร/u.test(product.summary), `${id}: skincare safeguard`);
    assert(!/(?:spf\s*\d+|pa\s*\+)/iu.test(`${product.cleanName} ${product.summary}`), `${id}: unsupported SPF/PA`);
  }
  if (cosmetics) assert(product.shopType !== 'general' && /โปรดตรวจสอบสูตร/u.test(product.summary), `${id}: cosmetics safeguard`);
  if (product.categoryGroupKey === 'food') assert(product.shopType !== 'general' && /โปรดตรวจสอบส่วนประกอบ/u.test(product.summary), `${id}: food safeguard`);
  if (product.categoryKey === 'pet-food') assert(product.shopType !== 'general' && /โปรดตรวจสอบชนิดสัตว์/u.test(product.summary), `${id}: pet-food safeguard`);
  if (product.categoryGroupKey === 'automotive') assert(!isUnsafeAutomotiveText(product.cleanName) && !hasControlledPublicClaim('automotive', product.cleanName) && /ตรวจสอบรุ่นรถ/u.test(product.summary), `${id}: automotive safeguard`);
  if (product.riskTier === 'amber' && product.categoryGroupKey === 'appliances') assert(product.shopType !== 'general' && /ตรวจสอบแรงดัน/u.test(product.summary), `${id}: electrical safeguard`);
  if (product.riskTier === 'amber' && product.categoryGroupKey === 'baby') assert(product.shopType !== 'general' && /ตรวจสอบช่วงอายุ/u.test(product.summary), `${id}: child safeguard`);
  if (product.subcategoryKey === 'religious-amulets') assert(product.shopType !== 'general' && /ตรวจสอบแหล่งที่มา/u.test(product.summary), `${id}: amulet safeguard`);
}

function cohortCounts(products) {
  return {
    food: products.filter((product) => product.categoryGroupKey === 'food').length,
    fashion: products.filter((product) => product.categoryGroupKey === 'fashion').length,
    agriculture: products.filter((product) => product.categoryGroupKey === 'agriculture').length,
    cosmetics: products.filter((product) => product.categoryKey === 'makeup' || product.categoryKey === 'beauty-tools').length,
    'pet-food': products.filter((product) => product.categoryKey === 'pet-food').length,
    religious: products.filter((product) => product.categoryGroupKey === 'religious').length,
    'actual-amulets': products.filter((product) => product.subcategoryKey === 'religious-amulets').length,
    'religious-accessories': products.filter((product) => product.categoryGroupKey === 'religious' && product.subcategoryKey !== 'religious-amulets').length,
    'shop-supplies': products.filter((product) => product.categoryGroupKey === 'shop-supplies').length,
  };
}
function tagCounts(products) { return Object.fromEntries(CATALOG_MERCHANDISING_TAG_DEFINITIONS.map(({ key }) => [key, products.filter((product) => product.merchandisingTags.includes(key)).length])); }
function assertFloors(actual, floors, label) { for (const [key, floor] of Object.entries(floors)) assert((actual[key] ?? 0) >= floor, `${label} ${key} has ${actual[key] ?? 0}; floor ${floor}`); }
function seasonCoverage(products) { return Object.fromEntries(CLIMATE_SEASONS.map((season) => [season, products.filter((product) => product.seasonTags.includes(season)).length])); }
function monthCoverage(products) { return Object.fromEntries(Array.from({ length: 12 }, (_, index) => { const month = index + 1; return [month, products.filter((product) => product.monthTags.includes(month)).length]; })); }
function definitionCoverage(products, field, definitions) {
  const counts = new Map(definitions.map(({ key }) => [key, 0]));
  for (const product of products) counts.set(product[field], (counts.get(product[field]) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((left, right) => left[0].localeCompare(right[0], 'en')));
}
function semanticSummaryStats(products) {
  const counts = new Map();
  for (const product of products) {
    const fingerprint = semanticSummaryFingerprint(product.summary);
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  }
  const uniqueCount = counts.size;
  return {
    count: products.length,
    uniqueCount,
    uniquePercent: products.length ? Math.round(uniqueCount / products.length * 1_000_000) / 10_000 : 100,
    maxIdenticalCount: counts.size ? Math.max(...counts.values()) : 0,
  };
}

const args = parseArgs(process.argv.slice(2));
validateGoldenFixtures();
const artifactDirectory = dirname(args.manifest);
const [fullGzip, fallbackBytes, reserveBytes, manifestBytes] = await Promise.all([
  readFile(args.fullCatalog), readFile(args.catalog), readFile(args.reserve), readFile(args.manifest),
]);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
assert(manifest.artifactVersion === 'catalog-artifacts-v5' && manifest.schemaVersion === CATALOG_SCHEMA_VERSION, 'manifest schema mismatch');
assert(manifest.artifacts.fullCatalog.path === basename(args.fullCatalog) && manifest.artifacts.bundledFallback.path === basename(args.catalog) && manifest.artifacts.reserve.path === basename(args.reserve), 'manifest paths mismatch');
assert(fullGzip.byteLength === manifest.artifacts.fullCatalog.compressedBytes && sha256(fullGzip) === manifest.artifacts.fullCatalog.compressedSha256, 'full gzip hash mismatch');
assert(fallbackBytes.byteLength === manifest.artifacts.bundledFallback.bytes && sha256(fallbackBytes) === manifest.artifacts.bundledFallback.sha256, 'fallback hash mismatch');
assert(reserveBytes.byteLength === manifest.artifacts.reserve.bytes && sha256(reserveBytes) === manifest.artifacts.reserve.sha256, 'reserve hash mismatch');
const reportBytes = await readFile(resolve(artifactDirectory, manifest.artifacts.buildReport.path));
assert(reportBytes.byteLength === manifest.artifacts.buildReport.bytes && sha256(reportBytes) === manifest.artifacts.buildReport.sha256, 'report hash mismatch');
const report = JSON.parse(reportBytes.toString('utf8'));
for (const [name, bytes] of [['full gzip', fullGzip], ['fallback', fallbackBytes], ['reserve', reserveBytes], ['report', reportBytes]]) assert(bytes.byteLength < 95 * 1024 * 1024, `${name}: exceeds 95 MiB`);

const fullBytes = gunzipSync(fullGzip);
assert(fullBytes.byteLength === manifest.artifacts.fullCatalog.uncompressedBytes && sha256(fullBytes) === manifest.artifacts.fullCatalog.uncompressedSha256, 'full uncompressed hash mismatch');
const fullText = fullBytes.toString('utf8');
const fallbackText = fallbackBytes.toString('utf8');
const reserveText = reserveBytes.toString('utf8');
for (const [name, text] of [['full', fullText], ['fallback', fallbackText], ['reserve', reserveText]]) {
  assert(!text.includes('\0'), `${name}: contains NUL`);
  assert(!/(?:commission|extra\s*_?comm|review\s*_?count|"reviewCount"|"description"\s*:)/iu.test(text), `${name}: private/invented field leaked`);
  assert(!/"stock"\s*:/u.test(text), `${name}: raw stock leaked`);
}
const fullCatalog = JSON.parse(fullText);
const catalog = JSON.parse(fallbackText);
const reserveCatalog = JSON.parse(reserveText);
assert(fullCatalog.schemaVersion === CATALOG_SCHEMA_VERSION && catalog.schemaVersion === CATALOG_SCHEMA_VERSION && reserveCatalog.schemaVersion === CATALOG_SCHEMA_VERSION, 'schema mismatch');
assert(fullCatalog.seasonalMetadataVersion === SEASONAL_METADATA_VERSION && catalog.seasonalMetadataVersion === SEASONAL_METADATA_VERSION && reserveCatalog.seasonalMetadataVersion === SEASONAL_METADATA_VERSION, 'seasonal root mismatch');
assert(fullCatalog.catalogArtifactMode === 'full-approved' && catalog.catalogArtifactMode === 'bundled-fallback', 'artifact mode mismatch');
assert(fullCatalog.targetRankedCount === args.rankedTarget && fullCatalog.rankedCount === args.rankedTarget && fullCatalog.ranked.length === args.rankedTarget, 'full count mismatch');
assert(catalog.targetRankedCount === args.rankedTarget && catalog.rankedCount === args.fallbackTarget && catalog.ranked.length === args.fallbackTarget && catalog.approvedRankedCount === args.rankedTarget, 'fallback count mismatch');
assert(fullCatalog.targetReserveCount === args.reserveTarget && reserveCatalog.reserveCount === args.reserveTarget && reserveCatalog.reserve.length === args.reserveTarget, 'reserve count mismatch');
assert(fullCatalog.selectionStatus === 'target-met' && catalog.selectionStatus === 'target-met', 'selection target not met');
assert(CATALOG_GROUP_DEFINITIONS.length === 16 && CATALOG_CATEGORY_DEFINITIONS.length === 60 && CATALOG_SUBCATEGORY_DEFINITIONS.length === 167, 'taxonomy counts mismatch');
assert(isDeepStrictEqual(fullCatalog.groupDefinitions, CATALOG_GROUP_DEFINITIONS) && isDeepStrictEqual(fullCatalog.categoryDefinitions, CATALOG_CATEGORY_DEFINITIONS) && isDeepStrictEqual(fullCatalog.subcategoryDefinitions, CATALOG_SUBCATEGORY_DEFINITIONS), 'artifact taxonomy drifted');
assert(Object.keys(report.eligibleByGroupKey ?? {}).length === 16 && Object.keys(report.eligibleByCategoryKey ?? {}).length === 60 && Object.keys(report.eligibleBySubcategoryKey ?? {}).length === 167, 'eligible taxonomy census must include zero-filled 16/60/167 keys');
assert(Object.keys(report.selectedByCategoryKey ?? {}).length === 60 && Object.keys(report.selectedBySubcategoryKey ?? {}).length === 167, 'selected taxonomy report must include zero-filled 60/167 keys');
assert(isDeepStrictEqual(report.fullCoverage?.byGroupKey, definitionCoverage(fullCatalog.ranked, 'categoryGroupKey', CATALOG_GROUP_DEFINITIONS)), 'full group coverage report mismatch');
assert(isDeepStrictEqual(report.fullCoverage?.byCategoryKey, definitionCoverage(fullCatalog.ranked, 'categoryKey', CATALOG_CATEGORY_DEFINITIONS)), 'full category coverage report mismatch');
assert(isDeepStrictEqual(report.fullCoverage?.bySubcategoryKey, definitionCoverage(fullCatalog.ranked, 'subcategoryKey', CATALOG_SUBCATEGORY_DEFINITIONS)), 'full subcategory coverage report mismatch');
assert(isDeepStrictEqual(report.bundledFallbackCoverage?.byGroupKey, definitionCoverage(catalog.ranked, 'categoryGroupKey', CATALOG_GROUP_DEFINITIONS)), 'fallback group coverage report mismatch');
assert(isDeepStrictEqual(report.bundledFallbackCoverage?.byCategoryKey, definitionCoverage(catalog.ranked, 'categoryKey', CATALOG_CATEGORY_DEFINITIONS)), 'fallback category coverage report mismatch');
assert(isDeepStrictEqual(report.bundledFallbackCoverage?.bySubcategoryKey, definitionCoverage(catalog.ranked, 'subcategoryKey', CATALOG_SUBCATEGORY_DEFINITIONS)), 'fallback subcategory coverage report mismatch');
assert(fullCatalog.featured?.id === 'featured-dkub-book' && fullCatalog.featured.rank === undefined && fullCatalog.featured.reserveOrder === undefined, 'featured book ranked');
const featuredSeasonal = makeSeasonalMetadataV4(fullCatalog.featured.subcategoryKey, fullCatalog.featured.cleanName, fullCatalog.featured.summary);
assert(isDeepStrictEqual(Object.fromEntries(SEASONAL_PRODUCT_KEYS.map((key) => [key, fullCatalog.featured[key]])), featuredSeasonal), 'featured seasonal stale');

fullCatalog.ranked.forEach((product, index) => validateProduct(product, 'ranked', index + 1));
catalog.ranked.forEach((product, index) => validateProduct(product, 'fallback', index + 1));
reserveCatalog.reserve.forEach((product, index) => validateProduct(product, 'reserve', index + 1));
const fullById = new Map(fullCatalog.ranked.map((product) => [product.id, product]));
for (const fallback of catalog.ranked) {
  const full = fullById.get(fallback.id);
  assert(full, `fallback ${fallback.id}: absent from full`);
  const { rank: _fallbackRank, ...fallbackCore } = fallback;
  const { rank: _fullRank, ...fullCore } = full;
  assert(isDeepStrictEqual(fallbackCore, fullCore), `fallback ${fallback.id}: non-rank fields differ`);
}
const all = [...fullCatalog.ranked, ...reserveCatalog.reserve];
assert(new Set(all.map((product) => product.id)).size === all.length, 'duplicate IDs full/reserve');
assert(new Set(all.map((product) => new URL(product.imageUrl).pathname.split('/').filter(Boolean).at(-1))).size === all.length, 'duplicate images full/reserve');
assert(new Set(all.map((product) => titleFingerprint(product.cleanName))).size === all.length, 'duplicate normalized names full/reserve');
const fullAndReserveSummaryStats = semanticSummaryStats(all);
const fallbackSummaryStats = semanticSummaryStats(catalog.ranked);
assert(fullAndReserveSummaryStats.maxIdenticalCount <= 5, `semantic summary repeated ${fullAndReserveSummaryStats.maxIdenticalCount} times`);
assert(fullAndReserveSummaryStats.uniquePercent >= 95, `semantic summary uniqueness is ${fullAndReserveSummaryStats.uniquePercent}%`);
assert(isDeepStrictEqual(report.semanticSummaryStats?.fullAndReserve, fullAndReserveSummaryStats) && isDeepStrictEqual(report.semanticSummaryStats?.bundledFallback, fallbackSummaryStats), 'semantic summary stats report mismatch');
assert(report.qualityChecks?.maxIdenticalSemanticSummary === fullAndReserveSummaryStats.maxIdenticalCount && report.qualityChecks?.semanticSummaryUniquePercent === fullAndReserveSummaryStats.uniquePercent, 'semantic summary quality check mismatch');
assert(!all.some((product) => product.id === `${fullCatalog.featured.shopId}-${fullCatalog.featured.itemId}`), 'featured leaked into selection');
const rankedShopCounts = fullCatalog.ranked.reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map());
const allShopCounts = all.reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map());
assert(Math.max(...rankedShopCounts.values()) <= 18 && Math.max(...allShopCounts.values()) <= 24, 'per-shop cap exceeded');
assert(new Set(fullCatalog.ranked.map((product) => product.categoryGroupKey)).size === 16, 'empty group');
assert(new Set(fullCatalog.ranked.map((product) => product.categoryKey)).size >= 50, 'middle-category coverage too narrow');

const fullCohorts = cohortCounts(fullCatalog.ranked);
const fallbackCohorts = cohortCounts(catalog.ranked);
const fullTags = tagCounts(fullCatalog.ranked);
const fallbackTags = tagCounts(catalog.ranked);
if (args.rankedTarget === DEFAULT_RANKED_TARGET && args.fallbackTarget === DEFAULT_BUNDLED_FALLBACK_RANKED_COUNT) {
  assertFloors(fullCohorts, FULL_COHORT_FLOORS, 'full cohort');
  assertFloors(fallbackCohorts, FALLBACK_COHORT_FLOORS, 'fallback cohort');
  assertFloors(fullTags, FULL_TAG_FLOORS, 'full tag');
  assertFloors(fallbackTags, FALLBACK_TAG_FLOORS, 'fallback tag');
  assert(fullCohorts['actual-amulets'] >= 1 && fullCohorts['religious-accessories'] >= 200, 'amulet/accessory split missing');
  const topThree = fullCatalog.ranked.filter((product) => ['fashion', 'home', 'learning'].includes(product.categoryGroupKey)).length;
  assert(topThree <= Math.floor(fullCatalog.ranked.length * 0.5), `top three occupy ${(topThree / fullCatalog.ranked.length * 100).toFixed(1)}%`);
}
const automotiveCount = fullCatalog.ranked.filter((product) => product.categoryGroupKey === 'automotive').length;
const skincareCount = fullCatalog.ranked.filter((product) => product.subcategoryKey.startsWith('skincare-') || product.subcategoryKey === 'hair-body-care').length;
const supplementCount = fullCatalog.ranked.filter((product) => product.categoryGroupKey === 'supplements').length;
assert(automotiveCount >= 100 && skincareCount >= 80 && supplementCount >= 20, 'legacy controlled floor failed');
const fullSeasonCounts = seasonCoverage(fullCatalog.ranked);
const fallbackSeasonCounts = seasonCoverage(catalog.ranked);
const fullMonthCounts = monthCoverage(fullCatalog.ranked);
const fallbackMonthCounts = monthCoverage(catalog.ranked);
assert(Object.values(fullSeasonCounts).every((count) => count > 0) && Object.values(fallbackSeasonCounts).every((count) => count > 0), 'empty season coverage');
assert(Object.values(fullMonthCounts).every((count) => count > 0) && Object.values(fallbackMonthCounts).every((count) => count > 0), 'empty month coverage');

if (!args.skipRuntime) {
  const runtimeText = await readFile(args.runtimeModule, 'utf8');
  assert(!runtimeText.includes('\0') && !/"description"\s*:/u.test(runtimeText), 'runtime private content');
  const runtime = (await import(`${pathToFileURL(args.runtimeModule).href}?validation=${Date.now()}`)).default;
  assert(runtime.schemaVersion === CATALOG_SCHEMA_VERSION && runtime.catalogArtifactMode === 'bundled-fallback', 'runtime mode mismatch');
  assert(!Object.hasOwn(runtime, 'reserve'), 'runtime contains offline reserve');
  assert(JSON.stringify(runtime.ranked) === JSON.stringify(catalog.ranked) && JSON.stringify(runtime.featured) === JSON.stringify(catalog.featured), 'runtime differs from fallback');
}

process.stdout.write(`${JSON.stringify({
  status: 'valid', schemaVersion: CATALOG_SCHEMA_VERSION, fullRankedCount: fullCatalog.ranked.length,
  fallbackRankedCount: catalog.ranked.length, reserveCount: reserveCatalog.reserve.length,
  groupCount: new Set(fullCatalog.ranked.map((product) => product.categoryGroupKey)).size,
  categoryCount: new Set(fullCatalog.ranked.map((product) => product.categoryKey)).size,
  subcategoryCount: new Set(fullCatalog.ranked.map((product) => product.subcategoryKey)).size,
  fullCohorts, fallbackCohorts, fullTags, fallbackTags, automotiveCount, skincareCount, supplementCount,
  fullAndReserveSummaryStats, fallbackSummaryStats,
  fullSeasonCounts, fallbackSeasonCounts, fullMonthCounts, fallbackMonthCounts,
  sourceCheckedAt: fullCatalog.sourceCheckedAt,
}, null, 2)}\n`);
