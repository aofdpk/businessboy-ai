// No Pixel, third-party script, advertising cookie, or page-view beacon.
// The server enables this only after the lawful-basis review and CAPI setup.
(() => {
 'use strict';
 const version='book-meta-20261002-v1';
 let active=false, objected=false, fbc=null;
 try{objected=localStorage.getItem('bb_book_measurement_objected')==='1';}catch{}
 if(navigator.globalPrivacyControl===true || navigator.doNotTrack==='1')objected=true;
 const info=document.querySelector('#measurement-notice');
 const details=document.querySelector('#measurement-details');
 const button=document.querySelector('#measurement-object');
 const result=document.querySelector('#measurement-result');
 function update(){if(button)button.disabled=objected;if(result&&objected)result.textContent='ปิดการส่งข้อมูลวัดผลบนเบราว์เซอร์นี้แล้ว สั่งซื้อได้ตามปกติ';}
 window.BookMeasurement={payload(){return active ? {notice_version:version,objected,gpc:navigator.globalPrivacyControl===true,fbc:objected?null:fbc} : undefined;}};
 if(button)button.addEventListener('click',async()=>{
  objected=true;fbc=null;try{localStorage.setItem('bb_book_measurement_objected','1');}catch{}
  update();
  try{
   const order=JSON.parse(sessionStorage.getItem('bb_book_order')||'null');
   const key=sessionStorage.getItem('bb_book_key');
   if(order?.id&&key){
    const r=await fetch('/api/book?op=measurement_object',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:order.id,key})});
    if(!r.ok)throw Error();
    result.textContent='ปิดการส่งข้อมูลเพิ่มเติมสำหรับคำสั่งซื้อนี้และเบราว์เซอร์นี้แล้ว';
   }
  }catch{result.textContent='ปิดบนเบราว์เซอร์นี้แล้ว หากสั่งซื้อไปแล้ว กรุณาติดต่อเพจให้หยุดส่งข้อมูลเพิ่มเติมของออเดอร์เดิม';}
 });
 fetch('/api/book?op=measurement_config',{cache:'no-store',signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null).then(cfg=>{
  if(cfg?.enabled!==true||cfg.notice_version!==version||!info||!details)return;
  info.hidden=false;details.hidden=false;active=true;
  if(!objected){const id=new URL(location.href).searchParams.get('fbclid');if(id&&/^[A-Za-z0-9_-]{10,500}$/.test(id))fbc=`fb.1.${Date.now()}.${id}`;}
  update();
 }).catch(()=>{});
})();
