import { getTemplate, makeBrief, scenePlan, SCENE_DIRECTION } from './templates-v01.mjs';
import { initLibrary } from './template-library-v01.mjs';
export const DEFAULTS = Object.freeze({scenes:1,topic:'',style:'realistic',customStyle:'',outfit:'reference',customOutfit:'',speed:'normal',inputMode:'custom',templateId:'',focus:'',product:'',customTopic:'',templateTopic:''});
const SPEEDS = {slow:'พูดช้า 15-20 คำ',normal:'พูดปกติ 20-25 คำ',fast:'พูดเร็ว 25-30 คำ',veryfast:'พูดเร็วมาก 30-35 คำ'};
const STYLES = {realistic:'สมจริง',pixar:'Pixar 3D'};
const STORAGE_KEY = 'businessboy.gen4.meta-prompt.v1';
export function normalize(input = {}) {
  const text = key => typeof input[key] === 'string' ? input[key] : DEFAULTS[key];
  const template=getTemplate(input.templateId);const inputMode=input.inputMode==='template'&&template?'template':'custom';
  return {inputMode,templateId:template?.id||'',focus:text('focus'),product:text('product'),customTopic:typeof input.customTopic==='string'?input.customTopic:text('topic'),templateTopic:text('templateTopic'),scenes:Math.min(999,Math.max(1,Math.floor(Number(input.scenes)||1))),topic:text('topic'),style:['realistic','pixar','custom'].includes(input.style)?input.style:DEFAULTS.style,customStyle:text('customStyle'),outfit:input.outfit==='custom'?'custom':'reference',customOutfit:text('customOutfit'),speed:Object.hasOwn(SPEEDS,input.speed)?input.speed:DEFAULTS.speed};
}
export function buildPrompt(input) {
  const state=normalize(input), n=state.scenes, total=n*10, last=String(n).padStart(2,'0');
  const speed=SPEEDS[state.speed];
  const style=state.style==='custom'?(state.customStyle.trim()||'[ใส่สไตล์ภาพ]'):STYLES[state.style];
  const outfit=state.outfit==='custom'?(state.customOutfit.trim()||'[ใส่เสื้อผ้า/ท่าทาง]'):'ตามคาแรคเตอร์ชีท';
  const topic=state.inputMode==='template'&&getTemplate(state.templateId)?[state.topic.trim()||makeBrief(state.templateId),state.focus.trim()?'เจาะจงเพิ่มเติม: '+state.focus.trim():'ประเด็นย่อย: ให้ AI เลือกเองภายในหมวดและมุมเล่านี้',getTemplate(state.templateId).categoryId==='product'?'ข้อมูลสินค้าที่ใช้เป็นแหล่งอ้างอิง: '+(state.product.trim()||'[ระบุชื่อสินค้าและข้อมูลจริงก่อนคัดลอก]'):'',scenePlan(state.templateId,n),SCENE_DIRECTION].filter(Boolean).join('\n\n'):state.topic.trim()||'[ใส่หัวข้อหรือสคริปต์ตรงนี้]';
  return `บทบาท: คุณคือผู้กำกับ AI สร้างวิดีโอ End-to-End ต้องรักษาหน้าตาตัวละครหลักให้เหมือนเดิม 100%

================ INPUT - แก้แค่โซนนี้เท่านั้น =================
1. Master Character Reference = [แนบรูป 1 รูป - ถ้าไม่มี ให้สร้างตัวละครใหม่]
2. จำนวนซีนที่ต้องการ = ${n} ซีน
3. หัวข้อ / สคริปต์ = ${topic}
4. สไตล์ภาพ = ${style}
5. เสื้อผ้า/ท่าทาง = ${outfit}
6. ความเร็วบทพูด = ${speed} ต่อซีน 10 วิ


ค่าที่ล็อค: ต่อซีน 10 วิเป๊ะ / รวม = ${n} x 10 วิ = ${total} วิ / ขนาด 9:16 / lip-sync ตรง

คำสั่งบังคับ: AUTO-RUN 5 ขั้นตอนรวดเดียว ห้ามหยุดรอ

กฎเหล็ก Identity 100%:
- ใช้หน้า ทรงผม สีผิว จาก Master Reference เท่านั้น

กฎเหล็กบทพูด:

1. ห้ามขึ้นต้นด้วยสวัสดี ให้เข้าเรื่องเลยจากหัวข้อ INPUT ข้อ 3

2. เขียนให้พูดสมูท: ประโยคติดกันเหมือนคนพูดจริง ห้ามเคาะเว้นวรรคทุกคำ
   - ผิด: วัน นี้ เรา จะ มา พูด ถึง เรื่อง นี้ กัน
   - ถูก: วันนี้เราจะมาพูดถึงเรื่องนี้กัน, เป็นประเด็นที่หลายคนสนใจมาก

3. เว้นวรรคเฉพาะคำที่ AI อ่านผิดเท่านั้น (คลังคำอ่านผิด ต้องเว้นตามนี้เท่านั้น):

   อบ พะ ยบ = อพยพ
   สะ หมัก = สมัคร
   สะ มา ชิก = สมาชิก
   ถะ แหลง = แถลง
   ปอ ตอ ทอ = ปตท.

   ตำ หรวด = ตำรวจ
   สะ หละ = สละ
   ประ สบ การ = ประสบการณ์
   กระ ซวง = กระทรวง
   กระ ทรวง สา ธา ระ นะ สุข = กระทรวงสาธารณสุข
   สำ นัก งาน = สำนักงาน
   สำ นัก งาน ตำ หรวด แห่ง ชาด = สำนักงานตำรวจแห่งชาติ
   รัด ถะ บาน = รัฐบาล
   รัด ถะ มน ตรี = รัฐมนตรี
   อัย ยะ การ = อัยการ
   ผู้ ว่า ราด ชะ การ = ผู้ว่าราชการ
   กรุง เทบ มะ หา นะ คอน = กรุงเทพมหานคร
   เทก โน โล ยี = เทคโนโลยี
   ดิ จิ ทัล = ดิจิทัล
   อัจ ฉะ ริ ยะ = อัจฉริยะ
   สอ ทอ นอ ชอ = สทนช.
   กรม อุ ตุ = กรมอุตุ
   สอ ตอ ชอ = สตช.

4. ใส่จังหวะหายใจ: ใส่ , หยุด 0.3 วิ / ใส่ . หยุด 0.5 วิ

5. ห้ามใช้ ๆ ให้เขียนซ้ำคำ เช่น มาก มาก / ห้ามเลขอารบิก เขียนเป็นคำไทยทั้งหมด / ความยาวตามข้อ 6

--- 5 ขั้นตอนบังคับทำ ---

ขั้นตอนที่ 1: วิเคราะห์สคริปต์เป็นตาราง | ซีนที่ | คำอธิบายฉากไทย | Image Prompt | Video Prompt + บทพูด [${speed} ต่อซีน 10 วิ] ห้ามขึ้นต้นด้วยสวัสดี | เวลา 10 วิ |

ขั้นตอนที่ 2: สร้าง Storyboard รวม 1 ภาพใหญ่ ${n} ช่อง ใช้ Master Reference ต้นแบบ

ขั้นตอนที่ 3: แยกภาพ ${n===1?'Image_Final_01':`Image_Final_01 ถึง ${last}`} 9:16

ขั้นตอนที่ 4: สร้างวิดีโอทีละฉาก (Image-to-Video)
เอา Image_Final แต่ละใบเป็น First Frame มาสร้างวิดีโอ 10 วิเป๊ะ
คำสั่ง: "น้ำเสียงมืออาชีพ พูดต่อเนื่องไหลลื่นเป็นธรรมชาติ เชื่อมคำ ไม่ท่องทีละคำ ไม่หยุดระหว่างคำเกิน 0.1 วินาที + บทพูด: [บทพูดแบบสมูท] + lip-sync ปากตรง 100% + เสียงไทยชัด ห้ามมีตัวหนังสือบนจอ"

ขั้นตอนที่ 5: รวมวิดีโอ + ส่งงานสุดท้าย
${n===1?'- ใช้ Video_01 ความยาว 10 วิเป๊ะ ส่งออกเป็นคลิปเดียว ไม่มี transition ไม่มีโลโก้ ไม่มีซับ':`- เอา Video_01 -> Video_${last} ต่อกัน hard cut ทุก 10 วิเป๊ะ ไม่มี transition ไม่มีโลโก้ ไม่มีซับ`}
- Export เป็น Video_Final_${total}s.mp4
- ส่งแค่ไฟล์เดียวเท่านั้น: Video_Final_${total}s.mp4 1 คลิป`;
}

