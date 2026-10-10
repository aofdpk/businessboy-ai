'use strict';
const crypto=require('node:crypto');
const {neon}=require('@neondatabase/serverless');
const D=require('./_kvid-policy.js');
const E=require('./_kvid-enrollment');
const adminConfig=require('./_student-story-admin-config');
let database,ready;
const secret=()=>process.env.STUDENT_STORY_SECRET||process.env.GEN3_SESSION_SECRET||process.env.SESSION_SECRET||'';
const mac=s=>crypto.createHmac('sha256',secret()).update(s).digest('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
function db(){if(!database){const url=process.env.STUDENT_STORY_DATABASE_URL||process.env.GEN3_CATALOG_DATABASE_URL||process.env.DATABASE_URL;if(!url||!secret())D.fail('ระบบยังไม่พร้อม กรุณาลองใหม่',503);database=neon(url);}return database;}
async function schema(){if(!ready)ready=(async()=>{const s=db();
 const [installed]=await s`SELECT to_regclass('public.kvid_schema_v2') IS NOT NULL AS ready`;
 if(installed.ready)return;
 await s`CREATE TABLE IF NOT EXISTS kvid_access_control(id integer PRIMARY KEY CHECK(id=1),mode text NOT NULL DEFAULT 'open',registration_open boolean NOT NULL DEFAULT true,names jsonb NOT NULL DEFAULT '[]',revision integer NOT NULL DEFAULT 0)`;
 await s`INSERT INTO kvid_access_control(id) VALUES(1) ON CONFLICT DO NOTHING`;
 await s`CREATE TABLE IF NOT EXISTS kvid_members(id uuid PRIMARY KEY,first_name text NOT NULL,last_name text NOT NULL,name_key text NOT NULL,token_hash text NOT NULL,suspended boolean NOT NULL DEFAULT false,note text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),last_seen_at timestamptz,client_version text NOT NULL DEFAULT '')`;
 await s`CREATE INDEX IF NOT EXISTS kvid_members_name_idx ON kvid_members(name_key)`;
 await s`CREATE TABLE IF NOT EXISTS kvid_access_audit(id uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),action text NOT NULL,member_id uuid,before_data jsonb NOT NULL,after_data jsonb NOT NULL)`;
 await s`CREATE TABLE IF NOT EXISTS kvid_access_limits(key text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL)`;
 await s`ALTER TABLE kvid_members ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',ADD COLUMN IF NOT EXISTS cohort integer`;
 await s`CREATE TABLE IF NOT EXISTS kvid_enrollment(id uuid PRIMARY KEY,token_hash text NOT NULL,form_hash text UNIQUE NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz)`;
 await s`CREATE INDEX IF NOT EXISTS kvid_enrollment_expiry_idx ON kvid_enrollment(expires_at)`;
 await s`CREATE TABLE IF NOT EXISTS kvid_roster_shards(id integer PRIMARY KEY,version bigint NOT NULL DEFAULT 0)`;
 await s`INSERT INTO kvid_roster_shards(id) SELECT generate_series(0,63) ON CONFLICT DO NOTHING`;
 await s`CREATE TABLE IF NOT EXISTS kvid_schema_v2(id integer PRIMARY KEY)`;
 })().catch(e=>{ready=null;throw e;});return ready;}
async function rate(k,max,seconds){const s=db();const rows=await s`INSERT INTO kvid_access_limits(key,count,expires_at) VALUES(${k},1,now()+${seconds}*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN kvid_access_limits.expires_at<now() THEN 1 ELSE kvid_access_limits.count+1 END,expires_at=CASE WHEN kvid_access_limits.expires_at<now() THEN now()+${seconds}*interval '1 second' ELSE kvid_access_limits.expires_at END RETURNING count`;if(rows[0].count>max)D.fail('ทำรายการถี่เกินไป กรุณารอสักครู่',429);}
function admin(req){if(!secret())return false;try{const c=String(req.headers.cookie||'').split(';').find(v=>v.trim().startsWith('businessboy_student_story_admin='));if(!c)return false;const [exp,sig,...rest]=decodeURIComponent(c.trim().split('=').slice(1).join('=')).split('.');return !rest.length&&/^\d{13}$/.test(exp)&&+exp>Date.now()&&+exp<Date.now()+43201000&&equal(sig,mac('admin:'+exp+':'+adminConfig.digest));}catch{return false;}}
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function token(req){const v=String(req.headers.authorization||'');if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(v))D.fail('กรุณาเปิดใช้งานผู้ช่วยก่อน',401);return v.slice(7);}
const readPolicy=r=>({mode:r.mode,registrationOpen:r.registration_open,names:r.names,revision:r.revision});
async function state(){const s=db();const [r]=await s`SELECT * FROM kvid_access_control WHERE id=1`;return readPolicy(r);}
async function members(){return db()`SELECT id,first_name,last_name,phone,cohort,name_key,suspended,note,version,created_at,last_seen_at,client_version FROM kvid_members ORDER BY created_at DESC,id`;}
async function rosterRevision(){const [r]=await db()`SELECT COALESCE(sum(version),0)::text AS revision FROM kvid_roster_shards`;return r.revision;}
module.exports=async(req,res)=>{
 for(const k of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])res.setHeader(k,'no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');
 const json=(status,v)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(v));};
 try{
  const action=String(req.query?.action||'config');
  const admins=['list','export','member','preview','apply','audit','qa-cleanup'];
  if(admins.includes(action)&&!admin(req))return json(401,{error:'กรุณาเข้าสู่ระบบผู้ดูแล'});
  if(action==='session'&&req.method==='GET')return json(200,{authenticated:admin(req)});
  const expected=['config','list','export','audit','check'].includes(action)?'GET':'POST';
  if(![...admins,'register','enroll','enrollment-info','enrollment-save','check','config','qa-self-cleanup'].includes(action))return json(404,{error:'Not found'});
  if(req.method!==expected)return json(405,{error:'Method not allowed'});
  if(req.method==='POST'){
   if(!String(req.headers['content-type']||'').startsWith('application/json'))D.fail('Invalid content type',415);
   if(admins.includes(action)||action==='enrollment-save'){let origin;try{origin=new URL(req.headers.origin||'');}catch{D.fail('ไม่อนุญาตคำขอนี้',403);}if(origin.host!==req.headers.host)D.fail('ไม่อนุญาตคำขอนี้',403);}
  }
  let body=req.body||{};if(typeof body==='string'){if(Buffer.byteLength(body)>2000000)D.fail('ไฟล์ใหญ่เกินไป',413);try{body=JSON.parse(body);}catch{D.fail('Invalid JSON');}}
  if(!body||typeof body!=='object'||Array.isArray(body))D.fail('Invalid request');
  if(Buffer.byteLength(JSON.stringify(body))>2000000)D.fail('ไฟล์ใหญ่เกินไป',413);
  await schema();const s=db();
  if(['enroll','enrollment-info','enrollment-save'].includes(action))return json(200,await E.handle({action,body,req,s,token,uuid,rate}));
  if(action==='qa-self-cleanup'){
   const t=token(req);if(!uuid(body.id))D.fail('Invalid id');
   const rows=await s`WITH removed AS (DELETE FROM kvid_members WHERE id=${body.id} AND token_hash=${D.digest(t)} AND first_name='ทดสอบระบบ-KVID-QA' AND last_name='ไม่ใช่นักเรียน' RETURNING id), rev AS (UPDATE kvid_roster_shards SET version=version+1 WHERE id=${E.shard(body.id)} AND EXISTS(SELECT 1 FROM removed)), tickets AS (DELETE FROM kvid_enrollment WHERE id=${body.id} AND EXISTS(SELECT 1 FROM removed)), limits AS (DELETE FROM kvid_access_limits WHERE key IN (${('enroll:'+body.id)},${('register:'+body.id)},${('check:'+body.id)}) AND EXISTS(SELECT 1 FROM removed)) SELECT id FROM removed`;
   return json(200,{removed:rows.length});
  }
  if(action==='config'){const p=await state();return json(200,{mode:p.mode,registrationOpen:p.registrationOpen,serverTime:new Date().toISOString()});}
  if(action==='register'){
   const first=D.name(body.firstName),last=D.name(body.lastName),id=body.id,t=token(req);if(!uuid(id))D.fail('รหัสติดตั้งไม่ถูกต้อง');
   const hash=D.digest(t);await rate('register:'+id,60,3600);
   const existing=await s`SELECT * FROM kvid_members WHERE id=${id}`;
   if(existing.length){if(!equal(existing[0].token_hash,hash))D.fail('รหัสติดตั้งไม่ตรงกัน',401);if(existing[0].name_key!==D.key(first,last))D.fail('บัญชีนี้ลงทะเบียนแล้ว ไม่สามารถเปลี่ยนชื่อเพื่อเปิดสิทธิ์ใหม่',409);return json(200,{id,...D.decision(existing[0],await state())});}
   const k=D.key(first,last),version=String(body.version||'').slice(0,40);
   const result=await s.transaction([
    s`SELECT id FROM kvid_access_control WHERE id=1 FOR SHARE`,
    s`INSERT INTO kvid_members(id,first_name,last_name,name_key,token_hash,client_version) SELECT ${id},${first},${last},${k},${hash},${version} FROM kvid_access_control WHERE id=1 AND registration_open AND mode<>'paused' AND (mode='open' OR EXISTS(SELECT 1 FROM jsonb_array_elements(names) n WHERE n->>'key'=${k})) ON CONFLICT(id) DO NOTHING RETURNING id`,
    s`UPDATE kvid_roster_shards SET version=version+1 WHERE id=${E.shard(id)} AND EXISTS(SELECT 1 FROM kvid_members WHERE id=${id} AND token_hash=${hash})`
   ]);
   if(!result[1].length){const raced=await s`SELECT * FROM kvid_members WHERE id=${id}`;if(!raced.length)D.fail('ยังไม่เปิดรับบัญชีนี้ กรุณาติดต่อผู้ดูแลคอร์ส',403);if(!equal(raced[0].token_hash,hash))D.fail('รหัสติดตั้งไม่ตรงกัน',401);}
   return json(201,{id,...D.decision({suspended:false,name_key:k},await state())});
  }
  if(action==='check'){
   const t=token(req),id=String(req.query.id||'');if(!uuid(id))D.fail('กรุณาลงทะเบียนก่อน',401);
   const [m]=await s`SELECT m.token_hash,m.suspended,m.phone,m.cohort,c.mode,c.revision,(c.mode<>'allowlist' OR EXISTS(SELECT 1 FROM jsonb_array_elements(c.names) n WHERE n->>'key'=m.name_key)) AS listed FROM kvid_members m CROSS JOIN kvid_access_control c WHERE m.id=${id} AND c.id=1`;
   if(!m||!equal(m.token_hash,D.digest(t)))D.fail('สิทธิ์เชื่อมต่อไม่ถูกต้อง กรุณาติดต่อผู้ดูแล',401);
   const result=m.suspended?{allowed:false,reason:'suspended',message:'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลคอร์ส'}:m.mode==='paused'?{allowed:false,reason:'paused',message:'ผู้ดูแลหยุดให้บริการชั่วคราว'}:!m.listed?{allowed:false,reason:'not_on_list',message:'ยังไม่พบชื่อในรายชื่อผู้มีสิทธิ์ กรุณาติดต่อผู้ดูแลคอร์ส'}:!E.complete(m)?{allowed:false,reason:'profile_required',message:'กรุณากรอกข้อมูลลงทะเบียนให้ครบก่อนเริ่มงาน'}:{allowed:true,reason:m.mode==='open'?'unverified':'name_matched',message:'ใช้งานได้'};
   if(result.reason==='profile_required'){const f=await E.handle({action:'enroll',body:{id},req,s,token,uuid,rate});result.registration_url=f.registration_url;result.message+=' เปิดแบบฟอร์มให้นักเรียนกรอก: '+f.registration_url;}
   return json(200,{id,...result,policyRevision:m.revision,checkedAt:new Date().toISOString(),cacheSeconds:60});
  }
  if(action==='list'||action==='export'){
   const [p,rows]=await Promise.all([state(),members()]);const items=rows.map(m=>{const d=D.decision(m,p);return {...m,...(d.allowed&&!E.complete(m)?{allowed:false,reason:'profile_required',message:'รอกรอกเบอร์โทรและรุ่นเรียน'}:d)};});
   if(action==='list')return json(200,{policy:p,items});
   const data=[['รหัสบัญชี','ชื่อ','นามสกุล','เบอร์โทร','รุ่นเรียน','ลงทะเบียน','สถานะ','เหตุผล'],...items.map(m=>[m.id,m.first_name,m.last_name,m.phone,m.cohort,m.created_at,m.allowed?'ใช้งานได้':'ระงับ',m.message])].map(r=>r.map(D.csvCell).join(',')).join('\r\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="kvid-members.csv"');res.statusCode=200;return res.end('\ufeff'+data);
  }
  if(action==='member'){
   if(!uuid(body.id)||!Number.isSafeInteger(body.version)||typeof body.suspended!=='boolean')D.fail('ข้อมูลบัญชีไม่ถูกต้อง');
   const note=String(body.note||'').trim().slice(0,500),[old]=await s`SELECT suspended,note FROM kvid_members WHERE id=${body.id} AND version=${body.version}`;if(!old)D.fail('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่',409);
   const rows=await s`WITH changed AS (UPDATE kvid_members SET suspended=${body.suspended},note=${note},version=version+1 WHERE id=${body.id} AND version=${body.version} RETURNING id), rev AS (UPDATE kvid_access_control SET revision=revision+1 WHERE id=1 AND EXISTS(SELECT 1 FROM changed)) INSERT INTO kvid_access_audit(id,action,member_id,before_data,after_data) SELECT ${crypto.randomUUID()},'member',id,${JSON.stringify(old)}::jsonb,${JSON.stringify({suspended:body.suspended,note})}::jsonb FROM changed RETURNING id`;
   if(!rows.length)D.fail('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่',409);return json(200,{ok:true});
  }
  if(action==='preview'||action==='apply'){
   const desired=D.policy(body.policy),current=await state(),rows=await members(),impact=D.impact(rows,desired);
   const roster=await rosterRevision();const fingerprint=D.digest({revision:current.revision,roster,desired}),proof=mac('kvid-preview:'+fingerprint);
   if(action==='preview')return json(200,{revision:current.revision,proof,policy:desired,impact,allowed:impact.filter(x=>x.allowed).length,blocked:impact.filter(x=>!x.allowed).length});
   if(body.revision!==current.revision||!equal(body.proof,proof))D.fail('ข้อมูลเปลี่ยนแล้ว กรุณาดูผลกระทบอีกครั้ง',409);
   const auditId=crypto.randomUUID();const updated=await s.transaction([s`SELECT id FROM kvid_access_control WHERE id=1 FOR UPDATE`,s`WITH changed AS (UPDATE kvid_access_control SET mode=${desired.mode},registration_open=${desired.registrationOpen},names=${JSON.stringify(desired.names)}::jsonb,revision=revision+1 WHERE id=1 AND revision=${current.revision} AND (SELECT COALESCE(sum(version),0)::text FROM kvid_roster_shards)=${roster} RETURNING revision) INSERT INTO kvid_access_audit(id,action,before_data,after_data) SELECT ${auditId},'policy',${JSON.stringify(current)}::jsonb,${JSON.stringify(desired)}::jsonb FROM changed RETURNING id`]);
   if(!updated[1].length)D.fail('ข้อมูลเปลี่ยนแล้ว กรุณาดูผลกระทบอีกครั้ง',409);return json(200,{ok:true,auditId});
  }
  if(action==='audit'){const rows=await s`SELECT * FROM kvid_access_audit ORDER BY created_at DESC LIMIT 50`;return json(200,{items:rows});}
  if(action==='qa-cleanup'){
   if(!uuid(body.id))D.fail('Invalid id');const r=await s`DELETE FROM kvid_members WHERE id=${body.id} AND first_name='ทดสอบระบบ-KVID-QA' AND last_name='ไม่ใช่นักเรียน' RETURNING id`;return json(200,{removed:r.length});
  }
  return json(404,{error:'Not found'});
 }catch(e){if(!e.status)console.error('kvid-assistant failed',e.code||e.name);return json(e.status||503,{error:e.status?e.message:'ระบบเชื่อมต่อไม่สำเร็จ กรุณาลองใหม่'});}
};
module.exports._test={admin,uuid,readPolicy};
