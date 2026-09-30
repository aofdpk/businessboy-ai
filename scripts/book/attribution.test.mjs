import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=fs.readFileSync('book-assets/store.js','utf8');
const capture=code.slice(code.indexOf(' const incomingFbclid='),code.indexOf(' const utm='));
const clean=code.split('\n').find(x=>x.includes('const safeURL='));
for(const [consent,fbclid,expected] of [['all','IwValid_abc-123','IwValid_abc-123'],['analytics','IwValid_abc-123',null],['all','email@example.com',null],['all','a'.repeat(501),null],['all','',null]]){
 const url=new URL('https://businessboy.ai/ai-book?utm_source=facebook&phone=private&fbclid='+encodeURIComponent(fbclid)+'#order');
 let actual;
 vm.runInNewContext(capture+clean,{URL,location:url,utm:{utm_source:'facebook'},consent,history:{replaceState:(_,__,u)=>actual=new URL(u)}});
 assert.equal(actual.searchParams.get('fbclid'),expected);
 assert.equal(actual.searchParams.get('phone'),null);
 assert.equal(actual.searchParams.get('utm_source'),'facebook');
 assert.equal(actual.hash,'#order');
}
console.log('PASS: marketing consent preserves valid click ID; analytics-only, malformed/oversized IDs and private parameters are excluded');
