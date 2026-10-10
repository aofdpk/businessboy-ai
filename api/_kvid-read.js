'use strict';
// Only read-only operations may use this retry helper. Never replay mutations.
function reason(e){
 const status=/HTTP status (\d{3})/.exec(String(e.message||''));
 if(status)return 'http_'+status[1];
 if(/^[0-9A-Z]{5}$/.test(e.code||''))return e.code;
 if(e.sourceError||/Error connecting to database/.test(e.message||''))return 'connection';
 return 'unknown';
}
const transient=e=>['http_429','http_500','http_502','http_503','http_504','53300','57P01','57P02','57P03','08000','08001','08003','08006','connection'].includes(reason(e));
async function retryRead(run,{sleep=ms=>new Promise(r=>setTimeout(r,ms)),random=Math.random,onRetry=()=>{}}={}){
 for(let attempt=0;;attempt++)try{return await run();}catch(e){
  if(attempt>=4||!transient(e))throw e;
  onRetry(reason(e),attempt+1);await sleep(150*2**attempt+Math.floor(random()*250));
 }
}
// Briefly group concurrent fresh checks; no result survives the database read.
// Every caller still checks its own credential against the returned row.
function makeReader(read){
 let queue=[],timer;
 function flush(){clearTimeout(timer);timer=undefined;const batch=queue;queue=[];
  read([...new Set(batch.map(x=>x.id))]).then(rows=>{const byId=new Map(rows.map(r=>[r.id,r]));for(const x of batch)x.resolve(byId.get(x.id));},e=>{for(const x of batch)x.reject(e);});
 }
 return id=>new Promise((resolve,reject)=>{queue.push({id,resolve,reject});if(queue.length>=64)flush();else if(!timer)timer=setTimeout(flush,5);});
}
module.exports={reason,transient,retryRead,makeReader};
