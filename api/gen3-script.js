const crypto = require('crypto');
const bundles = require('./_gen3-bundle');
const ALLOWED_VIEWS = new Set(['identity', 'sales']);

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validSession(req) {
  const secret = process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
  if (!secret) return false;
  const raw = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('businessboy_gen3_session='));
  const token = raw ? decodeURIComponent(raw.slice(raw.indexOf('=') + 1)) : '';
  const [expiresAt, supplied] = token.split('.');
  if (!expiresAt || !supplied || Number(expiresAt) <= Date.now()) return false;
  const expected = crypto.createHmac('sha256', secret).update(expiresAt).digest('base64url');
  return safeEqual(supplied, expected);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!validSession(req)) return res.status(401).json({ error: 'unauthorized' });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestedView = req.query?.view;
  const view = requestedView === undefined ? 'identity' : requestedView;
  if (typeof view !== 'string' || !ALLOWED_VIEWS.has(view)) {
    return res.status(404).json({ error: 'builder view not found' });
  }

  const source = bundles[view];
  if (typeof source !== 'string' || !source) {
    return res.status(500).json({ error: 'builder bundle missing' });
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(source);
};
