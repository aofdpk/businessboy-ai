const crypto = require('crypto');

const COOKIE_NAME = 'businessboy_gen3_session';
const VIEWS = {
  hub: { path: '/gen3' },
  identity: { path: '/gen3/identity' },
  sales: { path: '/gen3/sales' },
};

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

function head(title, description) {
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${description}"><meta name="robots" content="noindex,nofollow">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="/gen3.css" rel="stylesheet">`;
}

function appHeader(subtitle) {
  return `<header class="app-header"><a class="brand-link" href="/gen3"><img alt="เด็กประกอบการ" height="64" src="/businessboy-logo.jpg" width="64"><div><b>AI Prompt Builder</b><span>${subtitle}</span></div></a><div class="header-message"><span>เอา AI ไปทำธุรกิจจริง</span><small>Prompt → KVID → KCUT → KPOST</small></div><button class="logout-button" id="logout-button" type="button">ออกจากระบบ</button></header>`;
}

function logoutScript() {
  return `<script>document.getElementById('logout-button').addEventListener('click',async function(){this.disabled=true;await fetch('/api/gen3-auth',{method:'DELETE'}).catch(function(){});location.reload()})</script>`;
}

function hubHtml() {
  return `<!doctype html><html lang="th"><head>${head('เลือกประเภทคลิป · เด็กประกอบการ รุ่น 3', 'เลือกเครื่องมือสร้างคลิป AI สำหรับคอร์สเด็กประกอบการ รุ่น 3')}</head><body><main class="app-page">${appHeader('เลือกประเภทคลิป · รุ่น 3')}
<div class="builder-shell builder-shell--hub"><section class="mode-hub" aria-labelledby="mode-hub-title"><header class="mode-hub__intro"><span class="eyebrow">AI PROMPT BUILDER · รุ่น 3</span><h1 id="mode-hub-title">วันนี้อยากสร้างคลิปแบบไหน?</h1><p>เลือกประเภทคลิปที่ต้องการทำรอบนี้ ไม่ได้เปลี่ยนรูปแบบธุรกิจของช่อง</p></header>
<div class="mode-grid"><article class="mode-card mode-card--identity"><span class="mode-card__badge">พร้อมใช้งาน</span><h2>สร้างคลิปสร้างตัวตน</h2><p>ให้คุณค่า เล่าเรื่อง และสร้างผู้ติดตาม โดยไม่มีสินค้าและไม่ใส่ CTA ขาย</p><ul><li>หาไอเดียและวางตัวตนของช่อง</li><li>สร้าง Character Sheet ให้คงที่</li><li>สร้างตาราง Image + Video Prompt พร้อมผลิต</li></ul><a class="mode-card__action mode-card__action--primary" href="/gen3/identity">เริ่มโหมดสร้างตัวตน →</a></article>
<article class="mode-card mode-card--sales mode-card--sales-active"><span class="mode-card__badge mode-card__badge--sales">พร้อมใช้งาน</span><h2>สร้างคลิปขายสินค้า</h2><p>ล็อกหน้าตา วิธีใช้ และข้อเท็จจริงของสินค้าก่อนสร้างคลิปขายพร้อมผลิต</p><ul><li>สร้าง Product Sheet และ PRODUCT LOCK</li><li>ใช้ Character Sheet คู่กับ Product Sheet</li><li>สร้างตาราง Image + Video Prompt ในขั้นเดียว</li></ul><a class="mode-card__action mode-card__action--sales" href="/gen3/sales">เริ่มโหมดคลิปขายสินค้า →</a></article></div></section></div></main>${logoutScript()}</body></html>`;
}

function identityHtml() {
  return `<!doctype html><html lang="th"><head>${head('สร้างคลิปตัวตน · เด็กประกอบการ รุ่น 3', 'AI Prompt Builder สำหรับสร้างคลิปสร้างตัวตน')}</head><body><div id="builder-root"></div><noscript>กรุณาเปิด JavaScript เพื่อใช้งาน AI Prompt Builder</noscript><script defer src="/api/gen3-script?view=identity"></script></body></html>`;
}

