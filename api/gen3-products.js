const crypto = require('crypto');
const catalog = require('./_gen3-products');

// Keep this handler in the deployment diff whenever the generated catalog is released.

const COOKIE_NAME = 'businessboy_gen3_session';
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;
const SEASONS = new Set(['all-year', 'hot', 'rainy', 'cool']);
const PRICES = Object.freeze({
  all: { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY },
  'under-100': { min: Number.NEGATIVE_INFINITY, max: 99.99 },
  '100-300': { min: 100, max: 300 },
  '301-500': { min: 301, max: 500 },
  '501-1000': { min: 501, max: 1000 },
  'over-1000': { min: 1000.01, max: Number.POSITIVE_INFINITY },
});
const SORTS = new Set(['rank', 'price-asc', 'price-desc']);
const PERIOD_LABELS = Object.freeze({
  'all-year': 'ขายได้ตลอดปี',
  hot: 'หน้าร้อน',
  rainy: 'หน้าฝน',
  cool: 'หน้าหนาว/อากาศเย็น',
});

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function validSession(req) {
  const secret = process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
  if (!secret) return false;
  const raw = String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const token = raw ? safeDecode(raw.slice(raw.indexOf('=') + 1)) : '';
  const [expiresAt, supplied] = token.split('.');
  if (!expiresAt || !supplied || Number(expiresAt) <= Date.now()) return false;
  const expected = crypto.createHmac('sha256', secret).update(expiresAt).digest('base64url');
  return safeEqual(supplied, expected);
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function queryText(value, maxLength = 120) {
  const first = firstQueryValue(value);
  return typeof first === 'string'
    ? first.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function text(value, maxLength = 500) {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function identifier(value) {
  return ['string', 'number', 'bigint'].includes(typeof value) ? String(value).trim().slice(0, 128) : '';
}

function numberOrNull(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function integerInRange(value, fallback, min, max) {
  const parsed = Number.parseInt(String(firstQueryValue(value) ?? ''), 10);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function rankOrNull(value) {
  const result = numberOrNull(value);
  return result !== null && Number.isInteger(result) && result >= 1 && result <= 1_000_000 ? result : null;
}

function trustedUrl(value, kind) {
  try {
    const url = new URL(text(value, 2_000));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return '';
    if (kind === 'image') {
      const trustedImageHost = host === 'susercontent.com'
        || host.endsWith('.susercontent.com')
        || host === 'shopee.co.th'
        || host.endsWith('.shopee.co.th');
      return trustedImageHost ? url.href : '';
    }
    const trustedProductHost = host === 'shopee.co.th' || host.endsWith('.shopee.co.th');
    return trustedProductHost ? url.href : '';
  } catch {
    return '';
  }
}

function categoryKeyFor(record, category) {
  const supplied = text(record.categoryKey, 80).toLowerCase();
  if (/^[a-z0-9][a-z0-9-]*$/.test(supplied)) return supplied;
  return `category-${crypto.createHash('sha256').update(category).digest('hex').slice(0, 12)}`;
}

function seasonTagsFor(record) {
  const values = Array.isArray(record.seasonTags) ? record.seasonTags : [];
  return [...new Set(values.map((value) => text(value, 20).toLowerCase()).filter((value) => SEASONS.has(value)))];
}

function monthTagsFor(record) {
  const values = Array.isArray(record.monthTags) ? record.monthTags : [];
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= 12))].sort((a, b) => a - b);
}

function publicProduct(record, featured = false) {
  if (!record || typeof record !== 'object') return null;
  const id = identifier(record.id);
  const cleanName = text(record.cleanName, 300);
  const imageUrl = trustedUrl(record.imageUrl, 'image');
  const productUrl = trustedUrl(record.productUrl, 'product');
  if (!id || !cleanName || !imageUrl || !productUrl) return null;
  const category = text(record.category, 120) || 'อื่น ๆ';
  const seasonalScore = integerInRange(record.seasonalScore, 0, 0, 100);

  return {
    id,
    rank: featured ? null : rankOrNull(record.rank),
    category,
    categoryKey: categoryKeyFor(record, category),
    imageUrl,
    cleanName,
    summary: text(record.summary, 700),
    priceMin: numberOrNull(record.priceMin),
    priceMax: numberOrNull(record.priceMax),
    checkedAt: text(record.checkedAt, 80),
    productUrl,
    featured,
    shopName: featured ? text(record.shopName, 120) : '',
    seasonTags: seasonTagsFor(record),
    monthTags: monthTagsFor(record),
    seasonalScore,
    seasonReason: text(record.seasonReason, 240),
  };
}

function featuredRecords(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('th-TH').replace(/\s+/g, ' ').trim();
}

function productPriceRange(product) {
  const first = product.priceMin ?? product.priceMax;
  const last = product.priceMax ?? product.priceMin;
  if (first === null || first === undefined || last === null || last === undefined) return null;
  return { min: Math.min(first, last), max: Math.max(first, last) };
}

function matchesPrice(product, price) {
  if (price === 'all') return true;
  const range = productPriceRange(product);
  if (!range) return false;
  const selected = PRICES[price];
  return range.max >= selected.min && range.min <= selected.max;
}

function resolvePeriod(query) {
  const requested = queryText(query.period, 24).toLowerCase();
  if (requested === 'all' || SEASONS.has(requested) || /^month-(?:[1-9]|1[0-2])$/.test(requested)) return requested;

  const season = queryText(query.season, 20).toLowerCase();
  if (SEASONS.has(season)) return season;
  const rawMonth = firstQueryValue(query.month);
  const month = /^\d{1,2}$/.test(String(rawMonth ?? '')) ? Number(rawMonth) : 0;
  return Number.isInteger(month) && month >= 1 && month <= 12 ? `month-${month}` : 'all';
}

function matchesPeriod(product, period) {
  if (period === 'all') return true;
  if (SEASONS.has(period)) return product.seasonTags.includes(period);
  const month = Number(period.slice('month-'.length));
  return product.monthTags.includes(month);
}

function compareProducts(sort, period) {
  return (left, right) => {
    if (sort === 'price-asc') {
      const leftPrice = left.priceMin ?? left.priceMax ?? Number.POSITIVE_INFINITY;
      const rightPrice = right.priceMin ?? right.priceMax ?? Number.POSITIVE_INFINITY;
      return leftPrice - rightPrice || (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
    }
    if (sort === 'price-desc') {
      const leftPrice = left.priceMax ?? left.priceMin ?? Number.NEGATIVE_INFINITY;
      const rightPrice = right.priceMax ?? right.priceMin ?? Number.NEGATIVE_INFINITY;
      return rightPrice - leftPrice || (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
    }
    if (period !== 'all') {
      const scoreDifference = right.seasonalScore - left.seasonalScore;
      if (scoreDifference) return scoreDifference;
    }
    return (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
  };
}

const publicFeatured = featuredRecords(catalog.featured)
  .map((record) => publicProduct(record, true))
  .filter(Boolean);
const publicRanked = (Array.isArray(catalog.ranked) ? catalog.ranked : [])
  .map((record) => publicProduct(record))
  .filter((record) => record && record.rank !== null)
  .sort((left, right) => left.rank - right.rank);

function categoryFacets(products) {
  const byKey = new Map();
  for (const product of products) {
    const current = byKey.get(product.categoryKey) || { key: product.categoryKey, label: product.category, count: 0 };
    current.count += 1;
    byKey.set(product.categoryKey, current);
  }
  return [...byKey.values()].sort((left, right) => left.label.localeCompare(right.label, 'th'));
}

function periodFacets(products) {
  const seasonCounts = Object.fromEntries([...SEASONS].map((season) => [season, 0]));
  const monthCounts = Array.from({ length: 12 }, () => 0);
  for (const product of products) {
    for (const season of product.seasonTags) seasonCounts[season] += 1;
    for (const month of product.monthTags) monthCounts[month - 1] += 1;
  }
  return {
    seasons: Object.entries(PERIOD_LABELS).map(([key, label]) => ({ key, label, count: seasonCounts[key] || 0 })),
    months: monthCounts.map((count, index) => ({ month: index + 1, count })),
  };
}

const facets = Object.freeze({
  categories: categoryFacets(publicRanked),
  ...periodFacets(publicRanked),
});

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!validSession(req)) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query || {};
  const q = queryText(query.q, 100);
  const normalizedQuery = normalizeSearch(q);
  const category = queryText(query.category, 80).toLowerCase() || 'all';
  const period = resolvePeriod(query);
  const requestedPrice = queryText(query.price, 24).toLowerCase();
  const price = Object.prototype.hasOwnProperty.call(PRICES, requestedPrice) ? requestedPrice : 'all';
  const requestedSort = queryText(query.sort, 24).toLowerCase();
  const sort = SORTS.has(requestedSort) ? requestedSort : 'rank';
  const offset = integerInRange(query.offset, 0, 0, Math.max(publicRanked.length, 0));
  const limit = integerInRange(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);

  const matching = publicRanked.filter((product) => {
    const hasQuery = !normalizedQuery || normalizeSearch(`${product.cleanName} ${product.summary} ${product.category}`).includes(normalizedQuery);
    const hasCategory = category === 'all' || product.categoryKey === category;
    return hasQuery && hasCategory && matchesPeriod(product, period) && matchesPrice(product, price);
  });
  matching.sort(compareProducts(sort, period));

  const items = matching.slice(offset, offset + limit);
  const nextOffset = offset + items.length < matching.length ? offset + items.length : null;
  const response = {
    schemaVersion: Number(catalog.schemaVersion) || 1,
    generatedAt: text(catalog.generatedAt, 80),
    total: publicRanked.length,
    matched: matching.length,
    offset,
    limit,
    nextOffset,
    featured: offset === 0 ? publicFeatured : [],
    items,
    facets,
    applied: { q, category, period, price, sort },
  };

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).json(response);
};
