'use strict';
const $=s=>document.querySelector(s),statuses={pending:'ส่งเพจแล้ว · รอตรวจ',progress:'กำลังทยอยลงคลิป',complete:'ทีมงานตรวจผ่านเพจนี้แล้ว',needs_fix:'มีจุดที่ต้องแก้ไข'};
let offset=0,loading=false,pageSize=20;
function message(text){$('#admin-message').textContent=text;$('#admin-message').hidden=!text;}
function lock(value){for(const id of ['generation-filter','status-filter','learner-search','refresh','export'])$('#'+id).disabled=value;}
function signedOut(){$('#admin-login').hidden=false;$('#admin-content').hidden=true;$('#submissions').replaceChildren();}
async function api(url,options){const response=await fetch(url,{cache:'no-store',...options});let result;try{result=await response.json();}catch{throw new Error('ระบบตอบกลับไม่สมบูรณ์ กรุณาลองใหม่');}if(!response.ok){if(response.status===401)signedOut();throw new Error(result.error||'โหลดไม่สำเร็จ');}return result;}
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function line(dl,label,value){dl.append(el('dt',label),el('dd',String(value??'')));}
function query(){return new URLSearchParams({generation:$('#generation-filter').value,status:$('#status-filter').value,search:$('#learner-search').value.trim()}).toString();}
function reviewForm(row,refreshSummary){
  const f=el('form',undefined,'review-form'),select=el('select');select.id='status-'+row.id;
  for(const [value,label] of Object.entries(statuses)){const option=el('option',label);option.value=value;select.append(option);}select.value=row.review_status;
  const statusLabel=el('label','สถานะการตรวจ');statusLabel.htmlFor=select.id;f.append(statusLabel,select);
  const daily=el('fieldset'),legend=el('legend','จำนวนคลิปที่ตรวจพบ แยกตามวัน'),grid=el('div',undefined,'daily-grid');
  daily.append(legend,el('p','เว้นว่าง = ยังไม่ได้ตรวจ · 0 = ตรวจแล้วไม่พบคลิป บันทึกเฉพาะวันที่ตรวจจริง และระบุช่วงวันที่ในหมายเหตุ','hint'),grid);
  const counts=new Map((row.daily_clips||[]).map(d=>[d.date,d.count])),inputs=[];
  for(let day=11;day<=23;day++){
    const date='2026-10-'+day,label=el('label',day+' ต.ค.'),input=el('input');input.type='number';input.min='0';input.step='1';input.inputMode='numeric';input.value=counts.get(date)??'';input.dataset.date=date;input.id='daily-'+row.id+'-'+day;label.htmlFor=input.id;
    if(date<row.page_created_date){input.disabled=true;label.append(el('small',' (ก่อนสร้างเพจ)'));}
    label.append(input);grid.append(label);inputs.push(input);
  }
  f.append(daily);
  const checks={};
  for(const [name,labelText,checked] of [['dateVerified','ตรวจแล้วว่าเป็นเพจใหม่ของผู้เรียน สร้างหลัง 10 ตุลาคม 2569',row.date_verified],['scenesVerified','ตรวจแล้วว่าคลิปมีอย่างน้อย 3 ฉาก',row.scenes_verified],['dailyVerified','ตรวจแล้วว่าลงเพจละวันละ 5 คลิป ตามช่วงวันที่ระบุในหมายเหตุ',row.daily_verified]]){
    const label=el('label',undefined,'review-check'),input=el('input');input.type='checkbox';input.checked=checked;input.name=name;label.append(input,el('span',labelText));f.append(label);checks[name]=input;
  }
  const note=el('textarea');note.id='note-'+row.id;note.rows=3;note.value=row.review_note;const noteLabel=el('label','หมายเหตุ / ช่วงวันที่ที่ตรวจ (ต้องระบุก่อนตรวจผ่าน)');noteLabel.htmlFor=note.id;f.append(noteLabel,note);
  const button=el('button','บันทึกผลตรวจ','button');button.type='submit';const feedback=el('p',undefined,'review-feedback');feedback.setAttribute('role','status');f.append(button,feedback);
  let version=row.review_version;
  f.addEventListener('submit',async e=>{
    e.preventDefault();const dailyClips=inputs.filter(i=>!i.disabled&&i.value!=='').map(i=>({date:i.dataset.date,count:Number(i.value)}));
    const flags=Object.fromEntries(Object.entries(checks).map(([name,input])=>[name,input.checked]));
    if(select.value==='complete'&&(!Object.values(flags).every(Boolean)||!dailyClips.length||dailyClips.some(d=>d.count<5)||!note.value.trim())){feedback.textContent='ก่อนตรวจผ่าน กรุณายืนยันทุกข้อ บันทึกคลิปรายวัน และระบุช่วงวันที่ที่ตรวจในหมายเหตุ';return;}
    button.disabled=true;feedback.textContent='กำลังบันทึก…';try{
      const result=await api('/api/homework-ep3?action=review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,version,status:select.value,dailyClips,...flags,note:note.value})});
      version=result.review_version;row.review_status=select.value;refreshSummary();feedback.textContent='บันทึกแล้ว · '+statuses[select.value];
    }catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
  });return f;
}
function learnerCard(rows){
  const first=rows[0],group=el('section',undefined,'learner-group'),heading=el('h2',first.full_name),dl=el('dl'),progress=el('div',undefined,'learner-progress');
  line(dl,'เบอร์โทรศัพท์',first.phone);line(dl,'ชื่อ Facebook',first.facebook_name);line(dl,'รุ่นผู้เรียน',first.generation);group.append(heading,dl,progress);
  const update=()=>{const complete=rows.filter(r=>r.review_status==='complete').length;progress.replaceChildren(el('span','ส่งแล้ว '+rows.length+'/3 เพจ'),el('span','ตรวจผ่าน '+complete+'/3 เพจ',complete===3?'passed':''));};update();
  if(new Set(rows.map(r=>r.full_name+'|'+r.facebook_name+'|'+r.generation)).size>1)group.append(el('p','ข้อมูลผู้เรียนในเบอร์เดียวกันต่างกัน กรุณาตรวจว่าเป็นคนเดียวกันก่อนสรุปผล','notice'));
  rows.forEach((row,index)=>{
    const card=el('article',undefined,'submission'),info=el('dl'),status=el('p',statuses[row.review_status],'page-status');card.append(el('h3','เพจ '+(index+1)+' · '+row.page_name),status,info);
    line(info,'ส่งเมื่อ',new Date(row.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}));line(info,'เลขยืนยัน','G4-EP3-'+row.id.toUpperCase());line(info,'วันที่สร้าง (ผู้เรียนระบุ)',row.page_created_date);
    const link=el('a','เปิดเพจเพื่อตรวจการบ้าน ↗');try{link.href=HomeworkPageUrl.normalizePageUrl(row.page_url);link.target='_blank';link.rel='noopener noreferrer';card.append(link);}catch{line(info,'ลิงก์ที่ต้องตรวจสอบ',row.page_url);}
    if(row.page_owner_count>1)card.append(el('p','ลิงก์เพจนี้ถูกส่งจากหลายเบอร์ กรุณาตรวจเจ้าของและไม่นับซ้ำ','notice'));
    card.append(reviewForm(row,()=>{status.textContent=statuses[row.review_status];update();}));
    if(row.full_name==='ทดสอบระบบ Gen4 EP3 — ไม่ใช่นักเรียน'&&row.phone==='0000000000'&&row.page_name.startsWith('QA EP3 ทดสอบระบบเท่านั้น')){
      const hide=el('button','ซ่อนรายการทดสอบระบบ');hide.type='button';hide.addEventListener('click',async()=>{hide.disabled=true;try{await api('/api/homework-ep3?action=archive-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id})});await list();}catch(error){message(error.message);hide.disabled=false;}});card.append(hide);
    }
    group.append(card);
  });return group;
}
async function list(){if(loading)return;loading=true;lock(true);message('กำลังโหลดข้อมูล…');try{
  const result=await api('/api/homework-ep3?action=list&'+query()+'&offset='+offset);pageSize=result.limit;$('#submissions').replaceChildren();$('#total').textContent='ผู้เรียน '+result.total.toLocaleString('th-TH')+' คน (ตามตัวกรอง) · แสดงทุกเพจของผู้เรียนที่ตรงตัวกรอง';
  const grouped=new Map();for(const row of result.rows){if(!grouped.has(row.phone))grouped.set(row.phone,[]);grouped.get(row.phone).push(row);}for(const rows of grouped.values())$('#submissions').append(learnerCard(rows));
  $('#previous').disabled=offset===0;$('#next').disabled=offset+pageSize>=result.total;$('#page-number').textContent='หน้า '+(Math.floor(offset/pageSize)+1);message(result.total?'':'ยังไม่มีรายการตามตัวกรองนี้ครับ');
}catch(error){message(error.message);}finally{loading=false;lock(false);}}
async function session(){try{const s=await api('/api/homework-ep3?action=session');$('#admin-login').hidden=s.authenticated;$('#admin-content').hidden=!s.authenticated;if(s.authenticated)await list();}catch(error){message(error.message);}}
$('#admin-login').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{await api('/api/student-story?action=login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#password').value})});$('#password').value='';await session();}catch(error){message(error.message);}finally{button.disabled=false;}});
for(const id of ['generation-filter','status-filter'])$('#'+id).addEventListener('change',()=>{offset=0;list();});
$('#learner-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();offset=0;list();}});
$('#refresh').addEventListener('click',()=>{offset=0;list();});$('#previous').addEventListener('click',()=>{if(!loading){offset=Math.max(0,offset-pageSize);list();}});$('#next').addEventListener('click',()=>{if(!loading){offset+=pageSize;list();}});
$('#logout').addEventListener('click',async()=>{try{await api('/api/student-story?action=logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});signedOut();}catch(error){message(error.message);}});
$('#export').addEventListener('click',async()=>{const button=$('#export');button.disabled=true;message('กำลังเตรียมไฟล์…');try{
  const response=await fetch('/api/homework-ep3?action=export&'+query(),{cache:'no-store'});if(!response.ok){if(response.status===401)signedOut();const result=await response.json();throw new Error(result.error||'ส่งออกไม่สำเร็จ');}
  const blob=await response.blob(),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='gen4-ep3-homework.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('ดาวน์โหลดไฟล์แล้ว เปิดด้วย Excel หรือ Google Sheets ได้ครับ');
}catch(error){message(error.message);}finally{button.disabled=false;}});
session();
