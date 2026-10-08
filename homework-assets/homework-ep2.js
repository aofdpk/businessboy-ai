'use strict';
const form=document.querySelector('#homework-form'),button=document.querySelector('#submit-button'),errorBox=document.querySelector('#form-error'),statusText=document.querySelector('#save-status');
const names=['fullName','phone','facebookName','generation','pageName','pageUrl'];
const requiredMessages={fullName:'กรุณากรอกชื่อ–นามสกุล',phone:'กรุณากรอกเบอร์โทรศัพท์',facebookName:'กรุณากรอกชื่อ Facebook',generation:'กรุณาเลือกรุ่นที่เรียน',pageName:'กรุณากรอกชื่อเพจ',pageUrl:'กรุณาวางลิงก์เพจ Facebook'};
let requestId=crypto.randomUUID(),busy=false,deadlinePassed=false,lastPayload='';
function clearErrors(){errorBox.hidden=true;for(const name of names){document.getElementById(name+'-error').textContent='';document.querySelectorAll('[name="'+name+'"]').forEach(el=>el.removeAttribute('aria-invalid'));}}
function fieldError(name,message){const messageEl=document.getElementById(name+'-error');if(!messageEl)return;messageEl.textContent=message;document.querySelectorAll('[name="'+name+'"]').forEach(el=>{el.setAttribute('aria-invalid','true');if(el.type==='radio')el.setAttribute('aria-describedby',name+'-error');});}
function focusField(name){const el=document.querySelector('[name="'+name+'"]');if(el){el.focus();el.scrollIntoView({behavior:'auto',block:'center'});}}
function showClosed(){deadlinePassed=true;document.querySelector('#closed').hidden=form.hidden;button.disabled=true;button.textContent='หมดเวลาส่งการบ้าน';}
function values(){const data=new FormData(form),out={};for(const name of names)out[name]=String(data.get(name)||'').trim();out.generation=Number(out.generation);out.website=String(data.get('website')||'');return out;}
function complete(result,data){document.querySelector('#success-page-name').textContent=data.pageName;document.querySelector('#success-page-link').href=HomeworkPageUrl.normalizePageUrl(data.pageUrl);form.hidden=true;document.querySelector('#closed').hidden=true;const panel=document.querySelector('#success');panel.hidden=false;document.querySelector('#receipt').textContent=result.receipt;document.querySelector('#submitted-time').textContent='ส่งเมื่อ '+new Date(result.submittedAt).toLocaleString('th-TH',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Bangkok'})+' น.';panel.focus();panel.scrollIntoView({behavior:'auto',block:'start'});}
form.addEventListener('input',e=>{const name=e.target.name;if(names.includes(name)){document.getElementById(name+'-error').textContent='';e.target.removeAttribute('aria-invalid');}});
form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||deadlinePassed)return;clearErrors();const data=values();let first='';
  for(const name of names){if(!data[name]){fieldError(name,requiredMessages[name]);if(!first)first=name;}}
  const normalizedPhone=data.phone.replace(/[๐-๙]/g,d=>String(d.charCodeAt(0)-3664)).replace(/[\s()-]/g,'').replace(/^\+66/,'0');
  if(data.phone&&!/^0\d{8,9}$/.test(normalizedPhone)){fieldError('phone','กรุณาตรวจเบอร์โทรศัพท์ เช่น 0812345678');if(!first)first='phone';}
  if(data.pageUrl){try{data.pageUrl=HomeworkPageUrl.normalizePageUrl(data.pageUrl);}catch(e){fieldError('pageUrl',e.message);if(!first)first='pageUrl';}}
  if(first){errorBox.textContent='ยังมีบางข้อที่ต้องกรอกหรือตรวจสอบครับ';errorBox.hidden=false;focusField(first);return;}
  const fingerprint=JSON.stringify(data);if(lastPayload&&lastPayload!==fingerprint)requestId=crypto.randomUUID();lastPayload=fingerprint;
  busy=true;button.disabled=true;button.textContent='กำลังบันทึกการบ้าน…';statusText.textContent='รอสักครู่ อย่าเพิ่งปิดหน้านี้นะครับ';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch('/api/homework-ep2?action=submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,requestId}),signal:controller.signal});let result;try{result=await response.json();}catch{throw new Error('ระบบตอบกลับไม่สมบูรณ์ กรุณากดส่งอีกครั้ง');}
    if(!response.ok){if(result.field)fieldError(result.field,result.error);if(response.status===410)showClosed();const error=new Error(result.error||'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');error.field=result.field;throw error;}
    if(!result.ok||!result.receipt||!result.submittedAt)throw new Error('ยังไม่ได้รับเลขยืนยัน กรุณากดส่งอีกครั้ง');complete(result,data);
  }catch(error){errorBox.textContent=error.name==='AbortError'?'ยังไม่ได้รับการยืนยัน กรุณากดส่งอีกครั้ง ข้อมูลที่กรอกยังอยู่':error.message||'เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง';errorBox.hidden=false;if(error.field)focusField(error.field);}
  finally{clearTimeout(timer);busy=false;if(!deadlinePassed){button.disabled=false;button.innerHTML='ส่งเพจสำหรับการบ้าน EP2 <span aria-hidden="true">→</span>';}statusText.textContent='';}
});
const clock=HomeworkCountdown.createClock(()=>performance.now());
const countdownCard=document.querySelector('.countdown-card'),countdownStatus=document.querySelector('#countdown-status');
let syncing=false;
function renderCountdown(){
  const state=clock.read();if(!state)return;
  if(state.expired&&!deadlinePassed)showClosed();
  for(const unit of ['days','hours','minutes','seconds'])document.querySelector('#countdown-'+unit).textContent=String(deadlinePassed?0:state[unit]).padStart(2,'0');
  countdownCard.classList.toggle('is-urgent',state.urgent&&!deadlinePassed);
  countdownCard.classList.toggle('is-closed',deadlinePassed);
  const message=deadlinePassed?'หมดเวลาส่งการบ้าน EP2 แล้วครับ':state.urgent?'วันสุดท้ายสำหรับส่งการบ้านครับ':'ส่งเพจไว้ก่อนได้ แล้วทยอยลงคลิปให้ครบตามกำหนดครับ';
  if(countdownStatus.textContent!==message)countdownStatus.textContent=message;
}
async function syncCountdown(){
  if(syncing)return;syncing=true;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch('/api/homework-ep2?action=config',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('Time unavailable');
    clock.sync(await response.json());renderCountdown();
  }catch{if(!clock.read())countdownStatus.textContent='ยังตรวจสอบเวลาไม่ได้ กำลังเชื่อมต่อใหม่ครับ';}
  finally{clearTimeout(timeout);syncing=false;}
}
syncCountdown();
setInterval(renderCountdown,1000);
setInterval(()=>{if(!document.hidden)syncCountdown();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderCountdown();syncCountdown();}});
window.addEventListener('pageshow',()=>{renderCountdown();syncCountdown();});
window.addEventListener('online',syncCountdown);

const preview=document.querySelector('#page-preview');document.querySelector('#pageUrl').addEventListener('input',e=>{try{preview.href=HomeworkPageUrl.normalizePageUrl(e.target.value);preview.hidden=false;}catch{preview.hidden=true;preview.removeAttribute('href');}});
