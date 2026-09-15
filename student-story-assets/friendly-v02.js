(() => {
  'use strict';
  const gallery=document.getElementById('gallery-dialog'),image=document.getElementById('gallery-full'),caption=document.getElementById('gallery-caption');
  const sticky=document.getElementById('sticky-apply'),apply=document.getElementById('apply'),hero=document.getElementById('hero-cta');
  let priorFocus=null,heroVisible=true,applyVisible=false;
  const updateSticky=()=>{
    const focused=document.activeElement;
    const inputFocused=focused?.matches('input,textarea,select');
    const passedForm=apply.getBoundingClientRect().bottom<=0;
    sticky.hidden=innerWidth>760||heroVisible||applyVisible||inputFocused||passedForm||!!document.querySelector('dialog[open]');
  };
  for(const button of document.querySelectorAll('[data-gallery]'))button.addEventListener('click',()=>{
    priorFocus=button;image.src=button.dataset.gallery;image.alt=button.dataset.caption;caption.textContent=button.dataset.caption;
    gallery.showModal();document.body.style.overflow='hidden';updateSticky();
  });
  document.getElementById('close-gallery').addEventListener('click',()=>gallery.close());
  gallery.addEventListener('click',e=>{if(e.target===gallery)gallery.close();});
  gallery.addEventListener('close',()=>{document.body.style.overflow='';image.removeAttribute('src');priorFocus?.focus({preventScroll:true});updateSticky();});
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){if(entry.target===hero)heroVisible=entry.isIntersecting;if(entry.target===apply)applyVisible=entry.isIntersecting;}
    updateSticky();
  });
  observer.observe(hero);observer.observe(apply);
  window.addEventListener('resize',updateSticky,{passive:true});
  document.addEventListener('focusin',updateSticky);document.addEventListener('focusout',()=>requestAnimationFrame(updateSticky));
  const dialog=document.getElementById('preview-dialog');
  new MutationObserver(updateSticky).observe(dialog,{attributes:true,attributeFilter:['open']});
})();
