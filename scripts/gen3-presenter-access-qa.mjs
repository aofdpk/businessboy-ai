import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bundlePath = require.resolve('../api/_gen3-bundle.js');
const originalBundles = require(bundlePath);
assert.ok(originalBundles.presenterIdentity, 'generated Presenter Identity bundle is missing');
assert.ok(originalBundles.presenterSales, 'generated Presenter Sales bundle is missing');

const authHandler = require('../api/gen3-auth.js');
const pageHandler = require('../api/gen3-page.js');
const scriptHandler = require('../api/gen3-script.js');

process.env.GEN3_SESSION_SECRET = 'presenter-access-qa-session-secret';
process.env.GEN3_SITE_PASSWORD = 'primary-access-qa-password';
process.env.GEN3_PRESENTER_PASSWORD = 'presenter-access-qa-password';
process.env.GEN3_PRESENTER_ACCESS = 'protected';

function request({ body, cookie = '', ip = '203.0.113.10', method = 'GET', origin = 'https://businessboy.ai', query = {} } = {}) {
  return {
    body,
    headers: {
      cookie,
      host: 'businessboy.ai',
      origin,
      'x-forwarded-for': ip,
    },
    method,
    query,
    socket: { remoteAddress: ip },
  };
}

function response() {
  return {
    body: undefined,
    ended: false,
    headers: {},
    statusCode: 200,
    end(value) {
      this.body = value;
      this.ended = true;
      return this;
    },
    json(value) {
      this.body = value;
      this.ended = true;
      return this;
    },
    send(value) {
      this.body = value;
      this.ended = true;
      return this;
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

async function invoke(handler, options) {
  const res = response();
  await handler(request(options), res);
  return res;
}

function cookiePair(setCookie, name) {
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  const value = values.find((entry) => typeof entry === 'string' && entry.startsWith(`${name}=`));
  assert.ok(value, `missing ${name} Set-Cookie header`);
  return value.split(';', 1)[0];
}

function assertPrivateNoStore(res) {
  assert.equal(res.headers['cache-control'], 'private, no-store, no-cache, must-revalidate');
  assert.equal(res.headers.pragma, 'no-cache');
}

let result = await invoke(authHandler, { method: 'GET' });
assert.equal(result.statusCode, 200);
assert.deepEqual(result.body, { authenticated: false });
assertPrivateNoStore(result);

result = await invoke(authHandler, {
  body: { password: process.env.GEN3_SITE_PASSWORD },
  method: 'POST',
});
assert.equal(result.statusCode, 200);
const sessionCookie = cookiePair(result.headers['set-cookie'], 'businessboy_gen3_session');
assert.match(String(result.headers['set-cookie']), /HttpOnly; Secure; SameSite=Lax/);

result = await invoke(pageHandler, { cookie: sessionCookie, query: { view: 'hub' } });
assert.equal(result.statusCode, 200);
assert.match(result.body, /\/gen3\/presenter-identity/);
assert.match(result.body, /\/gen3\/presenter-sales/);
assert.match(result.body, /ต้องใช้รหัสทดสอบ/);
assert.match(result.body, /sessionStorage\.removeItem\('businessboy-gen3-presenter-identity-v1'\)/, 'hub logout must clear Presenter Identity state');
assert.match(result.body, /sessionStorage\.removeItem\('businessboy-gen3-presenter-sales-v1'\)/, 'hub logout must clear Presenter Sales state');
assertPrivateNoStore(result);

result = await invoke(pageHandler, { cookie: sessionCookie, query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 200);
assert.match(result.body, /presenter-unlock-form/);
assert.doesNotMatch(result.body, /script\?view=presenter-identity/);

result = await invoke(scriptHandler, { cookie: sessionCookie, query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 403);
assertPrivateNoStore(result);

result = await invoke(authHandler, {
  body: { password: process.env.GEN3_PRESENTER_PASSWORD },
  method: 'POST',
  query: { scope: 'presenter' },
});
assert.equal(result.statusCode, 401, 'presenter unlock must require the primary session');

result = await invoke(authHandler, {
  body: { password: 'wrong' },
  cookie: sessionCookie,
  ip: '203.0.113.11',
  method: 'POST',
  query: { scope: 'presenter' },
});
assert.equal(result.statusCode, 401);

result = await invoke(authHandler, {
  body: { password: process.env.GEN3_PRESENTER_PASSWORD },
  cookie: sessionCookie,
  method: 'POST',
  query: { scope: 'presenter' },
});
assert.equal(result.statusCode, 200);
const presenterCookie = cookiePair(result.headers['set-cookie'], 'businessboy_gen3_presenter');
assert.match(String(result.headers['set-cookie']), /HttpOnly; Secure; SameSite=Lax/);
const entitledCookies = `${sessionCookie}; ${presenterCookie}`;

result = await invoke(pageHandler, { cookie: entitledCookies, query: { view: 'hub' } });
assert.match(result.body, /ปลดล็อกแล้ว/, 'hub should show the current Presenter entitlement');

result = await invoke(authHandler, {
  cookie: entitledCookies,
  method: 'GET',
  query: { scope: 'presenter' },
});
assert.deepEqual(result.body, { authenticated: true, authorized: true });

result = await invoke(pageHandler, { cookie: entitledCookies, query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 200);
assert.match(result.body, /script\?view=presenter-identity/);
assert.doesNotMatch(result.body, /presenter-unlock-form/);

result = await invoke(pageHandler, { cookie: entitledCookies, query: { view: 'presenter-sales' } });
assert.equal(result.statusCode, 200);
assert.match(result.body, /script\?view=presenter-sales/);

result = await invoke(scriptHandler, { cookie: entitledCookies, query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 200);
assert.equal(result.body, originalBundles.presenterIdentity);

result = await invoke(scriptHandler, { cookie: entitledCookies, query: { view: 'presenter-sales' } });
assert.equal(result.statusCode, 200);
assert.equal(result.body, originalBundles.presenterSales);

result = await invoke(scriptHandler, { cookie: sessionCookie, query: { view: 'identity' } });
assert.equal(result.statusCode, 200, 'the existing identity bundle must still need only the primary session');
assert.equal(typeof result.body, 'string');

result = await invoke(pageHandler, {
  cookie: `${sessionCookie}; businessboy_gen3_presenter=%E0%A4%A`,
  query: { view: 'presenter-identity' },
});
assert.equal(result.statusCode, 200);
assert.match(result.body, /presenter-unlock-form/, 'a malformed entitlement cookie must fail closed');

process.env.GEN3_PRESENTER_PASSWORD = 'rotated-presenter-access-qa-password';
result = await invoke(scriptHandler, { cookie: entitledCookies, query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 403, 'rotating the presenter password must invalidate old entitlements');
process.env.GEN3_PRESENTER_PASSWORD = 'presenter-access-qa-password';

delete process.env.GEN3_PRESENTER_PASSWORD;
result = await invoke(pageHandler, { cookie: entitledCookies, query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 200);
assert.match(result.body, /ระบบโหมดทดสอบยังตั้งค่าไม่ครบ/);
assert.doesNotMatch(result.body, /script\?view=presenter-identity/);
result = await invoke(scriptHandler, { cookie: entitledCookies, query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 403);
const originalConsoleError = console.error;
console.error = () => {};
result = await invoke(authHandler, {
  body: { password: 'anything' },
  cookie: sessionCookie,
  method: 'POST',
  query: { scope: 'presenter' },
});
console.error = originalConsoleError;
assert.equal(result.statusCode, 503);

delete process.env.GEN3_PRESENTER_ACCESS;
process.env.GEN3_PRESENTER_PASSWORD = 'presenter-access-qa-password';
result = await invoke(scriptHandler, { cookie: sessionCookie, query: { view: 'presenter-sales' } });
assert.equal(result.statusCode, 403, 'a missing access flag must remain protected');

process.env.GEN3_PRESENTER_ACCESS = 'open';
result = await invoke(pageHandler, { cookie: sessionCookie, query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 200);
assert.match(result.body, /script\?view=presenter-identity/);
result = await invoke(scriptHandler, { cookie: sessionCookie, query: { view: 'presenter-sales' } });
assert.equal(result.statusCode, 200);
result = await invoke(scriptHandler, { query: { view: 'presenter-sales' } });
assert.equal(result.statusCode, 401, 'open Presenter access must not bypass the primary Gen 3 session');

process.env.GEN3_PRESENTER_ACCESS = 'OPEN';
result = await invoke(scriptHandler, { cookie: sessionCookie, query: { view: 'presenter-sales' } });
assert.equal(result.statusCode, 403, 'only the exact server-side value "open" may bypass the entitlement');

process.env.GEN3_PRESENTER_ACCESS = 'protected';
process.env.GEN3_PRESENTER_PASSWORD = 'presenter-access-qa-password';
result = await invoke(scriptHandler, { cookie: entitledCookies, method: 'HEAD', query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 200);
assert.equal(result.body, undefined);
assert.equal(result.ended, true);

result = await invoke(pageHandler, { cookie: entitledCookies, method: 'POST', query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 405);
assert.equal(result.headers.allow, 'GET, HEAD');

result = await invoke(scriptHandler, { cookie: entitledCookies, method: 'POST', query: { view: 'presenter-identity' } });
assert.equal(result.statusCode, 405);
assert.equal(result.headers.allow, 'GET, HEAD');

for (let index = 0; index < 12; index += 1) {
  result = await invoke(authHandler, {
    body: { password: 'wrong' },
    cookie: sessionCookie,
    ip: '203.0.113.99',
    method: 'POST',
    query: { scope: 'presenter' },
  });
  assert.equal(result.statusCode, 401);
}
result = await invoke(authHandler, {
  body: { password: 'wrong' },
  cookie: sessionCookie,
  ip: '203.0.113.99',
  method: 'POST',
  query: { scope: 'presenter' },
});
assert.equal(result.statusCode, 429);

result = await invoke(authHandler, { cookie: entitledCookies, method: 'DELETE' });
assert.equal(result.statusCode, 200);
assert.equal(Array.isArray(result.headers['set-cookie']), true);
assert.equal(result.headers['set-cookie'].length, 2);
assert.match(result.headers['set-cookie'][0], /businessboy_gen3_session=;.*Max-Age=0/);
assert.match(result.headers['set-cookie'][1], /businessboy_gen3_presenter=;.*Max-Age=0/);

result = await invoke(pageHandler, { cookie: entitledCookies, query: { view: 'does-not-exist' } });
assert.equal(result.statusCode, 404);

console.log('Gen 3 presenter access QA passed');
