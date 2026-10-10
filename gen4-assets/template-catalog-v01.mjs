import * as legacy from './templates-v01.mjs';
import { CUSTOMER_TEMPLATES } from './templates-customer-v01.mjs';
export const FRAMES=legacy.FRAMES;
export const SCENE_DIRECTION=legacy.SCENE_DIRECTION;
export const CATEGORIES=[...new Map(CUSTOMER_TEMPLATES.map(t=>[t.categoryId,{id:t.categoryId,name:t.category,emoji:t.emoji}])).values(),...legacy.CATEGORIES];
export const TEMPLATES=[...CUSTOMER_TEMPLATES,...legacy.TEMPLATES];
export const getTemplate=id=>CUSTOMER_TEMPLATES.find(t=>t.id===id)||legacy.getTemplate(id);
export const makeBrief=id=>getTemplate(id)?.usesCustomerPrompt?getTemplate(id).brief:legacy.makeBrief(id);
export function scenePlan(id,scenes){
 const t=getTemplate(id);
 if(!t?.usesCustomerPrompt)return legacy.scenePlan(id,scenes);
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

const DRAFT_BRIEF_FINGERPRINTS = {"N01":"1049:28f04a1","N08":"1094:fad6ccd5","N11":"1824:e296cbea","N12":"776:af6d2c6c","N18":"786:abae2cb8","N22":"961:9974fe6d","N25":"852:970900c6","N36":"968:e4380bcd","N37":"899:11896a30","action-pas":"533:f7bccacf","action-belief":"498:e64caca3","action-hso":"502:742e1ef5","action-snowball":"499:9cc524b8","action-compare":"515:df0401a9","action-friend":"508:9b07c48b","action-story":"497:bfdc238e","action-howto":"493:e581146","action-aida":"499:3103531c","action-twist":"507:3c09c10b","habits-pas":"531:51adda0c","habits-belief":"483:45b43e05","habits-hso":"478:959e034d","habits-snowball":"481:701496c9","habits-compare":"491:c322aa85","habits-friend":"504:72cea87c","habits-story":"493:a435a4a0","habits-howto":"479:7a923deb","habits-aida":"479:d512242d","habits-twist":"505:e170c272","time-pas":"538:7d8531a6","time-belief":"513:dcbcf9e5","time-hso":"486:a0349d92","time-snowball":"502:54731a17","time-compare":"497:d6019be","time-friend":"507:72753653","time-story":"502:1f28f106","time-howto":"492:c7db1b8b","time-aida":"497:f9d867a7","time-twist":"510:5599ada","work-pas":"546:84a9bf25","work-belief":"506:fbe0b08d","work-hso":"482:cf47a1d5","work-snowball":"496:82e9c14e","work-compare":"510:9aee3b42","work-friend":"518:59a21fe2","work-story":"506:96453a0b","work-howto":"493:17058b20","work-aida":"497:a6b2c0a4","work-twist":"513:8c0b9296","team-pas":"510:743ac10","team-belief":"485:fc2657f7","team-hso":"453:1160ae37","team-snowball":"477:b19411c8","team-compare":"479:592babba","team-friend":"501:64ba49cd","team-story":"492:20882fc0","team-howto":"474:b8b46264","team-aida":"475:c505550b","team-twist":"476:5f59b82f","freelance-pas":"537:ee735211","freelance-belief":"493:672ddb6f","freelance-hso":"486:1d4a5b99","freelance-snowball":"487:207ddd89","freelance-compare":"493:a4531142","freelance-friend":"510:d2e8b734","freelance-story":"515:28f086c","freelance-howto":"483:f8347d2a","freelance-aida":"480:d418f6be","freelance-twist":"507:def9b020","smallbiz-pas":"539:c7003cd7","smallbiz-belief":"500:db843193","smallbiz-hso":"490:8c12d113","smallbiz-snowball":"487:8c8cc9d0","smallbiz-compare":"492:abe2f36c","smallbiz-friend":"499:485f5acf","smallbiz-story":"499:fb24c3b4","smallbiz-howto":"480:2df97172","smallbiz-aida":"475:3c35285","smallbiz-twist":"504:8571cfa8","ecommerce-pas":"518:942be0d6","ecommerce-belief":"489:29f5049","ecommerce-hso":"469:4fcd3718","ecommerce-snowball":"479:fe45fc39","ecommerce-compare":"494:9a46b217","ecommerce-friend":"492:fa637575","ecommerce-story":"490:46b58275","ecommerce-howto":"470:f37bb303","ecommerce-aida":"472:56a6993f","ecommerce-twist":"489:134d303a","content-pas":"544:e8a066c0","content-belief":"504:7d47c1a4","content-hso":"496:57c3ff85","content-snowball":"510:6bb4ccbd","content-compare":"508:50d284b6","content-friend":"535:953c57f6","content-story":"506:bbc067fe","content-howto":"495:d05861c4","content-aida":"480:b5cbf079","content-twist":"509:2e387ad1","ai-pas":"544:f42a932d","ai-belief":"507:2f209058","ai-hso":"490:4e985566","ai-snowball":"505:de40a584","ai-compare":"521:7076a592","ai-friend":"537:20c4ac3e","ai-story":"517:a5fde882","ai-howto":"498:5975425","ai-aida":"507:be32de48","ai-twist":"510:8febbf38","cars-pas":"625:606be55e","cars-belief":"583:319e61f0","cars-hso":"569:c87b9314","cars-snowball":"583:2ac09654","cars-compare":"575:f60ba5da","cars-friend":"584:d3c18331","cars-story":"582:2f9098bf","cars-howto":"566:ca95da74","cars-aida":"581:67eba248","cars-twist":"578:e31330c5","bikes-pas":"533:8e19f5dd","bikes-belief":"520:faf8a053","bikes-hso":"492:d23f651","bikes-snowball":"506:304d2ff2","bikes-compare":"515:1d8dd74e","bikes-friend":"514:aaccd39b","bikes-story":"521:d1b371f1","bikes-howto":"483:a3eaf886","bikes-aida":"495:e0d228ca","bikes-twist":"507:9ba0ea5b","home-pas":"534:b134bc49","home-belief":"509:17cce698","home-hso":"485:ca3309da","home-snowball":"493:b57c9405","home-compare":"500:aa211890","home-friend":"509:fed0d7aa","home-story":"518:f4ccd078","home-howto":"477:ee112f17","home-aida":"494:5583b3d8","home-twist":"501:ec7925d8","kitchen-pas":"558:f5d4575","kitchen-belief":"534:bed89eda","kitchen-hso":"513:85de0dff","kitchen-snowball":"525:371159ff","kitchen-compare":"524:3ebcd603","kitchen-friend":"537:beeeb722","kitchen-story":"519:e2847bcb","kitchen-howto":"511:98047ea9","kitchen-aida":"513:79bdec03","kitchen-twist":"515:a7050b20","beauty-pas":"578:7d46c6fc","beauty-belief":"552:38462051","beauty-hso":"524:a73ef77c","beauty-snowball":"552:7813d526","beauty-compare":"547:bba4022e","beauty-friend":"559:8a4e8c45","beauty-story":"546:9de40b7b","beauty-howto":"534:59fd70c2","beauty-aida":"529:b1065fbc","beauty-twist":"537:d6372db5","fashion-pas":"551:8efc753","fashion-belief":"506:52002ca1","fashion-hso":"507:2ef8b7dd","fashion-snowball":"500:35aeb78e","fashion-compare":"515:6963f3aa","fashion-friend":"533:bf6b636f","fashion-story":"520:4f7f6e4d","fashion-howto":"490:e30a4017","fashion-aida":"499:165fc754","fashion-twist":"517:7a42f6e8","family-pas":"567:8177b7e6","family-belief":"526:c412ad0","family-hso":"519:88c6e8e7","family-snowball":"531:17ae46ae","family-compare":"531:ef86612c","family-friend":"550:5c3ddf58","family-story":"539:8cb8b2db","family-howto":"519:a6db3649","family-aida":"527:37966c35","family-twist":"532:c866db32","relationships-pas":"560:35d079fe","relationships-belief":"534:67d3e631","relationships-hso":"520:f5c9a4b0","relationships-snowball":"525:4058d575","relationships-compare":"527:169cfd6","relationships-friend":"536:8227e8bf","relationships-story":"535:8bb0a410","relationships-howto":"519:fa5c75fe","relationships-aida":"508:bfc89281","relationships-twist":"522:dc3af71f","pets-pas":"582:c206dc45","pets-belief":"555:ba67d0ca","pets-hso":"532:a2379eb7","pets-snowball":"534:94fc947a","pets-compare":"560:acee4e31","pets-friend":"553:1af1c41d","pets-story":"551:26f283eb","pets-howto":"535:b40e4b03","pets-aida":"534:67d1fe36","pets-twist":"554:ffbaf4d3","product-pas":"590:e1847488","product-belief":"551:8dd11474","product-hso":"532:a0fb28ea","product-snowball":"544:6262713f","product-compare":"544:c96b64db","product-friend":"550:d4d5a64c","product-story":"549:392eda5d","product-howto":"534:9dcfbc2f","product-aida":"536:d477e683","product-twist":"554:17969b8d"};

function briefFingerprint(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return s.length+':'+(h>>>0).toString(16)}
export function migrateSavedDraft(saved){
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return saved;
 const expected=DRAFT_BRIEF_FINGERPRINTS[saved.templateId];
 if(!expected||!getTemplate(saved.templateId))return saved;
 const next={...saved};
 for(const key of ['templateTopic',...(saved.inputMode==='template'?['topic']:[])]){
  if(typeof next[key]==='string'&&briefFingerprint(next[key])===expected)next[key]=makeBrief(saved.templateId);
 }
 return next;
}
