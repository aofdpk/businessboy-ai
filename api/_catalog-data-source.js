'use strict';

const crypto = require('crypto');

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;
const CONTEXT_TTL_MS = 60_000;
const BUNDLED_RESULT_TTL_MS = 120_000;
const BUNDLED_RESULT_CACHE_MAX = 50;
const SEASONS = new Set(['all-year', 'hot', 'rainy', 'cool']);
const SHOP_TYPES = new Set(['official', 'preferred', 'general']);
const SORTS = new Set(['recommended', 'sold-desc', 'rating-desc', 'price-asc', 'price-desc', 'seasonal', 'newest']);
const PRICE_RANGES = Object.freeze({
  all: { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY },
  'under-100': { min: Number.NEGATIVE_INFINITY, max: 99.99 },
  '100-300': { min: 100, max: 300 },
  '301-500': { min: 301, max: 500 },
  '501-1000': { min: 501, max: 1000 },
  'over-1000': { min: 1000.01, max: Number.POSITIVE_INFINITY },
});
const PERIOD_LABELS = Object.freeze({
  'all-year': 'ขายได้ตลอดปี',
  hot: 'หน้าร้อน',
  rainy: 'หน้าฝน',
  cool: 'หน้าหนาว/อากาศเย็น',
});
const REASON_LABELS = Object.freeze({
  'strong-sales': 'ยอดขายสะสมสูง',
  'high-sales': 'ยอดขายสะสมสูง',
  'strong-cumulative-sales': 'ยอดขายสะสมสูง',
  'high-cumulative-sales': 'ยอดขายสะสมสูง',
  'established-sales-signal': 'มีสัญญาณยอดขาย',
  'high-like-signal': 'มีคนสนใจสูง',
  bestseller: 'ขายดีในหมวด',
  'high-rating': 'คะแนนสูง',
  'trusted-rating': 'คะแนนน่าเชื่อถือ',
  'official-shop': 'ร้าน Official',
  'preferred-shop': 'ร้าน Preferred',
  'high-shop-rating': 'คะแนนร้านสูง',
  'in-stock': 'มีสินค้า',
  'good-value': 'ราคาเข้าถึงง่าย',
  'clear-variant': 'ตัวเลือกชัดเจน',
  'clear-fixed-price': 'ราคาเดียวชัดเจน',
  seasonal: 'เหมาะกับช่วงนี้',
  'season-fit': 'เหมาะกับช่วงนี้',
  'content-friendly': 'เหมาะทำคลิปสาธิต',
  'complete-data': 'ข้อมูลค่อนข้างครบ',
});

