import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {enabled, normalizePhone, validFbc, makeContext, buildEvent, sendEvent, NOTICE_VERSION} from '../supabase/functions/book-store/measurement.ts';
const hash=async s=>createHash('sha256').update(s).digest('hex');
const config={enabled:true,lawful_basis:'legitimate_interest',review_reference:'review-20261002',reviewed_at:'2026-10-02T00:00:00Z',enabled_at:'2026-10-02T00:00:00Z',notice_version:NOTICE_VERSION};
const order={id:'00000000-0000-4000-8000-000000000001',created_at:'2026-10-02T01:00:00Z',phone:'0812345678',status:'new',payment_status:'cod_pending',is_test:false};
const input={notice_version:NOTICE_VERSION,objected:false};
const job={event_name:'OrderSubmitted',event_id:'book:test:OrderSubmitted',event_time:order.created_at,amount:490};
test('requires review, valid notice and server switch; no inferred consent',async()=>{
 assert.equal(enabled({...config,enabled:false}),false);
 assert.equal(enabled({...config,review_reference:null}),false);
 assert.equal(enabled({...config,lawful_basis:'pending'}),false);
 assert.equal(await makeContext(config,order,{},'UA',hash),null);
 assert.equal(await makeContext(config,order,{...input,objected:true},'UA',hash),null);
 assert.equal(await makeContext(config,order,{...input,gpc:true},'UA',hash),null);
 assert.equal(await makeContext(config,{...order,is_test:true},input,'UA',hash),null);
 assert.equal(await makeContext(config,{...order,created_at:'2026-10-01T00:00:00Z'},input,'UA',hash),null);
});
test('minimum payload hashes Thai phone; no address, name, slip, note, raw phone or IP',async()=>{
 assert.equal(normalizePhone('081-234-5678'),'66812345678');
 const context=await makeContext(config,order,input,'QA user agent',hash);
 assert.equal(context.phone_hash,await hash('66812345678'));
 const event=buildEvent(job,context,order);
 assert.deepEqual(Object.keys(event.user_data).sort(),['client_user_agent','ph']);
 assert.equal(event.custom_data.value,490);assert.equal(event.custom_data.currency,'THB');
 assert.equal(JSON.stringify(event).includes('0812345678'),false);
 assert.equal(event.event_source_url,'https://businessboy.ai/ai-book');
});
test('FBC preserves case and rejects fabricated timestamps and malformed identifiers',()=>{
 const now=Date.now(),fbc=`fb.1.${now}.AbCdEf_123456`;
 assert.equal(validFbc(fbc,now),fbc);
 assert.equal(validFbc(`fb.1.${now+120000}.AbCdEf_123456`,now),null);
 assert.equal(validFbc(`fb.1.${now-172800000}.AbCdEf_123456`,now),null);
 assert.equal(validFbc('https://example.com/?private=secret'),null);
});
test('COD and awaiting review never generate Purchase; paid events are distinct',async()=>{
 const ctx=await makeContext(config,order,input,'UA',hash),purchase={...job,event_name:'Purchase',event_id:'book:test:Purchase'};
 assert.equal(buildEvent(purchase,ctx,order),null);
 assert.equal(buildEvent(purchase,ctx,{...order,payment_status:'review'}),null);
 assert.equal(buildEvent(purchase,ctx,{...order,payment_status:'paid',paid_at:order.created_at}).event_name,'Purchase');
 assert.equal(buildEvent(job,{...ctx,objected:true},order),null);
 assert.equal(buildEvent(job,ctx,{...order,status:'cancelled'}),null);
 assert.equal(buildEvent(job,ctx,{...order,is_test:true}),null);
});
test('Meta acknowledgment required; retries preserve event ID and redact error text',async()=>{
 const ctx=await makeContext(config,order,input,'UA',hash),event=buildEvent(job,ctx,order);let sent;
 const mock=async(url,opts)=>{sent=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer test-only');return Response.json({events_received:1});};
 assert.equal((await sendEvent('test-only','300488034391029',event,mock,'TEST_ONLY')).ok,true);
 assert.equal(sent.data[0].event_id,job.event_id);assert.equal(sent.test_event_code,'TEST_ONLY');
 assert.deepEqual(await sendEvent('test-only','300488034391029',event,async()=>Response.json({events_received:0})),{ok:false,retry:false,code:'meta_200'});
 assert.deepEqual(await sendEvent('test-only','300488034391029',event,async()=>Response.json({error:{code:190,message:'SECRET'}},{status:400})),{ok:false,retry:false,code:'meta_190'});
 assert.equal((await sendEvent('test-only','300488034391029',event,async()=>Response.json({},{status:503}))).retry,true);
});
