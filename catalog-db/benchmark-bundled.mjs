import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { _testing, queryCatalog } = require('../api/_catalog-data-source');

async function measure(label, operation) {
  const started = performance.now();
  const value = await operation();
  const elapsed = performance.now() - started;
  process.stdout.write(`${label}: ${elapsed.toFixed(1)} ms\n`);
  return value;
}

const common = { group: 'automotive', minRating: '4.7', sort: 'sold-desc', limit: '24' };
_testing.clearRuntimeCaches();
const cold = await measure('cold/common query', () => queryCatalog(common));
await measure('warm/common query', () => queryCatalog(common));
if (cold.nextCursor) await measure('cursor page with reused aggregate facets', () => queryCatalog({ ...common, cursor: cold.nextCursor }));
_testing.clearRuntimeCaches();
await measure('50 concurrent identical cold queries (in-flight deduped)', () => Promise.all(Array.from({ length: 50 }, () => queryCatalog(common))));
await measure('50 concurrent identical cached queries', () => Promise.all(Array.from({ length: 50 }, () => queryCatalog(common))));
const distinct = await measure('50 concurrent distinct queries', () => Promise.all(Array.from({ length: 50 }, (_, index) => queryCatalog({
  q: `benchmark-${index}`,
  sort: index % 2 ? 'rating-desc' : 'recommended',
  price: ['all', 'under-100', '100-300', '301-500', '501-1000'][index % 5],
  limit: '24',
}))));
if (distinct.some((response) => response.items.length > 48)) throw new Error('Benchmark found an oversized page');
