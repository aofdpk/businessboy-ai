/* ตัวอย่างคลิปและภาพ: เปิดในหน้าเดิม โหลดวิดีโอเมื่อผู้ชมกดเท่านั้น */
(()=>{
 const dialog=document.querySelector('#book-media'),video=document.querySelector('#media-video'),image=document.querySelector('#media-image'),title=document.querySelector('#book-media-title'),help=document.querySelector('#media-help'),zoom=document.querySelector('#media-zoom');
 let opener=null;
 function stop(){video.pause();video.removeAttribute('src');video.load();image.removeAttribute('src');dialog.classList.remove('zoomed');zoom.setAttribute('aria-pressed','false');zoom.textContent='ขยายตัวอักษร ＋';document.body.classList.remove('media-open');}
 function close(){dialog.close();}
 document.querySelectorAll('[data-video],[data-image]').forEach(button=>button.addEventListener('click',()=>{
  opener=button;stop();title.textContent=button.dataset.title;help.hidden=true;
  const isVideo=Boolean(button.dataset.video);video.hidden=!isVideo;image.hidden=isVideo;zoom.hidden=isVideo;
  dialog.classList.toggle('video-mode',isVideo);
  if(isVideo){video.src=button.dataset.video;video.poster=button.dataset.poster;}
  else{image.src=button.dataset.image;image.alt=button.dataset.title;}
  dialog.showModal();document.body.classList.add('media-open');document.querySelector('#media-close').focus();
  if(isVideo)video.play().catch(()=>{help.textContent='กดปุ่มเล่นบนวิดีโอเพื่อเริ่มรับชม';help.hidden=false;});
 }));
 document.querySelector('#media-close').addEventListener('click',close);
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 dialog.addEventListener('close',()=>{stop();opener?.focus({preventScroll:true});});
 video.addEventListener('error',()=>{help.textContent='คลิปยังโหลดไม่สำเร็จ ลองปิดแล้วกดเล่นใหม่อีกครั้ง';help.hidden=false;});
 zoom.addEventListener('click',()=>{const enlarged=dialog.classList.toggle('zoomed');zoom.setAttribute('aria-pressed',String(enlarged));zoom.textContent=enlarged?'ย่อกลับ −':'ขยายตัวอักษร ＋';});
})();
