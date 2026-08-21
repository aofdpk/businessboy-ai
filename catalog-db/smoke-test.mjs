import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { _testing, getCatalogProductById, queryCatalog } = require('../api/_catalog-data-source');
const sorts = ['recommended', 'sold-desc', 'rating-desc', 'price-asc', 'price-desc', 'seasonal', 'newest'];

const first = await queryCatalog({ limit: '24' });
assert.equal(first.items.length, Math.min(24, first.matched));
assert.ok(first.total >= first.items.length);
assert.ok(Buffer.byteLength(JSON.stringify(first), 'utf8') < 80_000, 'default API payload must stay below 80 KB');
assert.ok(first.facets.groups.length > 0, 'hierarchical category facets are required');
assert.equal(first.facets.groups.every((group) => group.categories.length === 0), true, 'default payload must defer middle and leaf taxonomy until a parent is selected');
assert.equal(first.periodSummary, null);
assert.equal(first.facets.seasons.find((facet) => facet.key === 'all-year')?.label, 'ไม่เน้นฤดูกาล');
for (const month of first.facets.months) {
  assert.equal(month.count, month.peakCount + month.evergreenFallbackCount, `month ${month.month} facet breakdown is inconsistent`);
  assert.equal(month.available, month.count > 0);
}

for (const product of [...first.featured, ...first.items]) {
  assert.match(product.id, /^[A-Za-z0-9_-]{12,80}$/);
  assert.doesNotMatch(product.id, /^\d+-\d+$/, 'public ID must not expose shopId-itemId');
  assert.ok(product.reasonBadges.length <= 3);
  assert.ok(Array.isArray(product.merchandisingTags), 'public merchandisingTags must always be an array');
  assert.equal(product.merchandisingTags.every((tag) => ['fashion-sleepwear', 'fashion-plus-size', 'fashion-office'].includes(tag)), true);
  for (const privateField of ['shopId', 'itemId', 'sourceId', 'reasonCodes', 'recommendationScore', 'normalizedSearchText', 'evergreen', 'seasonScores', 'seasonReasons', 'monthScores', 'monthReasons']) {
    assert.equal(Object.hasOwn(product, privateField), false, `API leaked ${privateField}`);
  }
}

assert.ok(Array.isArray(first.facets.features), 'feature facets must keep a stable array contract');
assert.equal(first.applied.feature, 'all');
const featureFilters = _testing.parseFilters({ feature: 'fashion-office' });
const featureSql = _testing.sqlFilters(featureFilters, 'contract-run', false, 5);
assert.match(featureSql.where, /merchandising_tags/);
assert.ok(featureSql.params.includes('fashion-office'));
assert.equal(_testing.parseFilters({ feature: 'internal-rule-id' }).feature, 'all', 'unknown feature keys must fail closed to the unfiltered state');

const aggregateContext = { snapshotToken: 'snapshot-contract' };
const aggregateFirst = _testing.parseFilters({ group: 'fashion', sort: 'recommended', limit: '24' });
const aggregateCursor = { ...aggregateFirst, sort: 'price-desc', limit: 48, offset: 999, cursor: 'opaque-cursor' };
assert.equal(_testing.aggregateCacheKey(aggregateContext, aggregateFirst), _testing.aggregateCacheKey(aggregateContext, aggregateCursor), 'facet cache must ignore sort and pagination');

let inFlightExecutions = 0;
const inFlight = new Map();
const shared = await Promise.all(Array.from({ length: 25 }, () => _testing.shareInFlight(inFlight, 'same-query', async () => {
  inFlightExecutions += 1;
  await new Promise((resolve) => setImmediate(resolve));
  return { ok: true };
})));
assert.equal(inFlightExecutions, 1, 'identical cold requests must share one in-flight operation');
assert.equal(shared.every((value) => value.ok), true);
assert.equal(inFlight.size, 0, 'completed in-flight entries must be released');
let rejectedExecutions = 0;
await assert.rejects(() => Promise.all(Array.from({ length: 10 }, () => _testing.shareInFlight(inFlight, 'rejected-query', async () => {
  rejectedExecutions += 1;
  await new Promise((resolve) => setImmediate(resolve));
  throw new Error('expected shared rejection');
}))));
assert.equal(rejectedExecutions, 1, 'identical failing requests must still share one in-flight operation');
assert.equal(inFlight.size, 0, 'rejected in-flight entries must be released');

