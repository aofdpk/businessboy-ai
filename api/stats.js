'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const Redis = require('ioredis');
const scrypt = promisify(crypto.scrypt);
const COOKIE = '__Host-bb_stats';
const SALT = '0c97d6a027df32865b345d2df0121838';
const DIGEST = '5d2d8db4df3f9700fb69f2f279288a1a82ba5cb092d3c495919dcc6cbf519d628569d58f07b9a7feae5033f5e5ce7d1e7e494a0b1841811ea7ae3cbdad222b93';
const PROJECT = 'prj_GQAb9h8tzmAnXtaCnTedFtfwhYua';
const TEAM = 'team_GuVh2bhaUMiyFrLtSwWf1AP5';
const AGE = 8 * 3600;
const DAY = 86400000;
const OFFSET = 7 * 3600000;
let redis;
const secret = () => process.env.STATS_SESSION_SECRET || process.env.SESSION_SECRET || '';
const sign = value => crypto.createHmac('sha256', secret()).update('stats:v1:' + DIGEST + ':' + value).digest('base64url');
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
function store() {
  if (!process.env.REDIS_URL) fail(503, 'ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาลองใหม่ภายหลัง');
  if (!redis) { redis = new Redis(process.env.REDIS_URL, { connectTimeout: 2500, commandTimeout: 4000, maxRetriesPerRequest: 1 }); redis.on('error', () => {}); }
  return redis;
}
async function limit(req, kind, max, seconds) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const key = 'bb:stats:limit:' + kind + ':' + sign(ip);
  const count = await store().eval('local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],ARGV[1]) end; return n', 1, key, seconds);
  if (count > max) fail(429, 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง');
}
function session(req, now = Date.now()) {
  if (!secret()) return false;
  const token = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  const [expiry, signature, ...rest] = String(token || '').split('.');
  return rest.length === 0 && /^\d{13}$/.test(expiry) && +expiry > now && +expiry <= now + AGE * 1000 + 1000 && equal(signature, sign(expiry));
}
function period(days, now = Date.now()) {
  if (![1,7,30].includes(days)) fail(400, 'เลือกช่วงเวลาที่รองรับ');
  const start = Math.floor((now + OFFSET) / DAY) * DAY - OFFSET - (days - 1) * DAY;
  return { since: new Date(start).toISOString(), until: new Date(now).toISOString(), days };
}
function filters(scope, includeTests) {
  if (!['gen4','all'].includes(scope)) fail(400, 'เลือกหน้าเว็บที่รองรับ');
  const clauses = ["environment eq 'production'"];
  if (scope === 'gen4') clauses.push("(requestPath eq '/ai-page-gen4' or requestPath eq '/ai-page-gen4.html')");
  if (!includeTests) clauses.push("utmSource ne 'qa'");
  return clauses.join(' and ');
}
async function query(dataset, by, range, filter) {
  const url = new URL(`https://api.vercel.com/v1/query/web-analytics/${dataset}/aggregate`);
  for (const [key, value] of Object.entries({projectId: PROJECT, teamId: TEAM, by, since: range.since, until: range.until, limit: '20', filter})) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + process.env.STATS_VERCEL_TOKEN }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) { console.error(JSON.stringify({ route: 'stats', upstreamStatus: response.status, dataset, by })); fail(502, 'ดึงสถิติยังไม่สำเร็จ กรุณาลองใหม่อีกสักครู่'); }
  const body = await response.json();
  if (!Array.isArray(body.data)) fail(502, 'รูปแบบข้อมูลสถิติไม่ถูกต้อง');
  return body.data;
}
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
function rows(data, key) { return data.map(r => ({ label: String(r[key] ?? ''), visitors: number(r.visitors), views: number(r.pageviews), count: number(r.count) })); }
function trend(data, range) {
  const result = new Map();
  for (let i = 0; i < range.days; i++) result.set(new Date(Date.parse(range.since) + OFFSET + i * DAY).toISOString().slice(0,10), 0);
  for (const row of data) {
    const date = new Date(Date.parse(row.timestamp) + OFFSET).toISOString().slice(0,10);
    if (result.has(date)) result.set(date, result.get(date) + number(row.pageviews));
  }
  return [...result].map(([date, views]) => ({date, views}));
}
async function report(days, scope, includeTests) {
  const range = period(days), filter = filters(scope, includeTests);
  const key = `bb:stats:report:v1:${days}:${scope}:${includeTests}:${range.since}`;
  const cached = await store().get(key);
  if (cached) return JSON.parse(cached);
  if (!process.env.STATS_VERCEL_TOKEN) fail(503, 'กำลังเชื่อมต่อข้อมูลสถิติ กรุณาลองใหม่ภายหลัง');
  const queries = [
    ['visits','environment'], ['visits','hour'], ['visits','requestPath'], ['visits','utmSource'],
    ['visits','referrerHostname'], ['visits','deviceType'], ['visits','utmCampaign'], ['events','eventName'],
    ['events','eventData/section', "eventName eq 'gen4_section_viewed'"],
    ['events','eventData/package', "eventName eq 'gen4_line_click'"],
  ];
  const data = await Promise.all(queries.map(([dataset,by,extra]) => query(dataset,by,range,filter + (extra ? ' and ' + extra : ''))));
  const visits = data[0].reduce((sum,r) => ({visitors: sum.visitors + number(r.visitors), views: sum.views + number(r.pageviews)}), {visitors:0,views:0});
  const events = rows(data[7],'eventName');
  const line = events.find(e => e.label === 'gen4_line_click') || {visitors:0,count:0};
  const result = {range, scope, includeTests, updatedAt:new Date().toISOString(), source:'Vercel Web Analytics',
    totals:{...visits,lineClicks:line.count,lineVisitors:line.visitors,clickRate:visits.visitors ? line.visitors/visits.visitors*100 : 0},
    trend:trend(data[1],range), pages:rows(data[2],'requestPath'), sources:rows(data[3],'utmSource'), referrers:rows(data[4],'referrerHostname'),
    devices:rows(data[5],'deviceType'), campaigns:rows(data[6],'utmCampaign'), events, sections:rows(data[8],'eventData'), packages:rows(data[9],'eventData')};
  await store().set(key,JSON.stringify(result),'EX',120);
  return result;
}
async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('CDN-Cache-Control','no-store');
  res.setHeader('Vercel-CDN-Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Vary','Cookie');
  const send = (status,value) => { res.statusCode=status; res.end(JSON.stringify(value)); };
  try {
    if (!['GET','POST'].includes(req.method)) return send(405,{error:'Method not allowed'});
    if (!secret()) fail(503,'ระบบยังไม่พร้อม กรุณาลองใหม่ภายหลัง');
    const action = String(req.query?.action || 'data');
    if (req.method === 'POST') {
      let origin; try { origin = new URL(req.headers.origin || ''); } catch { fail(403,'ไม่อนุญาตคำขอนี้'); }
      if (origin.protocol !== 'https:' || origin.host !== req.headers.host) fail(403,'ไม่อนุญาตคำขอนี้');
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) fail(415,'รูปแบบคำขอไม่ถูกต้อง');
      let body = req.body || {};
      if (typeof body === 'string') { if (body.length > 1024) fail(413,'คำขอใหญ่เกินไป'); try { body = JSON.parse(body); } catch { fail(400,'คำขอไม่ถูกต้อง'); } }
      if (action === 'login') {
        await limit(req,'login',10,900);
        if (typeof body.password !== 'string' || body.password.length > 128) fail(401,'รหัสผ่านไม่ถูกต้อง ลองอีกครั้งนะครับ');
        const digest = (await scrypt(body.password,SALT,64)).toString('hex');
        if (!equal(digest,DIGEST)) fail(401,'รหัสผ่านไม่ถูกต้อง ลองอีกครั้งนะครับ');
        const expiry = String(Date.now() + AGE*1000);
        res.setHeader('Set-Cookie',`${COOKIE}=${expiry}.${sign(expiry)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${AGE}`);
        return send(200,{ok:true});
      }
      if (action === 'logout') { res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`); return send(200,{ok:true}); }
      return send(404,{error:'ไม่พบรายการ'});
    }
    if (!session(req)) return send(401,{error:'กรุณาใส่รหัสผ่านเพื่อดูสถิติ'});
    if (action === 'session') return send(200,{ok:true});
    if (action !== 'data') return send(404,{error:'ไม่พบรายการ'});
    await limit(req,'read',40,60);
    const days = Number(req.query?.days || 7), scope = String(req.query?.scope || 'gen4'), includeTests = req.query?.tests === '1';
    period(days); filters(scope,includeTests);
    return send(200,await report(days,scope,includeTests));
  } catch (e) {
    if (!e.status) console.error(JSON.stringify({route:'stats',message:'request_failed',type:e.name}));
    return send(e.status || 503,{error:e.status ? e.message : 'ระบบกำลังพักสักครู่ กรุณาลองใหม่ภายหลัง'});
  }
}
module.exports = handler;
module.exports._test = { period, filters, trend, session, rows };
