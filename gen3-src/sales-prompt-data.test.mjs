import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['gen3-src/sales-prompt-data.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { buildSalesPrompt, initialSalesPrompt } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const blocked = /\b(?:STOP|PASS|LIMITED|EVIDENCE_STATUS)\b|HARD GATE|CONFIGURATION GATE|Evidence Map|ผลิตงานต่อเฉพาะเมื่อ|ห้ามสร้างตาราง|ใช้ได้เฉพาะสิ่งที่เห็น/;

test('empty and partially described inputs produce a full brief without evidence or attachment gates', () => {
  for (const character of [false, true]) for (const product of [false, true]) for (const agent of [false, true]) {
    const prompt = buildSalesPrompt({ ...initialSalesPrompt, willAttachCharacterReference: character, willAttachProductReference: product, useAgent: agent });
    assert.doesNotMatch(prompt, blocked);
    assert.match(prompt, /ไม่มีไฟล์แนบก็ทำงานต่อได้/);
    assert.match(prompt, /รวม 3 ฉาก/);
    assert.equal(prompt.includes('งานต่อเนื่องสำหรับ Agent'), agent);
  }
});

test('30 stories and all five manual product scenes survive with no references and Agent enabled', () => {
  const prompt = buildSalesPrompt({ ...initialSalesPrompt, storyCount: '30', sceneCount: '5', productSceneMode: 'manual', productSceneNumbers: [5, 3, 1, 2, 4], useAgent: true });
  assert.doesNotMatch(prompt, blocked);
  assert.match(prompt, /รวม 150 ฉาก/);
  assert.match(prompt, /ให้สินค้าโผล่ใน ฉาก 01, 02, 03, 04, 05 ตรงตามที่เลือกทุกเรื่อง/);
  assert.match(prompt, /ทุกแท็บใช้ “ฉาก 01, 02, 03, 04, 05”/);
  assert.match(prompt, /สร้าง 30 แท็บ/);
});

test('empty or stale manual selections fall back to automatic scenes consistently', () => {
  for (const numbers of [[], [99, -1, 0], null]) {
    const prompt = buildSalesPrompt({ ...initialSalesPrompt, productSceneMode: 'manual', productSceneNumbers: numbers, useAgent: true });
    assert.doesNotMatch(prompt, blocked);
    assert.doesNotMatch(prompt, /ผู้ใช้กำหนด|ทุกแท็บใช้/);
    assert.match(prompt, /B5 = รายการฉากจริงที่ AI เลือก/);
  }
});

test('configured pacing, duration, CTA and native speech remain in the deliverable', () => {
  for (const [speed, range] of [['slow', '10–15'], ['normal', '20–25'], ['fast', '30–35']]) {
    const prompt = buildSalesPrompt({ ...initialSalesPrompt, speechSpeed: speed, sceneDuration: '10 วินาที', cta: 'ทักแชตได้เลย', tone: 'hardsale', productName: 'ของใช้ทดสอบ' });
    assert.ok(prompt.includes(range));
    assert.match(prompt, /10 วินาที/);
    assert.match(prompt, /ทักแชตได้เลย/);
    assert.match(prompt, /hardsale/);
    assert.match(prompt, /same take with accurate Thai lip sync/);
  }
});
