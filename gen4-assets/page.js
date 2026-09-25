(() => {
'use strict';
const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const general='สนใจสมัครคอร์ส เปลี่ยนเพจธรรมดา ให้กลายเป็นเครื่องจักรผลิตเงิน รุ่นที่ 4';
const lineUrl=message=>mobile?'https://line.me/R/oaMessage/%40034oysgq/?'+encodeURIComponent(message):'https://lin.ee/sl6unNh';
document.querySelectorAll('[data-line]').forEach(link=>{link.href=lineUrl(link.hasAttribute('data-onsite')?general+' แพ็กเกจ 25,990 บาท พร้อมเรียนในห้อง 3 ครั้ง':general);});
const fmt=new Intl.NumberFormat('th-TH');
function updatePackage(input){
 const price=Number(input.dataset.price), duration=input.dataset.duration, onsite=input.hasAttribute('data-onsite');
 const packageLabel='คอร์ส + KVID '+duration+(onsite?' + เรียนในห้องจริง 3 ครั้ง':'');
 document.getElementById('selected-name').textContent='คุณเลือก: '+packageLabel;
 document.getElementById('selected-extra').hidden=!onsite;
 document.getElementById('selected-price').textContent=fmt.format(price)+' บาท';
 document.getElementById('selected-installment').textContent=fmt.format(price/10)+' บาท/เดือน';
 const cta=document.getElementById('selected-cta');
 cta.href=lineUrl(general+' แพ็กเกจ '+packageLabel+' ราคา '+fmt.format(price)+' บาท');
 cta.setAttribute('aria-label','ให้แอดมินช่วยสมัคร '+packageLabel+' ราคา '+fmt.format(price)+' บาท ผ่าน LINE');
}
document.querySelectorAll('input[name="package"]').forEach(input=>input.addEventListener('change',()=>updatePackage(input)));
updatePackage(document.querySelector('input[name="package"]:checked'));
const dialog=document.getElementById('media-dialog'), title=document.getElementById('media-title'), img=document.getElementById('dialog-image'), video=document.getElementById('dialog-video'), help=document.getElementById('video-help'), close=document.getElementById('close-dialog');
let previousFocus;
const zoomTools=document.getElementById('zoom-tools'), zoomToggle=document.getElementById('zoom-toggle'), zoomHint=document.getElementById('zoom-hint');
zoomToggle.addEventListener('click',()=>{const expanded=img.classList.toggle('zoomed');zoomToggle.textContent=expanded?'ย่อภาพ −':'ขยายตัวอักษร ＋';zoomToggle.setAttribute('aria-pressed',String(expanded));zoomHint.textContent=expanded?'เลื่อนภาพซ้าย–ขวา และขึ้น–ลง เพื่ออ่านต่อ':'กดขยายเพื่ออ่านภาพให้ใหญ่ขึ้น';});
function openMedia(button,kind){
 zoomTools.hidden=kind!=='image';img.classList.remove('zoomed');zoomToggle.textContent='ขยายตัวอักษร ＋';zoomToggle.setAttribute('aria-pressed','false');zoomHint.textContent='กดขยายเพื่ออ่านภาพให้ใหญ่ขึ้น';
 previousFocus=button;title.textContent=button.dataset.title;img.hidden=kind!=='image';video.hidden=kind!=='video';help.hidden=true;
 dialog.classList.toggle('wide-video',kind==='video'&&button.dataset.layout==='wide');
 if(kind==='image'){img.src=button.dataset.image;img.alt=button.dataset.title;}
 else{video.src=button.dataset.video;video.poster=button.dataset.poster;video.setAttribute('aria-label',button.dataset.title);}
 dialog.showModal();document.body.classList.add('dialog-open');close.focus();
 if(kind==='video')video.play().catch(()=>{help.hidden=false;});
}
document.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>openMedia(button,'image')));
document.querySelectorAll('[data-video]').forEach(button=>button.addEventListener('click',()=>openMedia(button,'video')));
close.addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{video.pause();video.removeAttribute('src');video.load();document.body.classList.remove('dialog-open');previousFocus?.focus({preventScroll:true});});
})();