function salesHtml() {
  return `<!doctype html><html lang="th"><head>${head('สร้างคลิปขายสินค้า · เด็กประกอบการ รุ่น 3', 'AI Prompt Builder สำหรับสร้าง Product Sheet และคลิปขายสินค้าพร้อมผลิต')}</head><body><div id="builder-root"></div><noscript>กรุณาเปิด JavaScript เพื่อใช้งาน AI Prompt Builder</noscript><script defer src="/api/gen3-script?view=sales"></script></body></html>`;
}

function pageHtml(view) {
  if (view === 'identity') return identityHtml();
  if (view === 'sales') return salesHtml();
  return hubHtml();
}

function loginHtml(view, message = '') {
  const error = message ? `<p class="login-error">${message}</p>` : '<p class="login-helper">สำหรับนักเรียนคอร์สรุ่น 3 เท่านั้น</p>';
  const returnTo = VIEWS[view].path;
  return `<!doctype html><html lang="th"><head>${head('เข้าสู่ AI Prompt Builder · เด็กประกอบการ', 'เข้าสู่ระบบ AI Prompt Builder สำหรับนักเรียนเด็กประกอบการ รุ่น 3')}</head>
<body><main class="login-page"><section class="login-panel"><div class="login-brand"><img alt="เด็กประกอบการ The Business Boy" class="login-logo" height="112" src="/businessboy-logo.jpg" width="112"><div><span class="eyebrow">THE BUSINESS BOY · รุ่น 3</span><h1>AI Prompt Builder</h1><p>สร้าง Prompt ให้ครบ ตั้งแต่หาแนวช่องจนพร้อมผลิตคลิป</p></div></div>
<div class="login-steps"><span><b>01</b> เลือกประเภทคลิป</span><span><b>02</b> สร้างตัวละคร</span><span><b>03</b> สร้างเรื่องพร้อมผลิต</span></div>
<form class="login-form" id="login-form"><label for="password">รหัสเข้าใช้งาน</label><input autocomplete="current-password" autofocus id="password" placeholder="กรอกรหัสจากในคลาส" required type="password">${error}<button class="login-button" type="submit">เข้าสู่ Prompt Builder</button></form><p class="login-quote">“ขอแค่ได้เริ่ม แล้วค่อยทำให้ดีขึ้นระหว่างทาง”</p></section>
<aside class="login-visual" aria-hidden="true"><div class="orb orb-one"></div><div class="orb orb-two"></div><div class="visual-content"><span>Prompt → KVID → KCUT → KPOST</span><h2>เอา AI ไปทำ<br>ธุรกิจจริง</h2><p>คุณเป็นผู้จัดการ<br>ให้ AI เป็นเด็กฝึกงาน</p></div></aside></main>
<script>document.getElementById('login-form').addEventListener('submit',async function(event){event.preventDefault();const button=this.querySelector('button');const feedback=this.querySelector('p');button.disabled=true;button.textContent='กำลังตรวจรหัส...';feedback.className='login-helper';feedback.textContent='';try{const response=await fetch('/api/gen3-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('password').value})});const result=await response.json();if(!response.ok)throw new Error(result.error||'รหัสไม่ถูกต้อง');location.replace(${JSON.stringify(returnTo)})}catch(error){feedback.className='login-error';feedback.textContent=error.message;button.disabled=false;button.textContent='เข้าสู่ Prompt Builder'}});</script></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const view = typeof req.query?.view === 'string' ? req.query.view : 'hub';
  if (!Object.prototype.hasOwnProperty.call(VIEWS, view)) return res.status(404).send('Not found');
  return res.status(200).send(validSession(req) ? pageHtml(view) : loginHtml(view));
};
