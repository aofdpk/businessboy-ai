// Isolated offline PostgreSQL/UI test server. Excluded from deployment.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');const pg=new PGlite();
function tag(strings,...values){const sql=strings.reduce((a,b,i)=>a+(i?'$'+i:'')+b,'');return {sql,values,then(resolve,reject){return pg.query(sql,values).then(x=>x.rows).then(resolve,reject);}};}
tag.transaction=queries=>pg.transaction(async tx=>{const out=[];for(const q of queries)out.push((await tx.query(q.sql,q.values)).rows);return out;});
const mod=require.resolve('@neondatabase/serverless');require.cache[mod]={id:mod,filename:mod,loaded:true,exports:{neon:()=>tag}};
process.env.STUDENT_STORY_DATABASE_URL='postgresql://local-ui-test';process.env.STUDENT_STORY_SECRET='local-ui-test-secret';
const handler=require('../api/kvid-assistant'),adminConfig=require('../api/_student-story-admin-config');
const root=path.resolve(__dirname,'..'),routes={'/kvid-assistant/register':'/kvid-assistant-register.html','/kvid-assistant':'/kvid-assistant.html','/kvid-assistant/admin':'/kvid-assistant-admin.html','/kvid-assistant/install':'/kvid-assistant-assets/install.txt'};
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost:4392');
 if(u.pathname.startsWith('/api/')){
  req.query=Object.fromEntries(u.searchParams);let text='';for await(const chunk of req)text+=chunk;req.body=text?JSON.parse(text):{};
  if(u.pathname==='/api/student-story'){
   if(req.query.action==='logout'){res.setHeader('Set-Cookie','businessboy_student_story_admin=; Path=/; Max-Age=0');res.end('{}');return;}
   if(req.body.password!=='qa-local-only'){res.statusCode=401;res.end('{"error":"รหัสไม่ถูกต้อง"}');return;}
   const exp=Date.now()+600000,sig=crypto.createHmac('sha256',process.env.STUDENT_STORY_SECRET).update('admin:'+exp+':'+adminConfig.digest).digest('base64url');res.setHeader('Set-Cookie',`businessboy_student_story_admin=${exp}.${sig}; Path=/; HttpOnly; SameSite=Strict`);res.end('{"ok":true}');return;
  }
  return handler(req,res);
 }
 const file=path.resolve(root,'.'+(routes[u.pathname]||decodeURIComponent(u.pathname)));if(!file.startsWith(root+path.sep)){res.statusCode=403;res.end();return;}
 try{const data=fs.readFileSync(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.txt':'text/plain; charset=utf-8','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('Not found');}
}).listen(Number(process.env.PORT||4392),'127.0.0.1',()=>console.log('KVID isolated test server on http://127.0.0.1:4392'));
