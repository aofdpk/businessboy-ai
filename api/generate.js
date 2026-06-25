// /api/generate — proxy เรียก Gemini generateContent (text / vision / image-gen / video-inline)
// key อยู่ใน process.env.GEMINI_API_KEY เท่านั้น ไม่เคยส่งมาที่เบราว์เซอร์
const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash', 'gemini-2.5-flash-image', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'
]);

// ---------- กันบอทฟลัช: จำกัดต่อ IP ----------
// เล่นได้ 5 ครั้ง/โปรแกรม/วัน ต่อ IP + เพดานรวมต่อ IP กันบอทปลอมชื่อแอป
const LIMIT_PER_APP = 5;        // ครั้ง/โปรแกรม/วัน ต่อ IP
const LIMIT_PER_IP_TOTAL = 150; // ครั้งรวมทุกโปรแกรม/วัน ต่อ IP (backstop)
const WINDOW_SEC = 90000;       // ~25 ชม. (กุญแจคิดเป็นรายวัน อายุเผื่อข้ามวัน)

// ที่เก็บตัวนับ: Redis ผ่าน TCP (ioredis) ใช้ REDIS_URL ที่ Vercel inject
// (Redis Cloud ให้เฉพาะ TCP ไม่มี REST แบบ Upstash)
let Redis = null;
try { Redis = require('ioredis'); } catch (e) { Redis = null; }
let _redis = null; // null=ยังไม่ลอง, false=ใช้ไม่ได้, object=พร้อม
function getRedis() {
  if (_redis !== null) return _redis;
  if (!Redis || !process.env.REDIS_URL) { _redis = false; return false; }
  try {
    _redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true, // ให้คำสั่งรอจน connect (มี withTimeout คุมไม่ให้ค้างเกิน 1.5s)
      connectTimeout: 1500,
      lazyConnect: false
    });
    _redis.on('error', () => {}); // กลืน error ไม่ให้ทำ process ล้ม; fail-open
  } catch (e) { _redis = false; }
  return _redis;
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function appId(req) {
  // ระบุว่าเป็นโปรแกรมไหน: ใช้ที่ client ส่งมา (x-gk-app) ก่อน ไม่งั้นถอดจาก Referer
  let a = req.headers['x-gk-app'] || '';
  if (!a && req.headers.referer) { try { a = new URL(req.headers.referer).pathname; } catch (e) { a = ''; } }
  a = String(a).toLowerCase().replace(/[^a-z0-9/_.-]/g, '').replace(/\.html$/, '').replace(/^\/+|\/+$/g, '');
  return a || 'root';
}

// ตรวจ rate limit; คืน null ถ้าผ่าน, คืน object {message} ถ้าเกินโควต้า
// fail-open: ถ้าไม่มี Redis / Redis ล่ม / ช้า → ปล่อยผ่าน (กันเว็บล่ม; มีเพดานงบ Google เป็น backstop สุดท้าย)
async function checkRateLimit(req) {
  const r = getRedis();
  if (!r) return null;                             // ไม่มี Redis → ข้าม
  if (req.headers['x-gk-retry']) return null;      // เป็น retry/variant ภายในของการเล่นเดิม → ไม่นับ
  const ip = clientIp(req);
  const app = appId(req);
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const appKey = `rl:${day}:${app}:${ip}`;
  const allKey = `rl:${day}:_all:${ip}`;
  try {
    // INCR สองกุญแจ + ตั้งอายุ ในทรานแซกชันเดียว มี timeout กันค้าง
    const results = await withTimeout(
      r.multi().incr(appKey).expire(appKey, WINDOW_SEC).incr(allKey).expire(allKey, WINDOW_SEC).exec(),
      1500
    );
    const appCount = results && results[0] && Number(results[0][1]);
    const total = results && results[2] && Number(results[2][1]);
    if (appCount > LIMIT_PER_APP) {
      return { message: 'คุณทดลองโปรแกรมนี้ครบ ' + LIMIT_PER_APP + ' ครั้งแล้วสำหรับวันนี้ 🙏 พรุ่งนี้กลับมาเล่นใหม่ได้เลย — หรืออยากใช้แบบไม่จำกัด/ทำเวอร์ชันของธุรกิจคุณเอง ทักแอดมิน “เด็กประกอบการ” ได้เลยครับ' };
    }
    if (total > LIMIT_PER_IP_TOTAL) {
      return { message: 'วันนี้คุณใช้งานระบบครบโควต้ารวมแล้ว 🙏 พรุ่งนี้กลับมาเล่นใหม่ได้ หรือทักแอดมิน “เด็กประกอบการ” เพื่อใช้แบบไม่จำกัดครับ' };
    }
    return null;
  } catch (e) {
    return null; // KV ล่ม → fail-open
  }
}

function originOk(req) {
  const allow = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ref = req.headers.origin || req.headers.referer || '';
  if (!ref) return false; // fail-closed: ไม่มี origin/referer (เช่น curl/บอท) -> บล็อก
  try {
    const h = new URL(ref).host;
    if (h === req.headers.host) return true;
    return allow.some(a => {
      try { return new URL(a.includes('://') ? a : 'https://' + a).host === h; } catch (e) { return a === h; }
    });
  } catch (e) { return false; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'POST only' } });
  if (!originOk(req)) return res.status(403).json({ error: { message: 'forbidden origin' } });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: { message: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในเซิร์ฟเวอร์' } });

  // กันบอทฟลัช: เช็คก่อนเรียก Gemini (ประหยัดเงินถ้าโดนบล็อก)
  const limited = await checkRateLimit(req);
  if (limited) return res.status(429).json({ error: { code: 'RATE_LIMIT', message: limited.message } });

  let model = (req.body && req.body.model) || 'gemini-2.5-flash';
  model = String(model).replace(/[^a-z0-9.\-]/gi, '');
  if (!ALLOWED_MODELS.has(model)) model = 'gemini-2.5-flash';

  const body = req.body && req.body.body;
  if (!body || !body.contents) return res.status(400).json({ error: { message: 'bad request' } });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: { message: 'ติดต่อ Gemini ไม่สำเร็จ ลองใหม่อีกครั้ง' } });
  }
};
