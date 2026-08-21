'use strict';

const crypto = require('crypto');

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;
const BUNDLED_FALLBACK_LIMIT = 20_000;
const CONTEXT_TTL_MS = 60_000;
const RESULT_TTL_MS = 120_000;
const RESULT_CACHE_MAX = 50;
const AGGREGATE_TTL_MS = 120_000;
const AGGREGATE_CACHE_MAX = 100;
const IN_FLIGHT_MAX = 100;
const CLIMATE_SEASONS = new Set(['hot', 'rainy', 'cool']);
const SEASONS = new Set(['all-year', ...CLIMATE_SEASONS]);
const MONTH_KEYS = new Set(Array.from({ length: 12 }, (_, index) => String(index + 1)));
const SHOP_TYPES = new Set(['official', 'preferred', 'general']);
const FEATURE_LABELS = Object.freeze({
  'fashion-sleepwear': 'ชุดนอน',
  'fashion-plus-size': 'สาวพลัสไซส์',
  'fashion-office': 'ชุดออฟฟิศ',
});
const MERCHANDISING_FEATURES = new Set(Object.keys(FEATURE_LABELS));
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
  'all-year': 'ไม่เน้นฤดูกาล',
  hot: 'หน้าร้อน/ช่วงอากาศร้อน',
  rainy: 'หน้าฝน/ช่วงฝน',
  cool: 'หน้าหนาว/ช่วงอากาศเย็น',
});
const MONTH_LABELS = Object.freeze(['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']);
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
let neonContextInFlight;
const catalogResultCache = new Map();
const catalogAggregateCache = new Map();
const catalogResultInFlight = new Map();
const catalogAggregateInFlight = new Map();

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

