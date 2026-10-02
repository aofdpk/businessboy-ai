import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../book-assets/measurement.js',import.meta.url),'utf8');
async function boot({active=true,gpc=false,storageBlocked=false,fail=false}={}){
 const elements=Object.fromEntries(['#measurement-notice','#measurement-details','#measurement-object','#measurement-result'].map(id=>[id,{hidden:true,textContent:'',addEventListener(type,fn){this[type]=fn;}}]));
 const calls=[],values=new Map();const storage={getItem(k){if(storageBlocked)throw Error();return values.get(k)},setItem(k,v){if(storageBlocked)throw Error();values.set(k,v)}};
 const context={window:{},document:{querySelector:s=>elements[s]},navigator:{globalPrivacyControl:gpc},URL,Date,AbortSignal,localStorage:storage,sessionStorage:storage,location:{href:'https://businessboy.ai/ai-book?fbclid=AbCdEf_123456'},fetch:async(url,options)=>{calls.push({url,options});if(fail)throw Error('offline');return {ok:true,json:async()=>({enabled:active,notice_version:'book-meta-20261002-v1'})}}};
 vm.runInNewContext(source,context);await new Promise(setImmediate);return {context,elements,calls,values};
}
test('disabled or unreachable config leaves checkout tracking off',async()=>{
 for(const options of [{active:false},{fail:true}]){const {context,elements,calls}=await boot(options);assert.equal(context.window.BookMeasurement.payload(),undefined);assert.equal(elements['#measurement-notice'].hidden,true);assert.equal(calls.length,1);}
});
test('enabled configuration displays notice and only prepares order payload, no ad beacon',async()=>{
 const {context,elements,calls}=await boot();assert.equal(elements['#measurement-notice'].hidden,false);assert.equal(elements['#measurement-details'].hidden,false);
 const payload=context.window.BookMeasurement.payload();assert.equal(payload.objected,false);assert.match(payload.fbc,/AbCdEf_123456$/);assert.equal(calls.length,1);
 await elements['#measurement-object'].click();assert.equal(context.window.BookMeasurement.payload().objected,true);assert.equal(context.window.BookMeasurement.payload().fbc,null);
});
test('GPC and blocked browser storage remain safe and checkout-independent',async()=>{
 const {context}=await boot({gpc:true,storageBlocked:true});assert.equal(context.window.BookMeasurement.payload().objected,true);assert.equal(context.window.BookMeasurement.payload().fbc,null);
});
test('objection after order uses only existing order capability and blocks future payloads',async()=>{
 const {context,elements,calls,values}=await boot();values.set('bb_book_order',JSON.stringify({id:'synthetic-order'}));values.set('bb_book_key','synthetic-capability');
 await elements['#measurement-object'].click();assert.equal(calls[1].url,'/api/book?op=measurement_object');assert.equal(JSON.parse(calls[1].options.body).id,'synthetic-order');assert.equal(context.window.BookMeasurement.payload().objected,true);
});