let bundledContext;
let neonClient;
let neonContextCache;
const bundledResultCache = new Map();

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function text(value, maxLength = 500) {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function queryText(value, maxLength = 120) {
  return text(first(value), maxLength);
}

function key(value, fallback = '') {
  const candidate = text(value, 80).toLowerCase();
  return /^[a-z0-9][a-z0-9-]*$/.test(candidate) ? candidate : fallback;
}

function identifier(value) {
  return ['string', 'number', 'bigint'].includes(typeof value) ? String(value).trim().slice(0, 128) : '';
}

function publicIdFor(sourceId, supplied) {
  const candidate = identifier(supplied);
  if (/^[A-Za-z0-9_-]{12,80}$/.test(candidate)) return candidate;
  return crypto.createHash('sha256').update(`businessboy-catalog:${sourceId}`).digest('base64url').slice(0, 24);
}

function finiteNumber(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = finiteNumber(value, minimum, maximum);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function integerQuery(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(first(value) ?? ''), 10);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function trustedUrl(value, kind) {
  try {
    const url = new URL(text(value, 2_000));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return '';
    if (kind === 'image') {
      return host === 'susercontent.com' || host.endsWith('.susercontent.com') || host === 'shopee.co.th' || host.endsWith('.shopee.co.th') ? url.href : '';
    }
    return host === 'shopee.co.th' || host.endsWith('.shopee.co.th') ? url.href : '';
  } catch {
    return '';
  }
}

function normalizeSearch(value) {
  return text(value, 2_000).toLocaleLowerCase('th-TH');
}

function escapeLike(value) {
  return normalizeSearch(value).replace(/!/g, '!!').replace(/%/g, '!%').replace(/_/g, '!_');
}

function values(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    return value.slice(1, -1).split(',').map((entry) => entry.replace(/^"|"$/g, ''));
  }
  return [];
}

function stringArray(value, allowed, max = 20) {
  const result = [];
  for (const entry of values(value)) {
    const clean = text(entry, 80).toLowerCase();
    if (clean && (!allowed || allowed.has(clean)) && !result.includes(clean)) result.push(clean);
    if (result.length >= max) break;
  }
  return result;
}

function numberArray(value, min, max) {
  return [...new Set(values(value).map(Number).filter((entry) => Number.isInteger(entry) && entry >= min && entry <= max))].sort((a, b) => a - b);
}

function fallbackKey(label, prefix) {
  return `${prefix}-${crypto.createHash('sha256').update(label).digest('hex').slice(0, 12)}`;
}

function field(record, camel, snake) {
  return record?.[camel] ?? record?.[snake];
}

function normalizeProduct(record, featuredOverride = false) {
  if (!record || typeof record !== 'object') return null;
  const sourceId = identifier(field(record, 'id', 'id'));
  const id = publicIdFor(sourceId, field(record, 'publicId', 'public_id'));
  const cleanName = text(field(record, 'cleanName', 'clean_name'), 300);
  const imageUrl = trustedUrl(field(record, 'imageUrl', 'image_url'), 'image');
  const productUrl = trustedUrl(field(record, 'productUrl', 'product_url'), 'product');
  const reviewStatus = text(field(record, 'reviewStatus', 'review_status'), 24).toLowerCase();
  if (!sourceId || !cleanName || !imageUrl || !productUrl || (reviewStatus && reviewStatus !== 'approved')) return null;

  const category = text(field(record, 'category', 'category'), 120) || 'อื่น ๆ';
  const categoryKey = key(field(record, 'categoryKey', 'category_key'), fallbackKey(category, 'category'));
  const categoryGroup = text(field(record, 'categoryGroup', 'category_group'), 120) || category;
  const categoryGroupKey = key(field(record, 'categoryGroupKey', 'category_group_key'), categoryKey);
  const subcategory = text(field(record, 'subcategory', 'subcategory'), 120);
  const subcategoryKey = subcategory ? key(field(record, 'subcategoryKey', 'subcategory_key'), fallbackKey(subcategory, 'subcategory')) : '';
  const rank = integer(field(record, 'rank', 'rank'), 1, 10_000_000);
  const featured = featuredOverride || field(record, 'featured', 'featured') === true;
  const rating = finiteNumber(field(record, 'rating', 'rating'), 0, 5);
  const itemSold = integer(field(record, 'itemSold', 'item_sold'), 0, Number.MAX_SAFE_INTEGER);
  const likes = integer(field(record, 'likes', 'likes'), 0, Number.MAX_SAFE_INTEGER);
  const shopRating = finiteNumber(field(record, 'shopRating', 'shop_rating'), 0, 5);
  const rawShopType = text(field(record, 'shopType', 'shop_type'), 20).toLowerCase();
  const shopType = SHOP_TYPES.has(rawShopType) ? rawShopType : 'general';
  const stockStatus = text(field(record, 'stockStatus', 'stock_status'), 24).toLowerCase() === 'in-stock' ? 'in-stock' : 'unknown';
  const recommendationScore = finiteNumber(field(record, 'recommendationScore', 'recommendation_score'), 0, 1_000_000) ?? (rank ? Math.max(0, 1_000_000 - rank) : 0);
  const seasonTags = stringArray(field(record, 'seasonTags', 'season_tags'), SEASONS, 4);
  const monthTags = numberArray(field(record, 'monthTags', 'month_tags'), 1, 12);
  const summary = text(field(record, 'summary', 'summary'), 700);
  const normalizedSearchText = normalizeSearch(field(record, 'normalizedSearchText', 'normalized_search_text'))
    || normalizeSearch(`${cleanName} ${summary} ${categoryGroup} ${category} ${subcategory}`);

  return {
    id,
    sourceId,
    rank: featured ? null : rank,
    featured,
    category,
    categoryKey,
    categoryGroup,
    categoryGroupKey,
    subcategory,
    subcategoryKey,
    imageUrl,
    cleanName,
    summary,
    priceMin: finiteNumber(field(record, 'priceMin', 'price_min')),
    priceMax: finiteNumber(field(record, 'priceMax', 'price_max')),
    priceType: text(field(record, 'priceType', 'price_type'), 16).toLowerCase() === 'range' ? 'range' : 'fixed',
    checkedAt: text(field(record, 'checkedAt', 'checked_at'), 80),
    productUrl,
    shopName: featured ? text(field(record, 'shopName', 'shop_name'), 120) : '',
    itemSold,
    rating,
    likes,
    shopRating,
    shopType,
    stockStatus,
    seasonTags,
    monthTags,
    seasonalScore: integer(field(record, 'seasonalScore', 'seasonal_score'), 0, 100) ?? 0,
    seasonReason: text(field(record, 'seasonReason', 'season_reason'), 240),
    reasonCodes: stringArray(field(record, 'reasonCodes', 'reason_codes'), null, 12),
    recommendationScore,
    normalizedSearchText,
  };
}

function reasonBadges(product) {
  const labels = [];
  for (const code of product.reasonCodes) {
    const label = REASON_LABELS[code];
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.length === 3) return labels;
  }
  const derived = [
    product.itemSold !== null && product.itemSold >= 1_000 ? 'ยอดขายสะสมสูง' : '',
    product.rating !== null && product.rating >= 4.7 ? 'คะแนนสูง' : '',
    product.shopType === 'official' ? 'ร้าน Official' : product.shopType === 'preferred' ? 'ร้าน Preferred' : '',
    product.stockStatus === 'in-stock' ? 'มีสินค้า' : '',
  ];
  for (const label of derived) {
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.length === 3) break;
  }
  return labels.length ? labels : ['คัดตามเกณฑ์คลัง'];
}

