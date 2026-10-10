'use strict';
const crypto=require('node:crypto');
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function name(value){
 if(typeof value!=='string')fail('กรุณากรอกชื่อและนามสกุล');
 const v=value.normalize('NFC').replace(/[\u200b-\u200d\ufeff]/g,'').trim().replace(/\s+/g,' ');
 if(!v||v.length>160||/[\u0000-\u001f<>]/.test(v))fail('กรุณาตรวจชื่อและนามสกุล');
 return v;
}
function key(first,last){return (name(first).replace(/^(?:นางสาว|นาย|นาง|ด\.ช\.|ด\.ญ\.|Mr\.|Mrs\.|Ms\.)\s*/i,'').trim()+'\u001f'+name(last)).toLocaleLowerCase('en-US');}
function profile(input){
 let phone=String(input.phone||'').replace(/[\s()-]/g,'');if(phone.startsWith('+66'))phone='0'+phone.slice(3);
 if(!/^0\d{8,9}$/.test(phone))fail('กรุณากรอกเบอร์โทรศัพท์ไทยให้ครบ');
 const cohort=Number(input.cohort);if(!Number.isInteger(cohort)||cohort<1||cohort>4)fail('กรุณาเลือกรุ่นเรียน 1–4');
 return {firstName:name(input.firstName),lastName:name(input.lastName),phone,cohort};
}
function policy(input){
 if(!input||!['open','allowlist','paused'].includes(input.mode)||typeof input.registrationOpen!=='boolean')fail('นโยบายไม่ถูกต้อง');
 if(!Array.isArray(input.names)||input.names.length>20000)fail('รายชื่อไม่ถูกต้อง หรือเกินสองหมื่นรายการ');
 const seen=new Set(),names=[];
 for(const row of input.names){const first=name(row.firstName),last=name(row.lastName),k=key(first,last);if(seen.has(k))fail('รายชื่อซ้ำในไฟล์ กรุณาตรวจและลบรายการซ้ำก่อนนำเข้า');seen.add(k);names.push({firstName:first,lastName:last,key:k});}
 if(input.mode==='allowlist'&&!names.length)fail('ต้องมีรายชื่ออย่างน้อยหนึ่งคนก่อนเปิดโหมดรายชื่ออนุญาต');
 return {mode:input.mode,registrationOpen:input.registrationOpen,names};
}
function decision(member,p){
 if(member.suspended)return {allowed:false,reason:'suspended',message:'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลคอร์ส'};
 if(p.mode==='paused')return {allowed:false,reason:'paused',message:'ผู้ดูแลหยุดให้บริการชั่วคราว'};
 if(p.mode==='allowlist'&&!p.names.some(n=>n.key===member.name_key))return {allowed:false,reason:'not_on_list',message:'ยังไม่พบชื่อในรายชื่อผู้มีสิทธิ์ กรุณาติดต่อผู้ดูแลคอร์ส'};
 return {allowed:true,reason:p.mode==='open'?'unverified':'name_matched',message:p.mode==='open'?'ใช้งานได้ — ยังไม่ได้ตรวจรายชื่อ':'ใช้งานได้ — ชื่อตรงกับรายการ'};
}
function impact(members,p){return members.map(m=>({id:m.id,firstName:m.first_name,lastName:m.last_name,...decision(m,p)}));}
function digest(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');}
function csvCell(x){let s=String(x??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
module.exports={fail,name,key,profile,policy,decision,impact,digest,csvCell};
