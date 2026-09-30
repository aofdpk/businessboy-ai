// Server-side CRM. No direct browser access to private tables or activation codes.
type Context={db:any,fail:any,clean:any,uuid:any,hash:any,url:string,key:string,authHeaders:any};
const names:Record<string,string>={prompt_upgrade:'เพิ่มเว็บ Prompt ในหนังสือ',kcut_month:'KCUT 1 เดือน',kcut_year:'KCUT 1 ปี',kcut_lifetime:'KCUT ตลอดชีพ'};
export function createCRM(c:Context){
 const {db,fail,clean,uuid,hash,url,key,authHeaders}=c;
 async function paymentKey(id:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode('book-addon:'+id)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
 async function order(id:string,staff:any){if(!uuid(id))fail('ข้อมูลไม่ถูกต้อง');const o=(await db(`book_orders?id=eq.${id}&limit=1`))[0];if(!o)fail('ไม่พบออเดอร์',404);if(staff.role==='telesales'&&o.assigned_to!==staff.user_id)fail('รับงานนี้ก่อนเปิดรายละเอียด',403);return o;}
 async function addon(id:string,staff:any){if(!uuid(id))fail('ข้อมูลไม่ถูกต้อง');const a=(await db(`book_addons?id=eq.${id}&limit=1`))[0];if(!a)fail('ไม่พบรายการ',404);await order(a.order_id,staff);return a;}
 function safeOrder(o:any){const v={...o};delete v.idempotency_hash;delete v.slip_hash;delete v.slip_path;return v;}
 function safeAddon(a:any,staff:any){const v={...a};delete v.slip_hash;delete v.slip_path;if(!['owner','telesales'].includes(staff.role))delete v.activation_code;return v;}
 async function upload(a:any,image:any){
  if(a.method!=='transfer'||!['awaiting_slip','review'].includes(a.payment_status))fail('รายการนี้ไม่รับสลิปเพิ่ม');
  if(typeof image!=='string'||image.length>7000000)fail('รูปสลิปต้องไม่เกิน 5 MB');
  let b:Uint8Array;try{b=Uint8Array.from(atob(image),x=>x.charCodeAt(0));}catch{fail('อ่านรูปไม่ได้');}
  if(b!.length<16||b!.length>5242880)fail('ขนาดรูปไม่ถูกต้อง');
  let mime='',ext='';if(b![0]===255&&b![1]===216&&b![2]===255){mime='image/jpeg';ext='jpg';}else if(b![0]===137&&b![1]===80&&b![2]===78&&b![3]===71){mime='image/png';ext='png';}else if(String.fromCharCode(...b!.slice(0,4))==='RIFF'&&String.fromCharCode(...b!.slice(8,12))==='WEBP'){mime='image/webp';ext='webp';}else fail('ใช้รูป JPG, PNG หรือ WebP');
  const digest=await hash(b!),path=`addons/${a.id}/${crypto.randomUUID()}.${ext}`;
  if((await db(`book_orders?slip_hash=eq.${digest}&select=id&limit=1`)).length||(await db(`book_addons?slip_hash=eq.${digest}&id=neq.${a.id}&select=id&limit=1`)).length)fail('สลิปนี้ใช้กับรายการอื่นแล้ว');
  const r=await fetch(`${url}/storage/v1/object/book-slips/${path}`,{method:'POST',headers:{...authHeaders,'Content-Type':mime},body:new Uint8Array(b!)});if(!r.ok)fail('อัปโหลดไม่สำเร็จ',503);
  try{await db('rpc/book_addon_slip','POST',{p_id:a.id,p_revision:a.revision,p_path:path,p_hash:digest});}
  catch(e){await fetch(`${url}/storage/v1/object/book-slips`,{method:'DELETE',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});throw e;}
  return {ok:true};
 }
 return {
  async public(op:string,body:any){
   if(!['addon_status','addon_slip'].includes(op))return null;
   if(!uuid(body.id)||typeof body.key!=='string'||body.key.length!==64||body.key!==await paymentKey(body.id))fail('ลิงก์ไม่ถูกต้อง',404);
   const a=(await db(`book_addons?id=eq.${body.id}&limit=1`))[0];if(!a)fail('ไม่พบรายการ',404);
   if(op==='addon_slip')return await upload(a,body.image);
   const settings=(await db('book_sales_settings?id=eq.true'))[0];
   return {id:a.id,product:a.product,title:names[a.product],amount:a.amount,method:a.method,payment_status:a.payment_status,delivery_status:a.delivery_status,line_url:settings.line_url};
  },
  async staff(op:string,body:any,staff:any){
   if(op==='crm'){
    const result=await db('rpc/book_crm','POST',{p_actor:staff.user_id,p_page:Math.max(0,Math.min(100000,Math.floor(Number(body.page)||0))),p_view:clean(body.view,30),p_query:clean(body.query,100),p_days:Math.max(0,Math.min(366,Math.floor(Number(body.days)||0)))});
    if(staff.role==='telesales')for(const o of result.orders)if(!o.assigned_to){for(const k of ['phone','address','subdistrict','district','postcode','note','call_note','tracking'])delete o[k];o.addons=[];}
    return {...result,user:{id:staff.user_id,email:staff.email,username:staff.username,name:staff.display_name||staff.email,role:staff.role},sales_settings:(await db('book_sales_settings?id=eq.true'))[0]};
   }
   if(op==='crm_detail'){
    const o=await order(body.id,staff),addons=await db(`book_addons?order_id=eq.${o.id}&order=created_at.asc`);
    const audit=await db(`book_audit?order_id=eq.${o.id}&select=id,created_at,actor,action,details&order=created_at.desc&limit=50`);
    const people=await db('book_staff?select=user_id,display_name');
    return {order:safeOrder(o),addons:addons.map((a:any)=>safeAddon(a,staff)),audit:audit.map((a:any)=>({...a,actor_name:people.find((p:any)=>p.user_id===a.actor)?.display_name||'ระบบ'}))};
   }
   if(op==='sales_action'){
    if(!uuid(body.id)||!Number.isInteger(body.revision)||!['claim','assign','call','addon'].includes(body.action))fail('ข้อมูลไม่ถูกต้อง');
    if(body.action==='addon'&&!uuid(body.data?.id))fail('ข้อมูลสินค้าไม่ถูกต้อง');
    return await db('rpc/book_sales_action','POST',{p_id:body.id,p_revision:body.revision,p_actor:staff.user_id,p_action:body.action,p_data:body.data||{}});
   }
   if(op==='addon_action'){
    if(!uuid(body.id)||!Number.isInteger(body.revision))fail('ข้อมูลไม่ถูกต้อง');
    return safeAddon(await db('rpc/book_addon_action','POST',{p_id:body.id,p_revision:body.revision,p_actor:staff.user_id,p_action:clean(body.action,30),p_data:body.data||{}}),staff);
   }
   if(op==='addon_link'){
    if(!['owner','telesales','finance'].includes(staff.role))fail('ไม่มีสิทธิ์',403);
    const a=await addon(body.id,staff);if(a.method!=='transfer'||!['awaiting_slip','review'].includes(a.payment_status))fail('รายการนี้ไม่ต้องชำระผ่านลิงก์');
    return {url:`https://businessboy.ai/book-payment#${a.id}.${await paymentKey(a.id)}`};
   }
   if(op==='addon_staff_slip'){
    if(!['owner','telesales','finance'].includes(staff.role))fail('ไม่มีสิทธิ์',403);
    return await upload(await addon(body.id,staff),body.image);
   }
   if(op==='addon_slip_view'){
    if(!['owner','finance'].includes(staff.role))fail('เฉพาะฝ่ายการเงิน',403);
    const a=await addon(body.id,staff);if(!a.slip_path)fail('ยังไม่มีสลิป');
    const r=await fetch(`${url}/storage/v1/object/sign/book-slips/${a.slip_path}`,{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:120})});const v=await r.json();if(!r.ok)fail('เปิดสลิปไม่ได้');
    await db('book_audit','POST',{actor:staff.user_id,order_id:a.order_id,action:'view_addon_slip',details:{addon_id:a.id}});return {url:`${url}/storage/v1${v.signedURL}`};
   }
   if(op==='sales_settings'){
    if(staff.role!=='owner')fail('เฉพาะเจ้าของ',403);const out:any={};
    for(const k of ['line_url','kcut_url','kcut_guide_url']){out[k]=clean(body[k],1000);if(out[k]){try{const u=new globalThis.URL(out[k]);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{fail('ใช้ลิงก์ https ที่ถูกต้อง');}}}
    await db('book_sales_settings?id=eq.true','PATCH',out);await db('book_audit','POST',{actor:staff.user_id,action:'sales_settings'});return {ok:true};
   }
   return null;
  }
 };
}
