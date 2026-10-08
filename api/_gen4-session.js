const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const credential = require('./_gen4-credential');
const COOKIE = '__Host-businessboy_gen4';
const MAX_AGE = 7 * 24 * 60 * 60;
const secret = () => process.env.GEN4_SESSION_SECRET || process.env.SESSION_SECRET || process.env.GEN3_SESSION_SECRET || '';
const equal = (a, b) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const sign = value => crypto.createHmac('sha256', secret()).update(`gen4:v1:${credential.hash}:${value}`).digest('base64url');

function validSession(req) {
  if (!secret()) return false;
  const pair = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`));
  const token = pair ? pair.slice(COOKIE.length + 1) : '';
  if (!/^\d{13}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [expiry, signature] = token.split('.');
  return Number(expiry) > Date.now() && Number(expiry) <= Date.now() + MAX_AGE * 1000 && equal(signature, sign(expiry));
}

async function checkPassword(password) {
  if (typeof password !== 'string' || password.length > 256 || !password) return false;
  const result = await scrypt(password, credential.salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return equal(result, Buffer.from(credential.hash, 'hex'));
}

function cookie(clear = false) {
  const expiry = String(Date.now() + MAX_AGE * 1000);
  return `${COOKIE}=${clear ? '' : `${expiry}.${sign(expiry)}`}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : MAX_AGE}`;
}

module.exports = { validSession, checkPassword, cookie, configured: () => Boolean(secret()) };
