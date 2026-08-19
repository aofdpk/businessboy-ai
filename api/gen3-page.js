const crypto = require('crypto');

const COOKIE_NAME = 'businessboy_gen3_session';
const PRESENTER_COOKIE_NAME = 'businessboy_gen3_presenter';
const VIEWS = {
  hub: { path: '/gen3' },
  identity: { path: '/gen3/identity' },
  sales: { path: '/gen3/sales' },
  products: { path: '/gen3/products' },
  'presenter-identity': { path: '/gen3/presenter-identity', presenter: true },
  'presenter-sales': { path: '/gen3/presenter-sales', presenter: true },
};

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function secret() {
  return process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
}

function presenterPassword() {
  return process.env.GEN3_PRESENTER_PASSWORD || '';
}

function presenterAccessIsOpen() {
  return process.env.GEN3_PRESENTER_ACCESS === 'open';
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function cookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((result, pair) => {
    const index = pair.indexOf('=');
    if (index < 0) return result;
    result[pair.slice(0, index).trim()] = safeDecode(pair.slice(index + 1).trim());
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

function presenterPasswordFingerprint() {
  return crypto.createHash('sha256').update(presenterPassword()).digest('base64url');
}

function signPresenter(expiresAt) {
  const payload = `gen3-presenter-entitlement:v1\n${expiresAt}\n${presenterPasswordFingerprint()}`;
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function validPresenterEntitlement(req) {
  if (!secret() || !presenterPassword()) return false;
  const token = cookies(req)[PRESENTER_COOKIE_NAME];
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const expiresAt = parts[1];
  const supplied = parts[2];
  if (!/^\d{13}$/.test(expiresAt) || Number(expiresAt) <= Date.now() || !supplied) return false;
  return safeEqual(supplied, signPresenter(expiresAt));
}

function hasPresenterAccess(req) {
  return presenterAccessIsOpen() || validPresenterEntitlement(req);
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
  return `<script>document.getElementById('logout-button').addEventListener('click',async function(){this.disabled=true;try{sessionStorage.removeItem('businessboy-gen3-presenter-identity-v1');sessionStorage.removeItem('businessboy-gen3-presenter-sales-v1')}catch(error){}await fetch('/api/gen3-auth',{method:'DELETE'}).catch(function(){});location.reload()})</script>`;
}

function hubHtml(req) {
  const presenterBadge = hasPresenterAccess(req) ? 'ใหม่ · ปลดล็อกแล้ว' : 'ใหม่ · ต้องใช้รหัสทดสอบ';
  return `<!doctype html><html lang="th"><head>${head('เลือกเครื่องมือ · เด็กประกอบการ รุ่น 3', 'เลือกเครื่องมือสร้างคลิป AI และค้นหาสินค้าสำหรับคอร์สเด็กประกอบการ รุ่น 3')}</head><body><main class="app-page">${appHeader('เลือกเครื่องมือ · รุ่น 3')}
<div class="builder-shell builder-shell--hub"><section class="mode-hub" aria-labelledby="mode-hub-title"><header class="mode-hub__intro"><span class="eyebrow">AI TOOLS · รุ่น 3</span><h1 id="mode-hub-title">วันนี้อยากทำอะไร?</h1><p>เลือกเครื่องมือสร้างคลิปหรือค้นหาสินค้าที่ต้องการใช้ในรอบนี้</p></header>
<div class="mode-groups">
<section class="mode-group" aria-labelledby="identity-group-title"><header class="mode-group__heading"><span>01</span><div><h2 id="identity-group-title">สร้างตัวตนของช่อง</h2><p>วางคาแรกเตอร์และเรื่องเล่าให้คนจดจำ</p></div></header><div class="mode-grid mode-grid--pair">
<article class="mode-card mode-card--identity"><span class="mode-card__badge">พร้อมใช้งาน</span><h3>สร้างคลิปสร้างตัวตน</h3><p>วางช่องให้คนติดตาม พร้อมเห็นหมวดสินค้าที่เข้ากันในอนาคต โดยคลิปที่ผลิตในโหมดนี้ยังไม่มีสินค้าและไม่ใส่ CTA ขาย</p><ul><li>หาไอเดียช่องและสินค้าที่ต่อยอดได้</li><li>สร้าง Character Sheet ให้คงที่</li><li>สร้างตาราง Image + Video Prompt พร้อมผลิต</li></ul><a class="mode-card__action mode-card__action--primary" href="/gen3/identity">เริ่มโหมดสร้างตัวตน →</a></article>
<article class="mode-card mode-card--presenter"><span class="mode-card__badge mode-card__badge--presenter">${presenterBadge}</span><h3>คลิปสร้างตัวตนสาวสวย/หนุ่มหล่อ</h3><p>ออกแบบหน้าตา ลุคประเทศ บุคลิก และโทนช่อง แล้วให้ AI วางฉากและการเคลื่อนไหวตามบท</p><ul><li>เลือกสวย น่ารัก หล่อเข้ม หล่อละมุน หรือพิมพ์เอง</li><li>เลือกลุคไทย เกาหลี ญี่ปุ่น จีน หรืออินเตอร์</li><li>สร้าง Character Sheet และ Prompt คลิปที่ AI เลือกท่าตามเรื่อง</li></ul><a class="mode-card__action mode-card__action--presenter" href="/gen3/presenter-identity">เริ่มสร้างตัวตนสายพรีเซนเตอร์ →</a></article>
</div></section>
<section class="mode-group" aria-labelledby="sales-group-title"><header class="mode-group__heading"><span>02</span><div><h2 id="sales-group-title">สร้างคลิปขายสินค้า</h2><p>เปลี่ยนข้อมูลสินค้าเป็น Prompt พร้อมผลิต</p></div></header><div class="mode-grid mode-grid--pair">
<article class="mode-card mode-card--sales mode-card--sales-active"><span class="mode-card__badge mode-card__badge--sales">พร้อมใช้งาน</span><h3>สร้างคลิปขายสินค้า</h3><p>แนบรูปตัวละครและรูปสินค้าต้นฉบับ แล้วรับตารางคลิปขายพร้อมผลิตใน Prompt เดียว</p><ul><li>ไม่ต้องสร้าง Product Sheet</li><li>ตรวจหลักฐานและข้อจำกัดสินค้าให้อัตโนมัติ</li><li>สร้างตาราง Image + Video Prompt ในขั้นเดียว</li></ul><a class="mode-card__action mode-card__action--sales" href="/gen3/sales">เริ่มโหมดคลิปขายสินค้า →</a></article>
<article class="mode-card mode-card--presenter-sales"><span class="mode-card__badge mode-card__badge--presenter-sales">${presenterBadge}</span><h3>สร้างคลิปขายสินค้าสาวสวย/หนุ่มหล่อ</h3><p>ใช้บุคลิกและเสน่ห์ของพรีเซนเตอร์ช่วยหยุดสายตา พร้อมคงระบบตรวจหลักฐานและข้อจำกัดสินค้า</p><ul><li>ดึงตัวละครจากโหมดสร้างตัวตนสายพรีเซนเตอร์</li><li>เลือกมุมขาย โทนการพูด และวิธีนำเสนอสินค้า</li><li>วางฉากสินค้าได้หลายฉากโดยไม่ทำ Reference หลุด</li></ul><a class="mode-card__action mode-card__action--presenter-sales" href="/gen3/presenter-sales">เริ่มสร้างคลิปขายสายพรีเซนเตอร์ →</a></article>
</div></section>
<section class="mode-group" aria-labelledby="catalog-group-title"><header class="mode-group__heading"><span>03</span><div><h2 id="catalog-group-title">ค้นหาสินค้า</h2><p>เลือกสินค้าน่าขายก่อนนำไปสร้างคลิป</p></div></header><div class="mode-grid mode-grid--single">
<article class="mode-card mode-card--catalog"><span class="mode-card__badge mode-card__badge--catalog">พร้อมใช้งาน</span><h3>คลังสินค้าน่าขาย</h3><p>ค้นหาสินค้าที่คัดจากยอดขายสะสม คะแนนสินค้า คุณภาพร้าน ราคา และความเหมาะกับช่วงเวลา</p><ul><li>กรองหมวด ราคา เดือน คะแนน และประเภทร้าน</li><li>คัดลอกรายละเอียดพร้อมราคาได้ทันที</li><li>ดูรูปใหญ่ ดาวน์โหลดรูป และเปิด Shopee</li></ul><a class="mode-card__action mode-card__action--catalog" href="/gen3/products">เปิดคลังสินค้า →</a></article>
</div></section></div></section></div></main>${logoutScript()}</body></html>`;
}

function identityHtml() {
  return `<!doctype html><html lang="th"><head>${head('สร้างคลิปตัวตน · เด็กประกอบการ รุ่น 3', 'AI Prompt Builder สำหรับสร้างคลิปสร้างตัวตน')}</head><body><div id="builder-root"></div><noscript>กรุณาเปิด JavaScript เพื่อใช้งาน AI Prompt Builder</noscript><script defer src="/api/gen3-script?view=identity"></script></body></html>`;
}

function salesHtml() {
  return `<!doctype html><html lang="th"><head>${head('สร้างคลิปขายสินค้า · เด็กประกอบการ รุ่น 3', 'AI Prompt Builder สำหรับสร้างคลิปขายจากรูปตัวละครและรูปสินค้าต้นฉบับในขั้นตอนเดียว')}</head><body><div id="builder-root"></div><noscript>กรุณาเปิด JavaScript เพื่อใช้งาน AI Prompt Builder</noscript><script defer src="/api/gen3-script?view=sales"></script></body></html>`;
}

function productsHtml() {
  return `<!doctype html><html lang="th"><head>${head('คลังสินค้าน่าขาย · เด็กประกอบการ รุ่น 3', 'ค้นหาสินค้าน่าขาย พร้อมรูป ชื่อ รายละเอียด ราคา ยอดขายสะสม คะแนนสินค้า และตัวกรองตามช่วงเวลา')}<link href="/gen3-products.css" rel="stylesheet"></head><body><div id="catalog-root"></div><noscript>กรุณาเปิด JavaScript เพื่อใช้งานคลังสินค้าน่าขาย</noscript><script defer src="/api/gen3-script?view=products"></script></body></html>`;
}

function presenterIdentityHtml() {
  return `<!doctype html><html lang="th"><head>${head('สร้างตัวตนสาวสวย/หนุ่มหล่อ · เด็กประกอบการ รุ่น 3', 'ออกแบบช่อง ตัวละคร และคลิปสร้างตัวตนสำหรับพรีเซนเตอร์สาวสวยหรือหนุ่มหล่อ')}</head><body><div id="builder-root"></div><noscript>กรุณาเปิด JavaScript เพื่อใช้งาน AI Prompt Builder</noscript><script defer src="/api/gen3-script?view=presenter-identity"></script></body></html>`;
}

function presenterSalesHtml() {
  return `<!doctype html><html lang="th"><head>${head('สร้างคลิปขายสินค้าสาวสวย/หนุ่มหล่อ · เด็กประกอบการ รุ่น 3', 'สร้าง Prompt คลิปขายสินค้าด้วยพรีเซนเตอร์สาวสวยหรือหนุ่มหล่อ')}</head><body><div id="builder-root"></div><noscript>กรุณาเปิด JavaScript เพื่อใช้งาน AI Prompt Builder</noscript><script defer src="/api/gen3-script?view=presenter-sales"></script></body></html>`;
}

function pageHtml(view, req) {
  if (view === 'identity') return identityHtml();
  if (view === 'sales') return salesHtml();
  if (view === 'products') return productsHtml();
  if (view === 'presenter-identity') return presenterIdentityHtml();
  if (view === 'presenter-sales') return presenterSalesHtml();
  return hubHtml(req);
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

function presenterUnlockHtml(view) {
  const returnTo = VIEWS[view].path;
  const configured = Boolean(secret() && presenterPassword());
  const helper = configured
    ? '<p class="login-helper" role="status" aria-live="polite">พื้นที่ทดสอบส่วนตัว กรุณากรอกรหัส Presenter</p>'
    : '<p class="login-error" role="alert">ระบบโหมดทดสอบยังตั้งค่าไม่ครบ กรุณาแจ้งผู้สอน</p>';
  const inputState = configured ? 'autofocus' : 'disabled';
  const buttonState = configured ? '' : ' disabled';
  return `<!doctype html><html lang="th"><head>${head('ปลดล็อก Presenter Mode · เด็กประกอบการ', 'กรอกรหัสทดสอบเพื่อเข้าใช้งาน Presenter Mode')}</head>
<body><main class="login-page presenter-unlock-page"><section class="login-panel"><nav class="presenter-unlock-nav" aria-label="ย้อนกลับ"><a href="/gen3">← กลับไปเลือกเครื่องมือ</a></nav><div class="login-brand"><img alt="เด็กประกอบการ The Business Boy" class="login-logo" height="112" src="/businessboy-logo.jpg" width="112"><div><span class="eyebrow">PRESENTER MODE · TEST ACCESS</span><h1>พื้นที่ทดสอบ</h1><p>สำหรับทดสอบสองเครื่องมือใหม่ก่อนเปิดให้นักเรียน</p></div></div>
<div class="login-steps presenter-unlock-steps"><span><b>01</b> เลือกหน้าตาและลุค</span><span><b>02</b> ล็อกตัวละคร</span><span><b>03</b> สร้างคลิปพร้อมผลิต</span></div>
<form class="login-form login-form--presenter" id="presenter-unlock-form"><label for="presenter-password">รหัสเข้าโหมดทดสอบ</label><input autocomplete="off" id="presenter-password" inputmode="numeric" placeholder="กรอกรหัส Presenter" required type="password" ${inputState}>${helper}<button class="login-button login-button--presenter" type="submit"${buttonState}>ปลดล็อก Presenter Mode</button></form><p class="login-quote">เมื่อปลดล็อกแล้ว สามารถทดสอบได้ทั้งสองการ์ดบนอุปกรณ์นี้</p></section>
<aside class="login-visual login-visual--presenter" aria-hidden="true"><div class="orb orb-one"></div><div class="orb orb-two"></div><div class="visual-content"><span>FACE → CHARACTER → STORY</span><h2>สร้างคนที่<br>คนอยากดูต่อ</h2><p>ล็อกหน้าตา บุคลิก<br>และสไตล์ให้จำง่าย</p></div></aside></main>
<script>document.getElementById('presenter-unlock-form').addEventListener('submit',async function(event){event.preventDefault();const button=this.querySelector('button');const feedback=this.querySelector('p');button.disabled=true;button.textContent='กำลังตรวจรหัส...';feedback.className='login-helper';feedback.textContent='';try{const response=await fetch('/api/gen3-auth?scope=presenter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('presenter-password').value})});const result=await response.json();if(!response.ok)throw new Error(result.error||'รหัสทดสอบไม่ถูกต้อง');location.replace(${JSON.stringify(returnTo)})}catch(error){feedback.className='login-error';feedback.textContent=error.message;button.disabled=false;button.textContent='ปลดล็อก Presenter Mode'}});</script></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const view = typeof req.query?.view === 'string' ? req.query.view : 'hub';
  if (!Object.prototype.hasOwnProperty.call(VIEWS, view)) return res.status(404).send('Not found');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  let html;
  if (!validSession(req)) html = loginHtml(view);
  else if (VIEWS[view].presenter && !hasPresenterAccess(req)) html = presenterUnlockHtml(view);
  else html = pageHtml(view, req);

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(html);
};
