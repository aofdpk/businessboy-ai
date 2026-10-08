'use strict';
const $=s=>document.querySelector(s),statuses={pending:'ส่งเพจแล้ว · รอตรวจ',progress:'กำลังทยอยลงคลิป',complete:'ตรวจครบ 30 คลิปแล้ว',needs_fix:'มีจุดที่ต้องแก้ไข'};
let offset=0,loading=false;
function message(text){$('#admin-message').textContent=text;$('#admin-message').hidden=!text;}
function lock(value){for(const id of ['generation-filter','status-filter','refresh','export'])$('#'+id).disabled=value;}
function signedOut(){$('#admin-login').hidden=false;$('#admin-content').hidden=true;$('#submissions').replaceChildren();}
async function api(url,options){const response=await fetch(url,{cache:'no-store',...options}),result=await response.json();if(!response.ok){if(response.status===401)signedOut();throw new Error(result.error||'โหลดไม่สำเร็จ');}return result;}
function line(dl,label,value){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value??'');dl.append(dt,dd);}
function query(){return 'generation='+$('#generation-filter').value+'&status='+encodeURIComponent($('#status-filter').value);}
function reviewForm(row){
 const f=document.createElement('form');f.className='review-form';
 const select=document.createElement('select'),count=document.createElement('input'),note=document.createElement('textarea');
 select.id='status-'+row.id;count.id='count-'+row.id;note.id='note-'+row.id;
 for(const [value,label] of Object.entries(statuses)){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=row.review_status;
 count.type='number';count.min='0';count.step='1';count.value=row.clip_count??'';count.inputMode='numeric';note.rows=3;note.value=row.review_note;
 for(const [el,text] of [[select,'สถานะการตรวจ'],[count,'จำนวนคลิปที่ทีมงานตรวจพบ (เว้นว่างได้)'],[note,'หมายเหตุของทีมงาน']]){const label=document.createElement('label');label.htmlFor=el.id;label.textContent=text;f.append(label,el);}
 const button=document.createElement('button');button.className='button';button.type='submit';button.textContent='บันทึกผลตรวจ';
 const feedback=document.createElement('p');feedback.className='review-feedback';feedback.setAttribute('role','status');f.append(button,feedback);
 let version=row.review_version;
 f.addEventListener('submit',async e=>{e.preventDefault();const clipCount=count.value===''?null:Number(count.value);if(select.value==='complete'&&(clipCount===null||clipCount<30)){feedback.textContent='กรุณาตรวจพบอย่างน้อย 30 คลิปก่อนเลือกสถานะตรวจครบครับ';count.focus();return;}button.disabled=true;feedback.textContent='กำลังบันทึก…';try{const result=await api('/api/homework-ep2?action=review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,version,status:select.value,clipCount,note:note.value})});version=result.review_version;feedback.textContent='บันทึกแล้ว · '+statuses[select.value];}catch(e){feedback.textContent=e.message;}finally{button.disabled=false;}});
 return f;
}
async function list(){if(loading)return;loading=true;lock(true);message('กำลังโหลดข้อมูล…');try{
 const result=await api('/api/homework-ep2?action=list&'+query()+'&offset='+offset);$('#submissions').replaceChildren();$('#total').textContent='ส่งเพจแล้ว '+result.total.toLocaleString('th-TH')+' รายการ (ตามตัวกรอง)';
 for(const row of result.rows){const card=document.createElement('article'),title=document.createElement('h2'),dl=document.createElement('dl');card.className='submission';title.textContent=row.full_name;card.append(title,dl);
 line(dl,'ส่งเมื่อ',new Date(row.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}));line(dl,'เลขยืนยัน','G4-EP2-'+row.id.toUpperCase());line(dl,'เบอร์โทรศัพท์',row.phone);line(dl,'ชื่อ Facebook',row.facebook_name);line(dl,'รุ่นผู้เรียน',row.generation);line(dl,'ชื่อเพจ',row.page_name);
 const link=document.createElement('a');try{link.href=HomeworkPageUrl.normalizePageUrl(row.page_url);link.target='_blank';link.rel='noopener noreferrer';link.textContent='เปิดเพจเพื่อตรวจการบ้าน ↗';card.append(link);}catch{line(dl,'ลิงก์ที่ต้องตรวจสอบ',row.page_url);}
 if(row.same_phone_count>1){const warning=document.createElement('p');warning.className='duplicate';warning.textContent='เบอร์นี้ส่งมา '+row.same_phone_count+' รายการ กรุณาตรวจสอบรายการซ้ำ';card.append(warning);}
 card.append(reviewForm(row));
 if(row.full_name==='ทดสอบระบบ Gen4 EP2 — ไม่ใช่นักเรียน'&&row.phone==='0000000000'&&row.page_name==='QA EP2 ทดสอบระบบเท่านั้น'){const hide=document.createElement('button');hide.type='button';hide.textContent='ซ่อนรายการทดสอบระบบ';hide.addEventListener('click',async()=>{hide.disabled=true;try{await api('/api/homework-ep2?action=archive-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id})});await list();}catch(e){message(e.message);hide.disabled=false;}});card.append(hide);}
 $('#submissions').append(card);}
 $('#previous').disabled=offset===0;$('#next').disabled=offset+50>=result.total;$('#page-number').textContent='หน้า '+(Math.floor(offset/50)+1);message(result.total?'':'ยังไม่มีรายการตามตัวกรองนี้ครับ');
 }catch(e){message(e.message);}finally{loading=false;lock(false);}}
async function session(){try{const s=await api('/api/homework-ep2?action=session');$('#admin-login').hidden=s.authenticated;$('#admin-content').hidden=!s.authenticated;if(s.authenticated)await list();}catch(e){message(e.message);}}
$('#admin-login').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{await api('/api/student-story?action=login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#password').value})});$('#password').value='';await session();}catch(e){message(e.message);}finally{button.disabled=false;}});
for(const id of ['generation-filter','status-filter'])$('#'+id).addEventListener('change',()=>{offset=0;list();});
$('#refresh').addEventListener('click',list);$('#previous').addEventListener('click',()=>{if(!loading){offset=Math.max(0,offset-50);list();}});$('#next').addEventListener('click',()=>{if(!loading){offset+=50;list();}});
$('#logout').addEventListener('click',async()=>{try{await api('/api/student-story?action=logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});signedOut();}catch(e){message(e.message);}});
$('#export').addEventListener('click',async()=>{const button=$('#export');button.disabled=true;message('กำลังเตรียมไฟล์…');try{const response=await fetch('/api/homework-ep2?action=export&'+query(),{cache:'no-store'});if(!response.ok){if(response.status===401)signedOut();const result=await response.json();throw new Error(result.error||'ส่งออกไม่สำเร็จ');}const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gen4-ep2-homework.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('ดาวน์โหลดไฟล์แล้ว เปิดด้วย Excel หรือ Google Sheets ได้ครับ');}catch(e){message(e.message);}finally{button.disabled=false;}});
session();
