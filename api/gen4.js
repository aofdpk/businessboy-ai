const session = require('./_gen4-session');
const content = require('./_gen4-content');
const attempts = new Map();
const WINDOW = 10 * 60 * 1000;

function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}

const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
function limited(req, failure = false) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const ip = clientIp(req);
  const current = attempts.get(ip) || { count: 0, until: now + WINDOW };
  if (failure) current.count++;
  if (attempts.size < 10000 || attempts.has(ip)) attempts.set(ip, current);
  return current.count >= 12 || attempts.size >= 10000;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.query?.action === 'session') {
    if (req.method === 'GET') return res.status(200).json({ authenticated: session.validSession(req) });
    if (!['POST', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
    if (!sameOrigin(req)) return res.status(403).json({ error: 'กรุณาเข้าสู่ระบบจากหน้าเว็บรุ่น 4' });
    if (req.method === 'DELETE') { res.setHeader('Set-Cookie', session.cookie(true)); return res.status(200).json({ ok: true }); }
    if (!session.configured()) return res.status(503).json({ error: 'ระบบยังไม่พร้อม กรุณาลองใหม่อีกครั้ง' });
    if (limited(req)) { res.setHeader('Retry-After', '600'); return res.status(429).json({ error: 'ลองรหัสหลายครั้งเกินไป กรุณารอ 10 นาทีแล้วลองใหม่' }); }
    try {
      if (!await session.checkPassword(req.body?.password)) { limited(req, true); return res.status(401).json({ error: 'รหัสไม่ถูกต้อง ลองใหม่อีกครั้งนะครับ' }); }
      res.setHeader('Set-Cookie', session.cookie());
      return res.status(200).json({ ok: true });
    } catch { return res.status(503).json({ error: 'ระบบยังไม่พร้อม กรุณาลองใหม่อีกครั้ง' }); }
  }

  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).send('Method not allowed'); }
  if (req.query?.action === 'download-toolkit2') {
    if (!session.validSession(req)) { res.setHeader('Location', '/gen4/toolkit-2'); return res.status(302).end(); }
    const pack = require('./_gen4-toolkit2');
    const bytes = Buffer.from(pack.base64, 'base64');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="kvid-toolkit-2-v1.zip"');
    res.setHeader('Content-Length', bytes.length);
    res.setHeader('X-Toolkit-Version', pack.version);
    res.setHeader('X-Content-SHA256', pack.sha256);
    return req.method === 'HEAD' ? res.status(200).end() : res.status(200).send(bytes);
  }
  if (req.query?.asset !== undefined) {
    if (!session.validSession(req)) return res.status(401).json({ error: 'กรุณากรอกรหัสก่อนใช้งาน' });
    const asset = req.query.asset;
    if (typeof asset !== 'string' || !Object.hasOwn(content.scripts, asset)) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return req.method === 'HEAD' ? res.status(200).end() : res.status(200).send(content.scripts[asset]);
  }
  const view = req.query?.view || 'hub';
  if (!['hub', 'prompt', 'toolkit2'].includes(view)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const html = session.validSession(req) ? content.pages[view] : content.login;
  return req.method === 'HEAD' ? res.status(200).end() : res.status(200).send(html);
};
