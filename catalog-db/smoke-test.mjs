import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getCatalogProductById, queryCatalog } = require('../api/_catalog-data-source');
const sorts = ['recommended', 'sold-desc', 'rating-desc', 'price-asc', 'price-desc', 'seasonal', 'newest'];

const first = await queryCatalog({ limit: '24' });
assert.equal(first.items.length, Math.min(24, first.matched));
assert.ok(first.total >= first.items.length);
assert.ok(Buffer.byteLength(JSON.stringify(first), 'utf8') < 80_000, 'default API payload must stay below 80 KB');
assert.ok(first.facets.groups.length > 0, 'hierarchical category facets are required');

for (const product of [...first.featured, ...first.items]) {
  assert.match(product.id, /^[A-Za-z0-9_-]{12,80}$/);
  assert.doesNotMatch(product.id, /^\d+-\d+$/, 'public ID must not expose shopId-itemId');
  assert.ok(product.reasonBadges.length <= 3);
  for (const privateField of ['shopId', 'itemId', 'sourceId', 'reasonCodes', 'recommendationScore', 'normalizedSearchText']) {
    assert.equal(Object.hasOwn(product, privateField), false, `API leaked ${privateField}`);
  }
}

const lookup = await getCatalogProductById(first.items[0].id);
assert.equal(lookup?.id, first.items[0].id, 'image lookup must use the opaque public ID');

const automotive = first.facets.groups.find((group) => group.key === 'automotive');
if (automotive) {
  const filtered = await queryCatalog({ group: 'automotive', minSold: '100', minRating: '4.7', stock: 'in-stock', limit: '48' });
  for (const product of filtered.items) {
    assert.equal(product.categoryGroupKey, 'automotive');
    assert.ok(product.itemSold >= 100);
    assert.ok(product.rating >= 4.7);
    assert.equal(product.stockStatus, 'in-stock');
    assert.ok(product.safetyNotice, 'controlled automotive product needs a neutral notice');
  }
}
const rainy = await queryCatalog({ period: 'rainy', price: 'under-100', limit: '48' });
for (const product of rainy.items) {
  assert.ok(product.seasonTags.includes('rainy'));
  assert.ok((product.priceMin ?? product.priceMax) <= 99.99);
}

for (const sort of sorts) {
  const pageOne = await queryCatalog({ sort, limit: '48' });
  assert.ok(pageOne.items.length <= 48, `${sort} exceeded max page size`);
  if (!pageOne.nextCursor) continue;
  const decoded = JSON.parse(Buffer.from(pageOne.nextCursor.split('.')[0], 'base64url').toString('utf8'));
  assert.ok(decoded.c, `${sort} cursor is not bound to a catalog snapshot`);
  assert.doesNotMatch(decoded.id, /^\d+-\d+$/, `${sort} cursor leaked the source ID`);
  const pageTwo = await queryCatalog({ sort, limit: '48', cursor: pageOne.nextCursor });
  const pageOneIds = new Set(pageOne.items.map((item) => item.id));
  assert.equal(pageTwo.items.some((item) => pageOneIds.has(item.id)), false, `${sort} cursor repeated a row`);
}

await assert.rejects(() => queryCatalog({ cursor: 'tampered' }), (error) => error?.code === 'INVALID_CURSOR');
if (first.nextCursor) {
  const altered = `${first.nextCursor.slice(0, -1)}${first.nextCursor.endsWith('a') ? 'b' : 'a'}`;
  await assert.rejects(() => queryCatalog({ cursor: altered }), (error) => error?.code === 'INVALID_CURSOR');
  await assert.rejects(() => queryCatalog({ cursor: first.nextCursor, sort: 'sold-desc' }), (error) => error?.code === 'INVALID_CURSOR');
}

process.stdout.write(`Catalog API smoke test passed: ${first.total} ranked products, ${first.facets.groups.length} category groups\n`);