function safetyNotice(product) {
  if (product.categoryGroupKey === 'supplements') return 'ข้อมูลย่อไม่ใช่คำแนะนำทางการแพทย์ โปรดตรวจฉลาก คำเตือน และเลข อย. จากแหล่งทางการก่อนใช้';
  if (product.categoryGroupKey === 'beauty') return 'โปรดตรวจสูตร ขนาด ส่วนผสม และคำเตือนจากหน้าสินค้าก่อนใช้ ผลลัพธ์อาจแตกต่างกันในแต่ละคน';
  if (product.categoryGroupKey === 'automotive') return 'โปรดตรวจรุ่นรถ ปีรถ ขนาด และตำแหน่งติดตั้งจากหน้าสินค้าก่อนสั่งซื้อ';
  return '';
}

function toPublicProduct(product) {
  return {
    id: product.id,
    rank: product.rank,
    featured: product.featured,
    category: product.category,
    categoryKey: product.categoryKey,
    categoryGroup: product.categoryGroup,
    categoryGroupKey: product.categoryGroupKey,
    subcategory: product.subcategory,
    subcategoryKey: product.subcategoryKey,
    imageUrl: product.imageUrl,
    cleanName: product.cleanName,
    summary: product.summary,
    priceMin: product.priceMin,
    priceMax: product.priceMax,
    priceType: product.priceType,
    checkedAt: product.checkedAt,
    productUrl: product.productUrl,
    shopName: product.shopName,
    itemSold: product.itemSold,
    rating: product.rating,
    shopRating: product.shopRating,
    shopType: product.shopType,
    stockStatus: product.stockStatus,
    seasonTags: product.seasonTags,
    monthTags: product.monthTags,
    seasonalScore: product.seasonalScore,
    seasonReason: product.seasonReason,
    reasonBadges: reasonBadges(product).slice(0, 3),
    safetyNotice: safetyNotice(product),
  };
}

