# 🚀 คู่มือขึ้นเว็บจริง — businessboy.ai (38 AI Tools)

โฟลเดอร์นี้พร้อม deploy แล้ว เป็นเว็บแบบ **"ลูกค้าไม่ต้องใส่ API key"** — key เก็บอยู่หลังบ้าน (Vercel) เท่านั้น เปลี่ยนได้ทุกเมื่อ ไม่มีทางหลุดออกไปที่เบราว์เซอร์

> ทำงานยังไง: เปิดในเครื่อง (double-click) = โหมดใส่ key เอง · พอขึ้นเว็บจริง (https) = โหมด keyless อัตโนมัติ (เรียกผ่าน /api ที่ถือ key ฝั่ง server)

---

## ภาพรวม 4 ขั้น (รวม ~20–30 นาที)
A. เอา Gemini API key + ตั้งเพดานงบ → B. Deploy ขึ้น Vercel + ใส่ key → C. ซื้อโดเมน businessboy.ai + เชื่อม → D. ล็อกกัน abuse

---

## A. Gemini API key + เพดานงบ (กันบิลบาน)
1. ขอ key ที่ **aistudio.google.com/apikey** → กด **Get API key** → ก๊อปเก็บไว้
2. แนะนำเปิด **paid tier** (free tier เอาข้อมูลไปเทรน + ลิมิตต่ำ) ที่ Google Cloud Billing
3. **สำคัญ:** ตั้ง **Budget alert / เพดานงบ** ใน Google Cloud (เช่นไม่เกิน X บาท/เดือน) → กันคนถลุง key เรา

---

## B. Deploy ขึ้น Vercel (มีหลังบ้าน /api ต้องใช้ Vercel ไม่ใช่ Netlify Drop)
**วิธีที่ง่ายสุดสำหรับมือใหม่ = ผ่าน GitHub (ทุกขั้นเป็นหน้าเว็บ ไม่ต้องพิมพ์คำสั่ง):**
1. สมัคร **github.com** (ฟรี) → กด **New repository** → ตั้งชื่อ เช่น `businessboy-ai` → Create
2. ในหน้า repo กด **Add file → Upload files** → **ลากไฟล์ทั้งหมดในโฟลเดอร์ `claude-ai-apps` เข้าไป** (รวมโฟลเดอร์ `api/`) → Commit
3. ไป **vercel.com** → Sign up ด้วยบัญชี GitHub → **Add New → Project** → เลือก repo `businessboy-ai` → **Import**
4. **ก่อนกด Deploy:** เปิดหัวข้อ **Environment Variables** ใส่:
   - Name: `GEMINI_API_KEY`  ·  Value: *(วาง key จากข้อ A)*
   - (ใส่ทีหลังก็ได้ ที่ Settings → Environment Variables แล้ว Redeploy)
5. กด **Deploy** → รอสักครู่ → ได้ลิงก์สด เช่น `businessboy-ai.vercel.app` เปิดใช้ได้เลย ลูกค้าไม่ต้องใส่ key 🎉

> **เปลี่ยน key เมื่อไหร่ก็ได้:** Vercel → Settings → Environment Variables → แก้ค่า `GEMINI_API_KEY` → Redeploy (มีผลทันที ไม่ต้องแตะโค้ด)

---

## C. โดเมน businessboy.ai
1. ซื้อที่ **Porkbun / Namecheap / Dynadot** (.ai ราคา ~$60–110/ปี) — *จังหวะใส่บัตรจ่ายเงิน ทำเองนะครับ*
2. ที่ Vercel → โปรเจกต์ → **Settings → Domains → Add** → พิมพ์ `businessboy.ai`
3. Vercel จะบอกค่า **DNS (A / CNAME / Nameserver)** → เอาไปวางที่หน้าจัดการโดเมนของผู้ขาย → รอ ~5–60 นาที เชื่อมเสร็จ ใช้ `https://businessboy.ai` ได้เลย (HTTPS ฟรีอัตโนมัติ)

**ลิงก์สวยต่อโปรแกรม (ตั้งให้แล้วใน vercel.json)** เช่น:
`businessboy.ai/caption` · `/studio` · `/slip` · `/ads` · `/logo` · `/reels` · `/spy` · `/translate` … (ครบ 38 ตัว) + หน้ารวมที่ `businessboy.ai`

---

## D. ล็อกกัน abuse (key ไม่หลุด แต่ต้องกันคนยิงฟรีจนเปลืองโควต้า)
1. ที่ Vercel → Environment Variables เพิ่ม **`ALLOWED_ORIGINS`** = `businessboy.ai,www.businessboy.ai` → /api จะรับเฉพาะคำขอจากเว็บเรา
2. ตั้ง **เพดานงบที่ Google** (ข้อ A.3) = เกราะสุดท้ายที่ชัวร์สุด
3. (ทำเพิ่มทีหลังได้) ใส่ **Cloudflare Turnstile** (แคปช่ากันบอท) — บอกผมถ้าจะทำ เดี๋ยวต่อให้

---

## ❓ เปิดในเครื่องตัวเองยังเหมือนเดิมไหม?
เหมือนเดิมครับ — double-click ไฟล์ในเครื่อง = โหมดใส่ key เอง (สำหรับพี่ทดสอบ) · เฉพาะตอนขึ้นเว็บจริง https ถึงจะเป็น keyless

---

อยากให้ผม **ทำขั้น B–D ไปด้วยกันแบบสด** (ผมขับเบราว์เซอร์ให้ พี่แค่กดล็อกอิน + กดจ่ายเงิน) บอกได้เลยครับ
