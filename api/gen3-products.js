const crypto = require('crypto');
const catalog = require('./_gen3-products');

const COOKIE_NAME = 'businessboy_gen3_session';

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validSession(req) {
  const secret = process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
  if (!secret) return false;
  const raw = String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const token = raw ? decodeURIComponent(raw.slice(raw.indexOf('=') + 1)) : '';
  const [expiresAt, supplied] = token.split('.');
  if (!expiresAt || !supplied || Number(expiresAt) <= Date.now()) return false;
  const expected = crypto.createHmac('sha256', secret).update(expiresAt).digest('base64url');
  return safeEqual(supplied, expected);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function identifier(value) {
  return ['string', 'number', 'bigint'].includes(typeof value) ? String(value).trim() : '';
}

function numberOrNull(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function rankOrNull(value) {
  const result = numberOrNull(value);
  return result !== null && Number.isInteger(result) && result >= 1 && result <= 500 ? result : null;
}

function trustedUrl(value, kind) {
  try {
    const url = new URL(text(value));
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

function publicProduct(record, featured = false) {
  if (!record || typeof record !== 'object') return null;
  const id = identifier(record.id);
  const cleanName = text(record.cleanName);
  const imageUrl = trustedUrl(record.imageUrl, 'image');
  const productUrl = trustedUrl(record.productUrl, 'product');
  if (!id || !cleanName || !imageUrl || !productUrl) return null;

  return {
    id,
    rank: featured ? null : rankOrNull(record.rank),
    category: text(record.category) || 'อื่น ๆ',
    imageUrl,
    cleanName,
    summary: text(record.summary),
    priceMin: numberOrNull(record.priceMin),
    priceMax: numberOrNull(record.priceMax),
    checkedAt: text(record.checkedAt),
    productUrl,
    featured,
    shopName: featured ? text(record.shopName) : '',
  };
}

function featuredRecords(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

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

  const featured = featuredRecords(catalog.featured)
    .map((record) => publicProduct(record, true))
    .filter(Boolean);
  const ranked = (Array.isArray(catalog.ranked) ? catalog.ranked : [])
    .map((record) => publicProduct(record))
    .filter((record) => record && record.rank !== null)
    .sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 500);
  const response = {
    generatedAt: text(catalog.generatedAt),
    total: ranked.length,
    featured,
    ranked,
  };

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).json(response);
};
