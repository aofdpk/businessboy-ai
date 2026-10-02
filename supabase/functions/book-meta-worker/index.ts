import {enabled, buildEvent, sendEvent} from '../book-store/measurement.ts';
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function db(path:string, body?:unknown) {
  const r = await fetch(`${url}/rest/v1/${path}`, {method:body===undefined?'GET':'POST',
    headers:{apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body), signal:AbortSignal.timeout(10000)});
  if (!r.ok) throw new Error('database_unavailable');
  return await r.json();
}
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed',{status:405});
  try {
    const secrets = await db('rpc/book_meta_secrets',{});
    const supplied = req.headers.get('x-book-worker-key') || '';
    if (!secrets.worker_key || supplied.length!==secrets.worker_key.length ||
        [...supplied].reduce((n,c,i)=>n|(c.charCodeAt(0)^secrets.worker_key.charCodeAt(i)),0)!==0)
      return new Response('Unauthorized',{status:401});
    const config = (await db('book_meta_config?id=eq.true'))[0];
    if (!enabled(config) || !secrets.access_token) return Response.json({status:'disabled_or_unconfigured'});
    const jobs = await db('rpc/book_meta_claim',{p_limit:10});
    let accepted=0,failed=0,skipped=0;
    for (const job of jobs) {
      const freshConfig = (await db('book_meta_config?id=eq.true'))[0];
      const context = (await db(`book_meta_context?order_id=eq.${job.order_id}`))[0];
      const order = (await db(`book_orders?id=eq.${job.order_id}&select=id,is_test,status,payment_status,paid_at`))[0];
      const event = enabled(freshConfig) && context && order ? buildEvent(job,context,order) : null;
      if (!event) {
        await db('rpc/book_meta_finish',{p_event_id:job.event_id,p_lock:job.lock_id,p_status:'skipped',p_error:'ineligible_or_objected'});
        skipped++;continue;
      }
      const result = await sendEvent(secrets.access_token, config.pixel_id, event);
      await db('rpc/book_meta_finish',{p_event_id:job.event_id,p_lock:job.lock_id,
        p_status:result.ok?'sent':result.retry?'pending':'failed',p_error:result.code});
      result.ok ? accepted++ : failed++;
    }
    return Response.json({accepted,failed,skipped});
  } catch { return Response.json({error:'worker_unavailable'},{status:503}); }
});