function parseFilters(query = {}) {
  const requestedPeriod = queryText(query.period, 24).toLowerCase();
  const period = requestedPeriod === 'all' || SEASONS.has(requestedPeriod) || /^month-(?:[1-9]|1[0-2])$/.test(requestedPeriod) ? requestedPeriod : 'all';
  const requestedPrice = queryText(query.price, 24).toLowerCase();
  const price = Object.prototype.hasOwnProperty.call(PRICE_RANGES, requestedPrice) ? requestedPrice : 'all';
  const legacySort = queryText(query.sort, 24).toLowerCase();
  const sort = legacySort === 'rank' ? 'recommended' : SORTS.has(legacySort) ? legacySort : 'recommended';
  const requestedShop = queryText(query.shopType, 20).toLowerCase();
  const shopType = SHOP_TYPES.has(requestedShop) ? requestedShop : 'all';
  const freshness = [7, 30, 90].includes(integerQuery(query.freshness, 0, 0, 90)) ? integerQuery(query.freshness, 0, 0, 90) : 0;
  return {
    q: queryText(query.q, 100),
    group: key(queryText(query.group, 80).toLowerCase(), 'all'),
    category: key(queryText(query.category, 80).toLowerCase(), 'all'),
    subcategory: key(queryText(query.subcategory, 80).toLowerCase(), 'all'),
    period,
    price,
    sort,
    minSold: integerQuery(query.minSold, 0, 0, 100_000_000),
    minRating: [0, 4.5, 4.7, 4.8].includes(Number(first(query.minRating))) ? Number(first(query.minRating)) : 0,
    shopType,
    stock: queryText(query.stock, 20).toLowerCase() === 'in-stock' ? 'in-stock' : 'all',
    freshness,
    limit: integerQuery(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: integerQuery(query.offset, 0, 0, 1_000_000),
    cursor: queryText(query.cursor, 1_000),
  };
}

function priceRange(product) {
  const firstPrice = product.priceMin ?? product.priceMax;
  const lastPrice = product.priceMax ?? product.priceMin;
  return firstPrice === null || firstPrice === undefined || lastPrice === null || lastPrice === undefined
    ? null
    : { min: Math.min(firstPrice, lastPrice), max: Math.max(firstPrice, lastPrice) };
}

function matchesFilters(product, filters) {
  if (filters.q && !product.normalizedSearchText.includes(normalizeSearch(filters.q))) return false;
  if (filters.group !== 'all' && product.categoryGroupKey !== filters.group) return false;
  if (filters.category !== 'all' && product.categoryKey !== filters.category) return false;
  if (filters.subcategory !== 'all' && product.subcategoryKey !== filters.subcategory) return false;
  if (filters.period !== 'all') {
    if (SEASONS.has(filters.period) && !product.seasonTags.includes(filters.period)) return false;
    if (filters.period.startsWith('month-') && !product.monthTags.includes(Number(filters.period.slice(6)))) return false;
  }
  if (filters.price !== 'all') {
    const selected = PRICE_RANGES[filters.price];
    const range = priceRange(product);
    if (!range || range.max < selected.min || range.min > selected.max) return false;
  }
  if (filters.minSold && (product.itemSold === null || product.itemSold < filters.minSold)) return false;
  if (filters.minRating && (product.rating === null || product.rating < filters.minRating)) return false;
  if (filters.shopType !== 'all' && product.shopType !== filters.shopType) return false;
  if (filters.stock === 'in-stock' && product.stockStatus !== 'in-stock') return false;
  if (filters.freshness) {
    const checked = Date.parse(product.checkedAt);
    if (!Number.isFinite(checked) || checked < Date.now() - filters.freshness * 86_400_000) return false;
  }
  return true;
}

function sortValues(product, sort) {
  if (sort === 'sold-desc') return [product.itemSold ?? -1, product.recommendationScore];
  if (sort === 'rating-desc') return [product.rating ?? -1, product.itemSold ?? -1];
  if (sort === 'price-asc') return [product.priceMin ?? product.priceMax ?? Number.MAX_SAFE_INTEGER, 0];
  if (sort === 'price-desc') return [product.priceMax ?? product.priceMin ?? -1, 0];
  if (sort === 'seasonal') return [product.seasonalScore, product.recommendationScore];
  if (sort === 'newest') return [Date.parse(product.checkedAt) || 0, 0];
  return [product.recommendationScore, -(product.rank ?? Number.MAX_SAFE_INTEGER)];
}

function compareProducts(left, right, sort) {
  const [leftA, leftB] = sortValues(left, sort);
  const [rightA, rightB] = sortValues(right, sort);
  if (sort === 'price-asc') return leftA - rightA || left.id.localeCompare(right.id);
  return rightA - leftA || rightB - leftB || left.id.localeCompare(right.id);
}

function appliedSignature(filters) {
  const stable = JSON.stringify(['q', 'group', 'category', 'subcategory', 'period', 'price', 'sort', 'minSold', 'minRating', 'shopType', 'stock', 'freshness']
    .map((name) => [name, filters[name]]));
  return crypto.createHash('sha256').update(stable).digest('base64url').slice(0, 16);
}

function cursorSecret() {
  return process.env.GEN3_CURSOR_SECRET || process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || 'businessboy-local-cursor-v1';
}

function cursorMac(payload) {
  return crypto.createHmac('sha256', cursorSecret()).update(payload).digest('base64url').slice(0, 22);
}

function encodeCursor(product, filters, snapshotToken) {
  const [a, b] = sortValues(product, filters.sort);
  const payload = Buffer.from(JSON.stringify({ v: 2, q: appliedSignature(filters), c: snapshotToken, s: filters.sort, a, b, id: product.id }), 'utf8').toString('base64url');
  return `${payload}.${cursorMac(payload)}`;
}

function decodeCursor(value, filters) {
  if (!value || value.length > 1_000) return null;
  try {
    const [payload, suppliedMac, extra] = value.split('.');
    if (!payload || !suppliedMac || extra !== undefined) return null;
    const expectedMac = cursorMac(payload);
    const supplied = Buffer.from(suppliedMac);
    const expected = Buffer.from(expectedMac);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsed?.v !== 2 || parsed.q !== appliedSignature(filters) || !text(parsed.c, 40) || parsed.s !== filters.sort || !identifier(parsed.id)) return null;
    const a = Number(parsed.a);
    const b = Number(parsed.b);
    return Number.isFinite(a) && Number.isFinite(b) ? { a, b, id: identifier(parsed.id), c: text(parsed.c, 40) } : null;
  } catch {
    return null;
  }
}

function snapshotTokenFor(context) {
  return crypto.createHash('sha256')
    .update([context.source, context.runId || '', context.schemaVersion, context.generatedAt, context.total].join('|'))
    .digest('base64url').slice(0, 18);
}

function bundledCacheKey(context, filters) {
  return `${context.snapshotToken}:${JSON.stringify(filters)}`;
}

function bundledCacheGet(key) {
  const cached = bundledResultCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    bundledResultCache.delete(key);
    return null;
  }
  bundledResultCache.delete(key);
  bundledResultCache.set(key, cached);
  return cached.value;
}

