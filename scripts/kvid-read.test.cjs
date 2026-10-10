const {test}=require('node:test'),assert=require('node:assert/strict');
const {retryRead,makeReader,reason}=require('../api/_kvid-read');
test('temporary read failure recovers with bounded jitter; permanent errors do not retry',async()=>{
 let calls=0;const sleeps=[];assert.equal(await retryRead(()=>{if(++calls<3)throw new Error('Server error (HTTP status 429): redacted');return 7;},{sleep:async ms=>sleeps.push(ms),random:()=>0}),7);assert.deepEqual(sleeps,[150,300]);
 calls=0;await assert.rejects(retryRead(()=>{calls++;throw {code:'42601'};},{sleep:async()=>{}}));assert.equal(calls,1);
 calls=0;await assert.rejects(retryRead(()=>{calls++;throw {code:'53300'};},{sleep:async()=>{}}));assert.equal(calls,5);
 assert.equal(reason(new Error('Server error (HTTP status 503): private connection string')),'http_503');
});
test('concurrent checks group reads while preserving each identity; later calls are fresh',async()=>{
 const batches=[];let suspended=false;const read=makeReader(async ids=>{batches.push(ids);return ids.filter(id=>id!=='missing').map(id=>({id,suspended}));});
 const ids=Array.from({length:2000},(_,i)=>String(i));const rows=await Promise.all(ids.map(read));assert.deepEqual(rows.map(r=>r.id),ids);assert.ok(batches.length<=32);assert.ok(batches.every(b=>b.length<=64));
 suspended=true;assert.equal((await read('1')).suspended,true);assert.equal(await read('missing'),undefined);
});
test('read failure rejects every waiter and next request can recover',async()=>{
 let bad=true;const read=makeReader(async ids=>{if(bad)throw new Error('db offline');return ids.map(id=>({id}));});
 const result=await Promise.allSettled([read('a'),read('b')]);assert.ok(result.every(r=>r.status==='rejected'));bad=false;assert.equal((await read('c')).id,'c');
});
