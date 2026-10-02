(() => {
 const button=document.querySelector('#meta-status-refresh'),output=document.querySelector('#meta-status-result');
 if(!button||!output)return;
 button.addEventListener('click',async()=>{
  button.disabled=true;output.textContent='กำลังตรวจ...';
  try{
   const r=await fetch('/api/book?op=measurement_status',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
   const data=await r.json();if(!r.ok)throw Error(data.error||'ตรวจสถานะไม่ได้');
   const states={pending:'รอส่ง',sending:'กำลังส่ง',sent:'Meta รับแล้ว',failed:'ส่งไม่สำเร็จ',skipped:'ไม่ส่ง',expired:'หมดอายุ'};
   const lines=[data.enabled?'เปิดส่งข้อมูลแล้ว':'ยังปิดการส่งข้อมูลจริง',`Pixel: ${data.pixel_id||'-'}`];
   for(const event of ['OrderSubmitted','Purchase']){
    const jobs=data.jobs.filter(j=>j.event_name===event);
    lines.push(`\n${event==='Purchase'?'รับเงินแล้ว (Purchase)':'สั่งซื้อแล้ว (OrderSubmitted)'}`);
    for(const [state,label] of Object.entries(states)){const rows=jobs.filter(j=>j.status===state);if(rows.length)lines.push(`${label}: ${rows.length} รายการ / ${rows.reduce((n,j)=>n+j.amount,0).toLocaleString('th-TH')} บาท`);}
    if(!jobs.length)lines.push('ยังไม่มีรายการ');
   }
   lines.push('\nแสดงไม่เกิน 1,000 เหตุการณ์ล่าสุด การรับข้อมูลของ Meta ยังไม่ใช่ยอดที่จับคู่กับแอดแล้ว');
   output.textContent=lines.join('\n');
  }catch(e){output.textContent=e.message;}finally{button.disabled=false;}
 });
})();
