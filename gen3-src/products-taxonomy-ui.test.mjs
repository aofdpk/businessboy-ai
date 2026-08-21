import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./products-app.tsx', import.meta.url), 'utf8');
const filterFields = source.slice(source.indexOf('function FilterFields('), source.indexOf('function LoadingGrid('));

test('catalog taxonomy controls keep the three-level hierarchy', () => {
  assert.match(filterFields, /const categories = selectedGroup\?\.categories \?\? \[\]/);
  assert.doesNotMatch(filterFields, /flatMap\(/, 'categories must not flatten across unselected groups');
  assert.match(filterFields, /disabled=\{props\.group === "all" \|\| categories\.length === 0\}/);
  assert.match(filterFields, /disabled=\{props\.category === "all" \|\| subcategories\.length === 0\}/);
  assert.match(filterFields, /เลือกหมวดหลักก่อน/);
  assert.match(filterFields, /เลือกหมวดสินค้าก่อน/);
  assert.match(source, /aria-label=\{`ยกเลิกหมวดสินค้า \$\{activeCategory\?\.label \|\| "ที่เลือก"\}`\}>\{activeCategory\?\.label \|\| "หมวดสินค้า"\} ×<\/button>/);
});

test('fashion quick filters use only the schema-v5 allowlist and exact feature query', () => {
  for (const key of ['fashion-sleepwear', 'fashion-plus-size', 'fashion-office']) {
    assert.match(source, new RegExp(`key: "${key}"`));
  }
  assert.match(source, /features\?: FeatureFacet\[\]/, 'schema-v4 responses must remain valid');
  assert.match(source, /if \(!Array\.isArray\(facets\)\) return \[\]/, 'missing schema-v5 facets must hide quick filters');
  assert.match(source, /if \(filters\.feature !== "all"\) params\.set\("feature", filters\.feature\)/);
  assert.match(source, /disabled=\{!item\.available && feature !== item\.key\}/, 'zero-count feature facets must be disabled unless selected');
  assert.match(source, /numberFormatter\.format\(item\.count\)/, 'feature chips must show contextual counts');
});

test('catalog interaction and pagination performance contracts remain intact', () => {
  assert.match(source, /const PAGE_SIZE = 24/);
  assert.match(source, /limit: String\(PAGE_SIZE\)/);
  assert.match(source, /window\.setTimeout\(\(\) => setDebouncedQuery\(query\.trim\(\)\), 320\)/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /if \(filters\.cursor\) params\.set\("cursor", filters\.cursor\)/);
  assert.match(source, /setPreviousCursors\(\(current\) => \[\.\.\.current, cursor\]\)/);
});