_testing.clearRuntimeCaches();
const neonStatements = [];
const fakeSql = {
  async query(statement, params) {
    neonStatements.push({ statement, params });
    return [];
  },
};
const neonContext = {
  runId: 'run-60000-contract',
  schemaVersion: 5,
  snapshotToken: 'snapshot-60000-contract',
  total: 60_000,
  facets: {
    groups: [], seasons: [], months: [], shopTypes: [],
    features: [
      { key: 'fashion-sleepwear', label: 'ชุดนอน', count: 0, available: false },
      { key: 'fashion-plus-size', label: 'แฟชั่นพลัสไซส์', count: 0, available: false },
      { key: 'fashion-office', label: 'ชุดออฟฟิศ', count: 0, available: false },
    ],
  },
};
const neonFacetFilters = _testing.parseFilters({ group: 'fashion', feature: 'fashion-office' });
await _testing.neonAggregate(neonContext, neonFacetFilters, fakeSql);
const queryCountAfterFirstPage = neonStatements.length;
await _testing.neonAggregate(neonContext, { ...neonFacetFilters, cursor: 'opaque-page-two-cursor', limit: 48 }, fakeSql);
assert.equal(neonStatements.length, queryCountAfterFirstPage, 'cursor pages must reuse cached Neon counts and facets');
const featureFacetStatement = neonStatements.find(({ statement }) => statement.includes('UNNEST(p.merchandising_tags)'));
assert.ok(featureFacetStatement, 'Neon feature facet query is missing');
assert.doesNotMatch(featureFacetStatement.statement, /merchandising_tags\s*@>/, 'feature facet must exclude only its own selected feature');
assert.ok(neonStatements.some(({ statement }) => /merchandising_tags\s*@>/.test(statement)), 'selected feature must constrain products and other facets');

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

let verifiedZeroPeriodIntersection = false;
for (const group of first.facets.groups) {
  const groupContext = await queryCatalog({ group: group.key, limit: '1' });
  const unavailableSeason = groupContext.facets.seasons.find((facet) => facet.key !== 'all-year' && !facet.available);
  if (!unavailableSeason) continue;
  const empty = await queryCatalog({ group: group.key, period: unavailableSeason.key, limit: '1' });
  assert.equal(empty.matched, 0);
  assert.equal(empty.facets.seasons.find((facet) => facet.key === unavailableSeason.key)?.available, false, 'period facet must honor the selected group');
  verifiedZeroPeriodIntersection = true;
  break;
}
assert.ok(verifiedZeroPeriodIntersection, 'fixture needs at least one zero group/season intersection');

const automotiveFacets = await queryCatalog({ group: 'automotive', limit: '24' });
const automotiveGroup = automotiveFacets.facets.groups.find((group) => group.key === 'automotive');
assert.ok(automotiveGroup?.available);
assert.equal(automotiveFacets.facets.groups.filter((group) => group.key !== 'automotive').every((group) => group.categories.length === 0), true, 'only the selected group may expose middle categories');
assert.equal(automotiveGroup.categories.reduce((sum, category) => sum + category.count, 0), automotiveFacets.matched, 'category facets must retain the selected parent group');
assert.equal(automotiveGroup.categories.every((category) => category.subcategories.length === 0), true, 'leaf taxonomy must be deferred until a middle category is selected');
const selectedCategory = automotiveGroup.categories.find((category) => category.available);
if (selectedCategory) {
  const categoryFacets = await queryCatalog({ group: 'automotive', category: selectedCategory.key, limit: '24' });
  const selectedCategoryFacet = categoryFacets.facets.groups.find((group) => group.key === 'automotive')?.categories.find((category) => category.key === selectedCategory.key);
  assert.equal(selectedCategoryFacet?.count, categoryFacets.matched, 'selected category count must exclude only the category dimension');
  assert.equal(categoryFacets.facets.groups.find((group) => group.key === 'automotive')?.categories.filter((category) => category.key !== selectedCategory.key).every((category) => category.subcategories.length === 0), true, 'only the selected middle category may expose leaf categories');
  assert.equal(selectedCategoryFacet?.subcategories.reduce((sum, subcategory) => sum + subcategory.count, 0), categoryFacets.matched, 'subcategory facets must retain group and category');
}

