// Read-only or denied API calls only. Synthetic export files never contain customer data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const base=process.env.BOOK_API||'https://businessboy.ai/api/book';
const password=process.env.BOOK_QA_PASSWORD;
assert(password,'Supply BOOK_QA_PASSWORD in the process environment');
const checks=[];
async function api(op,data={},cookie='',expected=200){
 const r=await fetch(base+'?op='+op,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});
 const v=await r.json();assert.equal(r.status,expected,`${op}: ${r.status} ${v.error||''}`);
 return {data:v,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
await api('crm',{},'',401);
for(const username of ['natlogis','muaylogis']){
 const {cookie}=await api('login',{email:username,password});
 try{
  const {data}=await api('crm',{},cookie);assert.equal(data.user.role,'fulfillment');assert.equal(data.sales_settings.telesales_enabled,false);
  for(const op of ['staff_list','settings','sales_action','addon_action','addon_link','sales_settings'])await api(op,{},cookie,403);
  await api('slip_view',{},cookie,403);
  const testId='030bcae3-c2fb-45d7-90ae-ef7334c8ee77';
  const fixture=(await api('crm_detail',{id:testId},cookie)).data.order;
  assert.equal(fixture.is_test,true);
  for(const action of ['paid','cod_collected','refunded'])await api('change',{id:testId,revision:fixture.revision,action},cookie,409);
  await api('export',{id:crypto.randomUUID(),ids:[testId]},cookie,409);
  await api('batches',{},cookie);
  for(const view of ['ready','exported','shipped','delivered'])await api('crm',{view},cookie);
  checks.push(username+': login, shipping scope, finance denial, test export exclusion');
 }finally{await api('logout',{},cookie);await api('crm',{},cookie,401);}
}
for(const email of ['boatadmin','aeadmin','armadmin','pookieadmin','gunadmin'])await api('login',{email,password},'',401);
checks.push('all five paused telesales usernames denied');
const {cookie}=await api('login',{email:process.env.BOOK_ADMIN_EMAIL,password});
try{await api('sales_action',{},cookie,403);await api('addon_action',{},cookie,403);await api('staff_create',{role:'telesales'},cookie,403);checks.push('owner cannot bypass paused sales APIs');}finally{await api('logout',{},cookie);}
await api('addon_status',{},'',403);
const context={window:{},TextEncoder,Blob};vm.runInNewContext(await fs.readFile('book-assets/export.js','utf8'),context);
const fixtures=['book','bundle'].flatMap((pkg,i)=>['transfer','cod'].map((method,j)=>({number:i*2+j+1,first_name:'ทดสอบ',last_name:'จัดส่ง',phone:'0812345678',address:'99 บ้านทดสอบ',subdistrict:'ทดสอบ',district:'ทดสอบ',province:'ทดสอบ',postcode:'01234',package:pkg,amount:pkg==='book'?345:490,method,payment_status:method==='cod'?'cod_pending':'paid',note:'=TEST_ONLY'})));
const ex=context.window.bookExport,rows=ex.rows(fixtures,'packing');
assert.equal(rows[0].length,17);assert.equal(rows[0][11],'สินค้าที่สั่ง');
assert.deepEqual(Array.from(rows.slice(1),r=>r[9]),[0,345,0,490]);
assert.equal(rows[3][13],'หนังสือ 1 เล่ม + ใบ QR เข้าเว็บ Prompt พร้อมวิธีใช้');
assert.equal(rows[1][2],'0812345678');assert.equal(rows[1][7],'01234');
await fs.mkdir('qa-runs/shipping',{recursive:true});
for(const mode of ['packing','carrier'])await fs.writeFile(`qa-runs/shipping/${mode}.xlsx`,Buffer.from(await ex.xlsx(fixtures,mode).arrayBuffer()));
const csv=await ex.csv(fixtures).text();assert(csv.includes("'=TEST_ONLY"));await fs.writeFile('qa-runs/shipping/carrier.csv',csv);
checks.push('345/490 × transfer/COD: products, inserts, payments, leading zeroes and CSV formula escaping');
await fs.writeFile('qa-runs/shipping/checks.json',JSON.stringify({at:new Date().toISOString(),checks},null,2));
checks.forEach(c=>console.log('PASS '+c));
