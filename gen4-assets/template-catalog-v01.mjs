import * as legacy from './templates-v01.mjs';
import { CUSTOMER_TEMPLATES } from './templates-customer-v01.mjs';
export const FRAMES=legacy.FRAMES;
export const SCENE_DIRECTION=legacy.SCENE_DIRECTION;
export const CATEGORIES=[...CUSTOMER_TEMPLATES.map(t=>({id:t.categoryId,name:t.category,emoji:t.emoji})),...legacy.CATEGORIES];
export const TEMPLATES=[...CUSTOMER_TEMPLATES,...legacy.TEMPLATES];
export const getTemplate=id=>CUSTOMER_TEMPLATES.find(t=>t.id===id)||legacy.getTemplate(id);
export const makeBrief=id=>getTemplate(id)?.isNew?getTemplate(id).brief:legacy.makeBrief(id);
export function scenePlan(id,scenes){
 const t=getTemplate(id);
 if(!t?.isNew)return legacy.scenePlan(id,scenes);
 const n=Math.min(999,Math.max(1,Math.floor(Number(scenes)||1)));
 if(n===t.scenes)return t.originalPlan;
 const beats=t.framework.split(' → ');
 const lines=Array.from({length:n},(_,i)=>{
  const steps=n<=beats.length?beats.slice(Math.floor(i*beats.length/n),Math.floor((i+1)*beats.length/n)):
   [beats[Math.min(beats.length-1,Math.floor(i*beats.length/n))]+(i>0&&i<n-1?' เพิ่มรายละเอียดหรือการกระทำใหม่ที่ต่อเนื่อง ไม่ซ้ำซีนก่อน':'')];
  return `ซีน ${i+1}: ${steps.join(' แล้ว ')}`;
 });
 return `จำนวนซีนที่ผู้ใช้เลือก: ${n} ซีน ซีนละสิบวินาที\nโครงสร้าง: ${t.framework}\n${lines.join('\n')}\nรักษาเรื่องเดียวตลอดคลิป ย่อหรือขยายให้ครบตามจำนวนซีนที่ผู้ใช้เลือก แต่ละซีนต้องเพิ่มเนื้อหาหรือการกระทำใหม่ ไม่ยืดซ้ำเพื่อให้ครบเวลา\nให้ AI เลือกสถานที่ แสง บรรยากาศและอุปกรณ์ให้เหมาะกับเรื่อง รักษาความต่อเนื่อง ภาพเริ่มต้องอยู่ก่อนการกระทำ`;
}
export function buildCustomerPrompt(state,{style,outfit,speed}){
 const t=getTemplate(state.templateId),n=state.scenes,total=n*10,last=String(n).padStart(2,'0');
 // Substitute fixed template sections before user text to keep user edits literal.
 const values={BRIEF:(state.topic.trim()||t.brief)+(state.focus.trim()?'\n\nเจาะจงเพิ่มเติม: '+state.focus.trim():''),PLAN:scenePlan(t.id,n),STYLE:style,OUTFIT:outfit,SPEED:speed};
 let p=t.prompt.replace(t.brief,'{{BRIEF}}').replace(t.originalPlan,'{{PLAN}}')
  .replace(/^4\. สไตล์ภาพ = .*$/m,'4. สไตล์ภาพ = {{STYLE}}')
  .replace(/^5\. เสื้อผ้า\/ท่าทาง = .*$/m,'5. เสื้อผ้า/ท่าทาง = {{OUTFIT}}')
  .replaceAll('พูดปกติ 20-25 คำ','{{SPEED}}')
  .replace(`2. จำนวนซีนที่ต้องการ = ${t.scenes} ซีน`,`2. จำนวนซีนที่ต้องการ = ${n} ซีน`)
  .replace(`รวม = ${t.scenes} x 10 วิ = ${t.scenes*10} วิ`,`รวม = ${n} x 10 วิ = ${total} วิ`)
  .replace(`ภาพใหญ่ ${t.scenes} ช่อง`,`ภาพใหญ่ ${n} ช่อง`)
  .replace(/ขั้นตอนที่ 3: แยกภาพ .* 9:16/,`ขั้นตอนที่ 3: แยกภาพ ${n===1?'Image_Final_01':`Image_Final_01 ถึง ${last}`} 9:16`)
  .replace(/- เอา Video_01 -> Video_\d+ ต่อกัน hard cut ทุก 10 วิเป๊ะ ไม่มี transition ไม่มีโลโก้ ไม่มีซับ/,n===1?'- ใช้ Video_01 ความยาว 10 วิเป๊ะ ส่งออกเป็นคลิปเดียว ไม่มี transition ไม่มีโลโก้ ไม่มีซับ':`- เอา Video_01 -> Video_${last} ต่อกัน hard cut ทุก 10 วิเป๊ะ ไม่มี transition ไม่มีโลโก้ ไม่มีซับ`)
  .replaceAll(`Video_Final_${t.scenes*10}s.mp4`,`Video_Final_${total}s.mp4`);
 return p.replace(/\{\{(BRIEF|PLAN|STYLE|OUTFIT|SPEED)\}\}/g,(_,key)=>values[key]);
}