let tieredMonthQuery = null;
for (const group of first.facets.groups) {
  const groupContext = await queryCatalog({ group: group.key, limit: '1' });
  const month = groupContext.facets.months.find((facet) => facet.peakCount > 0 && facet.peakCount < 48 && facet.evergreenFallbackCount > 0);
  if (month) {
    tieredMonthQuery = { group: group.key, period: `month-${month.month}` };
    break;
  }
}
assert.ok(tieredMonthQuery, 'fixture needs a month with both peak and evergreen fallback rows');
for (const sort of sorts) {
  const monthPage = await queryCatalog({ ...tieredMonthQuery, sort, limit: '48' });
  assert.equal(monthPage.periodSummary.peakMatches + monthPage.periodSummary.evergreenFallbackMatches, monthPage.matched);
  assert.ok(monthPage.items.some((product) => product.periodMatch.kind === 'peak'), `${sort} omitted peak rows`);
  assert.ok(monthPage.items.some((product) => product.periodMatch.kind === 'evergreen-fallback'), `${sort} did not reach evergreen fallback rows`);
  let sawFallback = false;
  for (const product of monthPage.items) {
    if (product.periodMatch.kind === 'evergreen-fallback') sawFallback = true;
    if (sawFallback) assert.notEqual(product.periodMatch.kind, 'peak', `${sort} put a peak-month row after evergreen fallback`);
  }
  assert.ok(monthPage.nextCursor, `${sort} month fixture needs a cursor for SQL parity checks`);
  const sqlFilters = _testing.parseFilters({ ...tieredMonthQuery, sort, limit: '48', cursor: monthPage.nextCursor });
  const [firstSqlSort] = _testing.sqlSortExpressions(sqlFilters, 4);
  const sqlOrder = _testing.sqlOrder(sqlFilters, 4);
  const sqlCursor = _testing.sqlFilters(sqlFilters, 'contract-run', true, 4).where;
  assert.ok(sqlOrder.includes(firstSqlSort), `${sort} SQL order does not use the month-tier expression`);
  assert.ok(sqlCursor.includes(firstSqlSort), `${sort} SQL cursor does not use the same month-tier expression`);
  assert.match(firstSqlSort, /month_tags/, `${sort} SQL sort lost peak-month priority`);
}

const unavailableSeasonalSort = await queryCatalog({ sort: 'seasonal', limit: '24' });
assert.equal(unavailableSeasonalSort.applied.sort, 'recommended', 'period-fit sort must be unavailable without a selected period');

for (const sort of sorts) {
  const sortQuery = sort === 'seasonal' ? { sort, period: 'month-8', limit: '48' } : { sort, limit: '48' };
  const pageOne = await queryCatalog(sortQuery);
  assert.ok(pageOne.items.length <= 48, `${sort} exceeded max page size`);
  if (!pageOne.nextCursor) continue;
  const decoded = JSON.parse(Buffer.from(pageOne.nextCursor.split('.')[0], 'base64url').toString('utf8'));
  assert.ok(decoded.c, `${sort} cursor is not bound to a catalog snapshot`);
  assert.doesNotMatch(decoded.id, /^\d+-\d+$/, `${sort} cursor leaked the source ID`);
  const pageTwo = await queryCatalog({ ...sortQuery, cursor: pageOne.nextCursor });
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
