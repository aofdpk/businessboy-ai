(() => {
'use strict';
const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('th-TH');
const date = value => new Date(value).toLocaleDateString('th-TH',{day:'numeric',month:'short',timeZone:'Asia/Bangkok'});
const time = value => new Date(value).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
let days = 7, requestId = 0, signedIn = false, loading = false;
const labels = {
  '/ai-page-gen4':'หน้าขายคอร์สรุ่น 4','/ai-page-gen4.html':'หน้าขายคอร์สรุ่น 4','/gen3/products':'คลังสินค้า รุ่น 3','/gen3/identity':'สร้างตัวตน รุ่น 3','/gen3/sales':'สร้างคลิปขาย รุ่น 3',
  '/starter':'ชุดเริ่มต้น','/student-story':'สมัครสัมภาษณ์','/digitalproducts':'สินค้าดิจิทัล',
  tiktok:'TikTok',facebook:'Facebook',line:'LINE',qa:'ทดสอบระบบ',Others:'อื่น ๆ',others:'อื่น ๆ',
  mobile:'มือถือ',desktop:'คอมพิวเตอร์',tablet:'แท็บเล็ต',
  top:'ส่วนแนะนำคอร์ส','instructor-results':'ผลงานผู้สอน',learning:'รายละเอียดการเรียน',examples:'คลิปตัวอย่าง',kvid:'โปรแกรม KVID',reviews:'รีวิวผู้เรียน',results:'ผลลัพธ์ผู้เรียน',schedule:'ตารางเรียน',costs:'ค่าใช้จ่าย',packages:'ราคาและแพ็กเกจ',faq:'คำถามที่พบบ่อย',contact:'ส่วนติดต่อ',
  general:'ปุ่มสมัครทั่วไป',onsite:'แพ็กเกจเรียนในห้อง','1_month':'KVID 1 เดือน','3_months':'KVID 3 เดือน','1_year':'KVID 1 ปี',lifetime:'KVID ตลอดชีพ',unknown:'ไม่ระบุแพ็กเกจ',
  gen4_line_click:'กดไป LINE',gen4_register_click:'กดไปหน้าสมัครเรียน',gen4_package_selected:'เปลี่ยนแพ็กเกจ',gen4_section_viewed:'เลื่อนเห็นส่วนของหน้า',gen4_faq_opened:'เปิดคำถามที่พบบ่อย',gen4_video_opened:'เปิดวิดีโอตัวอย่าง',
  product_details_copied:'คัดลอกรายละเอียดสินค้า',identity_prompt_copied:'คัดลอก Prompt ตัวตน',sales_prompt_copied:'คัดลอก Prompt ขายสินค้า',product_image_download_clicked:'กดดาวน์โหลดรูปสินค้า',product_shopee_opened:'กดเปิด Shopee',live_26sep:'ไลฟ์ 26 กันยายน',analytics_setup:'ทดสอบติดตั้งสถิติ'
};
function showLogin() {
  signedIn=false; requestId++;
  $('dashboard').hidden=true; $('login-screen').hidden=false; $('loading-screen').hidden=true;
  $('password').value=''; $('password').focus();
}
function showDashboard() {
  signedIn=true; $('login-screen').hidden=true; $('loading-screen').hidden=true; $('dashboard').hidden=false;
  load();
}
async function api(action, body) {
  const response = await fetch('/api/stats?action='+action,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
  const data = await response.json();
  if (!response.ok) { const error=new Error(data.error||'เชื่อมต่อไม่สำเร็จ'); error.status=response.status; throw error; }
  return data;
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.currentTarget.querySelector('[type=submit]'); button.disabled=true;
  $('login-error').hidden=true;
  try { await api('login',{password:$('password').value}); $('password').value=''; showDashboard(); }
  catch(error) { $('login-error').textContent=error.message; $('login-error').hidden=false; }
  finally { button.disabled=false; }
});
$('show-password').addEventListener('click',()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('show-password').textContent=show?'ซ่อน':'แสดง';$('show-password').setAttribute('aria-pressed',String(show));$('show-password').setAttribute('aria-label',show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน');});
$('logout').addEventListener('click',async()=>{
  $('logout').disabled=true;
  try {await api('logout',{}); showLogin();}
  catch { $('data-error-message').textContent='ออกจากระบบยังไม่สำเร็จ กรุณาลองอีกครั้ง';$('data-error').hidden=false; }
  finally {$('logout').disabled=false;}
});
function list(id, data, metric='views', empty='ยังไม่มีข้อมูลในช่วงนี้', blank='ไม่ระบุ') {
  const parent=$(id);parent.replaceChildren();
  const items=[...data].sort((a,b)=>b[metric]-a[metric]);
  const max=Math.max(1,...items.map(r=>r[metric]));
  if(!items.length){const p=document.createElement('p');p.className='list-empty';p.textContent=empty;parent.append(p);return;}
  for(const row of items){
    const item=document.createElement('div');item.className='rank-row';
    const bar=document.createElement('div');bar.className='rank-fill';bar.style.width=(row[metric]/max*100)+'%';
    const label=document.createElement('span');label.className='rank-label';label.textContent=labels[row.label]||row.label||blank;
    const value=document.createElement('span');value.className='rank-number';value.textContent=number.format(row[metric]);
    const unit=document.createElement('small');unit.textContent=metric==='visitors'?'คน':'ครั้ง';value.append(unit);
    item.append(bar,label,value);parent.append(item);
  }
}
const svgElement=(tag,attributes={})=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,String(value));return el;};
function chart(rows) {
  const parent=$('traffic-chart');parent.replaceChildren();
  const svg=svgElement('svg',{viewBox:'0 0 680 240',role:'img','aria-label':'จำนวนเปิดหน้าเว็บรายวัน'});
  const max=Math.max(4,...rows.map(r=>r.views));
  const left=42,right=668,top=12,bottom=208,width=right-left,height=bottom-top;
  for(let i=0;i<5;i++){const y=top+i*height/4;svg.append(svgElement('line',{x1:left,y1:y,x2:right,y2:y,stroke:'#eef2f8','stroke-dasharray':'3 5'}));const t=svgElement('text',{x:left-10,y:y+4,'text-anchor':'end'});t.textContent=number.format(Math.round(max*(4-i)/4));svg.append(t);}
  const band=width/Math.max(1,rows.length),barWidth=Math.min(38,band*.55);
  rows.forEach((row,index)=>{
    const x=left+band*(index+.5),h=row.views/max*height;
    const bar=svgElement('rect',{x:x-barWidth/2,y:bottom-h,width:barWidth,height:Math.max(row.views?2:0,h),rx:Math.min(5,barWidth/3),fill:index===rows.length-1?'#174acf':'#9dbbfa'});
    const title=svgElement('title');title.textContent=`${date(row.date+'T12:00:00+07:00')} : ${number.format(row.views)} ครั้ง`;bar.append(title);svg.append(bar);
    if(rows.length<=7||index===0||index===rows.length-1||index%Math.ceil(rows.length/6)===0){const text=svgElement('text',{x,y:231,'text-anchor':'middle'});text.textContent=date(row.date+'T12:00:00+07:00');svg.append(text);}
  });parent.append(svg);
}
function devices(rows) {
  const parent=$('devices');parent.replaceChildren();
  const palette=['#174acf','#7d9df0','#bed0f6','#e4ebf7'];
  const total=rows.reduce((sum,r)=>sum+r.views,0),mobile=rows.find(r=>r.label==='mobile')?.views||0;
  $('mobile-percent').textContent=total?Math.round(mobile/total*100)+'%':'—';
  let offset=0;const gradient=[];
  rows.forEach((row,i)=>{const percent=total?row.views/total*100:0,color=palette[i%palette.length];gradient.push(`${color} ${offset}% ${offset+percent}%`);offset+=percent;
    const el=document.createElement('div');el.className='device-row';const dot=document.createElement('i');dot.style.background=color;const label=document.createElement('span');label.textContent=labels[row.label]||row.label||'ไม่ระบุ';const value=document.createElement('strong');value.textContent=percent.toFixed(0)+'%';el.append(dot,label,value);parent.append(el);
  });$('device-ring').style.background=total?`conic-gradient(${gradient.join(',')})`:'#edf1f7';
  if(!rows.length){const p=document.createElement('p');p.className='fine-print';p.textContent='รอข้อมูลการเข้าชม';parent.append(p);}
}
function render(data) {
  const t=data.totals;
  const utm=data.features?.utm!==false;
  $('test-control').hidden=!utm;
  $('plan-note').hidden=utm;
  $('plan-note').textContent='ตัวเลขรวมการเข้าชมของทีมทดสอบด้วย · ดูแหล่งที่มาได้จากเว็บไซต์อ้างอิง ส่วนชื่อแคมเปญยังไม่เปิดใช้งาน';
  $('sources-description').textContent=utm?'ลิงก์ที่ติดชื่อช่องทางไว้ (UTM)':'เว็บไซต์ที่ส่งคนเข้ามา · จำนวนเปิดหน้าเว็บ';
  $('referrer-details').hidden=!utm;
  $('visitors').textContent=number.format(t.visitors);$('views').textContent=number.format(t.views);$('line-clicks').textContent=number.format(t.lineClicks);$('click-rate').textContent=t.visitors?t.clickRate.toFixed(1)+'%':'—';
  $('line-people').textContent=`จากผู้เข้าชมประมาณ ${number.format(t.lineVisitors)} คน`;
  $('date-range').textContent=`${date(data.range.since)} – ${date(data.range.until)} · เวลาไทย`;
  $('updated-at').textContent=`อัปเดตล่าสุด ${time(data.updatedAt)} น.`;
  $('empty-notice').hidden=t.views>0;
  chart(data.trend);devices(data.devices);
  list('pages',data.pages);list('sources',utm?data.sources:data.referrers,'views','ยังไม่มีข้อมูลช่องทาง',utm?'ไม่ได้ระบุช่องทาง':'เข้าโดยตรง / ไม่ส่งที่มา');
  list('referrers',data.referrers,'views','ยังไม่มีข้อมูลเว็บไซต์อ้างอิง','เข้าโดยตรง / ไม่ส่งที่มา');
  list('sections',data.sections,'visitors','เมื่อมีคนเลื่อนดูหน้ารุ่น 4 จะเห็นข้อมูลตรงนี้');
  list('packages',data.packages,'count','ยังไม่มีการกด LINE ในช่วงนี้');
  list('campaigns',data.campaigns,'views',utm?'ยังไม่มีข้อมูลแคมเปญ':'การแยกชื่อแคมเปญต้องใช้ Web Analytics Plus ของ Vercel · ยังไม่ได้เปิดบริการเสริมนี้','ไม่ได้ระบุแคมเปญ');
  list('events',data.events,'count','ยังไม่มีกิจกรรมในช่วงนี้');
}
async function load() {
  const id=++requestId;loading=true;$('report').setAttribute('aria-busy','true');$('refresh').disabled=true;$('updated-at').textContent='กำลังอัปเดต…';$('data-error').hidden=true;
  try {
    const query=new URLSearchParams({days:String(days),scope:$('scope').value,tests:$('include-tests').checked?'1':'0'});
    const response=await fetch('/api/stats?'+query,{credentials:'same-origin',cache:'no-store'});const data=await response.json();
    if(id!==requestId)return;
    if(response.status===401){showLogin();return;}
    if(!response.ok)throw new Error(data.error||'โหลดข้อมูลไม่สำเร็จ');
    render(data);$('report').hidden=false;
  }catch(error){if(id!==requestId)return;$('report').hidden=true;$('data-error').hidden=false;$('data-error-message').textContent=error.message;$('updated-at').textContent='ยังไม่อัปเดตข้อมูล';}
  finally{if(id===requestId){loading=false;$('report').setAttribute('aria-busy','false');$('refresh').disabled=false;}}
}
document.querySelectorAll('[data-days]').forEach(button=>button.addEventListener('click',()=>{days=Number(button.dataset.days);document.querySelectorAll('[data-days]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});load();}));
$('scope').addEventListener('change',load);$('include-tests').addEventListener('change',load);$('refresh').addEventListener('click',load);$('retry').addEventListener('click',load);
function buildLink(){
  const campaign=$('link-campaign').value.trim(),content=$('link-content').value.trim();const valid=/^[a-z][a-z0-9_-]{0,79}$/i.test(campaign)&&/^[a-z][a-z0-9_-]{0,79}$/i.test(content);
  $('copy-link').disabled=!valid;
  if(!valid){$('generated-link').value='ใช้ภาษาอังกฤษ ตัวเลข - หรือ _ และเริ่มด้วยตัวอักษร';return;}
  const source=$('link-source').value;
  const url=new URL('https://businessboy.ai/ai-page-gen4');url.search=new URLSearchParams({utm_source:source,utm_medium:source==='line'?'broadcast':'organic_social',utm_campaign:campaign,utm_content:content});$('generated-link').value=url.href;
}
['link-source','link-campaign','link-content'].forEach(id=>$(id).addEventListener('input',buildLink));
$('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('generated-link').value);$('copy-status').textContent='คัดลอกแล้ว! นำลิงก์ไปวางในโพสต์หรือโปรไฟล์ได้เลย';}catch{$('generated-link').select();$('copy-status').textContent='เลือกลิงก์ไว้ให้แล้ว กดคัดลอกบนเครื่องได้เลย';}});
buildLink();
api('session').then(showDashboard).catch(showLogin);
setInterval(()=>{if(signedIn&&!loading&&!document.hidden)load();},120000);
})();
