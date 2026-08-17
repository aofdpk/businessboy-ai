const crypto = require('crypto');
const { getCatalogProductById } = require('./_catalog-data-source');

const COOKIE_NAME = 'businessboy_gen3_session';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/avif', 'avif'],
]);

function detectImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp' && ['avif', 'avis'].includes(bytes.subarray(8, 12).toString('ascii'))) return 'image/avif';
  return '';
}

async function readLimitedBody(response) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('image too large'), { code: 'IMAGE_TOO_LARGE' });
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw Object.assign(new Error('image too large'), { code: 'IMAGE_TOO_LARGE' });
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

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

function trustedImageUrl(value) {
  try {
    const url = value instanceof URL ? value : new URL(String(value));
    const host = url.hostname.toLowerCase();
    const trustedHost = host === 'susercontent.com'
      || host.endsWith('.susercontent.com')
      || host === 'shopee.co.th'
      || host.endsWith('.shopee.co.th');
    return url.protocol === 'https:' && trustedHost ? url : null;
  } catch {
    return null;
  }
}

async function fetchTrustedImage(source, signal) {
  let current = trustedImageUrl(source);
  if (!current) throw new Error('untrusted image host');

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal,
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5',
        Referer: 'https://shopee.co.th/',
        'User-Agent': 'BusinessBoy-Catalog/1.0',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === 3) throw new Error('image redirect failed');
      current = trustedImageUrl(new URL(location, current));
      if (!current) throw new Error('untrusted image redirect');
      continue;
    }
    return response;
  }
  throw new Error('too many image redirects');
}

function safeName(value) {
  const cleaned = String(value || 'สินค้า')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
  return cleaned || 'สินค้า';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (!validSession(req)) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!id || id.length > 128) return res.status(400).json({ error: 'รหัสสินค้าไม่ถูกต้อง' });
  const product = await getCatalogProductById(id);
  if (!product) return res.status(404).json({ error: 'ไม่พบสินค้าในคลัง' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetchTrustedImage(product.imageUrl, controller.signal);
    if (!upstream.ok) return res.status(502).json({ error: 'ดาวน์โหลดรูปจากต้นทางไม่สำเร็จ' });

    const declaredLength = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'รูปมีขนาดใหญ่เกินไป' });
    }
    const bytes = await readLimitedBody(upstream);
    if (!bytes.length) return res.status(502).json({ error: 'ไม่พบข้อมูลรูปจากต้นทาง' });
    const type = detectImageType(bytes);
    const extension = ALLOWED_TYPES.get(type);
    if (!extension) return res.status(415).json({ error: 'ชนิดรูปไม่รองรับ' });

    const rank = product.rank !== null && product.rank !== undefined && Number.isFinite(Number(product.rank))
      ? String(Number(product.rank)).padStart(4, '0')
      : 'แนะนำ';
    const displayName = `${rank}-${safeName(product.cleanName)}.${extension}`;
    const fallbackName = `product-${id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'image'}.${extension}`;
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Content-Disposition', `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(displayName)}`);
    return res.status(200).send(bytes);
  } catch (error) {
    if (error && error.name === 'AbortError') return res.status(504).json({ error: 'ต้นทางใช้เวลาตอบนานเกินไป' });
    if (error && error.code === 'IMAGE_TOO_LARGE') return res.status(413).json({ error: 'รูปมีขนาดใหญ่เกินไป' });
    console.error('Gen 3 product image download failed', error);
    return res.status(502).json({ error: 'ดาวน์โหลดรูปไม่สำเร็จ กรุณาลองใหม่' });
  } finally {
    clearTimeout(timeout);
  }
};
