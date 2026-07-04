// /api/admin — ดึงรายชื่อสมาชิกสำหรับหน้าหลังบ้าน (ป้องกันด้วย ADMIN_TOKEN)
// ใช้ service role (secret key) อ่านตาราง profiles ทั้งหมด — ห้ามเปิดให้ client ทั่วไป
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_SECRET = process.env.SUPABASE_SECRET_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const body = req.body || {};
  if (!ADMIN_TOKEN || String(body.token || '') !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'รหัสแอดมินไม่ถูกต้อง' });
  }
  if (!SB_URL || !SB_SECRET) return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า SUPABASE' });
  try {
    const r = await fetch(SB_URL + '/rest/v1/profiles?select=first_name,last_name,phone,credits,created_at&order=created_at.desc', {
      headers: { apikey: SB_SECRET, Authorization: 'Bearer ' + SB_SECRET }
    });
    let rows = await r.json();
    if (!Array.isArray(rows)) rows = [];
    const q = String(body.q || '').trim().toLowerCase();
    if (q) rows = rows.filter(x => ((x.first_name || '') + ' ' + (x.last_name || '') + ' ' + (x.phone || '')).toLowerCase().includes(q));
    return res.status(200).json({ ok: true, count: rows.length, rows });
  } catch (e) {
    return res.status(502).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
  }
};
