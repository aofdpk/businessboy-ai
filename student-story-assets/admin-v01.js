(() => {
  const api='/api/student-story',login=document.getElementById('login-panel'),dashboard=document.getElementById('dashboard'),list=document.getElementById('applications');let page=0;
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  async function call(action,body,query=''){const r=await fetch(api+'?action='+action+query,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const d=await r.json();if(!r.ok){if(r.status===401){login.hidden=false;dashboard.hidden=true;list.replaceChildren();}throw new Error(d.error||'เชื่อมต่อไม่สำเร็จ');}return d;}
  async function load(){
    const msg=document.getElementById('admin-message');msg.textContent='กำลังโหลด…';
    try{const q='&page='+page+'&search='+encodeURIComponent(document.getElementById('search').value)+'&generation='+document.getElementById('generation-filter').value;const d=await call('list',null,q);list.replaceChildren();
      for(const a of d.items){
        const card=el('article',undefined,'application'),head=el('header'),title=el('div');title.append(el('h2',a.full_name),el('p','รุ่น '+a.generation+' · BB-'+a.id.slice(0,8).toUpperCase()+' · '+new Date(a.submitted_at).toLocaleString('th-TH'), 'meta'));
        const select=el('select',undefined,'status-select');select.setAttribute('aria-label','สถานะของ '+a.full_name);for(const s of ['ใหม่','สนใจ','ติดต่อแล้ว','นัดหมายแล้ว','ไม่เลือก']){const o=el('option',s);o.value=s;o.selected=s===a.status;select.append(o);}select.onchange=async()=>{select.disabled=true;try{await call('status',{id:a.id,status:select.value});a.status=select.value;msg.textContent='บันทึกสถานะแล้ว';}catch(e){select.value=a.status;msg.textContent=e.message;}finally{select.disabled=false;}};head.append(title,select);card.append(head);
        const details=el('div',undefined,'details');for(const [label,value]of [['ชื่อ Facebook ในกลุ่ม',a.facebook_name],['เบอร์โทร',a.phone],['LINE ID',a.line_id||'—'],['ที่มา',a.source||'direct']]){const cell=el('div');cell.append(el('small',label),el('span',value));details.append(cell);}card.append(details);
        for(const [label,urls]of [['เพจ Facebook',a.facebook_links],['ช่อง TikTok',a.tiktok_links]])if(urls.length){const group=el('div',undefined,'links');group.append(el('strong',label));for(const url of urls){const link=el('a',url);link.href=url;link.target='_blank';link.rel='noopener noreferrer';group.append(link);}card.append(group);}
        if(a.note)card.append(el('p',a.note,'note'));
        const images=el('div',undefined,'admin-images');for(const slot of a.images){const href=api+'?action=image&id='+encodeURIComponent(a.id)+'&slot='+slot;const link=el('a');link.href=href;link.target='_blank';link.rel='noopener';const img=el('img');img.src=href+'&thumb=1';img.alt='รูปผลงานที่ '+(slot+1)+' ของ '+a.full_name;img.loading='lazy';link.append(img);images.append(link);}card.append(images);list.append(card);
      }
      if(!d.items.length)list.append(el('p','ยังไม่มีใบสมัครที่ตรงกับรายการนี้','empty'));msg.textContent='พบ '+d.total+' ใบสมัคร';document.getElementById('previous').disabled=page===0;document.getElementById('next').disabled=(page+1)*30>=d.total;document.getElementById('page-label').textContent='หน้า '+(page+1);
    }catch(e){msg.textContent=e.message;}
  }
  document.getElementById('admin-login').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await call('login',{password:document.getElementById('password').value});document.getElementById('password').value='';login.hidden=true;dashboard.hidden=false;await load();}catch(e){document.getElementById('login-message').textContent=e.message;}finally{b.disabled=false;}};
  document.getElementById('logout').onclick=async()=>{try{await call('logout',{});location.reload();}catch(e){document.getElementById('admin-message').textContent=e.message;}};
  document.getElementById('filters').onsubmit=e=>{e.preventDefault();page=0;load();};document.getElementById('previous').onclick=()=>{if(page>0){page--;load();}};document.getElementById('next').onclick=()=>{page++;load();};
  call('session').then(d=>{login.hidden=d.authenticated;dashboard.hidden=!d.authenticated;if(d.authenticated)load();}).catch(()=>{login.hidden=false;});
})();
