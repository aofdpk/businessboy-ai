const crypto = require('node:crypto');
const {promisify}=require('node:util');
const pbkdf2=promisify(crypto.pbkdf2);
const bundle=require('./_gen4-awards-private');
const COOKIE='businessboy_gen4_awards',TTL=8*3600;
const attempts=new Map();let cached=null,cachedKey='';
const key=()=>process.env.GEN4_AWARDS_BUNDLE_KEY||'';
const equal=(a,b)=>Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
function data(){
 const k=key();if(!/^[a-f0-9]{64}$/.test(k))throw Error('Configuration unavailable');
 if(cached&&cachedKey===k)return cached;
 const dec=crypto.createDecipheriv('aes-256-gcm',Buffer.from(k,'hex'),Buffer.from(bundle.iv,'base64'));
 dec.setAuthTag(Buffer.from(bundle.tag,'base64'));
 cached=JSON.parse(Buffer.concat([dec.update(Buffer.from(bundle.cipher,'base64')),dec.final()]).toString('utf8'));cachedKey=k;return cached;
}
const sign=payload=>crypto.createHmac('sha256',Buffer.from(key(),'hex')).update('gen4-awards-session-v1\n'+payload).digest('base64url');
function authenticated(req){
 try{
  if(!/^[a-f0-9]{64}$/.test(key()))return false;
  const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  if(!raw)return false;const parts=raw.slice(COOKIE.length+1).split('.');
  if(parts.length!==2||!equal(parts[1],sign(parts[0])))return false;
  const p=JSON.parse(Buffer.from(parts[0],'base64url').toString());
  return Number.isSafeInteger(p.exp)&&p.exp>Date.now()&&p.exp<=Date.now()+TTL*1000+1000&&typeof p.nonce==='string';
 }catch{return false;}
}
function cookie(value,maxAge){return `${COOKIE}=${value}; Path=/; HttpOnly; ${process.env.GEN4_AWARDS_LOCAL==='1'?'':'Secure; '}SameSite=Strict; Max-Age=${maxAge}`;}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store, no-cache, must-revalidate');res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
 const path=typeof req.query?.path==='string'?req.query.path:'';
 if(path==='blocked')return json(404,{error:'ไม่พบรายการ'});
 if(!['GET','POST'].includes(req.method))return json(405,{error:'Method not allowed'});
 if(req.method==='POST'){
  try{if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'Origin rejected'});}catch{return json(403,{error:'Origin rejected'});}
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(415,{error:'JSON required'});
  if(Number(req.headers['content-length']||0)>4096)return json(413,{error:'Request too large'});
 }
 let d;try{d=data();}catch{return json(503,{error:'กรุณาลองใหม่อีกครั้ง'});}
 const auth=authenticated(req);
 if(req.method==='POST'){
  let b=req.body;try{if(typeof b==='string')b=JSON.parse(b);}catch{return json(400,{error:'ข้อมูลไม่ถูกต้อง'});}
  if(!b||typeof b!=='object'||Array.isArray(b))return json(400,{error:'ข้อมูลไม่ถูกต้อง'});
  if(path==='api/login'){
   const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0],now=Date.now();
   let entry=attempts.get(ip);if(!entry||now-entry.start>60000)entry={start:now,count:0};
   if(entry.count>=10)return json(429,{error:'ใส่รหัสผิดหลายครั้ง กรุณารอ 1 นาที'});
   if(typeof b.password!=='string'||b.password.length>256)return json(400,{error:'ข้อมูลไม่ถูกต้อง'});
   // Count in-flight attempts as well as failures, before the asynchronous hash.
   entry.count++;attempts.set(ip,entry);
   if(attempts.size>5000)for(const [k,v]of attempts)if(now-v.start>60000)attempts.delete(k);
   const hash=(await pbkdf2(b.password,Buffer.from(d.auth.salt,'hex'),d.auth.iterations,32,'sha256')).toString('hex');
   if(!equal(hash,d.auth.digest))return json(403,{error:'รหัสไม่ถูกต้อง ลองอีกครั้งครับ'});
   attempts.delete(ip);const payload=Buffer.from(JSON.stringify({exp:Date.now()+TTL*1000,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');
   res.setHeader('Set-Cookie',cookie(payload+'.'+sign(payload),TTL));return json(200,{ok:true});
  }
  if(!auth)return json(401,{error:'กรุณาใส่รหัสเข้าเว็บ'});
  if(path==='api/logout'){res.setHeader('Set-Cookie',cookie('',0));return json(200,{ok:true});}
  return json(404,{error:'ไม่พบรายการ'});
 }
 if(path==='api/session')return json(200,{loggedIn:auth});
 const publicFiles=['','styles.css','app.js','assets/businessboy-logo.jpg','assets/NotoSansThai-variable.woff2'];
 const serve=f=>{res.statusCode=200;res.setHeader('Content-Type',f.type);res.end(Buffer.from(f.body,'base64'));};
 if(publicFiles.includes(path)&&d.files[path])return serve(d.files[path]);
 if(!auth)return json(401,{error:'กรุณาใส่รหัสเข้าเว็บ'});
 if(path==='api/dashboard')return json(200,d.dashboard);
 if(path==='api/prizes')return json(200,d.prizes);
 if(/^api\/ep\/[1-4]$/.test(path))return json(200,{people:d.episodes[path.slice(-1)]});
 if((path.startsWith('media/')||path.startsWith('prizes/'))&&Object.hasOwn(d.files,path))return serve(d.files[path]);
 return json(404,{error:'ไม่พบรายการ'});
};
