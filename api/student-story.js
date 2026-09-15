'use strict';
const crypto = require('node:crypto');
const sharp = require('sharp');
const { neon } = require('@neondatabase/serverless');
const adminConfig = require('./_student-story-admin-config');
const COOKIE = 'businessboy_student_story_admin';
const MAX_IMAGE = 2 * 1024 * 1024;
const STATES = ['ใหม่', 'สนใจ', 'ติดต่อแล้ว', 'นัดหมายแล้ว', 'ไม่เลือก'];
let database, schemaPromise;
const secret = () => process.env.STUDENT_STORY_SECRET || process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
const mac = s => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const fail = (message, status=400) => { const e = new Error(message); e.status=status; throw e; };
function db() {
  if (!database) {
    const url = process.env.STUDENT_STORY_DATABASE_URL || process.env.GEN3_CATALOG_DATABASE_URL || process.env.DATABASE_URL;
    if (!url || !secret()) fail('ระบบรับสมัครยังไม่พร้อม กรุณาลองใหม่ภายหลัง',503);
    database=neon(url);
  }
  return database;
}
async function schema() {
  if (!schemaPromise) schemaPromise=(async()=>{
    const sql=db();
    await sql`CREATE TABLE IF NOT EXISTS student_story_applications (
      id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
      full_name text, phone text, line_id text, facebook_name text, generation integer CHECK (generation IN (1,2,3)),
      facebook_links jsonb NOT NULL DEFAULT '[]', tiktok_links jsonb NOT NULL DEFAULT '[]', note text,
      source text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'ใหม่', consent_version text, ip_hash text NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS student_story_images (
      application_id uuid NOT NULL REFERENCES student_story_applications(id) ON DELETE CASCADE,
      slot integer NOT NULL CHECK (slot BETWEEN 0 AND 4), data bytea NOT NULL, sha256 text NOT NULL,
      width integer NOT NULL, height integer NOT NULL, PRIMARY KEY(application_id,slot)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS student_story_submitted_idx ON student_story_applications(submitted_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS student_story_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)`;
  })().catch(e=>{schemaPromise=null;throw e;});
  return schemaPromise;
}
async function rate(key,max,seconds) {
  const sql=db();
  const rows=await sql`INSERT INTO student_story_limits(key,count,expires_at) VALUES(${key},1,now()+${seconds}*interval '1 second')
  ON CONFLICT(key) DO UPDATE SET count=CASE WHEN student_story_limits.expires_at<now() THEN 1 ELSE student_story_limits.count+1 END,
  expires_at=CASE WHEN student_story_limits.expires_at<now() THEN now()+${seconds}*interval '1 second' ELSE student_story_limits.expires_at END RETURNING count`;
  if (rows[0].count>max) fail('ทำรายการหลายครั้ง กรุณารอสักครู่แล้วลองใหม่',429);
}
function signDraft(id) { const exp=Date.now()+86400000; return `${id}.${exp}.${mac('draft:'+id+':'+exp)}`; }
function draftId(token) {
  const [id,exp,sig,...rest]=String(token||'').split('.');
  if (rest.length || !/^[0-9a-f-]{36}$/.test(id||'') || !/^\d{13}$/.test(exp||'') || +exp<Date.now() || +exp>Date.now()+86401000 || !equal(sig,mac('draft:'+id+':'+exp))) fail('รายการหมดอายุ กรุณาส่งใหม่อีกครั้ง',401);
  return id;
}
function admin(req) {
  if (!secret()) return false;
  try {
    const item=String(req.headers.cookie||'').split(';').find(v=>v.trim().startsWith(COOKIE+'='));
    if(!item)return false;
    const [exp,sig,...rest]=decodeURIComponent(item.trim().slice(COOKIE.length+1)).split('.');
    return !rest.length && /^\d{13}$/.test(exp) && +exp>Date.now() && +exp<Date.now()+43201000 && equal(sig,mac('admin:'+exp+':'+adminConfig.digest));
  } catch {return false;}
}
function text(value,max,required,label) {
  const v=typeof value==='string'?value.trim():'';
  if((required && !v) || v.length>max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v))fail('กรุณาตรวจ '+label);
  return v;
}
function links(value,kind) {
  if(typeof value!=='string' || value.length>20000) fail('กรุณาตรวจลิงก์'+kind);
  const values=value.split(/\s+/).filter(Boolean);
  if(values.length>100)fail('ใส่ลิงก์ได้ไม่เกิน 100 ลิงก์ต่อช่อง');
  const result=[];
  for(let i=0;i<values.length;i++) {
    let u; try{u=new URL(values[i]);}catch{fail(`ลิงก์ ${kind} ลำดับที่ ${i+1} ไม่ถูกต้อง กรุณาใส่ลิงก์เต็ม`);}
    const host=u.hostname.toLowerCase();
    const domains=kind==='Facebook'?['facebook.com','fb.com','fb.watch']:['tiktok.com'];
    if(u.protocol!=='https:' || u.username || u.password || !domains.some(d=>host===d||host.endsWith('.'+d)))fail(`กรุณาตรวจลิงก์ ${kind} ลำดับที่ ${i+1}`);
    u.hash='';if(!result.includes(u.href))result.push(u.href);
  }
  return result;
}
function validate(body) {
  const phone=text(body.phone,25,true,'เบอร์โทรศัพท์').replace(/[\s()-]/g,'');
  if(!/^(?:0\d{8,9}|\+66\d{8,9})$/.test(phone))fail('กรุณาตรวจเบอร์โทรศัพท์');
  if(![1,2,3].includes(body.generation))fail('กรุณาเลือกรุ่น 1, 2 หรือ 3 เพียงรุ่นเดียว');
  if(body.consent!==true)fail('กรุณายืนยันข้อมูลก่อนส่ง');
  const slots=body.slots;
  if(!Array.isArray(slots)||slots.length<1||slots.length>5||new Set(slots).size!==slots.length||slots.some(s=>!Number.isInteger(s)||s<0||s>4))fail('กรุณาแนบรูปผลงาน 1–5 รูป');
  return {fullName:text(body.fullName,120,true,'ชื่อ–นามสกุล'),phone,lineId:text(body.lineId,100,false,'LINE ID'),facebookName:text(body.facebookName,150,true,'ชื่อ Facebook ที่ใช้ในกลุ่มเรียน'),generation:body.generation,facebookLinks:links(body.facebookLinks||'','Facebook'),tiktokLinks:links(body.tiktokLinks||'','TikTok'),note:text(body.note,300,false,'ข้อความเพิ่มเติม'),slots};
}
async function imageBytes(base64) {
  if(typeof base64!=='string'||base64.length>Math.ceil(MAX_IMAGE/3)*4||!base64.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))fail('ไฟล์รูปไม่ถูกต้องหรือมีขนาดใหญ่เกินไป');
  const input=Buffer.from(base64,'base64');
  if(input.length>MAX_IMAGE)fail('รูปมีขนาดใหญ่เกินไป');
  try {
    const src=sharp(input,{limitInputPixels:40000000,failOn:'error'});
    const meta=await src.metadata();
    if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1||meta.width<50||meta.height<50)fail('กรุณาเลือกภาพ JPG, PNG หรือ WebP ที่อ่านได้ชัดเจน');
    const {data,info}=await src.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).jpeg({quality:90,mozjpeg:true}).toBuffer({resolveWithObject:true});
    if(data.length>MAX_IMAGE)fail('รูปมีรายละเอียดมากเกินไป กรุณาลองภาพหน้าจอ');
    return {data,width:info.width,height:info.height,hash:crypto.createHash('sha256').update(data).digest('hex')};
  } catch(e) {if(e.status)throw e;fail('อ่านรูปไม่สำเร็จ กรุณาเลือกภาพ JPG, PNG หรือ WebP ใหม่');}
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('CDN-Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Vary','Cookie');
  const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
  try {
    if(!['GET','POST'].includes(req.method))return json(405,{error:'Method not allowed'});
    if(req.method==='POST') {
      let origin;try{origin=new URL(req.headers.origin||'');}catch{return json(403,{error:'ไม่อนุญาตคำขอนี้'});}
      if(origin.host!==req.headers.host)return json(403,{error:'ไม่อนุญาตคำขอนี้'});
      if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(415,{error:'Invalid content type'});
    }
    let body=req.body||{};if(typeof body==='string')try{body=JSON.parse(body);}catch{return json(400,{error:'Invalid JSON'});}
    if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'Invalid request'});
    const action=String(req.query?.action||'');
    if(action==='session' && req.method==='GET')return json(200,{authenticated:admin(req)});
    if(action==='logout' && req.method==='POST'){res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);return json(200,{ok:true});}
    if(['list','image','status'].includes(action) && !admin(req))return json(401,{error:'กรุณาเข้าสู่ระบบผู้ดูแล'});
    await schema();const sql=db();
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const ipHash=mac('ip:'+ip);
    if(action==='login' && req.method==='POST') {
      await rate('login:'+ipHash,10,600);
      if(typeof body.password!=='string'||body.password.length>256)fail('รหัสผ่านไม่ถูกต้อง',401);
      const digest=crypto.scryptSync(body.password,adminConfig.salt,64).toString('hex');
      if(!equal(digest,adminConfig.digest))fail('รหัสผ่านไม่ถูกต้อง',401);
      const exp=Date.now()+43200000;
      res.setHeader('Set-Cookie',`${COOKIE}=${exp}.${mac('admin:'+exp+':'+adminConfig.digest)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
      return json(200,{ok:true});
    }
    if(action==='start' && req.method==='POST') {
      if(body.website)fail('ไม่สามารถรับรายการนี้ได้');
      await rate('start:'+ipHash,12,3600);
      const id=crypto.randomUUID();const source=text(body.source,80,false,'แหล่งที่มา');
      await sql`INSERT INTO student_story_applications(id,ip_hash,source) VALUES(${id},${ipHash},${source})`;
      return json(200,{token:signDraft(id)});
    }
    if(['upload','submit'].includes(action) && req.method==='POST') {
      const id=draftId(body.token);await rate('draft:'+id,45,3600);
      const rows=await sql`SELECT submitted_at FROM student_story_applications WHERE id=${id}`;
      if(!rows.length)fail('ไม่พบรายการ กรุณาเริ่มส่งใหม่',404);
      if(rows[0].submitted_at) {
        if(action==='submit')return json(200,{ok:true,receipt:'BB-'+id.slice(0,8).toUpperCase()});
        fail('ใบสมัครนี้ส่งแล้ว',409);
      }
      if(action==='upload') {
        if(!Number.isInteger(body.slot)||body.slot<0||body.slot>4)fail('ตำแหน่งรูปไม่ถูกต้อง');
        const img=await imageBytes(body.data);
        // Lock the parent to serialize upload/submit and prevent edits after submission.
        const result=await sql.transaction([
          sql`SELECT id FROM student_story_applications WHERE id=${id} FOR UPDATE`,
          sql`INSERT INTO student_story_images(application_id,slot,data,sha256,width,height)
          SELECT ${id},${body.slot},decode(${img.data.toString('base64')},'base64'),${img.hash},${img.width},${img.height}
          WHERE EXISTS(SELECT 1 FROM student_story_applications WHERE id=${id} AND submitted_at IS NULL)
          ON CONFLICT(application_id,slot) DO UPDATE SET data=EXCLUDED.data,sha256=EXCLUDED.sha256,width=EXCLUDED.width,height=EXCLUDED.height
          RETURNING slot`
        ]);
        if(!result[1].length)fail('ใบสมัครนี้ส่งแล้ว',409);
        return json(200,{ok:true,slot:body.slot});
      }
      const v=validate(body);
      const stored=await sql`SELECT slot FROM student_story_images WHERE application_id=${id}`;
      if(v.slots.some(s=>!stored.some(r=>r.slot===s)))fail('รูปยังส่งไม่ครบ กรุณาลองใหม่');
      const selected=JSON.stringify(v.slots);
      await sql.transaction([
        sql`SELECT id FROM student_story_applications WHERE id=${id} FOR UPDATE`,
        sql`WITH changed AS (
          UPDATE student_story_applications SET full_name=${v.fullName},phone=${v.phone},line_id=${v.lineId},facebook_name=${v.facebookName},generation=${v.generation},facebook_links=${JSON.stringify(v.facebookLinks)}::jsonb,tiktok_links=${JSON.stringify(v.tiktokLinks)}::jsonb,note=${v.note},consent_version='2026-09-15-v1',submitted_at=now()
          WHERE id=${id} AND submitted_at IS NULL RETURNING id
        ) DELETE FROM student_story_images WHERE application_id=${id} AND EXISTS(SELECT 1 FROM changed)
          AND slot NOT IN (SELECT value::integer FROM jsonb_array_elements_text(${selected}::jsonb))`
      ]);
      return json(200,{ok:true,receipt:'BB-'+id.slice(0,8).toUpperCase()});
    }
    if(action==='list' && req.method==='GET') {
      const page=Math.floor(Math.max(0,Math.min(10000,Number(req.query.page)||0)));
      const q=text(req.query.search||'',120,false,'คำค้น');const generation=['1','2','3'].includes(req.query.generation)?Number(req.query.generation):null;
      const rows=await sql`SELECT a.id,a.created_at,a.submitted_at,a.full_name,a.phone,a.line_id,a.facebook_name,a.generation,a.facebook_links,a.tiktok_links,a.note,a.status,a.source,
      COALESCE((SELECT json_agg(i.slot ORDER BY i.slot) FROM student_story_images i WHERE i.application_id=a.id),'[]') AS images,
      count(*) OVER() AS total FROM student_story_applications a WHERE submitted_at IS NOT NULL
      AND (${generation}::integer IS NULL OR generation=${generation})
      AND (${q}='' OR full_name ILIKE ${'%'+q+'%'} OR facebook_name ILIKE ${'%'+q+'%'} OR phone ILIKE ${'%'+q+'%'})
      ORDER BY submitted_at DESC LIMIT 30 OFFSET ${page*30}`;
      return json(200,{items:rows,page,total:rows[0]?Number(rows[0].total):0});
    }
    if(action==='image' && req.method==='GET') {
      if(!/^[0-9a-f-]{36}$/.test(req.query.id||''))fail('ไม่พบรูป',404);
      const rows=await sql`SELECT encode(data,'base64') AS data FROM student_story_images WHERE application_id=${req.query.id} AND slot=${Number(req.query.slot)}`;
      if(!rows.length)fail('ไม่พบรูป',404);
      let bytes=Buffer.from(rows[0].data,'base64');
      if(req.query.thumb==='1')bytes=await sharp(bytes).resize({width:400,height:400,fit:'inside'}).jpeg({quality:75}).toBuffer();
      res.setHeader('Content-Type','image/jpeg');res.setHeader('Content-Disposition','inline; filename="student-proof.jpg"');res.statusCode=200;return res.end(bytes);
    }
    if(action==='status' && req.method==='POST') {
      if(!STATES.includes(body.status)||!/^[0-9a-f-]{36}$/.test(body.id||''))fail('ข้อมูลไม่ถูกต้อง');
      const result=await sql`UPDATE student_story_applications SET status=${body.status} WHERE id=${body.id} AND submitted_at IS NOT NULL RETURNING id`;
      if(!result.length)fail('ไม่พบใบสมัคร',404);return json(200,{ok:true});
    }
    return json(404,{error:'Not found'});
  } catch(e) {
    if(!e.status)console.error('student-story request failed',e.code||e.name);
    return json(e.status||503,{error:e.status?e.message:'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลในหน้านี้ยังอยู่'});
  }
};
module.exports._test={validate,links,draftId,signDraft,admin,imageBytes,STATES};