if (typeof document !== 'undefined') {
  const $=id=>document.getElementById(id), form=$('prompt-form'), output=$('prompt-output');
  let state={...DEFAULTS},storageAvailable=true,toastTimer;
  try {const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));if(saved&&typeof saved==='object'&&!Array.isArray(saved))state=normalize(saved);} catch {storageAvailable=false;}
  function restoreForm(){
    $('scenes').value=state.scenes;$('topic').value=state.topic;$('template-focus').value=state.focus;$('product-details').value=state.product;
    form.querySelector(`input[name="style"][value="${state.style}"]`).checked=true;
    $('custom-style').value=state.customStyle;$('outfit').value=state.outfit;$('custom-outfit').value=state.customOutfit;$('speed').value=state.speed;
  }
  function readForm(){return normalize({...state,focus:$('template-focus').value,product:$('product-details').value,customTopic:state.inputMode==='custom'?$('topic').value:state.customTopic,templateTopic:state.inputMode==='template'?$('topic').value:state.templateTopic,scenes:$('scenes').value,topic:$('topic').value,style:form.elements.style.value,customStyle:$('custom-style').value,outfit:$('outfit').value,customOutfit:$('custom-outfit').value,speed:$('speed').value});}
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageAvailable=true;}catch{storageAvailable=false;}$('save-status').textContent=storageAvailable?'บันทึกอัตโนมัติในเบราว์เซอร์นี้':'เบราว์เซอร์นี้ไม่อนุญาตให้บันทึก แต่ยังกรอกและคัดลอกได้';}
  function missing(){if(state.inputMode==='template'&&getTemplate(state.templateId)?.categoryId==='product'&&!state.product.trim())return 'ระบุชื่อสินค้าและข้อมูลจริงก่อนคัดลอก';if(!$('scenes').checkValidity())return 'ใส่จำนวนซีนเป็นจำนวนเต็ม ตั้งแต่ 1–999 ซีน';if(!state.topic.trim())return 'กรอกหัวข้อ / สคริปต์ เพื่อพร้อมคัดลอก';if(state.style==='custom'&&!state.customStyle.trim())return 'ระบุสไตล์ภาพ เพื่อพร้อมคัดลอก';if(state.outfit==='custom'&&!state.customOutfit.trim())return 'ระบุเสื้อผ้า / ท่าทาง เพื่อพร้อมคัดลอก';return '';}
  function render(){
    const selected=getTemplate(state.templateId),usingTemplate=state.inputMode==='template'&&selected;
    $('template-options').hidden=!usingTemplate;
    $('product-details-wrap').hidden=!(usingTemplate&&selected.categoryId==='product');
    $('product-details').required=Boolean(usingTemplate&&selected.categoryId==='product');
    $('mode-template').setAttribute('aria-pressed',String(Boolean(usingTemplate)));$('mode-custom').setAttribute('aria-pressed',String(!usingTemplate));
    $('topic-caption').textContent=usingTemplate?'แนวทางที่เลือก — แก้ข้อความต่อได้':'หัวข้อหรือสคริปต์ของคุณ';
    $('topic-hint').textContent=usingTemplate?'เว้นช่องเจาะจงเพิ่มเติมไว้ ให้ AI คิดเรื่องย่อยเอง โครงแบ่งซีนจะเติมใน Prompt อัตโนมัติ':'พิมพ์หัวข้อสั้น ๆ หรือวางสคริปต์ที่เตรียมไว้ได้เลย';
    if(usingTemplate){$('selected-template').textContent=selected.title;$('template-meta').textContent=selected.framework+' · แนะนำ '+selected.scenes+' ซีน';$('scene-plan').textContent=scenePlan(selected.id,state.scenes);}

    $('custom-style-wrap').hidden=state.style!=='custom';$('custom-style').required=state.style==='custom';
    $('custom-outfit-wrap').hidden=state.outfit!=='custom';$('custom-outfit').required=state.outfit==='custom';
    $('minus').disabled=state.scenes<=1;$('plus').disabled=state.scenes>=999;
    $('duration').replaceChildren(document.createTextNode(`${state.scenes} ซีน × 10 วินาที = `));const bold=document.createElement('b');bold.textContent=`${state.scenes*10} วินาที`;$('duration').append(bold);
    $('scene-badge').textContent=`${state.scenes} ซีน / ${state.scenes*10} วินาที`;
    const scrollTop=output.scrollTop;output.value=buildPrompt(state);output.scrollTop=scrollTop;
    $('reader-output').value=output.value;const error=missing();$('reader-copy').disabled=Boolean(error);$('reader-help').textContent=error||'พร้อมคัดลอกไปวางใน Meta AI';$('reader-copy').textContent='คัดลอก Prompt ทั้งหมด';$('copy').disabled=Boolean(error);$('copy-help').textContent=error||'คัดลอกครบทั้ง INPUT และกฎทั้งหมดในคลิกเดียว';$('copy-label').textContent='คัดลอก Prompt ทั้งหมด';
  }
  function update(){state=readForm();render();save();}
  function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
  form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('input',update);form.addEventListener('change',update);
  $('scenes').addEventListener('blur',()=>{$('scenes').value=normalize({scenes:$('scenes').value}).scenes;update();});
  for(const [id,delta] of [['minus',-1],['plus',1]])$(id).addEventListener('click',()=>{$('scenes').value=Math.min(999,Math.max(1,state.scenes+delta));update();});
  $('reset').addEventListener('click',()=>{state={...DEFAULTS};restoreForm();render();save();toast('คืนค่าเริ่มต้นแล้ว');});
  async function copyPrompt(inReader=false){
    if(missing())return;
    const source=inReader?$('reader-output'):output;const prompt=source.value;
    let copied=false;
    try{await navigator.clipboard.writeText(prompt);copied=true;}catch{
      const previousFocus=document.activeElement,scrollTop=source.scrollTop;
      source.focus({preventScroll:true});source.select();try{copied=document.execCommand('copy');}catch{}
      if(copied){source.setSelectionRange(0,0);source.scrollTop=scrollTop;previousFocus?.focus({preventScroll:true});}
    }
    if(copied){$('copy-label').textContent='✓ คัดลอกแล้ว';$('reader-copy').textContent='✓ คัดลอกแล้ว';$('reader-help').textContent='คัดลอกแล้ว พร้อมนำไปวางใน Meta AI';toast('คัดลอกแล้ว พร้อมนำไปวางใน Meta AI');}
    else{$('copy-help').textContent='เลือกข้อความไว้ให้แล้ว กดคัดลอกจากเมนูของอุปกรณ์ หรือ Ctrl/Cmd + C';$('reader-help').textContent=$('copy-help').textContent;source.focus();source.select();toast('กรุณาคัดลอกข้อความที่เลือกไว้ด้วยตนเอง');}
  }
  $('copy').addEventListener('click',()=>copyPrompt());
  $('reader-copy').addEventListener('click',()=>copyPrompt(true));
  const dialog=$('reader-dialog');
  $('expand').addEventListener('click',()=>{ $('reader-output').value=output.value;dialog.showModal();document.body.classList.add('reading'); });
  $('close-reader').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>document.body.classList.remove('reading'));
  function setFont(value){const size=[18,20,22].includes(Number(value))?Number(value):18;document.documentElement.style.setProperty('--prompt-size',size+'px');document.querySelectorAll('.font-size').forEach(select=>select.value=String(size));try{localStorage.setItem('businessboy.gen4.prompt-font.v1',String(size));}catch{}}
  let initialFont=18;try{initialFont=localStorage.getItem('businessboy.gen4.prompt-font.v1')||18;}catch{}setFont(initialFont);
  document.querySelectorAll('.font-size').forEach(select=>select.addEventListener('change',()=>setFont(select.value)));
  document.querySelectorAll('button[data-view]').forEach(button=>button.addEventListener('click',()=>{const view=button.dataset.view;$('builder').dataset.view=view;document.querySelectorAll('.mobile-tabs button').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.view===view)));if(matchMedia('(max-width: 1050px)').matches)document.querySelector('.mobile-tabs').scrollIntoView({block:'start'});}));
  document.documentElement.classList.add('enhanced');
  const library=initLibrary({onSelect(id){
    const selected=getTemplate(id);if(!selected)return;if(getTemplate(state.templateId)?.categoryId!==selected.categoryId)state.focus='';
    if(state.inputMode==='custom')state.customTopic=$('topic').value;
    state.inputMode='template';state.templateId=id;state.topic=makeBrief(id);state.templateTopic=state.topic;state.scenes=selected.scenes;
    restoreForm();render();save();toast('เลือกเทมเพลตแล้ว ตั้งค่า '+state.scenes+' ซีน · '+state.scenes*10+' วินาที');
  }});
  $('mode-template').addEventListener('click',()=>{if(!getTemplate(state.templateId)){library.open();return;}if(state.inputMode==='custom'){state.customTopic=$('topic').value;state.inputMode='template';state.topic=state.templateTopic||makeBrief(state.templateId);restoreForm();render();save();}});
  $('mode-custom').addEventListener('click',()=>{if(state.inputMode==='template'){state.templateTopic=$('topic').value;state.inputMode='custom';state.topic=state.customTopic;restoreForm();render();save();}});
  $('browse-templates').addEventListener('click',()=>library.open());
  restoreForm();render();if(!storageAvailable)$('save-status').textContent='ยังไม่ได้บันทึกค่า แต่กรอกและคัดลอกได้ตามปกติ';
}

