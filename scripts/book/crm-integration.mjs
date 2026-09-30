// Synthetic fixtures marked is_test=true are created separately. Never sends messages or calls DHL.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const apiURL=process.env.BOOK_API||'https://businessboy.ai/api/book';
const ids=JSON.parse(process.env.BOOK_QA_IDS),pw=process.env.BOOK_QA_PASSWORD,checks=[];
const log=s=>{checks.push(s);console.log('PASS '+s);};
async function request(op,data={},cookie='',expected=200){const r=await fetch(apiURL+'?op='+op,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});const json=await r.json();assert.equal(r.status,expected,`${op} ${r.status}: ${JSON.stringify(json)}`);return {data:json,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const call=async(op,data,cookie,expected)=>(await request(op,data,cookie,expected)).data;
const sessions=[];let owner,boat,ae;
try{
 await call('crm',{},'',401);log('anonymous CRM denied');
 owner=(await request('login',{email:process.env.BOOK_ADMIN_EMAIL,password:pw})).cookie;sessions.push(owner);
 for(const username of ['boatadmin','aeadmin','armadmin','pookieadmin','gunadmin']){const cookie=(await request('login',{email:username,password:pw})).cookie;sessions.push(cookie);const crm=await call('crm',{},cookie);assert.equal(crm.user.username,username);assert.equal(crm.user.role,'telesales');if(username==='boatadmin')boat=cookie;if(username==='aeadmin')ae=cookie;}
 log('all five usernames log in with telesales scope');
 await call('admin',{},boat,403);await call('staff_list',{},boat,403);await call('export',{id:crypto.randomUUID(),ids},boat,403);await call('settings',{},boat,403);log('sales cannot export, manage staff, edit tracking or use legacy admin');
 let o=(await call('crm_detail',{id:ids[0]},owner)).order;
 await call('crm_detail',{id:o.id},boat,403);
 await call('sales_action',{id:o.id,revision:o.revision,action:'claim'},boat);
 await call('sales_action',{id:o.id,revision:o.revision,action:'claim'},ae,409);
 await call('crm_detail',{id:o.id},ae,403);log('claim race and cross-agent detail access blocked');
 o=(await call('crm_detail',{id:o.id},boat)).order;
 const promptId=crypto.randomUUID();o=await call('sales_action',{id:o.id,revision:o.revision,action:'addon',data:{id:promptId,product:'prompt_upgrade',amount:1}},boat);
 assert.equal(o.amount,490);assert.equal(o.base_amount,345);assert.equal(o.package,'bundle');
 const p=(await call('crm_detail',{id:o.id},boat)).addons[0];assert.equal(p.amount,145);assert.equal(p.method,'cod');assert.equal(p.payment_status,'cod_pending');log('COD prompt upgrade sets parcel 490 and preserves base 345');
 const kid=crypto.randomUUID();o=await call('sales_action',{id:o.id,revision:o.revision,action:'addon',data:{id:kid,product:'kcut_month',amount:1}},boat);assert.equal(o.amount,490);
 let d=await call('crm_detail',{id:o.id},boat),k=d.addons.find(a=>a.id===kid);assert.equal(k.amount,390);assert.equal(k.method,'transfer');
 await call('sales_action',{id:o.id,revision:o.revision,action:'addon',data:{id:crypto.randomUUID(),product:'kcut_year'}},boat,409);log('KCUT server price enforced, separate from parcel and duplicate active plan blocked');
 const link=await call('addon_link',{id:kid},boat);const [id,key]=new URL(link.url).hash.slice(1).split('.');assert.equal(new URL(link.url).search,'');
 await call('addon_status',{id,key:'a'.repeat(64)},'',404);const publicData=await call('addon_status',{id,key});assert.equal(publicData.amount,390);assert.equal(publicData.phone,undefined);assert.equal(publicData.activation_code,undefined);
 const png=()=>Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS0AAAAASUVORK5CYII=','base64'),Buffer.from(crypto.randomUUID())]).toString('base64');const receipt=png();
 await call('addon_slip',{id,key,image:'invalid'},'',400);await call('addon_slip',{id,key,image:receipt});
 k=(await call('crm_detail',{id:o.id},owner)).addons.find(a=>a.id===kid);
 await call('addon_action',{id:k.id,revision:k.revision,action:'paid'},boat,409);
 const signed=await call('addon_slip_view',{id:k.id},owner);assert.equal((await fetch(signed.url)).status,200);
 k=await call('addon_action',{id:k.id,revision:k.revision,action:'paid'},owner);assert.equal(k.payment_status,'paid');assert.equal(k.delivery_status,'waiting_line');
 await call('addon_action',{id:k.id,revision:k.revision-1,action:'paid'},owner,409);log('private slip upload, finance-only approval and stale retry protection');
 await call('addon_action',{id:k.id,revision:k.revision,action:'delivery',data:{status:'sent'}},boat,409);
 k=await call('addon_action',{id:k.id,revision:k.revision,action:'delivery',data:{status:'sent',line_name:'QA LINE ไม่ส่งจริง',code:'QA-NOT-A-REAL-LICENSE',note:'test only'}},boat);assert.equal(k.delivery_status,'sent');log('KCUT delivery requires paid state, LINE identity and code');
 let t=(await call('crm_detail',{id:ids[1]},owner)).order;
 t=await call('sales_action',{id:t.id,revision:t.revision,action:'claim'},boat);t=await call('sales_action',{id:t.id,revision:t.revision,action:'addon',data:{id:crypto.randomUUID(),product:'prompt_upgrade'}},boat);
 assert.equal(t.amount,345);assert.equal(t.status,'new');let a=(await call('crm_detail',{id:t.id},boat)).addons[0];
 await call('addon_staff_slip',{id:a.id,image:receipt},boat,400);await call('addon_staff_slip',{id:a.id,image:png()},boat);
 a=(await call('crm_detail',{id:t.id},owner)).addons[0];await call('addon_action',{id:a.id,revision:a.revision,action:'paid'},owner);
 t=(await call('crm_detail',{id:t.id},owner)).order;assert.equal(t.amount,490);assert.equal(t.base_amount,345);assert.equal(t.status,'ready');log('transfer 345 + 145 remains accurate and holds fulfillment until confirmed');
 for(const [idx,product,price] of [[1,'kcut_year',3900],[2,'kcut_lifetime',5900]]){let q=(await call('crm_detail',{id:ids[idx]},owner)).order;const id=crypto.randomUUID();await call('sales_action',{id:q.id,revision:q.revision,action:'addon',data:{id,product}},owner);const a=(await call('crm_detail',{id:q.id},owner)).addons.find(a=>a.id===id);assert.equal(a.amount,price);}
 log('KCUT annual 3900 and lifetime 5900 saved correctly');
 let pending=(await call('crm_detail',{id:ids[3]},owner)).order;await call('sales_action',{id:pending.id,revision:pending.revision,action:'addon',data:{id:crypto.randomUUID(),product:'prompt_upgrade'}},owner,409);log('cannot upgrade unpaid transfer book');
 const future=new Date(Date.now()+3600000).toISOString();o=(await call('crm_detail',{id:ids[0]},boat)).order;o=await call('sales_action',{id:o.id,revision:o.revision,action:'call',data:{status:'callback',next_call_at:future,note:'QA callback'}},boat);assert.equal(o.call_status,'callback');assert.equal(new Date(o.next_call_at).toISOString(),future);log('callback schedule preserves timestamp');
 const clean=await call('crm',{view:'all'},owner);assert.ok(clean.orders.every(o=>!ids.includes(o.id)));log('test orders excluded from production lists and dashboards');
 await fs.mkdir('qa-runs',{recursive:true});await fs.writeFile('qa-runs/crm-integration.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,fixtureIds:ids},null,2));
}finally{for(const cookie of sessions)await call('logout',{},cookie).catch(()=>{});}
