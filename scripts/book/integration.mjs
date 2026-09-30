// Authorized smoke checks. Synthetic orders only. No outbound messages, payments or DHL submission.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base=process.env.BOOK_API||'https://oezzgzzqgsrpvjeesgva.supabase.co/functions/v1/book-store',id=()=>crypto.randomUUID(),checks=[],ids=[];let cookie='';
async function call(op,body={},admin=false,status=200,origin){const r=await fetch(`${base}?op=${op}`,{method:'POST',headers:{'Content-Type':'application/json',...(admin?{cookie}:{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,`${op}: ${JSON.stringify(data)}`);return {r,data};}
const ok=s=>{checks.push(s);console.log('PASS',s)};
const customer={first_name:'ทดสอบระบบ',last_name:'ห้ามจัดส่ง',phone:'0000000000',address:'ทดสอบระบบ ห้ามจัดส่ง 000',subdistrict:'สีลม',district:'บางรัก',province:'กรุงเทพมหานคร',postcode:'10500',note:'QA_BOOK_20260930 synthetic - DO NOT SHIP',analytics_consent:false,marketing_consent:false};
try{
 await call('admin',{},false,401);await call('order',{},false,403,'https://example.org');ok('unauthorized admin and cross-origin blocked');
 const login=await call('login',{email:process.env.BOOK_ADMIN_EMAIL,password:process.env.BOOK_ADMIN_PASSWORD});cookie=login.r.headers.get('set-cookie').split(';')[0];assert.match(login.r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);ok('owner login and secure session');
 await call('order',{...customer,key:id()+id(),package:'book',method:'cod',postcode:'99999'},false,400);ok('server validates address combination');
 const orderKey=id()+id(),input={...customer,key:orderKey,package:'book',method:'cod',amount:1};const [a,b]=await Promise.all([call('order',input),call('order',input)]);assert.equal(a.data.id,b.data.id);assert.equal(a.data.amount,345);ids.push(a.data.id);ok('concurrent idempotency and server-owned price');
 await call('status',{id:a.data.id,key:id()+id()},false,404);ok('order status requires customer capability');
 const tkey=id()+id(),t=(await call('order',{...customer,key:tkey,package:'bundle',method:'transfer'})).data;ids.push(t.id);assert.equal(t.amount,490);
 await call('change',{id:t.id,revision:0,action:'paid'},true,409);ok('cannot mark transfer paid before slip');
 await call('slip',{id:t.id,key:tkey,image:btoa('<svg>bad</svg>')},false,400);ok('non-image slip rejected');
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS0AAAAASUVORK5CYII=';
 const uploaded=(await call('slip',{id:t.id,key:tkey,image:png})).data;assert.equal(uploaded.payment_status,'review');
 const view=(await call('slip_view',{id:t.id},true)).data;const signed=await fetch(view.url);assert.equal(signed.status,200);const publicURL=new URL(view.url);publicURL.pathname=publicURL.pathname.replace('/object/sign/','/object/public/');publicURL.search='';assert.notEqual((await fetch(publicURL)).status,200);ok('slip private and signed URL works');
 let paid=(await call('change',{id:t.id,revision:1,action:'paid'},true)).data;assert.equal(paid.status,'ready');
 await call('change',{id:t.id,revision:1,action:'paid'},true,409);ok('stale revision and double payment blocked');
 let cod=(await call('change',{id:a.data.id,revision:0,action:'ready'},true)).data;
 const batchId=id(),exp=(await call('export',{id:batchId,ids},true)).data;assert.equal(exp.orders.length,2);const again=(await call('export',{id:batchId,ids},true)).data;assert.deepEqual(again,exp);await call('export',{id:id(),ids},true,409);ok('atomic export with retry recovery and no re-export');
 cod=(await call('change',{id:cod.id,revision:2,action:'shipped',data:{tracking:'QA-DO-NOT-SHIP-20260930'}},true)).data;
 await call('change',{id:cod.id,revision:cod.revision,action:'cod_collected'},true,409);
 cod=(await call('change',{id:cod.id,revision:cod.revision,action:'delivered'},true)).data;
 cod=(await call('change',{id:cod.id,revision:cod.revision,action:'cod_collected'},true)).data;assert.equal(cod.payment_status,'cod_collected');ok('COD money separate from shipment status');
 const report=(await call('admin',{},true)).data;assert(!JSON.stringify(report.orders).includes('idempotency_hash'));assert(!JSON.stringify(report.orders).includes('slip_hash'));ok('admin does not expose capability keys');
 const event={id:id(),session_id:id(),event:'page_view',consent:false};await call('event',event,false,400);ok('analytics rejects events without consent');
 globalThis.window={};await import('../../book-assets/export.js');const xlsx=window.bookExport.xlsx(exp.orders),csv=window.bookExport.csv(exp.orders);await fs.mkdir('qa-runs/book',{recursive:true});await fs.writeFile('qa-runs/book/export-test.xlsx',Buffer.from(await xlsx.arrayBuffer()));await fs.writeFile('qa-runs/book/export-test.csv',Buffer.from(await csv.arrayBuffer()));ok('XLSX and CSV generated');
 await call('logout',{},true);await call('admin',{},true,401);ok('logout revokes session');
}finally{await fs.mkdir('qa-runs/book',{recursive:true});await fs.writeFile('qa-runs/book/api-results.json',JSON.stringify({created_order_ids:ids,checks},null,2));console.log('QA_ORDER_IDS',ids.join(','));}
