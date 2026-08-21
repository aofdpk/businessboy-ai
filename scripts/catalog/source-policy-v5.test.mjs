import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { sanitizeText } from './catalog-lib.mjs';
import {
  evaluateSellableRow,
  hasSourceListingPolicyRisk,
} from './sellable-catalog-lib.mjs';

test('source policy is evaluated before whole-field NFKC can shift the bounded window', () => {
  const sourceTitle = 'แก้วทดสอบขอบเขตข้อความต้นทาง';
  const sourceDescription = `${'ำ'.repeat(1_700)} กรณีสินค้าชำรุดเสียหายไม่ครบผิดขนาด`;
  assert.equal(hasSourceListingPolicyRisk(sourceTitle, sourceDescription), true);
  assert.equal(hasSourceListingPolicyRisk(sanitizeText(sourceTitle), sanitizeText(sourceDescription)), false);

  const columns = ['global_category1', 'global_category2', 'global_category3', 'title', 'description'];
  const index = new Map(columns.map((name, position) => [name, position]));
  const row = ['Home & Living', 'Dining', 'Drinkware', sourceTitle, sourceDescription];
  const rejectionCounts = { _byGroup: new Map(), _bySubcategory: new Map() };
  assert.equal(evaluateSellableRow(row, index, new Date('2026-08-21T00:00:00Z'), rejectionCounts), null);
  assert.equal(rejectionCounts.sourcePolicy, 1);
});

test('row evaluator passes raw source fields into the policy gate', () => {
  const source = readFileSync(new URL('./sellable-catalog-lib.mjs', import.meta.url), 'utf8');
  assert.match(source, /hasSourceListingPolicyRisk\(sourceTitle, sourceDescription\)/u);
  assert.doesNotMatch(source, /hasSourceListingPolicyRisk\(rawTitle, description\)/u);
});