function bundledCacheSet(key, value) {
  if (bundledResultCache.has(key)) bundledResultCache.delete(key);
  while (bundledResultCache.size >= BUNDLED_RESULT_CACHE_MAX) {
    const oldest = bundledResultCache.keys().next().value;
    if (oldest === undefined) break;
    bundledResultCache.delete(oldest);
  }
  bundledResultCache.set(key, { value, expiresAt: Date.now() + BUNDLED_RESULT_TTL_MS });
}

function createFacets(products) {
  const groups = new Map();
  const seasonCounts = Object.fromEntries([...SEASONS].map((season) => [season, 0]));
  const monthCounts = Array.from({ length: 12 }, () => 0);
  const shopCounts = { official: 0, preferred: 0, general: 0 };
  for (const product of products) {
    let group = groups.get(product.categoryGroupKey);
    if (!group) {
      group = { key: product.categoryGroupKey, label: product.categoryGroup, count: 0, categories: new Map() };
      groups.set(product.categoryGroupKey, group);
    }
    group.count += 1;
    let category = group.categories.get(product.categoryKey);
    if (!category) {
      category = { key: product.categoryKey, label: product.category, count: 0, subcategories: new Map() };
      group.categories.set(product.categoryKey, category);
    }
    category.count += 1;
    if (product.subcategoryKey) {
      const sub = category.subcategories.get(product.subcategoryKey) || { key: product.subcategoryKey, label: product.subcategory, count: 0 };
      sub.count += 1;
      category.subcategories.set(product.subcategoryKey, sub);
    }
    for (const season of product.seasonTags) seasonCounts[season] += 1;
    for (const month of product.monthTags) monthCounts[month - 1] += 1;
    shopCounts[product.shopType] += 1;
  }
  return {
    groups: [...groups.values()].map((group) => ({
      key: group.key,
      label: group.label,
      count: group.count,
      categories: [...group.categories.values()].map((category) => ({
        key: category.key,
        label: category.label,
        count: category.count,
        subcategories: [...category.subcategories.values()].sort((a, b) => a.label.localeCompare(b.label, 'th')),
      })).sort((a, b) => a.label.localeCompare(b.label, 'th')),
    })).sort((a, b) => a.label.localeCompare(b.label, 'th')),
    seasons: Object.entries(PERIOD_LABELS).map(([facetKey, label]) => ({ key: facetKey, label, count: seasonCounts[facetKey] || 0 })),
    months: monthCounts.map((count, index) => ({ month: index + 1, count })),
    shopTypes: Object.entries(shopCounts).map(([facetKey, count]) => ({ key: facetKey, count })),
  };
}

function getBundledContext() {
  if (bundledContext) return bundledContext;
  // Lazy load keeps local tools fast and provides a zero-configuration fallback.
  const catalog = require('./_gen3-products');
  const featuredRecords = Array.isArray(catalog.featured) ? catalog.featured : catalog.featured ? [catalog.featured] : [];
  const featured = featuredRecords.map((record) => normalizeProduct(record, true)).filter(Boolean);
  const ranked = (Array.isArray(catalog.ranked) ? catalog.ranked : []).map((record) => normalizeProduct(record)).filter(Boolean);
  ranked.sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER));
  const byId = new Map([...featured, ...ranked].map((product) => [product.id, product]));
  bundledContext = {
    source: 'bundled',
    schemaVersion: Number(catalog.schemaVersion) || 1,
    generatedAt: text(catalog.generatedAt, 80),
    total: ranked.length,
    featured,
    ranked,
    byId,
    facets: createFacets(ranked),
  };
  bundledContext.snapshotToken = snapshotTokenFor(bundledContext);
  return bundledContext;
}

function catalogDatabaseUrl() {
  if (process.env.GEN3_CATALOG_SOURCE === 'bundled') return '';
  return process.env.GEN3_CATALOG_DATABASE_URL || (process.env.GEN3_CATALOG_SOURCE === 'neon' ? process.env.DATABASE_URL || '' : '');
}

function getNeonClient() {
  const connectionString = catalogDatabaseUrl();
  if (!connectionString) return null;
  if (!neonClient) {
    const { neon } = require('@neondatabase/serverless');
    neonClient = neon(connectionString);
  }
  return neonClient;
}

