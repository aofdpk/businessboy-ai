import {CATEGORIES,TEMPLATES,FRAMES} from './template-catalog-v01.mjs';
export function initLibrary({onSelect}){
 const $=id=>document.getElementById(id),dialog=$('template-dialog');let limit=20;
 const option=(value,label)=>{const el=document.createElement('option');el.value=value;el.textContent=label;return el};
 $('template-category').append(option('all',`ทุกหมวด · ${TEMPLATES.length} เทมเพลต`),option('new','✨ ใหม่ 9 แบบ'),...CATEGORIES.map(c=>option(c.id,`${c.emoji} ${c.name} · ${TEMPLATES.filter(t=>t.categoryId===c.id).length}`)));
 const text=(tag,className,value)=>{const el=document.createElement(tag);el.className=className;el.textContent=value;return el};
 function render(){const category=$('template-category').value,query=$('template-search').value.trim().toLocaleLowerCase('th');const results=TEMPLATES.filter(t=>{const c=CATEGORIES.find(c=>c.id===t.categoryId);return(category==='all'||(category==='new'&&t.isNew)||t.categoryId===category)&&`${t.title} ${t.direction} ${t.framework} ${c.name} ${t.tone}`.toLocaleLowerCase('th').includes(query)});
 $('template-results').replaceChildren();for(const t of results.slice(0,limit)){const c=CATEGORIES.find(c=>c.id===t.categoryId),card=document.createElement('button');card.type='button';card.className='template-card';card.dataset.templateId=t.id;card.setAttribute('aria-label',`ใช้เทมเพลต ${t.title}`);card.append(text('span','category-label',`${c.emoji} ${c.name}`),text('strong','',t.title),text('span','card-direction',t.direction),text('span','template-facts',t.isNew?'✨ เทมเพลตใหม่':FRAMES.find(f=>f.id===t.frameId).name),text('span','template-facts',`${t.framework} · ${t.scenes} ซีน / ${t.scenes*10} วินาที`),...(t.sceneReason?[text('span','card-direction',t.sceneReason)]:[]),text('span','use-template','ใช้เทมเพลตนี้ →'));card.addEventListener('click',()=>{onSelect(t.id);dialog.close()});$('template-results').append(card)}
 if(!results.length)$('template-results').append(text('p','empty-templates','ไม่พบเทมเพลต ลองเปลี่ยนคำค้นหรือเลือกทุกหมวด'));
 $('library-count').textContent=`พบ ${results.length} เทมเพลต · แสดง ${Math.min(limit,results.length)} จากคลังทั้งหมด ${TEMPLATES.length}`;$('more-templates').hidden=results.length<=limit;
 }
 for(const id of ['template-category','template-search'])$(id).addEventListener(id==='template-search'?'input':'change',()=>{limit=20;render();$('template-results').scrollTop=0});
 $('more-templates').addEventListener('click',()=>{const top=$('template-results').scrollTop;limit+=20;render();$('template-results').scrollTop=top});
 $('close-library').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>document.body.classList.remove('reading'));
 return {open(){render();dialog.showModal();document.body.classList.add('reading')}};
}