function trustedBundledUrl(value, kind) {
  const candidate = typeof value === 'string' ? value.trim().slice(0, 2_000) : '';
  if (!candidate) return '';
  const shopee = /^https:\/\/(?:[a-z0-9-]+\.)*shopee\.co\.th(?:[/:?#]|$)/i;
  const suresource = /^https:\/\/(?:[a-z0-9-]+\.)*susercontent\.com(?:[/:?#]|$)/i;
  return (shopee.test(candidate) || (kind === 'image' && suresource.test(candidate))) ? candidate : '';
}

function objectValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function scoreMap(value, allowedKeys) {
  const result = {};
  for (const [rawKey, rawScore] of Object.entries(objectValue(value))) {
    const cleanKey = String(rawKey).toLowerCase();
    if (!allowedKeys.has(cleanKey)) continue;
    const score = integer(rawScore, 0, 100);
    if (score !== null) result[cleanKey] = score;
  }
  return result;
}

function reasonMap(value, allowedKeys) {
  const result = {};
  for (const [rawKey, rawReasons] of Object.entries(objectValue(value))) {
    const cleanKey = String(rawKey).toLowerCase();
    if (!allowedKeys.has(cleanKey)) continue;
    const entries = Array.isArray(rawReasons) ? rawReasons : [rawReasons];
    const reasons = [];
    for (const entry of entries) {
      const clean = text(entry, 180);
      if (clean && !reasons.includes(clean)) reasons.push(clean);
      if (reasons.length >= 3) break;
    }
    if (reasons.length) result[cleanKey] = reasons;
  }
  return result;
}

function fallbackKey(label, prefix) {
  return `${prefix}-${crypto.createHash('sha256').update(label).digest('hex').slice(0, 12)}`;
}

function field(record, camel, snake) {
  return record?.[camel] ?? record?.[snake];
}

function normalizeProduct(record, featuredOverride = false, trustedBundle = false) {
  if (!record || typeof record !== 'object') return null;
  const sourceId = identifier(field(record, 'id', 'id'));
  const suppliedId = identifier(field(record, 'publicId', 'public_id'));
  // Bundled rows do not carry public IDs. Defer their SHA-256 derivation until a
  // row is actually returned (or the download index is requested) so the first
  // catalog page does not hash all 20,000 records.
  const id = /^[A-Za-z0-9_-]{12,80}$/.test(suppliedId) ? suppliedId : '';
  const cleanName = text(field(record, 'cleanName', 'clean_name'), 300);
  const imageUrl = trustedBundle
    ? trustedBundledUrl(field(record, 'imageUrl', 'image_url'), 'image')
    : trustedUrl(field(record, 'imageUrl', 'image_url'), 'image');
  const productUrl = trustedBundle
    ? trustedBundledUrl(field(record, 'productUrl', 'product_url'), 'product')
    : trustedUrl(field(record, 'productUrl', 'product_url'), 'product');
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
  const merchandisingTags = stringArray(field(record, 'merchandisingTags', 'merchandising_tags'), MERCHANDISING_FEATURES, MERCHANDISING_FEATURES.size);
  const seasonTags = stringArray(field(record, 'seasonTags', 'season_tags'), SEASONS, 4);
  const monthTags = numberArray(field(record, 'monthTags', 'month_tags'), 1, 12);
  const metadataVersion = text(field(record, 'metadataVersion', 'metadata_version'), 40).toLowerCase();
  const evergreen = field(record, 'evergreen', 'evergreen') === true || seasonTags.includes('all-year');
  const seasonScores = scoreMap(field(record, 'seasonScores', 'season_scores'), CLIMATE_SEASONS);
  const seasonReasons = reasonMap(field(record, 'seasonReasons', 'season_reasons'), CLIMATE_SEASONS);
  const monthScores = scoreMap(field(record, 'monthScores', 'month_scores'), MONTH_KEYS);
  const monthReasons = reasonMap(field(record, 'monthReasons', 'month_reasons'), MONTH_KEYS);
  const summary = text(field(record, 'summary', 'summary'), 700);
  const suppliedSearchText = field(record, 'normalizedSearchText', 'normalized_search_text');
  const normalizedSearchText = (trustedBundle && typeof suppliedSearchText === 'string' ? suppliedSearchText.slice(0, 2_000) : normalizeSearch(suppliedSearchText))
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
    merchandisingTags,
    seasonTags,
    monthTags,
    metadataVersion,
    evergreen,
    seasonScores,
    seasonReasons,
    monthScores,
    monthReasons,
    seasonalScore: integer(field(record, 'seasonalScore', 'seasonal_score'), 0, 100) ?? 0,
    seasonReason: text(field(record, 'seasonReason', 'season_reason'), 240),
    reasonCodes: stringArray(field(record, 'reasonCodes', 'reason_codes'), null, 12),
    recommendationScore,
    normalizedSearchText,
  };
}

function productPublicId(product) {
  if (!product.id) product.id = publicIdFor(product.sourceId, '');
  return product.id;
}

function isPeakMonth(product, month) {
  return Number(product.monthScores[String(month)]) > 0 || product.monthTags.includes(month);
}

function selectedPeriodMatch(product, period) {
  if (!period || period === 'all') return { period: 'all', kind: 'none', score: 0, reason: '', badge: '' };
  if (period === 'all-year') {
    return product.evergreen
      ? { period, kind: 'evergreen', score: 0, reason: 'เหมาะใช้เป็นสินค้าที่ไม่เน้นฤดูกาล', badge: 'ไม่เน้นฤดูกาล' }
      : { period, kind: 'none', score: 0, reason: '', badge: '' };
  }
  if (CLIMATE_SEASONS.has(period)) {
    if (!product.seasonTags.includes(period)) return { period, kind: 'none', score: 0, reason: '', badge: '' };
    const mappedScore = integer(product.seasonScores[period], 0, 100);
    const score = mappedScore !== null && mappedScore > 0 ? mappedScore : product.seasonalScore;
    const reason = product.seasonReasons[period]?.[0] || product.seasonReason || `เหมาะกับ${PERIOD_LABELS[period]}`;
    return { period, kind: 'season', score, reason, badge: `เด่น${PERIOD_LABELS[period]}` };
  }
  if (period.startsWith('month-')) {
    const month = Number(period.slice(6));
    const monthKey = String(month);
    const mappedScore = integer(product.monthScores[monthKey], 0, 100);
    const isPeak = isPeakMonth(product, month);
    if (isPeak) {
      const score = mappedScore !== null && mappedScore > 0 ? mappedScore : product.seasonalScore;
      const reason = product.monthReasons[monthKey]?.[0] || product.seasonReason || `เหมาะทำคอนเทนต์ในเดือน${MONTH_LABELS[month - 1]}`;
      return { period, kind: 'peak', score, reason, badge: `เด่นเดือน${MONTH_LABELS[month - 1]}` };
    }
    if (product.evergreen) {
      return { period, kind: 'evergreen-fallback', score: 0, reason: `สินค้าไม่เน้นฤดูกาล ใช้เป็นตัวเลือกสำรองของเดือน${MONTH_LABELS[month - 1]}ได้`, badge: 'ไม่เน้นฤดูกาล' };
    }
  }
  return { period, kind: 'none', score: 0, reason: '', badge: '' };
}

function periodSortTier(match) {
  if (match.kind === 'peak' || match.kind === 'season') return 2;
  if (match.kind === 'evergreen' || match.kind === 'evergreen-fallback') return 1;
  return 0;
}

function reasonBadges(product, periodMatch) {
  const labels = [];
  if (periodMatch?.badge) labels.push(periodMatch.badge);
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

function toPublicProduct(product, filters) {
  const periodMatch = selectedPeriodMatch(product, filters?.period || 'all');
  return {
    id: productPublicId(product),
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
    merchandisingTags: product.merchandisingTags,
    seasonTags: product.seasonTags,
    monthTags: product.monthTags,
    seasonalScore: product.seasonalScore,
    seasonReason: product.seasonReason,
    periodMatch,
    reasonBadges: reasonBadges(product, periodMatch).slice(0, 3),
    safetyNotice: safetyNotice(product),
  };
}

function parseFilters(query = {}) {
  const q = queryText(query.q, 100);
  const requestedPeriod = queryText(query.period, 24).toLowerCase();
  const period = requestedPeriod === 'all' || SEASONS.has(requestedPeriod) || /^month-(?:[1-9]|1[0-2])$/.test(requestedPeriod) ? requestedPeriod : 'all';
  const requestedPrice = queryText(query.price, 24).toLowerCase();
  const price = Object.prototype.hasOwnProperty.call(PRICE_RANGES, requestedPrice) ? requestedPrice : 'all';
  const legacySort = queryText(query.sort, 24).toLowerCase();
  let sort = legacySort === 'rank' ? 'recommended' : SORTS.has(legacySort) ? legacySort : 'recommended';
  if (sort === 'seasonal' && period === 'all') sort = 'recommended';
  const requestedShop = queryText(query.shopType, 20).toLowerCase();
  const shopType = SHOP_TYPES.has(requestedShop) ? requestedShop : 'all';
  const requestedFeature = queryText(query.feature, 40).toLowerCase();
  const feature = MERCHANDISING_FEATURES.has(requestedFeature) ? requestedFeature : 'all';
  const freshness = [7, 30, 90].includes(integerQuery(query.freshness, 0, 0, 90)) ? integerQuery(query.freshness, 0, 0, 90) : 0;
  return {
    q,
    normalizedQ: normalizeSearch(q),
    group: key(queryText(query.group, 80).toLowerCase(), 'all'),
    category: key(queryText(query.category, 80).toLowerCase(), 'all'),
    subcategory: key(queryText(query.subcategory, 80).toLowerCase(), 'all'),
    period,
    price,
    sort,
    minSold: integerQuery(query.minSold, 0, 0, 100_000_000),
    minRating: [0, 4.5, 4.7, 4.8].includes(Number(first(query.minRating))) ? Number(first(query.minRating)) : 0,
    shopType,
    feature,
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

const NO_EXCLUSIONS = new Set();
const GROUP_EXCLUSIONS = new Set(['group', 'category', 'subcategory']);
const CATEGORY_EXCLUSIONS = new Set(['category', 'subcategory']);
const SUBCATEGORY_EXCLUSIONS = new Set(['subcategory']);
const PERIOD_EXCLUSIONS = new Set(['period']);
const SHOP_EXCLUSIONS = new Set(['shopType']);
const FEATURE_EXCLUSIONS = new Set(['feature']);

function matchesFilters(product, filters, excluded = NO_EXCLUSIONS) {
  if (!excluded.has('q') && filters.normalizedQ && !product.normalizedSearchText.includes(filters.normalizedQ)) return false;
  if (!excluded.has('group') && filters.group !== 'all' && product.categoryGroupKey !== filters.group) return false;
  if (!excluded.has('category') && filters.category !== 'all' && product.categoryKey !== filters.category) return false;
  if (!excluded.has('subcategory') && filters.subcategory !== 'all' && product.subcategoryKey !== filters.subcategory) return false;
  if (!excluded.has('period') && filters.period !== 'all') {
    if (filters.period === 'all-year' && !product.evergreen) return false;
    if (CLIMATE_SEASONS.has(filters.period) && !product.seasonTags.includes(filters.period)) return false;
    if (filters.period.startsWith('month-')) {
      const month = Number(filters.period.slice(6));
      if (!isPeakMonth(product, month) && !product.evergreen) return false;
    }
  }
  if (!excluded.has('price') && filters.price !== 'all') {
    const selected = PRICE_RANGES[filters.price];
    const range = priceRange(product);
    if (!range || range.max < selected.min || range.min > selected.max) return false;
  }
  if (!excluded.has('minSold') && filters.minSold && (product.itemSold === null || product.itemSold < filters.minSold)) return false;
  if (!excluded.has('minRating') && filters.minRating && (product.rating === null || product.rating < filters.minRating)) return false;
  if (!excluded.has('shopType') && filters.shopType !== 'all' && product.shopType !== filters.shopType) return false;
  if (!excluded.has('feature') && filters.feature !== 'all' && !product.merchandisingTags.includes(filters.feature)) return false;
  if (!excluded.has('stock') && filters.stock === 'in-stock' && product.stockStatus !== 'in-stock') return false;
  if (!excluded.has('freshness') && filters.freshness) {
    const checked = Date.parse(product.checkedAt);
    if (!Number.isFinite(checked) || checked < Date.now() - filters.freshness * 86_400_000) return false;
  }
  return true;
}

function sortValues(product, filters) {
  const sort = filters.sort;
  const monthMatch = filters.period.startsWith('month-') ? selectedPeriodMatch(product, filters.period) : null;
  const monthTier = monthMatch ? periodSortTier(monthMatch) : 0;
  if (sort === 'sold-desc') return [(monthTier ? monthTier * 1_000_000_000_000 : 0) + Math.min(product.itemSold ?? -1, 999_999_999_999), product.recommendationScore];
  if (sort === 'rating-desc') return [(monthTier ? monthTier * 10 : 0) + (product.rating ?? -1), product.itemSold ?? -1];
  if (sort === 'price-asc') return [(monthMatch ? (2 - monthTier) * 10_000_000_000_000 : 0) + (product.priceMin ?? product.priceMax ?? 9_000_000_000_000), 0];
  if (sort === 'price-desc') return [(monthTier ? monthTier * 10_000_000_000_000 : 0) + (product.priceMax ?? product.priceMin ?? -1), 0];
  if (sort === 'seasonal') {
    const match = selectedPeriodMatch(product, filters.period);
    return [periodSortTier(match) * 101 + match.score, product.recommendationScore];
  }
  if (sort === 'newest') return [(monthTier ? monthTier * 10_000_000_000_000 : 0) + (Date.parse(product.checkedAt) || 0), 0];
  return [(monthTier ? monthTier * 10_000_000 : 0) + product.recommendationScore, -(product.rank ?? Number.MAX_SAFE_INTEGER)];
}

function compareProducts(left, right, filters) {
  const [leftA, leftB] = sortValues(left, filters);
  const [rightA, rightB] = sortValues(right, filters);
  if (filters.sort === 'price-asc') return leftA - rightA || productPublicId(left).localeCompare(productPublicId(right));
  return rightA - leftA || rightB - leftB || productPublicId(left).localeCompare(productPublicId(right));
}

function appliedSignature(filters) {
  const stable = JSON.stringify(['q', 'group', 'category', 'subcategory', 'period', 'price', 'sort', 'minSold', 'minRating', 'shopType', 'feature', 'stock', 'freshness']
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
  const [a, b] = sortValues(product, filters);
  const payload = Buffer.from(JSON.stringify({ v: 2, q: appliedSignature(filters), c: snapshotToken, s: filters.sort, a, b, id: productPublicId(product) }), 'utf8').toString('base64url');
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

function resultCacheKey(context, filters) {
  return `${context.snapshotToken}:${JSON.stringify(filters)}`;
}

function aggregateCacheKey(context, filters) {
  const stable = ['q', 'group', 'category', 'subcategory', 'period', 'price', 'minSold', 'minRating', 'shopType', 'feature', 'stock', 'freshness']
    .map((name) => [name, filters[name]]);
  return `${context.snapshotToken}:${JSON.stringify(stable)}`;
}

function lruCacheGet(cache, key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, cached);
  return cached.value;
}

function lruCacheSet(cache, key, value, maxEntries, ttlMs) {
  if (cache.has(key)) cache.delete(key);
  while (cache.size >= maxEntries) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function resultCacheGet(key) {
  return lruCacheGet(catalogResultCache, key);
}

function resultCacheSet(key, value) {
  lruCacheSet(catalogResultCache, key, value, RESULT_CACHE_MAX, RESULT_TTL_MS);
}

function aggregateCacheGet(key) {
  return lruCacheGet(catalogAggregateCache, key);
}

function aggregateCacheSet(key, value) {
  lruCacheSet(catalogAggregateCache, key, value, AGGREGATE_CACHE_MAX, AGGREGATE_TTL_MS);
}

async function shareInFlight(inFlight, cacheKey, operation) {
  const current = inFlight.get(cacheKey);
  if (current) return current;
  if (inFlight.size >= IN_FLIGHT_MAX) return operation();
  const pending = Promise.resolve().then(operation);
  inFlight.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    if (inFlight.get(cacheKey) === pending) inFlight.delete(cacheKey);
  }
}

function clearRuntimeCaches() {
  catalogResultCache.clear();
  catalogAggregateCache.clear();
  catalogResultInFlight.clear();
  catalogAggregateInFlight.clear();
}

function createFacets(products, schemaVersion = 4) {
  const groups = new Map();
  const seasonCounts = Object.fromEntries([...SEASONS].map((season) => [season, 0]));
  const monthCounts = Array.from({ length: 12 }, () => ({ peak: 0, evergreenFallback: 0 }));
  const shopCounts = { official: 0, preferred: 0, general: 0 };
  const featureCounts = Object.fromEntries([...MERCHANDISING_FEATURES].map((feature) => [feature, 0]));
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
    if (product.evergreen) seasonCounts['all-year'] += 1;
    for (const season of CLIMATE_SEASONS) {
      if (product.seasonTags.includes(season)) seasonCounts[season] += 1;
    }
    for (let month = 1; month <= 12; month += 1) {
      if (isPeakMonth(product, month)) monthCounts[month - 1].peak += 1;
      else if (product.evergreen) monthCounts[month - 1].evergreenFallback += 1;
    }
    shopCounts[product.shopType] += 1;
    for (const feature of product.merchandisingTags) featureCounts[feature] += 1;
  }
  return {
    groups: [...groups.values()].map((group) => ({
      key: group.key,
      label: group.label,
      count: group.count,
      available: group.count > 0,
      categories: [...group.categories.values()].map((category) => ({
        key: category.key,
        label: category.label,
        count: category.count,
        available: category.count > 0,
        subcategories: [...category.subcategories.values()].map((subcategory) => ({ ...subcategory, available: subcategory.count > 0 })).sort((a, b) => a.label.localeCompare(b.label, 'th')),
      })).sort((a, b) => a.label.localeCompare(b.label, 'th')),
    })).sort((a, b) => a.label.localeCompare(b.label, 'th')),
    seasons: Object.entries(PERIOD_LABELS).map(([facetKey, label]) => ({ key: facetKey, label, count: seasonCounts[facetKey] || 0, available: (seasonCounts[facetKey] || 0) > 0 })),
    months: monthCounts.map((counts, index) => ({
      month: index + 1,
      count: counts.peak + counts.evergreenFallback,
      peakCount: counts.peak,
      evergreenFallbackCount: counts.evergreenFallback,
      available: counts.peak + counts.evergreenFallback > 0,
    })),
    shopTypes: Object.entries(shopCounts).map(([facetKey, count]) => ({ key: facetKey, count, available: count > 0 })),
    features: schemaVersion >= 5
      ? Object.entries(FEATURE_LABELS).map(([facetKey, label]) => ({ key: facetKey, label, count: featureCounts[facetKey] || 0, available: (featureCounts[facetKey] || 0) > 0 }))
      : [],
  };
}

function increment(map, mapKey) {
  map.set(mapKey, (map.get(mapKey) || 0) + 1);
}

function projectTaxonomyFacetDepth(groups, filters) {
  const selectedGroup = filters.group !== 'all' ? filters.group : '';
  const selectedCategory = selectedGroup && filters.category !== 'all' ? filters.category : '';
  return groups.map((group) => ({
    ...group,
    categories: group.key === selectedGroup
      ? group.categories.map((category) => ({
        ...category,
        subcategories: category.key === selectedCategory ? category.subcategories : [],
      }))
      : [],
  }));
}

function createContextualFacets(context, filters) {
  const groupCounts = new Map();
  const categoryCounts = new Map();
  const subcategoryCounts = new Map();
  const seasonCounts = Object.fromEntries([...SEASONS].map((season) => [season, 0]));
  const monthCounts = Array.from({ length: 12 }, () => ({ peak: 0, evergreenFallback: 0 }));
  const shopCounts = { official: 0, preferred: 0, general: 0 };
  const featureCounts = Object.fromEntries([...MERCHANDISING_FEATURES].map((feature) => [feature, 0]));

  for (const product of context.ranked) {
    if (matchesFilters(product, filters, GROUP_EXCLUSIONS)) {
      increment(groupCounts, product.categoryGroupKey);
    }
    if (matchesFilters(product, filters, CATEGORY_EXCLUSIONS)) {
      increment(categoryCounts, `${product.categoryGroupKey}\u0000${product.categoryKey}`);
    }
    if (product.subcategoryKey && matchesFilters(product, filters, SUBCATEGORY_EXCLUSIONS)) {
      increment(subcategoryCounts, `${product.categoryGroupKey}\u0000${product.categoryKey}\u0000${product.subcategoryKey}`);
    }
    if (matchesFilters(product, filters, PERIOD_EXCLUSIONS)) {
      if (product.evergreen) seasonCounts['all-year'] += 1;
      for (const season of CLIMATE_SEASONS) {
        if (product.seasonTags.includes(season)) seasonCounts[season] += 1;
      }
      for (let month = 1; month <= 12; month += 1) {
        if (isPeakMonth(product, month)) monthCounts[month - 1].peak += 1;
        else if (product.evergreen) monthCounts[month - 1].evergreenFallback += 1;
      }
    }
    if (matchesFilters(product, filters, SHOP_EXCLUSIONS)) shopCounts[product.shopType] += 1;
    if (matchesFilters(product, filters, FEATURE_EXCLUSIONS)) {
      for (const feature of product.merchandisingTags) featureCounts[feature] += 1;
    }
  }

  return {
    groups: projectTaxonomyFacetDepth(context.facets.groups.map((group) => {
      const groupCount = groupCounts.get(group.key) || 0;
      return {
        ...group,
        count: groupCount,
        available: groupCount > 0,
        categories: group.categories.map((category) => {
          const categoryCount = categoryCounts.get(`${group.key}\u0000${category.key}`) || 0;
          return {
            ...category,
            count: categoryCount,
            available: categoryCount > 0,
            subcategories: category.subcategories.map((subcategory) => {
              const subcategoryCount = subcategoryCounts.get(`${group.key}\u0000${category.key}\u0000${subcategory.key}`) || 0;
              return { ...subcategory, count: subcategoryCount, available: subcategoryCount > 0 };
            }),
          };
        }),
      };
    }), filters),
    seasons: Object.entries(PERIOD_LABELS).map(([facetKey, label]) => ({
      key: facetKey,
      label,
      count: seasonCounts[facetKey] || 0,
      available: (seasonCounts[facetKey] || 0) > 0,
    })),
    months: monthCounts.map((counts, index) => ({
      month: index + 1,
      count: counts.peak + counts.evergreenFallback,
      peakCount: counts.peak,
      evergreenFallbackCount: counts.evergreenFallback,
      available: counts.peak + counts.evergreenFallback > 0,
    })),
    shopTypes: Object.entries(shopCounts).map(([facetKey, count]) => ({ key: facetKey, count, available: count > 0 })),
    features: context.facets.features.map((feature) => {
      const count = featureCounts[feature.key] || 0;
      return { ...feature, count, available: count > 0 };
    }),
  };
}

function periodSummary(products, period) {
  if (!period || period === 'all') return null;
  let peakMatches = 0;
  let evergreenFallbackMatches = 0;
  let exactMatches = 0;
  for (const product of products) {
    const match = selectedPeriodMatch(product, period);
    if (match.kind === 'peak') peakMatches += 1;
    else if (match.kind === 'evergreen-fallback') evergreenFallbackMatches += 1;
    else if (match.kind === 'season' || match.kind === 'evergreen') exactMatches += 1;
  }
  return {
    period,
    mode: period.startsWith('month-') ? 'month-with-evergreen-fallback' : 'exact',
    peakMatches,
    evergreenFallbackMatches,
    exactMatches,
    total: products.length,
  };
}

function hasAggregateFilters(filters) {
  return Boolean(filters.q)
    || filters.group !== 'all'
    || filters.category !== 'all'
    || filters.subcategory !== 'all'
    || filters.period !== 'all'
    || filters.price !== 'all'
    || filters.minSold > 0
    || filters.minRating > 0
    || filters.shopType !== 'all'
    || filters.feature !== 'all'
    || filters.stock !== 'all'
    || filters.freshness > 0;
}

function baseAggregate(context, filters) {
  return {
    matched: context.total,
    facets: {
      ...context.facets,
      groups: projectTaxonomyFacetDepth(context.facets.groups, filters),
    },
    periodSummary: null,
  };
}

function getBundledContext() {
  if (bundledContext) return bundledContext;
  // Lazy load keeps local tools fast and provides a zero-configuration fallback.
  const catalog = require('./_gen3-products');
  const featuredRecords = Array.isArray(catalog.featured) ? catalog.featured : catalog.featured ? [catalog.featured] : [];
  const featured = featuredRecords.map((record) => normalizeProduct(record, true, true)).filter(Boolean);
  const requestedFallbackCount = integer(catalog.bundledFallbackRankedCount, 1, BUNDLED_FALLBACK_LIMIT) ?? BUNDLED_FALLBACK_LIMIT;
  const rankedRecords = Array.isArray(catalog.ranked) ? catalog.ranked.slice(0, requestedFallbackCount) : [];
  const ranked = rankedRecords.map((record) => normalizeProduct(record, false, true)).filter(Boolean);
  ranked.sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER));
  const schemaVersion = Number(catalog.schemaVersion) || 1;
  bundledContext = {
    source: 'bundled',
    schemaVersion,
    generatedAt: text(catalog.generatedAt, 80),
    total: ranked.length,
    featured,
    ranked,
    byId: null,
    facets: createFacets(ranked, schemaVersion),
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

async function loadNeonContext() {
  const sql = getNeonClient();
  if (!sql) return null;
  const runs = await sql.query(`
    SELECT id, schema_version, generated_at, total_count
    FROM gen3_catalog_runs
    WHERE status = 'active'
    ORDER BY activated_at DESC NULLS LAST, generated_at DESC
    LIMIT 1`);
  const run = runs[0];
  if (!run) throw new Error('No active catalog run');
  const schemaVersion = Number(run.schema_version) || 1;
  const approvedWhere = `run_id = $1 AND featured = false AND review_status = 'approved'`;
  const [categoryRows, periodRows, shopRows, featureRows, featuredRows] = await Promise.all([
    sql.query(`SELECT category_group_key, category_group, category_key, category, subcategory_key, subcategory, COUNT(*)::int AS count
      FROM gen3_catalog_products WHERE ${approvedWhere}
      GROUP BY category_group_key, category_group, category_key, category, subcategory_key, subcategory`, [run.id]),
    sql.query(`SELECT ${periodAggregateSelect(schemaVersion)}
      FROM gen3_catalog_products p WHERE p.run_id = $1 AND p.featured = false AND p.review_status = 'approved'`, [run.id]),
    sql.query(`SELECT shop_type AS key, COUNT(*)::int AS count FROM gen3_catalog_products
      WHERE ${approvedWhere} GROUP BY shop_type`, [run.id]),
    sql.query(`SELECT tag AS key, COUNT(*)::int AS count FROM gen3_catalog_products, UNNEST(merchandising_tags) tag
      WHERE ${approvedWhere} GROUP BY tag`, [run.id]),
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
  const periodRow = periodRows[0] || {};
  const featureCounts = Object.fromEntries(featureRows.map((row) => [String(row.key), Number(row.count) || 0]));
  const facets = {
    groups: [...groupMap.values()].map((group) => ({
      key: group.key,
      label: group.label,
      count: group.count,
      available: group.count > 0,
      categories: [...group.categories.values()].map((category) => ({
        ...category,
        available: category.count > 0,
        subcategories: category.subcategories
          .map((subcategory) => ({ ...subcategory, available: subcategory.count > 0 }))
          .sort((a, b) => a.label.localeCompare(b.label, 'th')),
      })).sort((a, b) => a.label.localeCompare(b.label, 'th')),
    })).sort((a, b) => a.label.localeCompare(b.label, 'th')),
    seasons: Object.entries(PERIOD_LABELS).map(([facetKey, label]) => {
      const column = facetKey === 'all-year' ? 'all_year_count' : `${facetKey}_count`;
      const count = Number(periodRow[column]) || 0;
      return { key: facetKey, label, count, available: count > 0 };
    }),
    months: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const peakCount = Number(periodRow[`month_${month}_peak`]) || 0;
      const evergreenFallbackCount = Number(periodRow[`month_${month}_evergreen`]) || 0;
      return { month, count: peakCount + evergreenFallbackCount, peakCount, evergreenFallbackCount, available: peakCount + evergreenFallbackCount > 0 };
    }),
    shopTypes: ['official', 'preferred', 'general'].map((facetKey) => {
      const row = shopRows.find((candidate) => String(candidate.key) === facetKey);
      const count = Number(row?.count) || 0;
      return { key: facetKey, count, available: count > 0 };
    }),
    features: schemaVersion >= 5
      ? Object.entries(FEATURE_LABELS).map(([facetKey, label]) => {
        const count = featureCounts[facetKey] || 0;
        return { key: facetKey, label, count, available: count > 0 };
      })
      : [],
  };
  const value = {
    source: 'neon',
    runId: String(run.id),
    schemaVersion,
    generatedAt: text(run.generated_at instanceof Date ? run.generated_at.toISOString() : String(run.generated_at || ''), 80),
    total: integer(run.total_count, 0) ?? categoryRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0),
    featured: featuredRows.map((record) => normalizeProduct(record, true)).filter(Boolean),
    facets,
  };
  value.snapshotToken = snapshotTokenFor(value);
  neonContextCache = { value, expiresAt: Date.now() + CONTEXT_TTL_MS };
  return value;
}

async function getNeonContext() {
  const sql = getNeonClient();
  if (!sql) return null;
  if (neonContextCache && neonContextCache.expiresAt > Date.now()) return neonContextCache.value;
  if (neonContextInFlight) return neonContextInFlight;
  const pending = loadNeonContext();
  neonContextInFlight = pending;
  try {
    return await pending;
  } finally {
    if (neonContextInFlight === pending) neonContextInFlight = null;
  }
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
  matching.sort((left, right) => compareProducts(left, right, filters));
  const decoded = decodeCursor(filters.cursor, filters);
  let start = filters.cursor && decoded ? matching.findIndex((product) => productPublicId(product) === decoded.id) + 1 : filters.offset;
  if (start < 0) start = 0;
  const internalItems = matching.slice(start, start + filters.limit);
  const nextCursor = start + internalItems.length < matching.length && internalItems.length
    ? encodeCursor(internalItems[internalItems.length - 1], filters, context.snapshotToken)
    : null;
  const cacheKey = aggregateCacheKey(context, filters);
  let aggregate = aggregateCacheGet(cacheKey);
  if (!aggregate) {
    aggregate = hasAggregateFilters(filters)
      ? {
        matched: matching.length,
        facets: createContextualFacets(context, filters),
        periodSummary: periodSummary(matching, filters.period),
      }
      : baseAggregate(context, filters);
    aggregateCacheSet(cacheKey, aggregate);
  }
  return {
    matched: aggregate.matched,
    offset: start,
    nextOffset: start + internalItems.length < matching.length ? start + internalItems.length : null,
    nextCursor,
    items: internalItems.map((product) => toPublicProduct(product, filters)),
    facets: aggregate.facets,
    periodSummary: aggregate.periodSummary,
  };
}

function addParameter(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function sqlEvergreenExpression(schemaVersion) {
  return schemaVersion >= 4
    ? `(COALESCE(p.evergreen, FALSE) OR p.season_tags @> ARRAY['all-year']::text[])`
    : `p.season_tags @> ARRAY['all-year']::text[]`;
}

function sqlMonthPeakExpression(month) {
  return `p.month_tags @> ARRAY[${Number(month)}]::smallint[]`;
}

function sqlPeriodScoreExpression(period, schemaVersion) {
  if (schemaVersion >= 4 && CLIMATE_SEASONS.has(period)) {
    return `COALESCE(NULLIF((p.season_scores ->> '${period}')::int, 0), p.seasonal_score, 0)`;
  }
  if (schemaVersion >= 4 && period.startsWith('month-')) {
    const month = Number(period.slice(6));
    return `COALESCE(NULLIF((p.month_scores ->> '${month}')::int, 0), p.seasonal_score, 0)`;
  }
  return `COALESCE(p.seasonal_score, 0)`;
}

function sqlPeriodSortExpression(filters, schemaVersion) {
  if (filters.period.startsWith('month-')) {
    const month = Number(filters.period.slice(6));
    const peak = sqlMonthPeakExpression(month);
    const evergreen = sqlEvergreenExpression(schemaVersion);
    const score = sqlPeriodScoreExpression(filters.period, schemaVersion);
    return `(CASE WHEN ${peak} THEN 202 + ${score} WHEN ${evergreen} THEN 101 ELSE 0 END)`;
  }
  if (CLIMATE_SEASONS.has(filters.period)) return `(202 + ${sqlPeriodScoreExpression(filters.period, schemaVersion)})`;
  if (filters.period === 'all-year') return `101`;
  return `0`;
}

function sqlMonthTierExpression(filters, schemaVersion) {
  if (!filters.period.startsWith('month-')) return `0`;
  const month = Number(filters.period.slice(6));
  const peak = sqlMonthPeakExpression(month);
  const evergreen = sqlEvergreenExpression(schemaVersion);
  return `(CASE WHEN ${peak} THEN 2 WHEN ${evergreen} THEN 1 ELSE 0 END)`;
}

function sqlSortExpressions(filters, schemaVersion) {
  const tier = sqlMonthTierExpression(filters, schemaVersion);
  const hasMonthTier = filters.period.startsWith('month-');
  const expressions = {
    'sold-desc': [hasMonthTier ? `(${tier} * 1000000000000 + LEAST(COALESCE(p.item_sold, -1), 999999999999))` : `COALESCE(p.item_sold, -1)`, `COALESCE(p.recommendation_score, 0)`],
    'rating-desc': [hasMonthTier ? `(${tier} * 10 + COALESCE(p.rating, -1))` : `COALESCE(p.rating, -1)`, `COALESCE(p.item_sold, -1)`],
    'price-asc': [hasMonthTier ? `((2 - ${tier}) * 10000000000000 + COALESCE(p.price_min, p.price_max, 9000000000000))` : `COALESCE(p.price_min, p.price_max, 9000000000000)`, `0`],
    'price-desc': [hasMonthTier ? `(${tier} * 10000000000000 + COALESCE(p.price_max, p.price_min, -1))` : `COALESCE(p.price_max, p.price_min, -1)`, `0`],
    seasonal: [sqlPeriodSortExpression(filters, schemaVersion), `COALESCE(p.recommendation_score, 0)`],
    newest: [hasMonthTier ? `(${tier} * 10000000000000 + COALESCE(EXTRACT(EPOCH FROM p.checked_at) * 1000, 0))` : `COALESCE(EXTRACT(EPOCH FROM p.checked_at) * 1000, 0)`, `0`],
    recommended: [hasMonthTier ? `(${tier} * 10000000 + COALESCE(p.recommendation_score, 0))` : `COALESCE(p.recommendation_score, 0)`, `-COALESCE(p.rank, 2147483647)`],
  };
  return expressions[filters.sort];
}

function sqlFilters(filters, runId, includeCursor, schemaVersion, excluded = NO_EXCLUSIONS) {
  const params = [runId];
  const conditions = [`p.run_id = $1`, `p.featured = false`, `p.review_status = 'approved'`];
  if (!excluded.has('q') && filters.q) conditions.push(`p.normalized_search_text LIKE '%' || ${addParameter(params, escapeLike(filters.q))} || '%' ESCAPE '!'`);
  if (!excluded.has('group') && filters.group !== 'all') conditions.push(`p.category_group_key = ${addParameter(params, filters.group)}`);
  if (!excluded.has('category') && filters.category !== 'all') conditions.push(`p.category_key = ${addParameter(params, filters.category)}`);
  if (!excluded.has('subcategory') && filters.subcategory !== 'all') conditions.push(`p.subcategory_key = ${addParameter(params, filters.subcategory)}`);
  if (!excluded.has('period') && filters.period === 'all-year') conditions.push(sqlEvergreenExpression(schemaVersion));
  if (!excluded.has('period') && CLIMATE_SEASONS.has(filters.period)) conditions.push(`p.season_tags @> ARRAY[${addParameter(params, filters.period)}]::text[]`);
  if (!excluded.has('period') && filters.period.startsWith('month-')) {
    const month = Number(filters.period.slice(6));
    conditions.push(`(${sqlMonthPeakExpression(month)} OR ${sqlEvergreenExpression(schemaVersion)})`);
  }
  if (!excluded.has('price') && filters.price !== 'all') {
    const range = PRICE_RANGES[filters.price];
    if (Number.isFinite(range.min)) conditions.push(`COALESCE(p.price_max, p.price_min) >= ${addParameter(params, range.min)}`);
    if (Number.isFinite(range.max)) conditions.push(`COALESCE(p.price_min, p.price_max) <= ${addParameter(params, range.max)}`);
  }
  if (!excluded.has('minSold') && filters.minSold) conditions.push(`p.item_sold >= ${addParameter(params, filters.minSold)}`);
  if (!excluded.has('minRating') && filters.minRating) conditions.push(`p.rating >= ${addParameter(params, filters.minRating)}`);
  if (!excluded.has('shopType') && filters.shopType !== 'all') conditions.push(`p.shop_type = ${addParameter(params, filters.shopType)}`);
  if (!excluded.has('feature') && filters.feature !== 'all') conditions.push(`p.merchandising_tags @> ARRAY[${addParameter(params, filters.feature)}]::text[]`);
  if (!excluded.has('stock') && filters.stock === 'in-stock') conditions.push(`p.stock_status = 'in-stock'`);
  if (!excluded.has('freshness') && filters.freshness) conditions.push(`p.checked_at >= NOW() - (${addParameter(params, filters.freshness)} * INTERVAL '1 day')`);

  const cursor = includeCursor ? decodeCursor(filters.cursor, filters) : null;
  if (cursor) {
    const a = addParameter(params, cursor.a);
    const b = addParameter(params, cursor.b);
    const id = addParameter(params, cursor.id);
    if (filters.sort === 'price-asc') {
      const [firstExpression] = sqlSortExpressions(filters, schemaVersion);
      conditions.push(`(${firstExpression} > ${a} OR (${firstExpression} = ${a} AND p.public_id > ${id}))`);
    }
    else {
      const [firstExpression, secondExpression] = sqlSortExpressions(filters, schemaVersion);
      conditions.push(`(${firstExpression} < ${a} OR (${firstExpression} = ${a} AND ${secondExpression} < ${b}) OR (${firstExpression} = ${a} AND ${secondExpression} = ${b} AND p.public_id > ${id}))`);
    }
  }
  return { params, where: conditions.join(' AND ') };
}

function sqlOrder(filters, schemaVersion) {
  const sort = filters.sort;
  const [firstExpression, secondExpression] = sqlSortExpressions(filters, schemaVersion);
  if (sort === 'price-asc') return `${firstExpression} ASC, p.public_id ASC`;
  return `${firstExpression} DESC, ${secondExpression} DESC, p.public_id ASC`;
}

function periodAggregateSelect(schemaVersion) {
  const evergreen = sqlEvergreenExpression(schemaVersion);
  const fields = [
    `COUNT(*) FILTER (WHERE ${evergreen})::int AS all_year_count`,
    ...[...CLIMATE_SEASONS].map((season) => `COUNT(*) FILTER (WHERE p.season_tags @> ARRAY['${season}']::text[])::int AS ${season}_count`),
  ];
  for (let month = 1; month <= 12; month += 1) {
    const peak = sqlMonthPeakExpression(month);
    fields.push(`COUNT(*) FILTER (WHERE ${peak})::int AS month_${month}_peak`);
    fields.push(`COUNT(*) FILTER (WHERE ${evergreen} AND NOT (${peak}))::int AS month_${month}_evergreen`);
  }
  return fields.join(',\n');
}

function contextualFacetsFromDatabaseRows(context, filters, groupRows, categoryRows, subcategoryRows, periodRow, shopRows, featureRows) {
  const groupCounts = new Map();
  const categoryCounts = new Map();
  const subcategoryCounts = new Map();
  for (const row of groupRows) {
    const groupKey = key(row.category_group_key, 'other');
    groupCounts.set(groupKey, Number(row.count) || 0);
  }
  for (const row of categoryRows) {
    const groupKey = key(row.category_group_key, 'other');
    const categoryKey = key(row.category_key, 'other');
    const count = Number(row.count) || 0;
    categoryCounts.set(`${groupKey}\u0000${categoryKey}`, count);
  }
  for (const row of subcategoryRows) {
    const groupKey = key(row.category_group_key, 'other');
    const categoryKey = key(row.category_key, 'other');
    const subcategoryKey = key(row.subcategory_key);
    if (subcategoryKey) subcategoryCounts.set(`${groupKey}\u0000${categoryKey}\u0000${subcategoryKey}`, Number(row.count) || 0);
  }
  const shopCounts = Object.fromEntries(shopRows.map((row) => [String(row.key), Number(row.count) || 0]));
  const featureCounts = Object.fromEntries(featureRows.map((row) => [String(row.key), Number(row.count) || 0]));
  return {
    groups: projectTaxonomyFacetDepth(context.facets.groups.map((group) => {
      const groupCount = groupCounts.get(group.key) || 0;
      return {
        ...group,
        count: groupCount,
        available: groupCount > 0,
        categories: group.categories.map((category) => {
          const categoryCount = categoryCounts.get(`${group.key}\u0000${category.key}`) || 0;
          return {
            ...category,
            count: categoryCount,
            available: categoryCount > 0,
            subcategories: category.subcategories.map((subcategory) => {
              const subcategoryCount = subcategoryCounts.get(`${group.key}\u0000${category.key}\u0000${subcategory.key}`) || 0;
              return { ...subcategory, count: subcategoryCount, available: subcategoryCount > 0 };
            }),
          };
        }),
      };
    }), filters),
    seasons: Object.entries(PERIOD_LABELS).map(([facetKey, label]) => {
      const column = facetKey === 'all-year' ? 'all_year_count' : `${facetKey}_count`;
      const count = Number(periodRow?.[column]) || 0;
      return { key: facetKey, label, count, available: count > 0 };
    }),
    months: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const peakCount = Number(periodRow?.[`month_${month}_peak`]) || 0;
      const evergreenFallbackCount = Number(periodRow?.[`month_${month}_evergreen`]) || 0;
      return { month, count: peakCount + evergreenFallbackCount, peakCount, evergreenFallbackCount, available: peakCount + evergreenFallbackCount > 0 };
    }),
    shopTypes: ['official', 'preferred', 'general'].map((facetKey) => {
      const count = shopCounts[facetKey] || 0;
      return { key: facetKey, count, available: count > 0 };
    }),
    features: context.facets.features.map((feature) => {
      const count = featureCounts[feature.key] || 0;
      return { ...feature, count, available: count > 0 };
    }),
  };
}

async function neonContextualFacets(context, filters, sql = getNeonClient()) {
  const groupFilter = sqlFilters(filters, context.runId, false, context.schemaVersion, GROUP_EXCLUSIONS);
  const categoryFilter = sqlFilters(filters, context.runId, false, context.schemaVersion, CATEGORY_EXCLUSIONS);
  const subcategoryFilter = sqlFilters(filters, context.runId, false, context.schemaVersion, SUBCATEGORY_EXCLUSIONS);
  const periodFilter = sqlFilters(filters, context.runId, false, context.schemaVersion, PERIOD_EXCLUSIONS);
  const shopFilter = sqlFilters(filters, context.runId, false, context.schemaVersion, SHOP_EXCLUSIONS);
  const featureFilter = sqlFilters(filters, context.runId, false, context.schemaVersion, FEATURE_EXCLUSIONS);
  const [groupRows, categoryRows, subcategoryRows, periodRows, shopRows, featureRows] = await Promise.all([
    sql.query(`SELECT p.category_group_key, COUNT(*)::int AS count
      FROM gen3_catalog_products p WHERE ${groupFilter.where}
      GROUP BY p.category_group_key`, groupFilter.params),
    sql.query(`SELECT p.category_group_key, p.category_key, COUNT(*)::int AS count
      FROM gen3_catalog_products p WHERE ${categoryFilter.where}
      GROUP BY p.category_group_key, p.category_key`, categoryFilter.params),
    sql.query(`SELECT p.category_group_key, p.category_key, p.subcategory_key, COUNT(*)::int AS count
      FROM gen3_catalog_products p WHERE ${subcategoryFilter.where}
      GROUP BY p.category_group_key, p.category_key, p.subcategory_key`, subcategoryFilter.params),
    sql.query(`SELECT ${periodAggregateSelect(context.schemaVersion)}
      FROM gen3_catalog_products p WHERE ${periodFilter.where}`, periodFilter.params),
    sql.query(`SELECT p.shop_type AS key, COUNT(*)::int AS count
      FROM gen3_catalog_products p WHERE ${shopFilter.where} GROUP BY p.shop_type`, shopFilter.params),
    sql.query(`SELECT tag AS key, COUNT(*)::int AS count
      FROM gen3_catalog_products p, UNNEST(p.merchandising_tags) tag
      WHERE ${featureFilter.where} GROUP BY tag`, featureFilter.params),
  ]);
  return contextualFacetsFromDatabaseRows(context, filters, groupRows, categoryRows, subcategoryRows, periodRows[0] || {}, shopRows, featureRows);
}

function periodSummaryFromFacets(facets, period, total) {
  if (!period || period === 'all') return null;
  if (period.startsWith('month-')) {
    const month = Number(period.slice(6));
    const facet = facets.months.find((item) => item.month === month);
    return {
      period,
      mode: 'month-with-evergreen-fallback',
      peakMatches: facet?.peakCount || 0,
      evergreenFallbackMatches: facet?.evergreenFallbackCount || 0,
      exactMatches: 0,
      total,
    };
  }
  const facet = facets.seasons.find((item) => item.key === period);
  return { period, mode: 'exact', peakMatches: 0, evergreenFallbackMatches: 0, exactMatches: facet?.count || 0, total };
}

async function neonAggregate(context, filters, sql = getNeonClient()) {
  const cacheKey = aggregateCacheKey(context, filters);
  const cached = aggregateCacheGet(cacheKey);
  if (cached) return cached;
  if (!hasAggregateFilters(filters)) {
    const aggregate = baseAggregate(context, filters);
    aggregateCacheSet(cacheKey, aggregate);
    return aggregate;
  }
  return shareInFlight(catalogAggregateInFlight, cacheKey, async () => {
    const repeated = aggregateCacheGet(cacheKey);
    if (repeated) return repeated;
    const countFilter = sqlFilters(filters, context.runId, false, context.schemaVersion);
    const [countRows, facets] = await Promise.all([
      sql.query(`SELECT COUNT(*)::int AS count FROM gen3_catalog_products p WHERE ${countFilter.where}`, countFilter.params),
      neonContextualFacets(context, filters, sql),
    ]);
    const matched = Number(countRows[0]?.count) || 0;
    const aggregate = {
      matched,
      facets,
      periodSummary: periodSummaryFromFacets(facets, filters.period, matched),
    };
    aggregateCacheSet(cacheKey, aggregate);
    return aggregate;
  });
}

async function neonQuery(context, filters) {
  const sql = getNeonClient();
  const itemFilter = sqlFilters(filters, context.runId, true, context.schemaVersion);
  const limitParameter = addParameter(itemFilter.params, filters.limit + 1);
  const v4Select = context.schemaVersion >= 4
    ? `p.metadata_version, p.evergreen, p.season_scores, p.season_reasons, p.month_scores, p.month_reasons,`
    : `'seasonal-legacy' AS metadata_version, FALSE AS evergreen, '{}'::jsonb AS season_scores, '{}'::jsonb AS season_reasons, '{}'::jsonb AS month_scores, '{}'::jsonb AS month_reasons,`;
  const select = `p.id, p.public_id, p.rank, p.featured, p.category_group_key, p.category_group, p.category_key, p.category,
    p.subcategory_key, p.subcategory, p.image_url, p.clean_name, p.summary, p.price_min, p.price_max, p.price_type,
    p.checked_at, p.product_url, p.shop_name, p.item_sold, p.rating, p.likes, p.shop_rating, p.shop_type, p.stock_status,
    p.merchandising_tags, p.season_tags, p.month_tags, ${v4Select} p.seasonal_score, p.season_reason, p.reason_codes, p.recommendation_score,
    p.normalized_search_text, p.review_status`;
  const [rows, aggregate] = await Promise.all([
    sql.query(`SELECT ${select} FROM gen3_catalog_products p WHERE ${itemFilter.where} ORDER BY ${sqlOrder(filters, context.schemaVersion)} LIMIT ${limitParameter}`, itemFilter.params),
    neonAggregate(context, filters),
  ]);
  const hasMore = rows.length > filters.limit;
  const internalItems = rows.slice(0, filters.limit).map((record) => normalizeProduct(record)).filter(Boolean);
  const matched = aggregate.matched;
  const start = filters.cursor ? Math.max(0, filters.offset) : filters.offset;
  const nextCursor = hasMore && internalItems.length
    ? encodeCursor(internalItems[internalItems.length - 1], filters, context.snapshotToken)
    : null;
  return {
    matched,
    offset: start,
    nextOffset: !filters.cursor && start + internalItems.length < matched ? start + internalItems.length : null,
    nextCursor,
    items: internalItems.map((product) => toPublicProduct(product, filters)),
    facets: aggregate.facets,
    periodSummary: aggregate.periodSummary,
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
  const cacheKey = resultCacheKey(context, filters);
  const cached = resultCacheGet(cacheKey);
  if (cached) return cached;
  return shareInFlight(catalogResultInFlight, cacheKey, async () => {
    const repeated = resultCacheGet(cacheKey);
    if (repeated) return repeated;
    let responseContext = context;
    let result;
    if (responseContext.source === 'neon') {
      try {
        result = await neonQuery(responseContext, filters);
      } catch (error) {
        if (filters.cursor) {
          const changed = new Error('Catalog source changed while paging');
          changed.code = 'CATALOG_CHANGED';
          throw changed;
        }
        console.error('Catalog database query failed; using bundled fallback', error);
        responseContext = getBundledContext();
        result = bundledQuery(responseContext, filters);
      }
    } else {
      result = bundledQuery(responseContext, filters);
    }
    const firstPage = !filters.cursor && filters.offset === 0;
    const response = {
      schemaVersion: responseContext.schemaVersion,
      generatedAt: responseContext.generatedAt,
      total: responseContext.total,
      matched: result.matched,
      offset: result.offset,
      limit: filters.limit,
      nextOffset: result.nextOffset,
      nextCursor: result.nextCursor,
      featured: firstPage ? responseContext.featured.map((product) => toPublicProduct(product)) : [],
      items: result.items,
      facets: result.facets,
      periodSummary: result.periodSummary,
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
        feature: filters.feature,
        stock: filters.stock,
        freshness: filters.freshness,
      },
    };
    resultCacheSet(resultCacheKey(responseContext, filters), response);
    return response;
  });
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
  const bundled = getBundledContext();
  if (!bundled.byId) {
    bundled.byId = new Map([...bundled.featured, ...bundled.ranked].map((product) => [productPublicId(product), product]));
  }
  return bundled.byId.get(cleanId) || null;
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getCatalogProductById,
  queryCatalog,
  _testing: Object.freeze({
    aggregateCacheKey,
    clearRuntimeCaches,
    neonAggregate,
    parseFilters,
    shareInFlight,
    sortValues,
    sqlFilters,
    sqlOrder,
    sqlSortExpressions,
  }),
};
