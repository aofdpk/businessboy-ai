// Measurement is separate from consent. Fail closed until a reviewed basis is configured.
export const NOTICE_VERSION = 'book-meta-20261002-v1';
export const SOURCE_URL = 'https://businessboy.ai/ai-book';
export function enabled(c: any) {
  return c?.enabled === true && c.lawful_basis === 'legitimate_interest' &&
    !!c.review_reference && !!c.reviewed_at && !!c.enabled_at && c.notice_version === NOTICE_VERSION;
}
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return /^0\d{8,9}$/.test(digits) ? '66' + digits.slice(1) : '';
}
export function validFbc(value: unknown, now = Date.now()) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^fb\.1\.(\d{13})\.([A-Za-z0-9_-]{10,500})$/);
  if (!m || Number(m[1]) > now + 60000 || Number(m[1]) < now - 86400000) return null;
  return value;
}
export async function makeContext(c: any, order: any, input: any, ua: string, hash: (s: string) => Promise<string>) {
  if (!enabled(c) || order.is_test || new Date(order.created_at) < new Date(c.enabled_at) ||
      input?.notice_version !== NOTICE_VERSION || input?.objected !== false || input?.gpc === true) return null;
  const phone = normalizePhone(order.phone);
  if (!phone || !ua) return null;
  return {order_id: order.id, phone_hash: await hash(phone), user_agent: ua.slice(0,512),
    fbc: validFbc(input.fbc), notice_version: NOTICE_VERSION, lawful_basis: c.lawful_basis};
}
export function buildEvent(job: any, context: any, order: any) {
  if (context.objected || order.is_test || ['cancelled','returned'].includes(order.status) ||
      !/^[a-f0-9]{64}$/.test(context.phone_hash || '') || !context.user_agent) return null;
  if (job.event_name === 'Purchase' && (!['paid','cod_collected'].includes(order.payment_status) || !order.paid_at)) return null;
  if (!['OrderSubmitted','Purchase'].includes(job.event_name)) return null;
  const user_data: any = {ph: [context.phone_hash], client_user_agent: context.user_agent};
  if (context.fbc) user_data.fbc = context.fbc;
  return {event_name: job.event_name, event_id: job.event_id,
    event_time: Math.floor(new Date(job.event_time).getTime()/1000), action_source: 'website',
    event_source_url: SOURCE_URL, user_data,
    custom_data: {currency: 'THB', value: job.amount, content_type: 'product', content_ids: ['ai-book'], num_items: 1}};
}
export async function sendEvent(token: string, pixel: string, event: any, fetcher = fetch, testCode?: string) {
  try {
    const response = await fetcher(`https://graph.facebook.com/v25.0/${pixel}/events`, {
      method: 'POST', headers: {'Content-Type':'application/json', Authorization:`Bearer ${token}`},
      body: JSON.stringify({data: [event], ...(testCode ? {test_event_code:testCode}: {})}),
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json().catch(()=>({}));
    if (response.ok && result.events_received === 1) return {ok:true, retry:false, code:null};
    // Never log Meta's message: it can echo customer data or access tokens.
    const code = Number.isInteger(result.error?.code) ? result.error.code : response.status;
    return {ok:false, retry:response.status===429 || response.status>=500 || result.error?.is_transient===true,
      code:`meta_${code}`};
  } catch { return {ok:false, retry:true, code:'network_timeout'}; }
}
