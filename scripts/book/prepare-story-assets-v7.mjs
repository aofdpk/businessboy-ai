import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('sharp');
import crypto from 'node:crypto';
const manifest=JSON.parse(await fs.readFile('scripts/book/story-v7-sources.json','utf8'));
let html=await fs.readFile('ai-book.html','utf8');
for(const item of manifest.images){
 await sharp(item.source).webp({quality:87,effort:6}).toFile(item.output);
 const info=await sharp(item.output).metadata(),buf=await fs.readFile(item.output);
 Object.assign(item,{width:info.width,height:info.height,bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex')});
 const name=item.output.split('/').pop();
 html=html.replace(new RegExp(`(src="/book-assets/story-v7/${name}" width=")\\d+(" height=")\\d+`),`$1${info.width}$2${info.height}`);
}
// จองพื้นที่ตามขนาดไฟล์จริงเพื่อป้องกันหน้าเลื่อนระหว่างโหลด
for(const name of ['page-12-v3.png','page-13-v3.png','page-35-v3.png','page-102-v2.png','page-223-v3.png','review-natty-v2.png','review-lalitaporn-v2.png','review-pareenart-v2.png','story-v7/prompt-real-v7.png']){
 const m=await sharp('book-assets/'+name).metadata();
 html=html.replace(new RegExp(`(src="/book-assets/${name}" width=")\\d+(" height=")\\d+`),`$1${m.width}$2${m.height}`);
}
await fs.writeFile('ai-book.html',html);
await fs.writeFile('scripts/book/story-v7-sources.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({images:manifest.images.length,bytes:manifest.images.reduce((s,x)=>s+x.bytes,0),sizes:manifest.images.map(x=>({panel:x.panel,width:x.width,height:x.height,kb:Math.round(x.bytes/1024)}))}));
