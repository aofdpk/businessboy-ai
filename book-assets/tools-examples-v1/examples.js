(()=>{
 const dialog=document.querySelector('#tools-example-dialog');if(!dialog)return;
 const title=dialog.querySelector('#tools-example-title'),img=dialog.querySelector('#tools-example-full'),zoom=dialog.querySelector('#tools-example-zoom');let opener=null;
 document.querySelectorAll('[data-demo-src]').forEach(button=>button.addEventListener('click',()=>{
  opener=button;title.textContent=button.dataset.demoTitle;img.src=button.dataset.demoSrc;img.alt=button.dataset.demoTitle;
  dialog.classList.remove('enlarged');zoom.setAttribute('aria-pressed','false');zoom.textContent='ขยายตัวหนังสือ ＋';
  dialog.showModal();document.body.classList.add('example-open');
 }));
 dialog.querySelector('#tools-example-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{document.body.classList.remove('example-open');opener?.focus({preventScroll:true});});
 zoom.addEventListener('click',()=>{const enlarged=dialog.classList.toggle('enlarged');zoom.setAttribute('aria-pressed',String(enlarged));zoom.textContent=enlarged?'ย่อกลับ −':'ขยายตัวหนังสือ ＋';});
})();
