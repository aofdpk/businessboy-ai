const crypto = require('node:crypto');
const config = require('./_awards-admin-config');
const COOKIE = 'businessboy_awards_admin';
const attempts = new Map();
const equal = (a,b) => Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const secret = () => process.env.GEN3_SESSION_SECRET || process.env.SESSION_SECRET || '';
const sign = expiry => crypto.createHmac('sha256',secret()).update('awards-admin-v1\n'+expiry+'\n'+config.digest).digest('base64url');
function authenticated(req) {
  if (!secret()) return false;
  try {
    const raw=String(req.headers.cookie||'').split(';').find(p=>p.trim().startsWith(COOKIE+'='));
    if(!raw)return false;
    const parts=decodeURIComponent(raw.trim().slice(COOKIE.length+1)).split('.');
    if(parts.length!==2 || !/^\d{13}$/.test(parts[0]) || Number(parts[0])<=Date.now() || Number(parts[0])>Date.now()+43200001)return false;
    return equal(parts[1],sign(parts[0]));
  } catch { return false; }
}
const login=`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>หลังบ้านรางวัล · เด็กประกอบการ</title><style>body{margin:0;background:#101f34;color:#fff;font:18px system-ui;display:grid;min-height:100vh;place-items:center}form{width:min(380px,80vw);padding:32px;border:1px solid #766844;border-radius:24px}h1{font-size:28px}label,input,button{display:block;width:100%;box-sizing:border-box}input,button{font:inherit;padding:14px;border-radius:10px;margin:12px 0;border:0}button{background:#e5c681;color:#101f34;cursor:pointer}a{color:#e5c681}#message{color:#ffd0b3}</style><form id="login"><h1>หลังบ้านรางวัล รุ่น 3</h1><p>สำหรับผู้ดูแลประกาศรางวัล</p><label for="password">รหัสผ่านผู้ดูแล</label><input id="password" type="password" autocomplete="current-password" required><button>เข้าสู่ระบบ</button><p id="message" role="alert"></p><a href="/gen3-awards">กลับหน้าประกาศ</a></form><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const r=await fetch('/api/gen3-awards-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.querySelector('input').value})});if(r.ok)location.reload();else document.querySelector('#message').textContent='เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจรหัสผ่านแล้วลองใหม่'}catch{document.querySelector('#message').textContent='เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่'}finally{b.disabled=false}}</script></html>`;
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store, no-cache, must-revalidate');
  res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff');
  const asset=typeof req.query?.asset==='string'?req.query.asset:'';
  const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
  if(asset==='blocked')return json(404,{error:'Not found'});
  if(!['GET','POST','DELETE'].includes(req.method))return json(405,{error:'Method not allowed'});
  if(req.method!=='GET'){
    try{if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'Forbidden'});}catch{return json(403,{error:'Forbidden'});}
  }
  if(req.method==='DELETE'){res.setHeader('Set-Cookie',COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return json(200,{ok:true});}
  if(req.method==='POST'){
    if(!secret())return json(503,{error:'Unavailable'});
    const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];let entry=attempts.get(ip);
    if(!entry||Date.now()-entry.start>600000){entry={start:Date.now(),count:0};attempts.set(ip,entry);}
    if(++entry.count>10)return json(429,{error:'Try later'});
    if(attempts.size>5000)for(const [key,v]of attempts)if(Date.now()-v.start>600000)attempts.delete(key);
    let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return json(400,{error:'Invalid request'});}
    if(typeof body?.password!=='string'||body.password.length>256)return json(401,{error:'Unauthorized'});
    const digest=crypto.scryptSync(body.password,config.salt,64).toString('hex');
    if(!equal(digest,config.digest))return json(401,{error:'Unauthorized'});
    attempts.delete(ip);const expiry=String(Date.now()+43200000);
    res.setHeader('Set-Cookie',COOKIE+'='+expiry+'.'+sign(expiry)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200');return json(200,{ok:true});
  }
  if(!authenticated(req)){
    if(asset)return json(401,{error:'Unauthorized'});
    res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(login);
  }
  const data=require('./_awards-private').read();
  if(asset==='person'){
    const id=req.query?.id;if(typeof id!=='string'||!/^P[0-9a-f]{16}$/.test(id)||!data.people[id])return json(404,{error:'Not found'});
    return json(200,data.people[id]);
  }
  if(asset==='results'||asset==='winners')return json(200,data[asset]);
  if(asset==='script'){res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end(data.script);}
  if(asset)return json(404,{error:'Not found'});
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(data.html);
};
