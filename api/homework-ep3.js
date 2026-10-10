'use strict';
const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');
const base = require('./homework-ep2')._test;
const DEADLINE = '2026-10-23T05:00:00.000Z';
const MIN_DATE = '2026-10-11', MAX_DATE = '2026-10-23';
const STATUSES = { pending:'ส่งเพจแล้ว · รอตรวจ', progress:'กำลังทยอยลงคลิป', complete:'ทีมงานตรวจผ่านเพจนี้แล้ว', needs_fix:'มีจุดที่ต้องแก้ไข' };
let database, schemaPromise;
const secret = () => process.env.STUDENT_STORY_SECRET || process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
const mac = value => crypto.createHmac('sha256',secret()).update(value).digest('base64url');
function fail(message,status=400,field) { throw Object.assign(new Error(message),{status,field}); }
function db() {
  if (!database) {
    const url = process.env.STUDENT_STORY_DATABASE_URL || process.env.GEN3_CATALOG_DATABASE_URL || process.env.DATABASE_URL;
    if (!url || !secret()) fail('ระบบยังไม่พร้อมรับการบ้าน กรุณาลองอีกครั้ง',503);
    database = neon(url);
  }
  return database;
}
async function schema() {
  if (!schemaPromise) schemaPromise = (async()=>{
    const sql=db();
    await sql`CREATE TABLE IF NOT EXISTS course_homework_ep3 (
      id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
      full_name text NOT NULL, phone text NOT NULL, facebook_name text NOT NULL,
      generation integer NOT NULL CHECK(generation BETWEEN 1 AND 4),
      page_name text NOT NULL, page_url text NOT NULL, page_key text NOT NULL,
      page_created_date text NOT NULL CHECK(page_created_date BETWEEN '2026-10-11' AND '2026-10-23'),
      payload_hash text NOT NULL, ip_hash text NOT NULL, archived_at timestamptz,
      review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','progress','complete','needs_fix')),
      daily_clips jsonb NOT NULL DEFAULT '[]', date_verified boolean NOT NULL DEFAULT false,
      scenes_verified boolean NOT NULL DEFAULT false, daily_verified boolean NOT NULL DEFAULT false,
      review_note text NOT NULL DEFAULT '', review_version integer NOT NULL DEFAULT 0, reviewed_at timestamptz,
      CHECK(review_status <> 'complete' OR (date_verified AND scenes_verified AND daily_verified AND jsonb_array_length(daily_clips)>0))
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS course_homework_ep3_page_idx ON course_homework_ep3(phone,page_key) WHERE archived_at IS NULL`;
    await sql`CREATE INDEX IF NOT EXISTS course_homework_ep3_created_idx ON course_homework_ep3(created_at DESC,id)`;
    await sql`CREATE INDEX IF NOT EXISTS course_homework_ep3_phone_idx ON course_homework_ep3(phone) WHERE archived_at IS NULL`;
    await sql`CREATE TABLE IF NOT EXISTS course_homework_limits(key text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL)`;
  })().catch(error=>{schemaPromise=null;throw error;});
  return schemaPromise;
}
function validDate(value) {
  return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value>=MIN_DATE && value<=MAX_DATE;
}
// Common mobile/www hosts, profile IDs and legacy page URLs share a duplicate key.
// Vanity links versus IDs/share redirects still need staff verification.
function pageKey(value) {
  const u=new URL(value), p=decodeURIComponent(u.pathname).replace(/\/+$/,'').toLowerCase().replace(/\/(about|mentions|reviews|followers|following)$/,'');
  if(p==='/profile.php') return 'id:'+u.searchParams.get('id');
  const legacy=p.match(/^\/pages\/[^/]+\/(\d+)$/);
  if(legacy) return 'id:'+legacy[1];
  if(/^\/\d+$/.test(p)) return 'id:'+p.slice(1);
  return p;
}
function validate(body) {
  const v=base.validate(body);
  if(!validDate(body.pageCreatedDate)) fail('ใช้เพจที่สร้างหลังวันที่ 10 ตุลาคม 2569 และไม่เกินกำหนดส่งครับ',400,'pageCreatedDate');
  return {...v,pageCreatedDate:body.pageCreatedDate,pageKey:pageKey(v.pageUrl)};
}
function reviewInput(body) {
  if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id)||!Number.isInteger(body.version)||body.version<0) fail('ข้อมูลรายการไม่ถูกต้อง');
  if(!Object.hasOwn(STATUSES,body.status)) fail('สถานะไม่ถูกต้อง');
  if(!Array.isArray(body.dailyClips)||body.dailyClips.length>13) fail('ข้อมูลคลิปรายวันไม่ถูกต้อง');
  const dates=new Set(), dailyClips=body.dailyClips.map(row=>{
    if(!row||!validDate(row.date)||!Number.isSafeInteger(row.count)||row.count<0||row.count>2147483647||dates.has(row.date)) fail('กรุณาตรวจวันที่และจำนวนคลิปรายวัน ห้ามใส่วันที่ซ้ำ');
    dates.add(row.date);return {date:row.date,count:row.count};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  for(const field of ['dateVerified','scenesVerified','dailyVerified']) if(typeof body[field]!=='boolean') fail('กรุณาตรวจเครื่องหมายยืนยันผลตรวจ');
  if(typeof body.note!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.note)) fail('หมายเหตุไม่ถูกต้อง');
  if(body.status==='complete' && (!body.dateVerified||!body.scenesVerified||!body.dailyVerified||!dailyClips.length||dailyClips.some(r=>r.count<5)||!body.note.trim()))
    fail('ก่อนตรวจผ่าน ให้ยืนยันวันที่สร้างเพจ ฉาก และคลิปรายวัน พร้อมบันทึกช่วงวันที่ที่ตรวจและหมายเหตุครับ');
  return {id:body.id,version:body.version,status:body.status,dailyClips,dateVerified:body.dateVerified,scenesVerified:body.scenesVerified,dailyVerified:body.dailyVerified,note:body.note.trim()};
}
const isOpen=(now=Date.now())=>now<Date.parse(DEADLINE);
const receipt=row=>({ok:true,receipt:'G4-EP3-'+row.id.toUpperCase(),submittedAt:row.created_at});
function csv(rows) {
  const columns=['เลขยืนยัน','วันเวลาส่ง (ไทย)','ชื่อ–นามสกุล','เบอร์โทรศัพท์','ชื่อ Facebook','รุ่น','ชื่อเพจ','ลิงก์เพจ','วันที่สร้างเพจ (ผู้เรียนระบุ)','จำนวนเพจของผู้เรียน','เพจที่ตรวจผ่าน','สถานะตรวจ','จำนวนคลิปแยกตามวัน','ยืนยันวันที่สร้าง','ยืนยันอย่างน้อย 3 ฉาก','ยืนยันวันละ 5 คลิป','หมายเหตุทีมงาน'];
  return '\ufeff'+[columns,...rows.map(r=>['G4-EP3-'+r.id.toUpperCase(),new Date(r.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),r.full_name,r.phone,r.facebook_name,r.generation,r.page_name,r.page_url,r.page_created_date,r.page_count,r.complete_count,STATUSES[r.review_status],r.daily_clips.map(d=>d.date+': '+d.count).join(' | '),r.date_verified?'ใช่':'ยังไม่ยืนยัน',r.scenes_verified?'ใช่':'ยังไม่ยืนยัน',r.daily_verified?'ใช่':'ยังไม่ยืนยัน',r.review_note])].map(row=>row.map(base.csvCell).join(',')).join('\r\n');
}
module.exports=async(req,res)=>{
  for(const [key,value] of Object.entries({'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie'})) res.setHeader(key,value);
  const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
  try {
    const action=String(req.query?.action||'config');
    if(!['GET','POST'].includes(req.method)) return json(405,{error:'Method not allowed'});
    if(req.method==='POST') {
      let origin;try{origin=new URL(req.headers.origin||'');}catch{return json(403,{error:'ไม่อนุญาตคำขอนี้'});}
      if(origin.host!==req.headers.host||!['https:','http:'].includes(origin.protocol)) return json(403,{error:'ไม่อนุญาตคำขอนี้'});
      if(!String(req.headers['content-type']||'').startsWith('application/json')) return json(415,{error:'Invalid content type'});
    }
    if(action==='config'&&req.method==='GET') return json(200,{assignment:'gen4-ep3',deadline:DEADLINE,open:isOpen(),serverTime:new Date().toISOString()});
    if(action==='session'&&req.method==='GET') return json(200,{authenticated:base.authenticated(req)});
    if(['list','export','review','archive-test'].includes(action)&&!base.authenticated(req)) return json(401,{error:'กรุณาเข้าสู่ระบบผู้ดูแล'});
    if(!['submit','list','export','review','archive-test'].includes(action)) return json(404,{error:'Not found'});
    if((['submit','review','archive-test'].includes(action)&&req.method!=='POST')||(['list','export'].includes(action)&&req.method!=='GET')) return json(405,{error:'Method not allowed'});
    let body=req.body||{};if(typeof body==='string')try{body=JSON.parse(body);}catch{return json(400,{error:'Invalid JSON'});}
    if(!body||typeof body!=='object'||Array.isArray(body)) return json(400,{error:'Invalid request'});
    if(action==='submit') {
      if(body.website) fail('ไม่สามารถรับรายการนี้ได้');
      const v=validate(body),hash=base.payloadHash(v);await schema();const sql=db();
      const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
      const rate=await sql`INSERT INTO course_homework_limits(key,count,expires_at) VALUES(${'ep3-submit:'+mac('homework-ip:'+ip)},1,now()+interval '1 hour')
        ON CONFLICT(key) DO UPDATE SET count=CASE WHEN course_homework_limits.expires_at<now() THEN 1 ELSE course_homework_limits.count+1 END,
        expires_at=CASE WHEN course_homework_limits.expires_at<now() THEN now()+interval '1 hour' ELSE course_homework_limits.expires_at END RETURNING count`;
      if(rate[0].count>300) fail('ทำรายการหลายครั้ง กรุณารอสักครู่แล้วลองใหม่',429);
      const existing=await sql`SELECT id,created_at,payload_hash FROM course_homework_ep3 WHERE id=${body.requestId}`;
      if(existing.length) {
        if(existing[0].payload_hash!==hash) fail('ข้อมูลเปลี่ยนจากรายการที่ส่งแล้ว กรุณาเริ่มรายการใหม่',409);
        return json(200,receipt(existing[0]));
      }
      if(!isOpen()) fail('หมดเวลาส่งเพจ EP3 แล้ว (23 ตุลาคม 2569 เวลา 12.00 น.)',410);
      // Serialize submissions per learner so concurrent requests cannot exceed three pages.
      const [,saved]=await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${'homework-ep3:'+v.phone},0))`,
        sql`INSERT INTO course_homework_ep3(id,full_name,phone,facebook_name,generation,page_name,page_url,page_key,page_created_date,payload_hash,ip_hash)
          SELECT ${body.requestId},${v.fullName},${v.phone},${v.facebookName},${v.generation},${v.pageName},${v.pageUrl},${v.pageKey},${v.pageCreatedDate},${hash},${mac('homework-ip:'+ip)}
          WHERE clock_timestamp()<${DEADLINE}::timestamptz AND (SELECT count(*) FROM course_homework_ep3 WHERE phone=${v.phone} AND archived_at IS NULL)<3
          ON CONFLICT DO NOTHING RETURNING id,created_at,payload_hash`
      ],{isolationLevel:'ReadCommitted'});
      if(saved.length) return json(201,receipt(saved[0]));
      const raced=await sql`SELECT id,created_at,payload_hash FROM course_homework_ep3 WHERE id=${body.requestId}`;
      if(raced.length) {if(raced[0].payload_hash===hash)return json(200,receipt(raced[0]));fail('รายการนี้มีข้อมูลไม่ตรงกัน กรุณาโหลดหน้าใหม่',409);}
      const duplicate=await sql`SELECT id FROM course_homework_ep3 WHERE phone=${v.phone} AND page_key=${v.pageKey} AND archived_at IS NULL`;
      if(duplicate.length) fail('ส่งเพจนี้ไว้แล้วครับ ทยอยลงคลิปในเพจเดิมได้เลย ไม่ต้องส่งซ้ำ',409,'pageUrl');
      if(!isOpen()) fail('หมดเวลาส่งเพจแล้ว',410);
      fail('เบอร์นี้ส่งครบ 3 เพจแล้วครับ หากต้องการแก้ไขลิงก์ กรุณาติดต่อแอดมิน',409);
    }
    if(action==='review') {
      const v=reviewInput(body);await schema();const sql=db();
      const current=await sql`SELECT page_created_date FROM course_homework_ep3 WHERE id=${v.id} AND archived_at IS NULL`;
      if(!current.length) fail('ไม่พบรายการนี้',404);
      if(v.dailyClips.some(d=>d.date<current[0].page_created_date)) fail('วันที่ลงคลิปต้องไม่ก่อนวันที่สร้างเพจที่ผู้เรียนระบุ');
      const rows=await sql`UPDATE course_homework_ep3 SET review_status=${v.status},daily_clips=${JSON.stringify(v.dailyClips)}::jsonb,
        date_verified=${v.dateVerified},scenes_verified=${v.scenesVerified},daily_verified=${v.dailyVerified},review_note=${v.note},review_version=review_version+1,reviewed_at=now()
        WHERE id=${v.id} AND archived_at IS NULL AND review_version=${v.version} RETURNING review_version,reviewed_at`;
      if(!rows.length) fail('รายการถูกแก้ไขโดยทีมงานแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง',409);
      return json(200,{ok:true,...rows[0]});
    }
    await schema();const sql=db();
    if(action==='archive-test') {
      if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id)) fail('รายการไม่ถูกต้อง');
      const rows=await sql`UPDATE course_homework_ep3 SET archived_at=now() WHERE id=${body.id} AND full_name='ทดสอบระบบ Gen4 EP3 — ไม่ใช่นักเรียน' AND phone='0000000000' AND page_name LIKE 'QA EP3 ทดสอบระบบเท่านั้น%' RETURNING id`;
      if(!rows.length) fail('ไม่ใช่รายการทดสอบ',404);return json(200,{ok:true});
    }
    const generation=Number(req.query?.generation||0),status=String(req.query?.status||''),search=String(req.query?.search||'').trim();
    if(!Number.isInteger(generation)||generation<0||generation>4) fail('รุ่นไม่ถูกต้อง');
    if(status&&!Object.hasOwn(STATUSES,status)) fail('สถานะไม่ถูกต้อง');
    const offset=Number(req.query?.offset||0);if(!Number.isInteger(offset)||offset<0||offset>1000000) fail('หน้าไม่ถูกต้อง');
    // Paginate learners, not pages: every learner's pages remain together even when filtering.
    const matching=sql`SELECT phone,max(created_at) AS latest FROM course_homework_ep3 WHERE archived_at IS NULL
      AND (${generation}=0 OR generation=${generation}) AND (${status}='' OR review_status=${status})
      AND (${search}='' OR strpos(phone,${search})>0 OR strpos(lower(full_name),lower(${search}))>0) GROUP BY phone`;
    const counts=await sql`SELECT count(*)::integer AS total FROM (${matching}) AS learners`;
    if(action==='export'&&counts[0].total>8000) fail('ข้อมูลมากเกินไป กรุณาแยกส่งออกตามรุ่นหรือค้นหาผู้เรียน');
    const limit=action==='export'?8000:20;
    const rows=await sql`WITH learners AS (${matching}), selected AS (SELECT phone FROM learners ORDER BY latest DESC,phone LIMIT ${limit} OFFSET ${action==='export'?0:offset})
      SELECT h.*,count(*) OVER(PARTITION BY h.phone)::integer AS page_count,
      count(*) FILTER(WHERE h.review_status='complete') OVER(PARTITION BY h.phone)::integer AS complete_count,
      (SELECT count(DISTINCT d.phone)::integer FROM course_homework_ep3 d WHERE d.page_key=h.page_key AND d.archived_at IS NULL) AS page_owner_count
      FROM course_homework_ep3 h JOIN selected s ON h.phone=s.phone WHERE h.archived_at IS NULL ORDER BY h.phone,h.created_at,h.id`;
    if(action==='export') {res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="gen4-ep3-homework.csv"');res.statusCode=200;return res.end(csv(rows));}
    const safeRows=rows.map(({payload_hash,ip_hash,archived_at,page_key,...row})=>row);
    return json(200,{rows:safeRows,total:counts[0].total,offset,limit});
  } catch(error) {
    if(!error.status) console.error('homework_ep3_request_failed',error.code||'internal');
    return json(error.status||503,{error:error.status?error.message:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังอยู่',...(error.field?{field:error.field}:{})});
  }
};
module.exports._test={validate,reviewInput,isOpen,pageKey,csv,DEADLINE};
