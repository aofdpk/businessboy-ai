const crypto = require('crypto');

const COOKIE_NAME = 'businessboy_gen3_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;
const attempts = new Map();

function noStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function secret() {
  return process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function createToken() {
  const expiresAt = String(Date.now() + MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${sign(expiresAt)}`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function cookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((result, pair) => {
    const index = pair.indexOf('=');
    if (index < 0) return result;
    result[pair.slice(0, index).trim()] = safeDecode(pair.slice(index + 1).trim());
    return result;
  }, {});
}

function validSession(req) {
  const token = cookies(req)[COOKIE_NAME];
  if (!token || !secret()) return false;
  const [expiresAt, supplied] = token.split('.');
  return Boolean(expiresAt && supplied && Number(expiresAt) > Date.now() && safeEqual(supplied, sign(expiresAt)));
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

function blocked(req) {
  const key = clientIp(req);
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 0, startedAt: now });
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}

function recordFailure(req) {
  const key = clientIp(req);
  const current = attempts.get(key) || { count: 0, startedAt: Date.now() };
  current.count += 1;
  attempts.set(key, current);
}

module.exports = async (req, res) => {
  noStore(res);
  if (req.method === 'GET') return res.status(200).json({ authenticated: validSession(req) });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' });

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.GEN3_SITE_PASSWORD || process.env.SITE_PASSWORD || '';
  if (!expected || !secret()) {
    console.error('Gen 3 auth environment variables are missing');
    return res.status(503).json({ error: 'ระบบยังตั้งค่าไม่ครบ กรุณาแจ้งผู้สอน' });
  }
  if (blocked(req)) return res.status(429).json({ error: 'ลองรหัสหลายครั้งเกินไป กรุณารอ 10 นาที' });

  const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  if (!safeEqual(password, expected)) {
    recordFailure(req);
    return res.status(401).json({ error: 'รหัสไม่ถูกต้อง ลองอีกครั้งนะครับ' });
  }

  attempts.delete(clientIp(req));
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(createToken())}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`);
  return res.status(200).json({ ok: true });
};
