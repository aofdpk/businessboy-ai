const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {database,handler,cookie}=require('./ep3-test-db.cjs').setup();
const evidence=[];const pass=name=>{evidence.push(name);console.log('PASS '+name);};
async function req(action,body,auth=false,query={}){let result;await handler({method:body?'POST':'GET',query:{action,...query},body,headers:{host:'localhost:4393',origin:'http://localhost:4393','content-type':'application/json',...(auth?{cookie}:{})}},{setHeader(){},end(text){result={status:this.statusCode,data:action==='export'&&this.statusCode===200?text:JSON.parse(text)};}});return result;}
const input=n=>({requestId:crypto.randomUUID(),fullName:'ทดสอบระบบ Gen4 EP3 — ไม่ใช่นักเรียน',phone:'0000000000',facebookName:'QA EP3',generation:4,pageName:'QA EP3 ทดสอบระบบเท่านั้น '+n,pageUrl:'https://www.facebook.com/qaep3test'+n,pageCreatedDate:'2026-10-11',website:''});
(async()=>{try{
  const a=input(1),b=input(2),c=input(3);let result=await req('submit',a);assert.equal(result.status,201,JSON.stringify(result));pass('PostgreSQL schema and early page registration');
  assert.equal((await req('submit',a)).status,200);assert.equal((await req('submit',{...a,pageName:'changed'})).status,409);pass('idempotent receipt and changed payload rejected');
  assert.equal((await req('submit',{...a,requestId:crypto.randomUUID(),pageUrl:'https://m.facebook.com/QAEP3TEST1/?fbclid=test'})).status,409);pass('duplicate page aliases rejected');
  const raced=await Promise.all([req('submit',b),req('submit',c),req('submit',input(4))]);assert.equal(raced.filter(r=>r.status===201).length,2);assert.equal(raced.filter(r=>r.status===409).length,1);pass('three-page cap holds for parallel submissions');
  result=await req('list',undefined,true);assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.total,1);assert.equal(result.data.rows.length,3);assert.ok(result.data.rows.every(r=>r.page_count===3&&!('ip_hash'in r)&&!('payload_hash'in r)));pass('private grouping includes all three pages and hides hashes');
  const rev={id:a.requestId,version:0,status:'complete',dailyClips:[{date:'2026-10-11',count:5}],dateVerified:true,scenesVerified:true,dailyVerified:true,note:'ตรวจวันที่ 11 ตุลาคม'};
  assert.equal((await req('review',rev,true)).status,200);assert.equal((await req('review',rev,true)).status,409);pass('daily evidence review and stale-write conflict');
  const filtered=await req('list',undefined,true,{status:'complete'});assert.equal(filtered.data.rows.length,3);assert.equal(filtered.data.rows[0].complete_count,1);pass('status filter retains complete learner group');
  const exported=await req('export',undefined,true);assert.equal(exported.status,200);assert.ok(exported.data.includes('2026-10-11: 5'));assert.ok(exported.data.startsWith('\ufeff'));pass('Thai CSV contains daily evidence');
  const d={...input('other'),phone:'0111111111',fullName:'Synthetic other',pageUrl:a.pageUrl};assert.equal((await req('submit',d)).status,201);result=await req('list',undefined,true,{search:'0000000000'});assert.equal(result.data.total,1);assert.equal(result.data.rows.find(r=>r.id===a.requestId).page_owner_count,2);pass('search and cross-learner duplicate warning');
  assert.equal((await req('archive-test',{id:d.requestId},true)).status,404);for(const row of result.data.rows)assert.equal((await req('archive-test',{id:row.id},true)).status,200);pass('QA archive restricted to synthetic records');
  assert.equal((await req('list')).status,401);assert.equal((await req('export')).status,401);pass('anonymous records and export inaccessible');
  console.log(JSON.stringify({passed:evidence.length}));
}finally{await database.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
