const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  const candidates = [
    path.join(process.cwd(), 'gen3.js'),
    path.join(process.cwd(), '..', 'gen3.js'),
    path.join(__dirname, '..', 'gen3.js'),
  ];
  const sourcePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!sourcePath) return res.status(500).json({ error: 'builder bundle missing' });
  const source = fs.readFileSync(sourcePath, 'utf8');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  return res.status(200).send(source);
};
