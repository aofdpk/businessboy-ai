// Supabase Edge Function: send-sms
// ทำหน้าที่เป็น "Send SMS Hook" ของ Supabase Auth — ส่ง OTP ผ่าน ThaiBulkSMS
// Secrets ที่ต้องตั้ง (Supabase → Edge Functions → send-sms → Secrets):
//   SEND_SMS_HOOK_SECRET = v1,whsec_....  (Supabase สร้างให้ตอนตั้ง hook)
//   THAIBULKSMS_KEY      = api key ของ ThaiBulkSMS
//   THAIBULKSMS_SECRET   = api secret ของ ThaiBulkSMS
//   SMS_SENDER           = ชื่อผู้ส่ง (sender ID ที่ลงทะเบียนไว้ เช่น BizBoy)
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const hookSecret = (Deno.env.get('SEND_SMS_HOOK_SECRET') || '').replace('v1,whsec_', '')
const TBS_KEY = Deno.env.get('THAIBULKSMS_KEY') || ''
const TBS_SECRET = Deno.env.get('THAIBULKSMS_SECRET') || ''
const SENDER = Deno.env.get('SMS_SENDER') || 'BizBoy'

Deno.serve(async (req) => {
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  // 1) ตรวจลายเซ็นจาก Supabase (กันคนอื่นยิงมาให้ส่ง SMS ฟรี)
  let data: { user: { phone: string }; sms: { otp: string } }
  try {
    const wh = new Webhook(hookSecret)
    data = wh.verify(payload, headers) as any
  } catch (_e) {
    return new Response(JSON.stringify({ error: { http_code: 401, message: 'invalid signature' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  // 2) เตรียมเบอร์ (แปลง +66 -> 0) + ข้อความ
  const raw = data.user.phone || ''
  const msisdn = raw.startsWith('+66') ? '0' + raw.slice(3) : raw.replace(/^\+/, '')
  const message = `รหัส OTP ของคุณคือ ${data.sms.otp} (เด็กประกอบการ) รหัสมีอายุ 10 นาที`

  // 3) ส่งผ่าน ThaiBulkSMS
  try {
    const r = await fetch('https://api-v2.thaibulksms.com/sms', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TBS_KEY}:${TBS_SECRET}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ msisdn, message, sender: SENDER, force: 'standard' })
    })
    if (!r.ok) {
      const t = await r.text()
      return new Response(JSON.stringify({ error: { http_code: 500, message: 'sms failed: ' + t } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: { http_code: 502, message: 'sms provider unreachable' } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } })
  }

  // 4) สำเร็จ -> ตอบ {} ให้ Supabase
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
