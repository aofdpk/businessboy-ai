const crypto = require('crypto');

const COOKIE_NAME = 'businessboy_gen3_session';

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function secret() {
  return process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
}

function cookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((result, pair) => {
    const index = pair.indexOf('=');
    if (index < 0) return result;
    result[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
    return result;
  }, {});
}

function validSession(req) {
  const token = cookies(req)[COOKIE_NAME];
  if (!token || !secret()) return false;
  const [expiresAt, supplied] = token.split('.');
  if (!expiresAt || !supplied || Number(expiresAt) <= Date.now()) return false;
  const expected = crypto.createHmac('sha256', secret()).update(expiresAt).digest('base64url');
  return safeEqual(supplied, expected);
}

function pageHtml() {
  return `<!doctype html>
<html lang="th"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="AI Prompt Builder สำหรับนักเรียนเด็กประกอบการ รุ่น 3"><meta name="robots" content="noindex,nofollow">
<title>AI Prompt Builder · เด็กประกอบการ รุ่น 3</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="/gen3.css" rel="stylesheet"></head>
<body><div id="builder-root"></div><noscript>กรุณาเปิด JavaScript เพื่อใช้งาน AI Prompt Builder</noscript><script defer src="/api/gen3-script"></script></body></html>`;
}

function loginHtml(message = '') {
  const error = message ? `<p class="login-error">${message}</p>` : '<p class="login-helper">สำหรับนักเรียนคอร์สรุ่น 3 เท่านั้น</p>';
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>เข้าสู่ AI Prompt Builder · เด็กประกอบการ</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet"><link href="/gen3.css" rel="stylesheet"></head>
<body><main class="login-page"><section class="login-panel"><div class="login-brand"><img alt="เด็กประกอบการ The Business Boy" class="login-logo" height="112" src="/businessboy-logo.jpg" width="112"><div><span class="eyebrow">THE BUSINESS BOY · รุ่น 3</span><h1>AI Prompt Builder</h1><p>สร้าง Prompt ให้ครบ ตั้งแต่หาแนวช่องจนพร้อมผลิตคลิป</p></div></div>
<div class="login-steps"><span><b>01</b> หาไอเดียช่อง</span><span><b>02</b> สร้างตัวละคร</span><span><b>03</b> สร้างเรื่องพร้อมผลิต</span></div>
<form class="login-form" id="login-form"><label for="password">รหัสเข้าใช้งาน</label><input autocomplete="current-password" autofocus id="password" placeholder="กรอกรหัสจากในคลาส" required type="password">${error}<button class="login-button" type="submit">เข้าสู่ Prompt Builder</button></form><p class="login-quote">“ขอแค่ได้เริ่ม แล้วค่อยทำให้ดีขึ้นระหว่างทาง”</p></section>
<aside class="login-visual" aria-hidden="true"><div class="orb orb-one"></div><div class="orb orb-two"></div><div class="visual-content"><span>Prompt → KVID → KCUT → KPOST</span><h2>เอา AI ไปทำ<br>ธุรกิจจริง</h2><p>คุณเป็นผู้จัดการ<br>ให้ AI เป็นเด็กฝึกงาน</p></div></aside></main>
<script>document.getElementById('login-form').addEventListener('submit',async function(event){event.preventDefault();const button=this.querySelector('button');const feedback=this.querySelector('p');button.disabled=true;button.textContent='กำลังตรวจรหัส...';feedback.className='login-helper';feedback.textContent='';try{const response=await fetch('/api/gen3-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('password').value})});const result=await response.json();if(!response.ok)throw new Error(result.error||'รหัสไม่ถูกต้อง');location.replace('/gen3')}catch(error){feedback.className='login-error';feedback.textContent=error.message;button.disabled=false;button.textContent='เข้าสู่ Prompt Builder'}});</script></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.status(200).send(validSession(req) ? pageHtml() : loginHtml());
};
