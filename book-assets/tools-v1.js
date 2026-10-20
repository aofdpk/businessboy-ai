(()=>{
 const $=s=>document.querySelector(s);let settings=null;
 async function api(op,data){const r=await fetch('/api/book-tools?op='+op,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined});const b=await r.json();if(!r.ok)throw Error(b.error||'เชื่อมต่อไม่สำเร็จ');return b;}
 function show(b){settings=b;$('#login-panel').hidden=true;$('#tools-content').hidden=false;$('#logout').hidden=false;$('#password').value='';$('#tool-link').href=b.tool_url;$('#flow-help').href=b.help_url;$('#youtube-link').href='https://www.youtube.com/watch?v='+encodeURIComponent(b.video_id);}
 $('#show-password').onclick=()=>{const visible=$('#password').type==='password';$('#password').type=visible?'text':'password';$('#show-password').textContent=visible?'ซ่อน':'แสดง';$('#show-password').setAttribute('aria-pressed',String(visible));};
 $('#login').onsubmit=async e=>{e.preventDefault();$('#login-error').textContent='';$('#login-submit').disabled=true;try{show(await api('login',{password:$('#password').value}));window.scrollTo(0,0);}catch(e){$('#login-error').textContent=e.message;}finally{$('#login-submit').disabled=false;}};
 $('#logout').onclick=async()=>{try{await api('logout',{});location.reload();}catch(e){alert(e.message);}};
 $('#play-video').onclick=()=>{if(!settings)return;const f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(settings.video_id)+'?autoplay=1&rel=0';f.title='คลิปเดโม่แนะนำ Promptbook';f.allow='autoplay; encrypted-media; picture-in-picture';f.allowFullscreen=true;$('#video').replaceChildren(f);};
 $('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(settings.tool_url);$('#copy-status').textContent='คัดลอกแล้ว เปิดลิงก์ในเบราว์เซอร์บนมือถือหรือคอมพิวเตอร์ได้เลย';}catch{$('#copy-status').textContent='คัดลอกอัตโนมัติไม่ได้ กดค้างที่ปุ่มเปิดเครื่องมือแล้วเลือกคัดลอกลิงก์';}};
 api('content').then(show).catch(()=>{});
})();
