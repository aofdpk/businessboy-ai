'use strict';
const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');
const adminConfig = require('./_student-story-admin-config');
const DEADLINE = '2026-10-23T05:00:00.000Z';
const COOKIE = 'businessboy_student_story_admin';
const CATEGORIES = ['เพจเล่าข่าว','เพจเล่าเรื่อง','คลิปขายแนวโกดัง','สร้างตัวตน + ขายของ','คาแรกเตอร์หนุ่มหล่อสาวสวย','เพจสายมู'];
let database, schemaPromise;
const secret = () => process.env.STUDENT_STORY_SECRET || process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
const mac = value => crypto.createHmac('sha256',secret()).update(value).digest('base64url');
const equal = (a,b) => typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
function fail(message,status=400,field) { const e=new Error(message);e.status=status;e.field=field;throw e; }
function db() {
  if(!database) {
    const url=process.env.STUDENT_STORY_DATABASE_URL||process.env.GEN3_CATALOG_DATABASE_URL||process.env.DATABASE_URL;
    if(!url||!secret())fail('ระบบยังไม่พร้อมรับการบ้าน กรุณาลองใหม่อีกครั้ง',503);
    database=neon(url);
  }
  return database;
}
async function schema() {
  if(!schemaPromise) schemaPromise=(async()=>{
    const sql=db();
    await sql`CREATE TABLE IF NOT EXISTS course_homework_submissions (
      id uuid PRIMARY KEY, assignment text NOT NULL CHECK(assignment='gen4-ep1'),
      created_at timestamptz NOT NULL DEFAULT now(), full_name text NOT NULL, phone text NOT NULL,
      facebook_name text NOT NULL, generation integer NOT NULL CHECK(generation BETWEEN 1 AND 4),
      category integer NOT NULL CHECK(category BETWEEN 1 AND 6), page_name text NOT NULL,
      reason text NOT NULL, discovered text NOT NULL, decision text NOT NULL,
      payload_hash text NOT NULL, ip_hash text NOT NULL, archived_at timestamptz
    )`;
    await sql`CREATE INDEX IF NOT EXISTS course_homework_created_idx ON course_homework_submissions(assignment,created_at DESC,id)`;
    await sql`CREATE TABLE IF NOT EXISTS course_homework_limits(key text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL)`;
  })().catch(e=>{schemaPromise=null;throw e;});
  return schemaPromise;
}
async function rate(key,max,seconds) {
  const sql=db();
  const rows=await sql`INSERT INTO course_homework_limits(key,count,expires_at) VALUES(${key},1,now()+${seconds}*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN course_homework_limits.expires_at<now() THEN 1 ELSE course_homework_limits.count+1 END,
    expires_at=CASE WHEN course_homework_limits.expires_at<now() THEN now()+${seconds}*interval '1 second' ELSE course_homework_limits.expires_at END RETURNING count`;
  if(rows[0].count>max)fail('ทำรายการหลายครั้ง กรุณารอสักครู่แล้วลองใหม่',429);
}
function authenticated(req) {
  if(!secret())return false;
  try {
    const cookie=String(req.headers.cookie||'').split(';').find(v=>v.trim().startsWith(COOKIE+'='));
    if(!cookie)return false;
    const [exp,sig,...rest]=decodeURIComponent(cookie.trim().slice(COOKIE.length+1)).split('.');
    return !rest.length && /^\d{13}$/.test(exp) && +exp>Date.now() && +exp<Date.now()+43201000 && equal(sig,mac('admin:'+exp+':'+adminConfig.digest));
  }catch{return false;}
}
function text(value,max,field,label) {
  const v=typeof value==='string'?value.trim():'';
  if(!v)fail('กรุณากรอก'+label,400,field);
  if(v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('กรุณาตรวจ'+label+' (ไม่เกิน '+max+' ตัวอักษร)',400,field);
  return v;
}
function validate(body) {
  if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId))fail('กรุณาโหลดหน้าเว็บใหม่แล้วลองอีกครั้ง');
  if(!Number.isInteger(body.generation)||body.generation<1||body.generation>4)fail('กรุณาเลือกรุ่นที่เรียน',400,'generation');
  if(!Number.isInteger(body.category)||body.category<1||body.category>6)fail('กรุณาเลือกแนวเพจ 1 แบบ',400,'category');
  let phone=text(body.phone,30,'phone','เบอร์โทรศัพท์').replace(/[๐-๙]/g,d=>String(d.charCodeAt(0)-3664)).replace(/[\s()-]/g,'');
  if(phone.startsWith('+66'))phone='0'+phone.slice(3);
  if(!/^0\d{8,9}$/.test(phone))fail('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง เช่น 0812345678',400,'phone');
  return {fullName:text(body.fullName,150,'fullName','ชื่อ–นามสกุล'),phone,
    facebookName:text(body.facebookName,200,'facebookName','ชื่อ Facebook'),generation:body.generation,category:body.category,
    pageName:text(body.pageName,200,'pageName','ชื่อเพจ'),reason:text(body.reason,5000,'reason','เหตุผลที่เลือกทำเพจนี้'),
    discovered:text(body.discovered,5000,'discovered','ช่องทางที่รู้จักกันครั้งแรก'),decision:text(body.decision,5000,'decision','เหตุผลที่เลือกเรียน')};
}
const payloadHash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const receipt = row => ({ok:true,receipt:'G4-EP1-'+row.id.toUpperCase(),submittedAt:row.created_at});
const isOpen = (now=Date.now()) => now<=Date.parse(DEADLINE);
function csvCell(value) { let s=String(value??'');if(/^[\s]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'; }
function csv(rows) {
  const columns=['เลขอ้างอิง','วันเวลาส่ง (ไทย)','ชื่อ–นามสกุล','เบอร์โทรศัพท์','ชื่อ Facebook','รุ่น','แนวเพจ','ชื่อเพจ','เหตุผลที่เลือกทำเพจ','รู้จักครั้งแรกจากที่ไหน','เหตุผลที่เลือกเรียน'];
  return '\ufeff'+[columns,...rows.map(r=>['G4-EP1-'+r.id.toUpperCase(),new Date(r.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),r.full_name,r.phone,r.facebook_name,r.generation,CATEGORIES[r.category-1],r.page_name,r.reason,r.discovered,r.decision])].map(r=>r.map(csvCell).join(',')).join('\r\n');
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Vary','Cookie');
  const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
  try {
    const action=String(req.query?.action||'config');
    if(!['GET','POST'].includes(req.method))return json(405,{error:'Method not allowed'});
    if(req.method==='POST') {
      let origin;try{origin=new URL(req.headers.origin||'');}catch{return json(403,{error:'ไม่อนุญาตคำขอนี้'});}
      if(origin.host!==req.headers.host||!['https:','http:'].includes(origin.protocol))return json(403,{error:'ไม่อนุญาตคำขอนี้'});
      if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(415,{error:'Invalid content type'});
    }
    if(action==='config'&&req.method==='GET')return json(200,{assignment:'gen4-ep1',deadline:DEADLINE,open:isOpen(),serverTime:new Date().toISOString()});
    if(action==='session'&&req.method==='GET')return json(200,{authenticated:authenticated(req)});
    if(['list','export','archive-test'].includes(action)&&!authenticated(req))return json(401,{error:'กรุณาเข้าสู่ระบบผู้ดูแล'});
    if(!['submit','list','export','archive-test'].includes(action))return json(404,{error:'Not found'});
    if(action==='archive-test'&&req.method!=='POST')return json(405,{error:'Method not allowed'});
    if(action==='submit'&&req.method!=='POST')return json(405,{error:'Method not allowed'});
    if(['list','export'].includes(action)&&req.method!=='GET')return json(405,{error:'Method not allowed'});
    let body=req.body||{};
    if(Buffer.byteLength(typeof body==='string'?body:JSON.stringify(body))>65000)return json(413,{error:'ข้อความยาวเกินไป กรุณาย่อแล้วลองใหม่'});
    if(typeof body==='string')try{body=JSON.parse(body);}catch{return json(400,{error:'Invalid JSON'});}
    if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'Invalid request'});
    if(action==='submit') {
      if(body.website)fail('ไม่สามารถรับรายการนี้ได้');
      const v=validate(body),hash=payloadHash(v);
      await schema();const sql=db();
      const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
      // Generous shared-IP allowance accommodates students on one classroom network.
      await rate('submit:'+mac('homework-ip:'+ip),300,3600);
      const existing=await sql`SELECT id,created_at,payload_hash FROM course_homework_submissions WHERE id=${body.requestId}`;
      if(existing.length) {
        if(!equal(existing[0].payload_hash,hash))fail('ข้อมูลเปลี่ยนจากรายการที่ส่งแล้ว กรุณาเริ่มรายการใหม่',409);
        return json(200,receipt(existing[0]));
      }
      if(!isOpen())fail('หมดเวลาส่งการบ้าน EP1 แล้ว (23 ตุลาคม 2569 เวลา 12.00 น.)',410);
      // The database clock is authoritative; a request crossing the deadline cannot slip through.
      const saved=await sql`INSERT INTO course_homework_submissions(id,assignment,full_name,phone,facebook_name,generation,category,page_name,reason,discovered,decision,payload_hash,ip_hash)
        SELECT ${body.requestId},'gen4-ep1',${v.fullName},${v.phone},${v.facebookName},${v.generation},${v.category},${v.pageName},${v.reason},${v.discovered},${v.decision},${hash},${mac('homework-ip:'+ip)}
        WHERE clock_timestamp()<=${DEADLINE}::timestamptz ON CONFLICT(id) DO NOTHING RETURNING id,created_at,payload_hash`;
      if(saved.length)return json(201,receipt(saved[0]));
      const raced=await sql`SELECT id,created_at,payload_hash FROM course_homework_submissions WHERE id=${body.requestId}`;
      if(raced.length&&equal(raced[0].payload_hash,hash))return json(200,receipt(raced[0]));
      if(raced.length)fail('รายการนี้มีข้อมูลไม่ตรงกัน กรุณาโหลดหน้าใหม่',409);
      fail('หมดเวลาส่งการบ้านแล้ว',410);
    }
    await schema();const sql=db();
    if(action==='archive-test') {
      if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))fail('รายการไม่ถูกต้อง');
      // Only our explicitly labelled synthetic QA fixture may be hidden, never learner records.
      const rows=await sql`UPDATE course_homework_submissions SET archived_at=now() WHERE id=${body.id} AND full_name='ทดสอบระบบ Gen4 EP1 — ไม่ใช่นักเรียน' AND phone='0000000000' AND page_name='QA EP1 ทดสอบระบบเท่านั้น' RETURNING id`;
      if(!rows.length)fail('ไม่ใช่รายการทดสอบ',404);
      return json(200,{ok:true});
    }
    const generation=Number(req.query?.generation||0);
    if(!Number.isInteger(generation)||generation<0||generation>4)fail('รุ่นไม่ถูกต้อง');
    const counts=await sql`SELECT count(*)::integer AS total FROM course_homework_submissions WHERE assignment='gen4-ep1' AND archived_at IS NULL AND (${generation}=0 OR generation=${generation})`;
    if(action==='export') {
      if(counts[0].total>25000)fail('ข้อมูลมากเกินไป กรุณาแยกส่งออกตามรุ่น',400);
      const rows=await sql`SELECT * FROM course_homework_submissions WHERE assignment='gen4-ep1' AND archived_at IS NULL AND (${generation}=0 OR generation=${generation}) ORDER BY created_at DESC,id LIMIT 25000`;
      res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="gen4-ep1-homework.csv"');res.statusCode=200;return res.end(csv(rows));
    }
    const offset=Number(req.query?.offset||0);
    if(!Number.isInteger(offset)||offset<0||offset>1000000)fail('หน้าไม่ถูกต้อง');
    const rows=await sql`SELECT id,created_at,full_name,phone,facebook_name,generation,category,page_name,reason,discovered,decision FROM course_homework_submissions WHERE assignment='gen4-ep1' AND archived_at IS NULL AND (${generation}=0 OR generation=${generation}) ORDER BY created_at DESC,id LIMIT 50 OFFSET ${offset}`;
    return json(200,{rows,total:counts[0].total,offset,limit:50});
  }catch(e){if(!e.status)console.error('homework_request_failed',e.code||'internal');return json(e.status||503,{error:e.status?e.message:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังอยู่',...(e.field?{field:e.field}:{})});}
};
module.exports._test={validate,isOpen,csvCell,payloadHash,authenticated,DEADLINE};
