// /api/generate — proxy เรียก Gemini generateContent (text / vision / image-gen)
// key อยู่ใน process.env.GEMINI_API_KEY เท่านั้น ไม่เคยส่งมาที่เบราว์เซอร์
const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash', 'gemini-2.5-flash-image', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'
]);

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
