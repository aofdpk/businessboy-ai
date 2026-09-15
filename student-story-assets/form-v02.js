(() => {
  'use strict';
  const form=document.getElementById('application-form'), picker=document.getElementById('proofs'), previews=document.getElementById('image-previews');
  const message=document.getElementById('form-message'), submit=document.getElementById('submit-button');
  let files=[], busy=false, draftToken=null, receipt=null;
  const api='/api/student-story';
  function tell(text,progress=false){message.textContent=text;message.classList.toggle('progress',progress);}
  async function request(action,body){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000);
    try{const r=await fetch(api+'?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const d=await r.json();if(!r.ok){const e=new Error(d.error||'ส่งไม่สำเร็จ กรุณาลองใหม่');e.status=r.status;throw e;}return d;}
    catch(e){if(e.name==='AbortError')throw new Error('การเชื่อมต่อใช้เวลานาน กรุณากดส่งอีกครั้ง ข้อมูลของคุณยังอยู่');throw e;}
    finally{clearTimeout(timeout);}
  }
  function render(){
    previews.replaceChildren();
    files.forEach((f,index)=>{
      const item=document.createElement('div');item.className='proof-item';
      const view=document.createElement('button');view.type='button';view.className='proof-image-button';view.setAttribute('aria-label','ขยายรูปผลงานที่ '+(index+1));
      const img=document.createElement('img');img.src=f.url;img.alt='รูปผลงานที่ '+(index+1);view.append(img);
      view.onclick=()=>{document.getElementById('preview-full').src=f.url;document.getElementById('preview-dialog').showModal();};
      const remove=document.createElement('button');remove.type='button';remove.className='proof-remove';remove.textContent='×';remove.setAttribute('aria-label','ลบรูปที่ '+(index+1));remove.disabled=busy;
      remove.onclick=()=>{URL.revokeObjectURL(f.url);files.splice(index,1);render();};
      const status=document.createElement('p');status.className='proof-status'+(f.error?' error':f.uploaded?' done':'');status.textContent=f.error||f.status||(f.uploaded?'อัปโหลดแล้ว':'พร้อมส่ง');
      item.append(view,remove,status);previews.append(item);
    });
  }
  const readData=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('อ่านรูปไม่สำเร็จ กรุณาเลือกรูปอีกครั้ง'));r.readAsDataURL(blob);});
  async function prepare(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('กรุณาใช้รูป JPG, PNG หรือ WebP หากเป็น HEIC ให้ใช้ภาพหน้าจอแทนครับ');
    if(file.size>10*1024*1024)throw new Error('รูปต้องมีขนาดไม่เกิน 10 MB ต่อรูป');
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();img.src=url;await img.decode();
      if(img.naturalWidth<50||img.naturalHeight<50||img.naturalWidth*img.naturalHeight>40000000)throw new Error('รูปเล็กหรือใหญ่เกินไป กรุณาใช้ภาพหน้าจอที่อ่านได้ชัดเจน');
      let blob=file;
      if(file.size>1.5*1024*1024||Math.max(img.naturalWidth,img.naturalHeight)>2400){
        const ratio=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);
        const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        for(const q of [.92,.85,.78]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',q));if(blob&&blob.size<=1.5*1024*1024)break;}
      }
      if(!blob||blob.size>2*1024*1024)throw new Error('รูปมีรายละเอียดมากเกินไป กรุณาลองภาพหน้าจอ');
      return {url,data:await readData(blob),slot:null,uploaded:false,error:'',status:''};
    }catch(e){URL.revokeObjectURL(url);throw e;}
  }
  picker.addEventListener('change',async()=>{
    if(busy)return;
    const chosen=Array.from(picker.files);picker.value='';
    if(files.length+chosen.length>5){tell('แนบได้สูงสุด 5 รูป กรุณาลบรูปเดิมก่อนเพิ่ม');return;}
    busy=true;submit.disabled=true;picker.disabled=true;tell('กำลังเตรียมรูป…',true);
    let error='';
    for(const file of chosen){try{files.push(await prepare(file));render();}catch(e){error=e.message;break;}}
    busy=false;submit.disabled=false;picker.disabled=false;render();tell(error);
  });
  document.getElementById('close-preview').onclick=()=>document.getElementById('preview-dialog').close();
  document.getElementById('preview-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
  function checkLinks(value,kind){
    const values=value.trim().split(/\s+/).filter(Boolean);if(values.length>100)throw new Error('ใส่ได้ไม่เกิน 100 ลิงก์ต่อช่อง');
    for(let i=0;i<values.length;i++){
      let u;try{u=new URL(values[i]);}catch{throw new Error(`กรุณาตรวจลิงก์ ${kind} ลำดับที่ ${i+1} และใส่ลิงก์เต็ม`);}
      const domains=kind==='Facebook'?['facebook.com','fb.com','fb.watch']:['tiktok.com'];
      if(u.protocol!=='https:'||u.username||u.password||!domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))throw new Error(`กรุณาตรวจลิงก์ ${kind} ลำดับที่ ${i+1}`);
    }
  }
  function completed(code){
    receipt=code;form.hidden=true;const panel=document.getElementById('success');panel.hidden=false;document.getElementById('receipt').textContent=code;panel.focus();panel.scrollIntoView({behavior:'smooth',block:'center'});
    files.forEach(f=>URL.revokeObjectURL(f.url));files=[];
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy||receipt)return;
    if(!form.reportValidity())return;
    if(!files.length){tell('กรุณาแนบรูปผลงานอย่างน้อย 1 รูป');picker.focus();return;}
    const values=new FormData(form);
    const payload={fullName:values.get('fullName').trim(),phone:values.get('phone').trim(),lineId:values.get('lineId').trim(),facebookName:values.get('facebookName').trim(),generation:Number(values.get('generation')),facebookLinks:values.get('facebookLinks').trim(),tiktokLinks:values.get('tiktokLinks').trim(),note:values.get('note').trim(),consent:document.getElementById('consent').checked};
    try{if(!payload.fullName||!payload.facebookName)throw new Error('กรุณากรอกชื่อและชื่อ Facebook ให้ครบ');if(!/^(?:0\d{8,9}|\+66\d{8,9})$/.test(payload.phone.replace(/[\s()-]/g,'')))throw new Error('กรุณาตรวจเบอร์โทรศัพท์');checkLinks(payload.facebookLinks,'Facebook');checkLinks(payload.tiktokLinks,'TikTok');}catch(e){tell(e.message);message.focus();return;}
    busy=true;const controls=Array.from(form.elements);controls.forEach(el=>el.disabled=true);submit.textContent='กำลังส่งผลงาน…';render();
    try{
      if(!draftToken){tell('กำลังเตรียมส่งผลงาน…',true);const d=await request('start',{source:new URLSearchParams(location.search).get('src')||'direct',website:values.get('website')||''});draftToken=d.token;}
      const taken=new Set(files.filter(f=>f.slot!==null).map(f=>f.slot));
      for(const f of files)if(f.slot===null){for(let i=0;i<5;i++)if(!taken.has(i)){f.slot=i;taken.add(i);break;}}
      for(let i=0;i<files.length;i++){
        const f=files[i];if(f.uploaded)continue;
        f.error='';f.status='กำลังอัปโหลด…';tell(`กำลังส่งรูป ${i+1} จาก ${files.length} รูป…`,true);render();
        try{await request('upload',{token:draftToken,slot:f.slot,data:f.data});f.uploaded=true;f.status='';render();}catch(err){f.error='ส่งรูปไม่สำเร็จ กดส่งเพื่อลองใหม่';f.status='';render();throw err;}
      }
      tell('กำลังบันทึกใบสมัคร…',true);const result=await request('submit',{...payload,token:draftToken,slots:files.map(f=>f.slot)});completed(result.receipt);
    }catch(err){if(err.status===401){draftToken=null;files.forEach(f=>{f.uploaded=false;f.slot=null;});}tell(err.message||'เชื่อมต่อไม่สำเร็จ กรุณากดส่งอีกครั้ง ข้อมูลของคุณยังอยู่');message.focus();}
    finally{busy=false;controls.forEach(el=>el.disabled=false);submit.textContent='ส่งผลงานของฉันเลย 🚀';render();}
  });
  window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
})();