async function getNeonContext() {
  const sql = getNeonClient();
  if (!sql) return null;
  if (neonContextCache && neonContextCache.expiresAt > Date.now()) return neonContextCache.value;
  const runs = await sql.query(`
    SELECT id, schema_version, generated_at, total_count
    FROM gen3_catalog_runs
    WHERE status = 'active'
    ORDER BY activated_at DESC NULLS LAST, generated_at DESC
    LIMIT 1`);
  const run = runs[0];
  if (!run) throw new Error('No active catalog run');
  const approvedWhere = `run_id = $1 AND featured = false AND review_status = 'approved'`;
  const [categoryRows, seasonRows, monthRows, shopRows, featuredRows] = await Promise.all([
    sql.query(`SELECT category_group_key, category_group, category_key, category, subcategory_key, subcategory, COUNT(*)::int AS count
      FROM gen3_catalog_products WHERE ${approvedWhere}
      GROUP BY category_group_key, category_group, category_key, category, subcategory_key, subcategory`, [run.id]),
    sql.query(`SELECT tag, COUNT(*)::int AS count FROM gen3_catalog_products, UNNEST(season_tags) tag
      WHERE ${approvedWhere} GROUP BY tag`, [run.id]),
    sql.query(`SELECT tag, COUNT(*)::int AS count FROM gen3_catalog_products, UNNEST(month_tags) tag
      WHERE ${approvedWhere} GROUP BY tag`, [run.id]),
    sql.query(`SELECT shop_type AS key, COUNT(*)::int AS count FROM gen3_catalog_products
      WHERE ${approvedWhere} GROUP BY shop_type`, [run.id]),
    sql.query(`SELECT * FROM gen3_catalog_products WHERE run_id = $1 AND featured = true AND review_status = 'approved' ORDER BY rank NULLS LAST, id LIMIT 8`, [run.id]),
  ]);
  const groupMap = new Map();
  for (const row of categoryRows) {
    const groupKey = key(row.category_group_key, 'other');
    const categoryKey = key(row.category_key, 'other');
    const subcategoryKey = key(row.subcategory_key);
    const count = Number(row.count) || 0;
    const group = groupMap.get(groupKey) || { key: groupKey, label: text(row.category_group, 120) || 'อื่น ๆ', count: 0, categories: new Map() };
    group.count += count;
    const category = group.categories.get(categoryKey) || { key: categoryKey, label: text(row.category, 120) || 'อื่น ๆ', count: 0, subcategories: [] };
    category.count += count;
    if (subcategoryKey) category.subcategories.push({ key: subcategoryKey, label: text(row.subcategory, 120), count });
    group.categories.set(categoryKey, category);
    groupMap.set(groupKey, group);
  }
  const seasonCounts = Object.fromEntries(seasonRows.map((row) => [String(row.tag), Number(row.count) || 0]));
  const monthCounts = Object.fromEntries(monthRows.map((row) => [Number(row.tag), Number(row.count) || 0]));
  const facets = {
    groups: [...groupMap.values()].map((group) => ({
      key: group.key,
      label: group.label,
      count: group.count,
      categories: [...group.categories.values()].map((category) => ({
        ...category,
        subcategories: category.subcategories.sort((a, b) => a.label.localeCompare(b.label, 'th')),
      })).sort((a, b) => a.label.localeCompare(b.label, 'th')),
    })).sort((a, b) => a.label.localeCompare(b.label, 'th')),
    seasons: Object.entries(PERIOD_LABELS).map(([facetKey, label]) => ({ key: facetKey, label, count: seasonCounts[facetKey] || 0 })),
    months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: monthCounts[index + 1] || 0 })),
    shopTypes: shopRows.map((row) => ({ key: String(row.key), count: Number(row.count) || 0 })),
  };
  const value = {
    source: 'neon',
    runId: String(run.id),
    schemaVersion: Number(run.schema_version) || 1,
    generatedAt: text(run.generated_at instanceof Date ? run.generated_at.toISOString() : String(run.generated_at || ''), 80),
    total: integer(run.total_count, 0) ?? categoryRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0),
    featured: featuredRows.map((record) => normalizeProduct(record, true)).filter(Boolean),
    facets,
  };
  value.snapshotToken = snapshotTokenFor(value);
  neonContextCache = { value, expiresAt: Date.now() + CONTEXT_TTL_MS };
  return value;
}

async function contextWithFallback() {
  if (!catalogDatabaseUrl()) return getBundledContext();
  try {
    return await getNeonContext();
  } catch (error) {
    console.error('Catalog database unavailable; using bundled fallback', error);
    return getBundledContext();
  }
}

function bundledQuery(context, filters) {
  const matching = context.ranked.filter((product) => matchesFilters(product, filters));
  matching.sort((left, right) => compareProducts(left, right, filters.sort));
  const decoded = decodeCursor(filters.cursor, filters);
  let start = filters.cursor && decoded ? matching.findIndex((product) => product.id === decoded.id) + 1 : filters.offset;
  if (start < 0) start = 0;
  const internalItems = matching.slice(start, start + filters.limit);
  const nextCursor = start + internalItems.length < matching.length && internalItems.length
    ? encodeCursor(internalItems[internalItems.length - 1], filters, context.snapshotToken)
    : null;
  return {
    matched: matching.length,
    offset: start,
    nextOffset: start + internalItems.length < matching.length ? start + internalItems.length : null,
    nextCursor,
    items: internalItems.map(toPublicProduct),
  };
}

