import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { sanitizeUrl } from './site-analytics.mjs';

test('page URLs retain campaign attribution and strip private data', () => {
  assert.equal(sanitizeUrl('https://businessboy.ai/ai-page-gen4?utm_source=tiktok&utm_campaign=live_26sep&email=a%40b.com&phone=0812345678#private'), 'https://businessboy.ai/ai-page-gen4?utm_source=tiktok&utm_campaign=live_26sep');
  assert.equal(sanitizeUrl('https://businessboy.ai/ai-page-gen4?utm_content=a%40b.com'), 'https://businessboy.ai/ai-page-gen4');
  for (const url of ['https://preview.vercel.app/ai-page-gen4', 'http://businessboy.ai/ai-page-gen4', 'https://businessboy.ai/student-story/admin', 'https://businessboy.ai/api/student-story', 'https://user:pass@businessboy.ai/']) assert.equal(sanitizeUrl(url), null);
});

function browser(url, storage = new Map(), selected = { duration: '1 ปี', onsite: false }) {
  const listeners = {}, scripts = [], window = {};
  const context = vm.createContext({ window, location: new URL(url), URL, console,
    localStorage: { setItem: (k,v) => storage.set(k,v), getItem: k => storage.get(k), removeItem: k => storage.delete(k) },
    document: {
      head: { querySelector: () => null, appendChild: el => scripts.push(el) },
      createElement: () => ({ dataset: {} }),
      addEventListener: (name, callback) => listeners[name] = callback,
      querySelectorAll: () => [],
      querySelector: () => ({ dataset: { duration: selected.duration }, hasAttribute: name => name === 'data-onsite' && selected.onsite }),
    },
  });
  const run = () => vm.runInContext(readFileSync('site-analytics.js','utf8'), context);
  run(); return { window, listeners, scripts, run };
}
test('preview, localhost and opted-out staff do not send analytics', () => {
  for (const url of ['https://preview.vercel.app/ai-page-gen4','http://localhost:3000/ai-page-gen4','https://businessboy.ai/ai-page-gen4?analytics=off']) assert.equal(browser(url).scripts.length,0);
  const storage = new Map();
  browser('https://businessboy.ai/ai-page-gen4?analytics=off',storage);
  assert.equal(browser('https://businessboy.ai/ai-page-gen4',storage).scripts.length,0);
  assert.equal(browser('https://businessboy.ai/ai-page-gen4?analytics=on',storage).scripts.length,1);
});
test('LINE click sends only placement and selected package; bootstrap is idempotent', () => {
  const page = browser('https://businessboy.ai/ai-page-gen4');
  assert.equal(page.scripts.length,1);
  page.run(); assert.equal(page.scripts.length,1);
  const link = { id: 'selected-cta', closest: () => ({id:'packages'}), hasAttribute: () => false };
  page.listeners.click({target: {closest: () => link}});
  const event = page.window.vaq.find(entry => entry[0] === 'event')[1];
  assert.equal(event.name,'gen4_line_click');
  assert.deepEqual(JSON.parse(JSON.stringify(event.data)),{placement:'packages',package:'1_year'});
});
test('all public static pages include one tracker, private admin includes none', () => {
  for (const file of readdirSync('.').filter(name => name.endsWith('.html'))) {
    const count = (readFileSync(file,'utf8').match(/src="\/site-analytics.js\?v=1"/g)||[]).length;
    assert.equal(count,(file.includes('admin')||file==='stats.html')?0:1,file);
  }
});

test('self-service enrollment records a register click, never a LINE click or purchase', () => {
  const page = browser('https://businessboy.ai/ai-page-gen4');
  const link = { id: 'register-cta', closest: () => ({id:'packages'}), hasAttribute: name => name === 'data-register' };
  page.listeners.click({target: {closest: () => link}});
  const events = page.window.vaq.filter(entry => entry[0] === 'event').map(entry => entry[1]);
  assert.equal(events.length,1);
  assert.equal(events[0].name,'gen4_register_click');
  assert.deepEqual(JSON.parse(JSON.stringify(events[0].data)),{placement:'packages',package:'1_year'});
});

test('onsite selection is distinct from lifetime for both enrollment paths', () => {
  for (const onsite of [true, false]) for (const register of [true, false]) {
    const page = browser('https://businessboy.ai/ai-page-gen4', new Map(), { duration: 'ตลอดชีพ', onsite });
    const link = { id: register ? 'register-cta' : 'selected-cta', closest: () => ({id:'packages'}), hasAttribute: name => name === 'data-register' && register };
    page.listeners.click({target: {closest: () => link}});
    const event = page.window.vaq.find(entry => entry[0] === 'event')[1];
    assert.equal(event.name, register ? 'gen4_register_click' : 'gen4_line_click');
    assert.equal(event.data.package, onsite ? 'onsite' : 'lifetime');
  }
});
