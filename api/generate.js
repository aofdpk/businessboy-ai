// /api/generate — proxy เรียก Gemini (text / vision / image-gen / video-inline)
// ต้องล็อกอิน (ตรวจ Supabase JWT) + หักเครดิต 10/ครั้ง ฝั่งเซิร์ฟเวอร์
// key ทั้งหมด (Gemini + Supabase secret) อยู่ใน env เท่านั้น ไม่เคยส่งมาที่เบราว์เซอร์
const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash', 'gemini-2.5-flash-image', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'
]);
const CREDITS_PER_GEN = 10;

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_SECRET = process.env.SUPABASE_SECRET_KEY || '';

function originOk(req) {
  const allow = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ref = req.headers.origin || req.headers.referer || '';
  if (!ref) return false; // fail-closed
  try {
    const h = new URL(ref).host;
    if (h === req.headers.host) return true;
    return allow.some(a => { try { return new URL(a.includes('://') ? a : 'https://' + a).host === h; } catch (e) { return a === h; } });
  } catch (e) { return false; }
}

// ยืนยัน access token ของผู้ใช้ -> คืน user id หรือ null
async function getUserId(token) {
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', {
      headers: { apikey: SB_SECRET, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u.id : null;
  } catch (e) { return null; }
}

// เรียก RPC ด้วย service role (secret key) -> คืนค่าที่ฟังก์ชันคืน
async function rpc(fn, args) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: SB_SECRET, Authorization: 'Bearer ' + SB_SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error('rpc ' + fn + ' ' + r.status);
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return t; }
}

async function callGemini(model, body, key) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body)
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

function candidateText(rawText) {
  try {
    const j = JSON.parse(rawText);
    const parts = j.candidates[0].content.parts;
    return parts.filter(p => p.text).map(p => p.text).join('\n').trim();
  } catch (e) { return ''; }
}
function isValidModelJson(rawText) {
  let s = candidateText(rawText);
  if (!s) return false;
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { JSON.parse(s); return true; } catch (e) { return false; }
}
function hasImage(rawText) {
  try {
    const parts = JSON.parse(rawText).candidates[0].content.parts;
    return parts.some(p => p.inlineData || p.inline_data);
  } catch (e) { return false; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'POST only' } });
  if (!originOk(req)) return res.status(403).json({ error: { message: 'forbidden origin' } });
  const gkey = process.env.GEMINI_API_KEY;
  if (!gkey) return res.status(500).json({ error: { message: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY' } });
  if (!SB_URL || !SB_SECRET) return res.status(500).json({ error: { message: 'ยังไม่ได้ตั้งค่าระบบสมาชิก (SUPABASE)' } });

  // ---------- ต้องล็อกอิน ----------
  const authz = req.headers.authorization || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!token) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' } });
  const uid = await getUserId(token);
  if (!uid) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' } });

  // ---------- model + body ----------
  let model = (req.body && req.body.model) || 'gemini-2.5-flash';
  model = String(model).replace(/[^a-z0-9.\-]/gi, '');
  if (!ALLOWED_MODELS.has(model)) model = 'gemini-2.5-flash';
  const body = req.body && req.body.body;
  if (!body || !body.contents) return res.status(400).json({ error: { message: 'bad request' } });

  // ---------- จองเครดิต 10 ก่อนเรียก (กันเจนฟรีถ้าเครดิตไม่พอ) ----------
  let remaining;
  try { remaining = Number(await rpc('deduct_credits', { p_user: uid, p_amount: CREDITS_PER_GEN })); }
  catch (e) { return res.status(502).json({ error: { message: 'ระบบเครดิตขัดข้อง ลองใหม่อีกครั้ง' } }); }
  if (!(remaining >= 0)) {
    return res.status(402).json({ error: { code: 'NO_CREDITS', message: 'เครดิตของคุณหมดแล้ว 🙏 สนใจใช้งานต่อแบบไม่จำกัด — แอดไลน์ @businessboy ได้เลยครับ 💬' } });
  }

  const refund = () => rpc('refund_credits', { p_user: uid, p_amount: CREDITS_PER_GEN }).catch(() => {});

  try {
    let g = await callGemini(model, body, gkey);

    // retry ฝั่งเซิร์ฟเวอร์ครั้งเดียว (คิดเครดิตครั้งเดียว) ถ้าขอ JSON แต่ตอบไม่เป็น JSON
    const wantsJson = body.generationConfig && body.generationConfig.responseMimeType === 'application/json';
    if (g.ok && wantsJson && !isValidModelJson(g.text)) {
      const body2 = JSON.parse(JSON.stringify(body));
      body2.contents.push({ role: 'user', parts: [{ text: 'สำคัญ: ตอบกลับเป็น JSON ที่ถูกต้องเท่านั้น ห้ามมีข้อความอื่นหรือ markdown' }] });
      const g2 = await callGemini(model, body2, gkey);
      if (g2.ok) g = g2;
    }

    // image gen: ถ้ารอบแรกไม่ได้รูป ลองอีก modality (คิดเครดิตครั้งเดียว)
    if (g.ok && model === 'gemini-2.5-flash-image' && !hasImage(g.text)) {
      const body3 = JSON.parse(JSON.stringify(body));
      body3.generationConfig = Object.assign({}, body3.generationConfig, { responseModalities: ['TEXT', 'IMAGE'] });
      const g3 = await callGemini(model, body3, gkey);
      if (g3.ok && hasImage(g3.text)) g = g3;
    }

    if (!g.ok) { await refund(); } // Gemini error -> คืนเครดิต
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Credits-Remaining', String(g.ok ? remaining : remaining + CREDITS_PER_GEN));
    return res.status(g.status).send(g.text);
  } catch (e) {
    await refund();
    return res.status(502).json({ error: { message: 'ติดต่อ Gemini ไม่สำเร็จ ลองใหม่อีกครั้ง' } });
  }
};
