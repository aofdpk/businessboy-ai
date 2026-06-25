// /api/file-start — เริ่ม resumable upload กับ Gemini File API (สำหรับวิดีโอ/เสียง)
// คืน uploadUrl ให้เบราว์เซอร์อัปไฟล์ก้อนใหญ่ "ตรงไป Google" ได้เลย (ขั้นนั้นไม่ต้องใช้ key)
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
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'POST only' } });
  if (!originOk(req)) return res.status(403).json({ error: { message: 'forbidden origin' } });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: { message: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY' } });

  const { displayName, mimeType, size } = req.body || {};
  const sz = Number(size);
  if (!mimeType || !sz || sz <= 0 || sz > 2 * 1024 * 1024 * 1024) {
    return res.status(400).json({ error: { message: 'bad request (mimeType/size)' } });
  }

  try {
    const r = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(size),
        'X-Goog-Upload-Header-Content-Type': String(mimeType),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file: { display_name: String(displayName || 'upload') } })
    });
    if (!r.ok) { const t = await r.text(); return res.status(r.status).send(t); }
    const uploadUrl = r.headers.get('x-goog-upload-url') || r.headers.get('X-Goog-Upload-URL');
    return res.status(200).json({ uploadUrl });
  } catch (e) {
    return res.status(502).json({ error: { message: 'เริ่มอัปโหลดไม่สำเร็จ ลองใหม่' } });
  }
};
