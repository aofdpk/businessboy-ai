const crypto = require('crypto');
const bundles = require('./_gen3-bundle');
const VIEW_BUNDLES = new Map([
  ['identity', 'identity'],
  ['sales', 'sales'],
  ['products', 'products'],
  ['presenter-identity', 'presenterIdentity'],
  ['presenter-sales', 'presenterSales'],
]);
const PRESENTER_VIEWS = new Set(['presenter-identity', 'presenter-sales']);

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

function cookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((result, pair) => {
    const index = pair.indexOf('=');
    if (index < 0) return result;
    result[pair.slice(0, index).trim()] = safeDecode(pair.slice(index + 1).trim());
    return result;
  }, {});
}

function validSession(req) {
  const secret = process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
  if (!secret) return false;
  const token = cookies(req).businessboy_gen3_session || '';
  const [expiresAt, supplied] = token.split('.');
  if (!expiresAt || !supplied || Number(expiresAt) <= Date.now()) return false;
  const expected = crypto.createHmac('sha256', secret).update(expiresAt).digest('base64url');
  return safeEqual(supplied, expected);
}

function presenterAccessIsOpen() {
  return process.env.GEN3_PRESENTER_ACCESS === 'open';
}

function validPresenterEntitlement(req) {
  const secret = process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
  const password = process.env.GEN3_PRESENTER_PASSWORD || '';
  if (!secret || !password) return false;

  const token = cookies(req).businessboy_gen3_presenter;
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const expiresAt = parts[1];
  const supplied = parts[2];
  if (!/^\d{13}$/.test(expiresAt) || Number(expiresAt) <= Date.now() || !supplied) return false;

  const fingerprint = crypto.createHash('sha256').update(password).digest('base64url');
  const payload = `gen3-presenter-entitlement:v1\n${expiresAt}\n${fingerprint}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return safeEqual(supplied, expected);
}

function hasPresenterAccess(req) {
  return presenterAccessIsOpen() || validPresenterEntitlement(req);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!validSession(req)) return res.status(401).json({ error: 'unauthorized' });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestedView = req.query?.view;
  const view = requestedView === undefined ? 'identity' : requestedView;
  if (typeof view !== 'string' || !VIEW_BUNDLES.has(view)) {
    return res.status(404).json({ error: 'builder view not found' });
  }
  if (PRESENTER_VIEWS.has(view) && !hasPresenterAccess(req)) {
    return res.status(403).json({ error: 'presenter access required' });
  }

  const source = bundles[VIEW_BUNDLES.get(view)];
  if (typeof source !== 'string' || !source) {
    return res.status(500).json({ error: 'builder bundle missing' });
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(source);
};
