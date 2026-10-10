// Loopback-only preview with isolated in-memory PostgreSQL; no real learner data.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {handler,cookie}=require('./ep3-test-db.cjs').setup(),root=path.resolve(__dirname,'..');
const routes={'/homework/gen4/ep3':'/homework-gen4-ep3.html','/homework/admin/ep3':'/homework-admin-ep3.html'};
http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost:4393');
  if(url.pathname.startsWith('/api/')){req.query=Object.fromEntries(url.searchParams);let body='';for await(const chunk of req)body+=chunk;req.body=body||{};
    if(url.pathname==='/api/student-story'){res.setHeader('Content-Type','application/json');res.setHeader('Set-Cookie',req.query.action==='logout'?'businessboy_student_story_admin=; Max-Age=0; Path=/':cookie+'; HttpOnly; Path=/; SameSite=Strict');return res.end('{"ok":true}');}
    if(url.pathname==='/api/homework-ep3')return handler(req,res);res.statusCode=404;return res.end('{}');
  }
  const file=path.resolve(root,'.'+(routes[url.pathname]||decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end('Not found');}
}).listen(4393,'127.0.0.1',()=>console.log('EP3 preview http://127.0.0.1:4393/homework/gen4/ep3'));