function addParameter(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function sqlFilters(filters, runId, includeCursor) {
  const params = [runId];
  const conditions = [`p.run_id = $1`, `p.featured = false`, `p.review_status = 'approved'`];
  if (filters.q) conditions.push(`p.normalized_search_text LIKE '%' || ${addParameter(params, escapeLike(filters.q))} || '%' ESCAPE '!'`);
  if (filters.group !== 'all') conditions.push(`p.category_group_key = ${addParameter(params, filters.group)}`);
  if (filters.category !== 'all') conditions.push(`p.category_key = ${addParameter(params, filters.category)}`);
  if (filters.subcategory !== 'all') conditions.push(`p.subcategory_key = ${addParameter(params, filters.subcategory)}`);
  if (SEASONS.has(filters.period)) conditions.push(`p.season_tags @> ARRAY[${addParameter(params, filters.period)}]::text[]`);
  if (filters.period.startsWith('month-')) conditions.push(`p.month_tags @> ARRAY[${addParameter(params, Number(filters.period.slice(6)))}]::smallint[]`);
  if (filters.price !== 'all') {
    const range = PRICE_RANGES[filters.price];
    if (Number.isFinite(range.min)) conditions.push(`COALESCE(p.price_max, p.price_min) >= ${addParameter(params, range.min)}`);
    if (Number.isFinite(range.max)) conditions.push(`COALESCE(p.price_min, p.price_max) <= ${addParameter(params, range.max)}`);
  }
  if (filters.minSold) conditions.push(`p.item_sold >= ${addParameter(params, filters.minSold)}`);
  if (filters.minRating) conditions.push(`p.rating >= ${addParameter(params, filters.minRating)}`);
  if (filters.shopType !== 'all') conditions.push(`p.shop_type = ${addParameter(params, filters.shopType)}`);
  if (filters.stock === 'in-stock') conditions.push(`p.stock_status = 'in-stock'`);
  if (filters.freshness) conditions.push(`p.checked_at >= NOW() - (${addParameter(params, filters.freshness)} * INTERVAL '1 day')`);

  const cursor = includeCursor ? decodeCursor(filters.cursor, filters) : null;
  if (cursor) {
    const a = addParameter(params, cursor.a);
    const b = addParameter(params, cursor.b);
    const id = addParameter(params, cursor.id);
    if (filters.sort === 'price-asc') conditions.push(`(COALESCE(p.price_min, p.price_max, 9007199254740991) > ${a} OR (COALESCE(p.price_min, p.price_max, 9007199254740991) = ${a} AND p.public_id > ${id}))`);
    else {
      const expressions = {
        'sold-desc': [`COALESCE(p.item_sold, -1)`, `COALESCE(p.recommendation_score, 0)`],
        'rating-desc': [`COALESCE(p.rating, -1)`, `COALESCE(p.item_sold, -1)`],
        'price-desc': [`COALESCE(p.price_max, p.price_min, -1)`, `0`],
        seasonal: [`COALESCE(p.seasonal_score, 0)`, `COALESCE(p.recommendation_score, 0)`],
        newest: [`EXTRACT(EPOCH FROM p.checked_at) * 1000`, `0`],
        recommended: [`COALESCE(p.recommendation_score, 0)`, `-COALESCE(p.rank, 2147483647)`],
      };
      const [firstExpression, secondExpression] = expressions[filters.sort];
      conditions.push(`(${firstExpression} < ${a} OR (${firstExpression} = ${a} AND ${secondExpression} < ${b}) OR (${firstExpression} = ${a} AND ${secondExpression} = ${b} AND p.public_id > ${id}))`);
    }
  }
  return { params, where: conditions.join(' AND ') };
}

function sqlOrder(sort) {
  if (sort === 'sold-desc') return `COALESCE(p.item_sold, -1) DESC, COALESCE(p.recommendation_score, 0) DESC, p.public_id ASC`;
  if (sort === 'rating-desc') return `COALESCE(p.rating, -1) DESC, COALESCE(p.item_sold, -1) DESC, p.public_id ASC`;
  if (sort === 'price-asc') return `COALESCE(p.price_min, p.price_max, 9007199254740991) ASC, p.public_id ASC`;
  if (sort === 'price-desc') return `COALESCE(p.price_max, p.price_min, -1) DESC, p.public_id ASC`;
  if (sort === 'seasonal') return `COALESCE(p.seasonal_score, 0) DESC, COALESCE(p.recommendation_score, 0) DESC, p.public_id ASC`;
  if (sort === 'newest') return `p.checked_at DESC NULLS LAST, p.public_id ASC`;
  return `COALESCE(p.recommendation_score, 0) DESC, p.rank ASC NULLS LAST, p.public_id ASC`;
}

async function neonQuery(context, filters) {
  const sql = getNeonClient();
  const countFilter = sqlFilters(filters, context.runId, false);
  const itemFilter = sqlFilters(filters, context.runId, true);
  const limitParameter = addParameter(itemFilter.params, filters.limit + 1);
  const select = `p.id, p.public_id, p.rank, p.featured, p.category_group_key, p.category_group, p.category_key, p.category,
    p.subcategory_key, p.subcategory, p.image_url, p.clean_name, p.summary, p.price_min, p.price_max, p.price_type,
    p.checked_at, p.product_url, p.shop_name, p.item_sold, p.rating, p.likes, p.shop_rating, p.shop_type, p.stock_status,
    p.season_tags, p.month_tags, p.seasonal_score, p.season_reason, p.reason_codes, p.recommendation_score,
    p.normalized_search_text, p.review_status`;
  const [countRows, rows] = await Promise.all([
    sql.query(`SELECT COUNT(*)::int AS count FROM gen3_catalog_products p WHERE ${countFilter.where}`, countFilter.params),
    sql.query(`SELECT ${select} FROM gen3_catalog_products p WHERE ${itemFilter.where} ORDER BY ${sqlOrder(filters.sort)} LIMIT ${limitParameter}`, itemFilter.params),
  ]);
  const hasMore = rows.length > filters.limit;
  const internalItems = rows.slice(0, filters.limit).map((record) => normalizeProduct(record)).filter(Boolean);
  const matched = Number(countRows[0]?.count) || 0;
  const start = filters.cursor ? Math.max(0, filters.offset) : filters.offset;
  const nextCursor = hasMore && internalItems.length
    ? encodeCursor(internalItems[internalItems.length - 1], filters, context.snapshotToken)
    : null;
  return {
    matched,
    offset: start,
    nextOffset: !filters.cursor && start + internalItems.length < matched ? start + internalItems.length : null,
    nextCursor,
    items: internalItems.map(toPublicProduct),
  };
}

async function queryCatalog(query) {
  const filters = parseFilters(query);
  const decodedCursor = filters.cursor ? decodeCursor(filters.cursor, filters) : null;
  if (filters.cursor && !decodedCursor) {
    const error = new Error('Invalid catalog cursor');
    error.code = 'INVALID_CURSOR';
    throw error;
  }
  let context = await contextWithFallback();
  if (context.source === 'neon' && filters.offset > 0 && !filters.cursor) {
    const error = new Error('Offset pagination is disabled for the database catalog');
    error.code = 'INVALID_PAGINATION';
    throw error;
  }
  if (decodedCursor && decodedCursor.c !== context.snapshotToken) {
    const error = new Error('Catalog snapshot changed');
    error.code = 'CATALOG_CHANGED';
    throw error;
  }
  const resultCacheKey = context.source === 'bundled' ? bundledCacheKey(context, filters) : '';
  if (resultCacheKey) {
    const cached = bundledCacheGet(resultCacheKey);
    if (cached) return cached;
  }
  let result;
  if (context.source === 'neon') {
    try {
      result = await neonQuery(context, filters);
    } catch (error) {
      if (filters.cursor) {
        const changed = new Error('Catalog source changed while paging');
        changed.code = 'CATALOG_CHANGED';
        throw changed;
      }
      console.error('Catalog database query failed; using bundled fallback', error);
      context = getBundledContext();
      result = bundledQuery(context, filters);
    }
  } else {
    result = bundledQuery(context, filters);
  }
  const firstPage = !filters.cursor && filters.offset === 0;
  const response = {
    schemaVersion: context.schemaVersion,
    generatedAt: context.generatedAt,
    total: context.total,
    matched: result.matched,
    offset: result.offset,
    limit: filters.limit,
    nextOffset: result.nextOffset,
    nextCursor: result.nextCursor,
    featured: firstPage ? context.featured.map(toPublicProduct) : [],
    items: result.items,
    facets: context.facets,
    applied: {
      q: filters.q,
      group: filters.group,
      category: filters.category,
      subcategory: filters.subcategory,
      period: filters.period,
      price: filters.price,
      sort: filters.sort,
      minSold: filters.minSold,
      minRating: filters.minRating,
      shopType: filters.shopType,
      stock: filters.stock,
      freshness: filters.freshness,
    },
  };
  if (resultCacheKey) bundledCacheSet(resultCacheKey, response);
  return response;
}

async function getCatalogProductById(id) {
  const cleanId = identifier(id);
  if (!cleanId) return null;
  const context = await contextWithFallback();
  if (context.source === 'neon') {
    try {
      const sql = getNeonClient();
      const rows = await sql.query(`SELECT * FROM gen3_catalog_products WHERE run_id = $1 AND public_id = $2 AND review_status = 'approved' LIMIT 1`, [context.runId, cleanId]);
      return rows[0] ? normalizeProduct(rows[0], rows[0].featured === true) : null;
    } catch (error) {
      console.error('Catalog image lookup failed; using bundled fallback', error);
    }
  }
  return getBundledContext().byId.get(cleanId) || null;
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getCatalogProductById,
  queryCatalog,
};
