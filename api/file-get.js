// /api/file-get?name=files/xxx — เช็คสถานะไฟล์ที่อัปไป Gemini (รอจน ACTIVE)
function originOk(req) {
  const allow = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ref = req.headers.origin || req.headers.referer || '';
  if (!ref) return false; // fail-closed: บล็อกคำขอที่ไม่มี origin/referer
  try {
    const h = new URL(ref).host;
    if (h === req.headers.host) return true;
    return allow.some(a => { try { return new URL(a.includes('://') ? a : 'https://' + a).host === h; } catch (e) { return a === h; } });
  } catch (e) { return false; }
}

module.exports = async (req, res) => {
  if (!originOk(req)) return res.status(403).json({ error: { message: 'forbidden origin' } });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: { message: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY' } });

  const name = String((req.query && req.query.name) || '');
  if (!/^files\/[a-z0-9_-]+$/i.test(name)) return res.status(400).json({ error: { message: 'bad name' } });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, {
      headers: { 'x-goog-api-key': key }
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: { message: 'เช็คสถานะไฟล์ไม่สำเร็จ' } });
  }
};
