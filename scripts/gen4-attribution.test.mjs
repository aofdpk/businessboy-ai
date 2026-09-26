import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync('gen4-assets/attribution.js', 'utf8');
function run(query, targets = ['https://kvid.klangtech.com/dpkgen4/register']) {
  const links = targets.map(href => ({ href }));
  vm.runInNewContext(source, { URL, URLSearchParams, location: { href: 'https://businessboy.ai/ai-page-gen4' + query }, document: { querySelectorAll: () => links } });
  return links.map(x => x.href);
}
test('ad and comment campaign labels survive the checkout handoff', () => {
  for (const content of ['ad_120253675300730729', 'dp_d01_c01']) {
    const [result] = run('?utm_source=facebook&utm_content=' + content + '&email=private&fbclid=ignored');
    const url = new URL(result);
    assert.equal(url.searchParams.get('utm_content'), content);
    assert.equal(url.searchParams.get('utm_source'), 'facebook');
    assert.equal(url.searchParams.has('email'), false);
    assert.equal(url.searchParams.has('fbclid'), false);
  }
});
test('invalid labels, unexpanded macros and unrelated links are not forwarded', () => {
  assert.equal(run('?utm_content=ad_%7B%7Bad.id%7D%7D')[0], 'https://kvid.klangtech.com/dpkgen4/register');
  assert.equal(run('?utm_source=facebook', ['https://example.com/register'])[0], 'https://example.com/register');
  assert.equal(run('')[0], 'https://kvid.klangtech.com/dpkgen4/register');
});
