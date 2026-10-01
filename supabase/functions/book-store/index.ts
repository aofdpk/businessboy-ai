import { createCRM } from './crm.ts';
import addresses from './addresses.json' with { type: 'json' };
const URL = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const authHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const origins = new Set(['https://businessboy.ai','https://www.businessboy.ai','http://localhost:4310','https://businessboy-ai-git-feat-ai-book-checkout-20260930-businessboy.vercel.app','https://businessboy-j5036ydlv-businessboy.vercel.app']);
const encoder = new TextEncoder();
async function salesEnabled(){return (await db('book_sales_settings?id=eq.true&select=telesales_enabled'))[0]?.telesales_enabled===true;}
const hash = async (s: string | Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof s==='string'?encoder.encode(s):new Uint8Array(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const uuid = (s: unknown) => typeof s==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
const clean = (s: unknown,max=150) => typeof s==='string'?s.trim().replace(/[\x00-\x1f]/g,'').slice(0,max):'';
function fail(message: string,status=400): never { throw {message,status}; }
async function db(path: string,method='GET',body?: unknown) {
 const res=await fetch(`${URL}/rest/v1/${path}`,{method,headers:{...authHeaders,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json().catch(()=>null);
 if(!res.ok) { console.error('book_database_error',res.status,data?.code);fail(data?.code==='P0001'?data.message:'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่',409); }
 return data;
}
async function auth(path:string,body?:unknown){const r=await fetch(`${URL}/auth/v1/${path}`,{method:body?'POST':'GET',headers:{...authHeaders,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {ok:r.ok,data:await r.json()};}
function address(data:any){
 const out:any={}; for(const k of ['first_name','last_name','phone','address','subdistrict','district','province','postcode','note'])out[k]=clean(data[k],k==='note'||k==='address'?500:100);
 out.phone=out.phone.replace(/[\s-]/g,'');
 if(!out.first_name||!out.last_name||out.address.length<4||!/^0[0-9]{8,9}$/.test(out.phone))fail('กรุณาตรวจชื่อ นามสกุล เบอร์โทร และที่อยู่');
 if(!addresses.some((a:any)=>a[0]===out.subdistrict&&a[1]===out.district&&a[2]===out.province&&String(a[3])===out.postcode))fail('กรุณาเลือกตำบล อำเภอ จังหวัด และรหัสไปรษณีย์จากรายการ');
 return out;
}
function attribution(data:any){const out:any={};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(typeof data?.[k]==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(data[k]))out[k]=data[k];return out;}
function publicOrder(o:any){return {id:o.id,number:`BB${String(o.number).padStart(6,'0')}`,package:o.package,amount:o.amount,method:o.method,status:o.status,payment_status:o.payment_status,tracking:o.tracking,payment_note:o.payment_status==='awaiting_slip'?o.payment_note:''};}
async function capability(id:string,key:string){if(!uuid(id)||!key||key.length<32)fail('ไม่พบคำสั่งซื้อ',404);const o=(await db(`book_orders?id=eq.${id}&idempotency_hash=eq.${await hash(key)}&limit=1`))[0];if(!o)fail('ไม่พบคำสั่งซื้อ',404);return o;}
async function slip(o:any,data:any){
 if(o.method!=='transfer'||o.status!=='new'||!['awaiting_slip','review'].includes(o.payment_status))fail('ออเดอร์นี้ไม่รับสลิปเพิ่ม');
 if(typeof data.image!=='string'||data.image.length>7000000)fail('รูปสลิปต้องไม่เกิน 5 MB');
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(data.image),c=>c.charCodeAt(0));}catch{fail('อ่านรูปสลิปไม่ได้');}
 if(bytes!.length<16||bytes!.length>5242880)fail('รูปสลิปต้องไม่เกิน 5 MB');
 const b=bytes!;let mime='',ext='';
 if(b[0]===255&&b[1]===216&&b[2]===255){mime='image/jpeg';ext='jpg';}
 else if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71){mime='image/png';ext='png';}
 else if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'){mime='image/webp';ext='webp';}
 else fail('รับเฉพาะรูป JPG, PNG หรือ WebP');
 const digest=await hash(b),path=`${o.id}/${crypto.randomUUID()}.${ext}`;
 const duplicate=(await db(`book_orders?slip_hash=eq.${digest}&select=id&limit=1`))[0];
 if(duplicate&&duplicate.id!==o.id)fail('สลิปนี้ถูกใช้กับคำสั่งซื้ออื่นแล้ว');
 const upload=await fetch(`${URL}/storage/v1/object/book-slips/${path}`,{method:'POST',headers:{...authHeaders,'Content-Type':mime},body:new Uint8Array(b)});
 if(!upload.ok)fail('อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่',503);
 try{
 const changed=await db(`book_orders?id=eq.${o.id}&revision=eq.${o.revision}&status=eq.new&payment_status=in.(awaiting_slip,review)`,'PATCH',{slip_path:path,slip_hash:digest,payment_status:'review',revision:o.revision+1,updated_at:new Date().toISOString()});
 if(!changed.length)fail('ออเดอร์เปลี่ยนแล้ว กรุณาโหลดใหม่',409);
 await db('book_audit','POST',{order_id:o.id,action:'slip_uploaded'});return publicOrder(changed[0]);
 }catch(e){await fetch(`${URL}/storage/v1/object/book-slips`,{method:'DELETE',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});throw e;}
}
const crm=createCRM({db,fail,clean,uuid,hash,url:URL,key:KEY,authHeaders});
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')||'';
 const cors:Record<string,string>=origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Vary':'Origin'}:{};
 const headers:any={...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'}});
 try{
  if(origin&&!origins.has(origin))fail('ไม่อนุญาตต้นทาง',403);
  const u=new globalThis.URL(req.url),op=u.searchParams.get('op')||'config';
  if(req.method==='GET'&&op==='config')return respond({...(await db('book_settings?id=eq.true'))[0],bank:'TTB',account:'138-1-08218-7',company:'บริษัท เด็กประกอบการ จำกัด'});
  if(req.method!=='POST')fail('ใช้ POST',405);
  if(Number(req.headers.get('content-length'))>7200000)fail('ไฟล์ใหญ่เกินไป',413);
  // อ่านแบบมีเพดาน แม้ request ไม่มี Content-Length
  const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>7200000){await reader.cancel();fail('ไฟล์ใหญ่เกินไป',413);}chunks.push(value);}}
  const raw=new Uint8Array(size);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}let body:any;try{body=JSON.parse(new TextDecoder().decode(raw));}catch{fail('ข้อมูลไม่ถูกต้อง');}
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||req.headers.get('cf-connecting-ip')||'unknown';
  const key=await hash(`${KEY}:${new Date().toISOString().slice(0,10)}:${ip}:${op}:${op==='login'?clean(body.email,150).toLowerCase():''}`);
  if(op==='login'&&!await db('rpc/book_rate','POST',{p_key:await hash(`${KEY}:${ip}:login_global`),p_limit:60,p_seconds:600}))fail('ทำรายการถี่เกินไป กรุณารอสักครู่',429);
  const allowed=await db('rpc/book_rate','POST',{p_key:key,p_limit:op==='login'?12:op==='order'?25:240,p_seconds:600});if(!allowed)fail('ทำรายการถี่เกินไป กรุณารอสักครู่',429);
  if(op==='login'){
   let email=clean(body.email).toLowerCase();
   if(!email.includes('@')){if(!/^[a-z0-9_]{3,40}$/.test(email))fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',401);const member=(await db(`book_staff?username=eq.${email}&active=eq.true&limit=1`))[0];email=member?.email||'unknown@staff.businessboy.ai';}
   const signed=await auth('token?grant_type=password',{email,password:body.password});
   if(!signed.ok)fail('อีเมลหรือรหัสผ่านไม่ถูกต้อง',401);
   const staff=(await db(`book_staff?user_id=eq.${signed.data.user.id}&active=eq.true&limit=1`))[0];if(!staff)fail('บัญชีนี้ไม่มีสิทธิ์หลังบ้าน',403);
   if(staff.role==='telesales'&&!await salesEnabled())fail('พักระบบเทเลไว้ชั่วคราว',403);
   const token=crypto.randomUUID()+crypto.randomUUID();await db('book_sessions','POST',{token_hash:await hash(token),user_id:staff.user_id,expires_at:new Date(Date.now()+8*3600000).toISOString()});
   headers['Set-Cookie']=`bb_book_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/book; Max-Age=28800`;
   return respond({ok:true,user:{email:staff.email,role:staff.role}});
  }
  const publicCRM=await crm.public(op,body);if(publicCRM!==null)return respond(publicCRM);
  if(op==='order'){
   if(typeof body.key!=='string'||!/^[a-f0-9-]{72}$/.test(body.key))fail('กรุณาโหลดหน้าแล้วลองใหม่');
   const ih=await hash(body.key);const existing=(await db(`book_orders?idempotency_hash=eq.${ih}&limit=1`))[0];if(existing)return respond(publicOrder(existing));
   if(body.website)fail('ไม่สามารถทำรายการ');
   if(!['book','bundle'].includes(body.package)||!['cod','transfer'].includes(body.method))fail('กรุณาเลือกแพ็กเกจและวิธีชำระเงิน');
   const data={...address(body),idempotency_hash:ih,package:body.package,amount:body.package==='book'?345:490,method:body.method,payment_status:body.method==='cod'?'cod_pending':'awaiting_slip',utm:attribution(body.utm),analytics_consent:body.analytics_consent===true,marketing_consent:body.marketing_consent===true,session_id:uuid(body.session_id)?body.session_id:null};
   try{return respond(publicOrder((await db('book_orders','POST',data))[0]));}catch(e){const retry=(await db(`book_orders?idempotency_hash=eq.${ih}&limit=1`))[0];if(retry)return respond(publicOrder(retry));throw e;}
  }
  if(op==='slip')return respond(await slip(await capability(body.id,body.key),body));
  if(op==='status')return respond(publicOrder(await capability(body.id,body.key)));
  if(op==='event'){
   const allowedEvents=['page_view','section_view','select_package','checkout_start','form_error','payment_select','copy_account','save_qr','slip_uploaded','order_submitted','engagement','scroll'];
   if(body.consent!==true||!uuid(body.id)||!uuid(body.session_id)||!allowedEvents.includes(body.event))fail('ข้อมูลเหตุการณ์ไม่ถูกต้อง');
   const data:any={};for(const k of ['package','method','section','field'])if(typeof body.data?.[k]==='string'&&/^[a-z_]{1,40}$/.test(body.data[k]))data[k]=body.data[k];
   for(const k of ['seconds','percent'])if(Number.isFinite(body.data?.[k]))data[k]=Math.max(0,Math.min(k==='seconds'?86400:100,Math.round(body.data[k])));
   await db('book_events?on_conflict=id','POST',{id:body.id,event:body.event,session_id:body.session_id,data,utm:attribution(body.utm)});return respond({ok:true});
  }
  const token=req.headers.get('cookie')?.match(/(?:^|; )bb_book_session=([^;]+)/)?.[1]||req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  const sess=token?(await db(`book_sessions?token_hash=eq.${await hash(token)}&expires_at=gt.${new Date().toISOString()}&limit=1`))[0]:null;
  if(!sess)fail('กรุณาเข้าสู่ระบบ',401);
  const staff=(await db(`book_staff?user_id=eq.${sess.user_id}&active=eq.true&limit=1`))[0];if(!staff)fail('ไม่มีสิทธิ์',403);
  if(op==='logout'){await db(`book_sessions?token_hash=eq.${await hash(token)}`,'DELETE');headers['Set-Cookie']='bb_book_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/book; Max-Age=0';return respond({ok:true});}
  if(staff.role==='telesales'&&!await salesEnabled())fail('พักระบบเทเลไว้ชั่วคราว',403);
  if((op==='sales_action'||(op.startsWith('addon_')&&op!=='addon_slip_view')||op==='sales_settings')&&!await salesEnabled())fail('พักระบบเทเลและอัพเซลล์ไว้ชั่วคราว',403);
  const staffCRM=await crm.staff(op,body,staff);if(staffCRM!==null)return respond(staffCRM);
  if(staff.role==='telesales')fail('หน้าที่นี้สำหรับเจ้าของ การเงิน หรือจัดส่ง',403);
  if(op==='insert'){const value=(await db('book_private_settings?id=eq.true&select=prompt_code'))[0];if(!value?.prompt_code)fail('ยังไม่ได้ตั้งรหัสเว็บ Prompt');return respond({code:value.prompt_code});}
  if(op==='admin'){
   const page=Math.max(0,Math.min(100000,Number(body.page)||0));let filter='';if(['new','ready','shipped','delivered','cancelled','returned'].includes(body.status))filter=`&status=eq.${body.status}`;
   const orders=await db(`book_orders?select=*&is_test=eq.false${filter}&order=created_at.desc&limit=100&offset=${page*100}`);orders.forEach((o:any)=>{delete o.idempotency_hash;delete o.slip_hash;});
   return respond({user:{email:staff.email,role:staff.role},orders,metrics:await db('rpc/book_metrics','POST',{}),batches:await db('book_exports?is_test=eq.false&select=id,created_at&order=created_at.desc&limit=30'),settings:(await db('book_settings?id=eq.true'))[0]});
  }
  if(op==='finance_report'){
   if(!['owner','finance'].includes(staff.role))fail('เฉพาะบัญชีและการเงิน',403);
   for(const k of ['from','to'])if(body[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(body[k])||!Number.isFinite(Date.parse(body[k]))))fail('วันที่ไม่ถูกต้อง');
   const result=await db('rpc/book_finance','POST',{p_actor:staff.user_id,p_from:body.from||null,p_to:body.to||null,p_basis:body.basis||'ordered',p_view:body.view||'all',p_page:Math.max(0,Math.floor(Number(body.page)||0)),p_export:body.export===true});
   if(body.export===true)await db('book_audit','POST',{actor:staff.user_id,action:'finance_export',details:{from:body.from||null,to:body.to||null,basis:body.basis||'ordered',count:result.total}});
   return respond(result);
  }
  if(op==='change'){
   if(['ready','shipped','delivered','returned'].includes(body.action)&&staff.role==='finance')fail('เฉพาะฝ่ายจัดส่ง',403);
   if(!uuid(body.id)||!Number.isInteger(body.revision))fail('ข้อมูลไม่ถูกต้อง');
   const data=body.action==='edit'?address(body.data):{tracking:clean(body.data?.tracking,60),note:clean(body.data?.note,500)};
   return respond(await db('rpc/book_change','POST',{p_id:body.id,p_revision:body.revision,p_actor:staff.user_id,p_action:body.action,p_data:data}));
  }
  if(op==='export'){
   if(staff.role==='finance')fail('เฉพาะฝ่ายจัดส่ง',403);if(!uuid(body.id)||!Array.isArray(body.ids)||!body.ids.every(uuid))fail('ข้อมูลไม่ถูกต้อง');
   return respond(await db('rpc/book_export','POST',{p_id:body.id,p_ids:body.ids,p_actor:staff.user_id}));
  }
  if(op==='batches'){
   if(!['owner','fulfillment'].includes(staff.role))fail('เฉพาะฝ่ายจัดส่ง',403);
   const batches=await db('book_exports?is_test=eq.false&select=id,created_at,created_by,snapshot&order=created_at.desc&limit=100');
   const people=await db('book_staff?select=user_id,display_name,username');
   return respond(batches.map((b:any)=>({id:b.id,created_at:b.created_at,count:b.snapshot.length,created_by:people.find((p:any)=>p.user_id===b.created_by)?.display_name||people.find((p:any)=>p.user_id===b.created_by)?.username||'ทีมงาน'})));
  }
  if(op==='batch'){
   if(!['owner','fulfillment'].includes(staff.role))fail('เฉพาะฝ่ายจัดส่ง',403);
   if(!uuid(body.id))fail('ข้อมูลไม่ถูกต้อง');const b=(await db(`book_exports?id=eq.${body.id}&limit=1`))[0];if(!b)fail('ไม่พบรอบส่งออก',404);await db('book_audit','POST',{actor:staff.user_id,action:'download_batch',details:{batch:body.id}});return respond({id:b.id,orders:b.snapshot});
  }
  if(op==='audit'){if(!uuid(body.id))fail('ข้อมูลไม่ถูกต้อง');return respond(await db(`book_audit?order_id=eq.${body.id}&order=created_at.desc&limit=50`));}
  if(op==='settings'){
   if(staff.role!=='owner')fail('เฉพาะเจ้าของ',403);const s={ga4_id:clean(body.ga4_id,30),pixel_id:clean(body.pixel_id,30),clarity_id:clean(body.clarity_id,30)};
   if(s.ga4_id&&!/^G-[A-Z0-9]{5,20}$/.test(s.ga4_id)||s.pixel_id&&!/^\d{8,25}$/.test(s.pixel_id)||s.clarity_id&&!/^[a-z0-9]{5,25}$/.test(s.clarity_id))fail('รูปแบบ ID ไม่ถูกต้อง');
   await db('book_settings?id=eq.true','PATCH',s);await db('book_audit','POST',{actor:staff.user_id,action:'tracking_settings'});return respond({ok:true});
  }
  if(op==='staff_list'){if(staff.role!=='owner')fail('เฉพาะเจ้าของ',403);return respond(await db('book_staff?select=user_id,email,username,display_name,role,active'));}
  if(op==='staff_create'){
   if(staff.role!=='owner')fail('เฉพาะเจ้าของ',403);
   if(body.role==='telesales'&&!await salesEnabled())fail('พักการเพิ่มทีมเทเลไว้ก่อน',403);
   const username=clean(body.username,40).toLowerCase(),display_name=clean(body.display_name,100),email=username?`${username}@staff.businessboy.ai`:clean(body.email).toLowerCase();
   if(!['finance','fulfillment','telesales'].includes(body.role)||(username&&!/^[a-z0-9_]{3,40}$/.test(username))||!/^\S+@\S+\.\S+$/.test(email)||typeof body.password!=='string'||body.password.length<8)fail('ตรวจชื่อผู้ใช้และใช้รหัสผ่านอย่างน้อย 8 ตัว');
   if((await db(`book_staff?email=eq.${encodeURIComponent(email)}&limit=1`)).length)fail('ชื่อผู้ใช้นี้มีอยู่แล้ว');
   const created=await auth('admin/users',{email,password:body.password,email_confirm:true});if(!created.ok)fail('เพิ่มบัญชีไม่สำเร็จ ชื่อนี้อาจมีบัญชีอยู่แล้ว');
   try{await db('book_staff','POST',{user_id:created.data.id,email,username:username||null,display_name,role:body.role});}
   catch(e){await fetch(`${URL}/auth/v1/admin/users/${created.data.id}`,{method:'DELETE',headers:authHeaders});throw e;}
   await db('book_audit','POST',{actor:staff.user_id,action:'staff_created',details:{user_id:created.data.id,role:body.role}});return respond({ok:true});
  }
  if(op==='staff_disable'){if(staff.role!=='owner'||!uuid(body.id)||body.id===staff.user_id)fail('ไม่อนุญาต',403);await db(`book_staff?user_id=eq.${body.id}&role=neq.owner`,'PATCH',{active:false});await db('book_audit','POST',{actor:staff.user_id,action:'staff_disabled',details:{user_id:body.id}});return respond({ok:true});}
  fail('ไม่พบคำสั่ง',404);
 }catch(e:any){return respond({error:e?.status?e.message:'ระบบขัดข้องชั่วคราว กรุณาลองใหม่'},e?.status||500);}
});
