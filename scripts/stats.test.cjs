const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
function setup({utm=true}={}){
 const cache=new Map(),counts=new Map(),calls=[];
 const sql=async(parts,...values)=>{const q=parts.join('?');if(q.includes('INSERT INTO bb_stats_limits')){const n=(counts.get(values[0])||0)+1;counts.set(values[0],n);return[{count:n}];}if(q.includes('SELECT payload'))return cache.has(values[0])?[{payload:cache.get(values[0])}]:[];if(q.includes('INSERT INTO bb_stats_cache'))cache.set(values[0],JSON.parse(values[1]));return[];};
 const salt='unit-test-only',digest=crypto.scryptSync('correct-test-password',salt,64).toString('hex');
 let code=fs.readFileSync(path.join(__dirname,'../api/stats.js'),'utf8').replace(/const SALT = '[^']+';/,`const SALT = '${salt}';`).replace(/const DIGEST = '[^']+';/,`const DIGEST = '${digest}';`);
 const context={module:{exports:{}},require:n=>n==='@neondatabase/serverless'?{neon:()=>sql}:require(n),Buffer,URL,AbortSignal,console,Date,process:{env:{SESSION_SECRET:'unit-test-signing-secret',STATS_DATABASE_URL:'postgres://test',STATS_VERCEL_TOKEN:'unit-test-token'}},fetch:async(url)=>{calls.push(url.href);const u=new URL(url);const by=u.searchParams.get('by');if(!utm&&(by.startsWith('utm')||u.searchParams.get('filter').includes('utmSource')))return{ok:false,status:402,json:async()=>({error:{message:'UTM dimensions require an Enterprise plan or the Web Analytics Plus add-on.'}})};const event=u.pathname.includes('/events/');return{ok:true,json:async()=>({data:event?by==='eventName'?[{eventName:'gen4_line_click',count:4,visitors:2}]:[]:by==='hour'?[{timestamp:'2026-09-22T18:00:00Z',pageviews:5,visitors:3}]:[{[by]:'production',pageviews:20,visitors:10}]})};}};
 vm.runInNewContext(code,context);return{handler:context.module.exports,counts,calls,helpers:context.module.exports._test};
}
async function request(handler,{method='GET',query={},body,headers={}}={}){
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};
 await handler({method,query,body,headers:{host:'businessboy.ai',...headers},socket:{remoteAddress:'127.0.0.1'}},response);return response;
}
test('unauthenticated and forged sessions cannot access statistics',async()=>{
 const {handler,calls}=setup();for(const cookie of ['', '__Host-bb_stats=9999999999999.fake']){const r=await request(handler,{headers:{cookie}});assert.equal(r.statusCode,401);assert.equal(r.headers['Cache-Control'],'private, no-store');}assert.equal(calls.length,0);
});
test('login uses secure session; logout expires it; cross-origin login denied',async()=>{
 const {handler}=setup(),headers={origin:'https://businessboy.ai','content-type':'application/json'};
 let r=await request(handler,{method:'POST',query:{action:'login'},headers:{...headers,origin:'https://attacker.test'},body:{password:'correct-test-password'}});assert.equal(r.statusCode,403);
 r=await request(handler,{method:'POST',query:{action:'login'},headers,body:{password:'wrong'}});assert.equal(r.statusCode,401);
 r=await request(handler,{method:'POST',query:{action:'login'},headers,body:{password:'correct-test-password'}});assert.equal(r.statusCode,200);
 assert.match(r.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);const cookie=r.headers['Set-Cookie'].split(';')[0];
 r=await request(handler,{query:{action:'session'},headers:{cookie}});assert.equal(r.statusCode,200);
 r=await request(handler,{method:'POST',query:{action:'logout'},headers,body:{}});assert.match(r.headers['Set-Cookie'],/Max-Age=0/);
});
test('distributed login rate limiting blocks repeated attempts',async()=>{
 const {handler}=setup();let r;for(let i=0;i<11;i++)r=await request(handler,{method:'POST',query:{action:'login'},headers:{origin:'https://businessboy.ai','content-type':'application/json'},body:{password:''}});assert.equal(r.statusCode,429);
});
test('Bangkok day boundaries and hourly chart rollup are correct',()=>{
 const {helpers:h}=setup(),now=Date.parse('2026-09-23T02:00:00Z');const range=h.period(1,now);assert.equal(range.since,'2026-09-22T17:00:00.000Z');
 const points=h.trend([{timestamp:'2026-09-22T18:00:00Z',pageviews:5},{timestamp:'2026-09-23T01:00:00Z',pageviews:3}],range);assert.equal(points[0].date,'2026-09-23');assert.equal(points[0].views,8);
 assert.throws(()=>h.period(1000),/รองรับ/);assert.throws(()=>h.filters("all' or true",false),/รองรับ/);
});
test('authenticated report uses fixed project, production filter and cache',async()=>{
 const {handler,calls}=setup();const auth=await request(handler,{method:'POST',query:{action:'login'},headers:{origin:'https://businessboy.ai','content-type':'application/json'},body:{password:'correct-test-password'}});const headers={cookie:auth.headers['Set-Cookie'].split(';')[0]};
 const r=await request(handler,{headers,query:{days:'7',scope:'gen4'}});assert.equal(r.statusCode,200);assert.equal(r.body.totals.views,20);assert.equal(r.body.totals.lineClicks,4);assert.equal(r.body.totals.clickRate,20);assert.equal(calls.length,10);
 for(const call of calls){const u=new URL(call);assert.equal(u.hostname,'api.vercel.com');assert.equal(u.searchParams.get('projectId'),'prj_GQAb9h8tzmAnXtaCnTedFtfwhYua');assert.match(u.searchParams.get('filter'),/environment eq 'production'/);assert.match(u.searchParams.get('filter'),/utmSource ne 'qa'/);}
 await request(handler,{headers,query:{days:'7',scope:'gen4'}});assert.equal(calls.length,10);
});

test('base plan still shows real analytics when UTM is unavailable',async()=>{
 const {handler,calls}=setup({utm:false});const auth=await request(handler,{method:'POST',query:{action:'login'},headers:{origin:'https://businessboy.ai','content-type':'application/json'},body:{password:'correct-test-password'}});
 const r=await request(handler,{headers:{cookie:auth.headers['Set-Cookie'].split(';')[0]},query:{days:'7',scope:'gen4'}});assert.equal(r.statusCode,200);assert.equal(r.body.features.utm,false);assert.equal(r.body.includeTests,true);assert.equal(r.body.totals.visitors,10);assert.equal(calls.length,9);for(const call of calls.slice(1))assert.doesNotMatch(new URL(call).searchParams.get('filter'),/utmSource/);
});
test('custom event dimensions preserve section and package labels',()=>{
 const {helpers:h}=setup();
 for(const row of [{'eventData/section':'packages'},{'eventData.section':'packages'},{eventData:{section:'packages'}},{eventData:'packages'}])assert.equal(h.rows([row],'eventData/section')[0].label,'packages');
 assert.equal(h.rows([{'eventData/package':'1_year',count:2}],'eventData/package')[0].label,'1_year');
});
