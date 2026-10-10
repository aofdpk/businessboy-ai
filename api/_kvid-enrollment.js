'use strict';
const crypto=require('node:crypto'),D=require('./_kvid-policy');
const shard=id=>parseInt(id.slice(0,2),16)%64;
const complete=m=>Boolean(m&&m.phone&&m.cohort>=1&&m.cohort<=4);
const enrollmentUrl=t=>'https://businessboy.ai/kvid-assistant/register#'+t;
async function handle({action,body,req,s,token,uuid,rate}){
 if(action==='enroll'){
  const id=body.id,t=token(req);if(!uuid(id))D.fail('รหัสติดตั้งไม่ถูกต้อง');const hash=D.digest(t);
  await rate('enroll:'+id,60,3600);
  const [member]=await s`SELECT * FROM kvid_members WHERE id=${id}`;
  if(member&&member.token_hash!==hash)D.fail('รหัสติดตั้งไม่ตรงกัน',401);
  if(complete(member))return {completed:true,message:'ลงทะเบียนครบแล้ว กลับไปเริ่มงานใน Codex ได้เลย'};
  const ticket=crypto.randomBytes(32).toString('base64url');
  const rows=await s`INSERT INTO kvid_enrollment(id,token_hash,form_hash,expires_at) VALUES(${id},${hash},${D.digest(ticket)},now()+interval '30 minutes') ON CONFLICT(id) DO UPDATE SET form_hash=excluded.form_hash,expires_at=excluded.expires_at,used_at=NULL WHERE kvid_enrollment.token_hash=excluded.token_hash RETURNING id`;
  if(!rows.length)D.fail('รหัสติดตั้งไม่ตรงกัน',401);
  return {completed:false,registration_url:enrollmentUrl(ticket),expires_in:1800,message:'เปิดลิงก์นี้ให้นักเรียนกรอกชื่อ นามสกุล เบอร์โทร และรุ่นเรียนด้วยตัวเอง แล้วกลับมาเริ่มงานใน Codex ไม่กรอกข้อมูลแทนนักเรียน ไม่ต้องคัดลอกรหัสกลับมา'};
 }
 if(!/^[A-Za-z0-9_-]{43}$/.test(body.ticket||''))D.fail('ลิงก์ลงทะเบียนไม่ถูกต้อง');
 const hash=D.digest(body.ticket);
 const [ticket]=await s`SELECT e.*,m.first_name,m.last_name,m.phone,m.cohort FROM kvid_enrollment e LEFT JOIN kvid_members m ON m.id=e.id WHERE e.form_hash=${hash} AND e.expires_at>now() AND e.used_at IS NULL`;
 if(!ticket)D.fail('ลิงก์นี้หมดอายุหรือใช้แล้ว กรุณากลับไปขอลิงก์ใหม่ใน Codex',410);
 if(action==='enrollment-info')return {firstName:ticket.first_name||'',lastName:ticket.last_name||'',phone:ticket.phone||'',cohort:ticket.cohort||'',existing:Boolean(ticket.first_name)};
 const p=D.profile(body),k=D.key(p.firstName,p.lastName);
 if(ticket.first_name&&k!==D.key(ticket.first_name,ticket.last_name))D.fail('บัญชีเดิมต้องใช้ชื่อที่ลงทะเบียนไว้ กรุณาติดต่อผู้ดูแลหากต้องแก้ชื่อ',409);
 const results=await s.transaction([
  s`SELECT id FROM kvid_access_control WHERE id=1 FOR SHARE`,
  s`WITH claimed AS (UPDATE kvid_enrollment SET used_at=now() WHERE form_hash=${hash} AND expires_at>now() AND used_at IS NULL AND EXISTS(SELECT 1 FROM kvid_access_control WHERE id=1 AND (EXISTS(SELECT 1 FROM kvid_members WHERE id=${ticket.id}) OR (registration_open AND mode<>'paused' AND (mode='open' OR EXISTS(SELECT 1 FROM jsonb_array_elements(names) n WHERE n->>'key'=${k}))))) RETURNING id,token_hash), saved AS (INSERT INTO kvid_members(id,first_name,last_name,name_key,token_hash,phone,cohort,client_version) SELECT id,${p.firstName},${p.lastName},${k},token_hash,${p.phone},${p.cohort},'form-0.9' FROM claimed ON CONFLICT(id) DO UPDATE SET phone=excluded.phone,cohort=excluded.cohort,version=kvid_members.version+1 WHERE kvid_members.token_hash=excluded.token_hash RETURNING id), bumped AS (UPDATE kvid_roster_shards SET version=version+1 WHERE id=${shard(ticket.id)} AND EXISTS(SELECT 1 FROM saved)) SELECT id FROM saved`
 ]);
 if(!results[1].length)D.fail('ยังลงทะเบียนไม่ได้ หรือลิงก์ถูกใช้แล้ว กรุณากลับไปตรวจสิทธิ์ใน Codex',409);
 return {completed:true,message:'บันทึกข้อมูลแล้ว กลับไปที่ Codex แล้วพิมพ์ “กรอกข้อมูลแล้ว เริ่มทำคลิป” ได้เลย'};
}
module.exports={handle,complete,shard};
