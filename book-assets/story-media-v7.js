/* แสดงภาพต้นฉบับในหน้าเดิม ไม่มีเครื่องเล่นวิดีโอ */
(()=>{
 const dialog=document.querySelector('#book-media'),image=document.querySelector('#media-image'),title=document.querySelector('#book-media-title'),zoom=document.querySelector('#media-zoom');
 let opener=null;
 document.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>{
  opener=button;title.textContent=button.dataset.title;image.src=button.dataset.image;image.alt=button.dataset.title;image.hidden=false;zoom.hidden=false;
  dialog.classList.remove('zoomed');zoom.setAttribute('aria-pressed','false');zoom.textContent='ขยายตัวอักษร ＋';
  dialog.showModal();document.body.classList.add('media-open');document.querySelector('#media-close').focus();
 }));
 document.querySelector('#media-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{image.removeAttribute('src');document.body.classList.remove('media-open');opener?.focus({preventScroll:true});});
 zoom.addEventListener('click',()=>{const enlarged=dialog.classList.toggle('zoomed');zoom.setAttribute('aria-pressed',String(enlarged));zoom.textContent=enlarged?'ย่อกลับ −':'ขยายตัวอักษร ＋';});
})();
