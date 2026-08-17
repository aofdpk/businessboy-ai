const crypto = require('crypto');
const { queryCatalog } = require('./_catalog-data-source');

const COOKIE_NAME = 'businessboy_gen3_session';

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

  try {
    const response = await queryCatalog(req.query || {});
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json(response);
  } catch (error) {
    if (error?.code === 'INVALID_CURSOR') {
      return res.status(400).json({ error: 'หน้ารายการไม่ถูกต้อง กรุณาเริ่มค้นหาใหม่', code: 'invalid_cursor' });
    }
    if (error?.code === 'INVALID_PAGINATION') {
      return res.status(400).json({ error: 'การแบ่งหน้าไม่ถูกต้อง กรุณาใช้หน้ารายการล่าสุด', code: 'invalid_pagination' });
    }
    if (error?.code === 'CATALOG_CHANGED') {
      return res.status(409).json({ error: 'คลังสินค้าเพิ่งอัปเดต กรุณาเริ่มจากหน้าแรก', code: 'catalog_changed' });
    }
    console.error('Gen 3 catalog query failed', error);
    return res.status(500).json({ error: 'เปิดคลังสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง' });
  }
};
