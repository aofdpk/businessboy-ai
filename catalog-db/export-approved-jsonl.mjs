import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const catalog = require('../api/_gen3-products');
const [outputArgument, expectedArgument] = process.argv.slice(2);
const expectedRanked = Number.parseInt(expectedArgument || process.env.GEN3_CATALOG_EXPECTED_RANKED || '20000', 10);
if (!outputArgument) throw new Error('Usage: node catalog-db/export-approved-jsonl.mjs <output.jsonl> [expected-ranked]');
if (!Number.isInteger(expectedRanked) || expectedRanked < 1) throw new Error('Expected ranked count must be a positive integer');

const featured = Array.isArray(catalog.featured) ? catalog.featured : catalog.featured ? [catalog.featured] : [];
const ranked = Array.isArray(catalog.ranked) ? catalog.ranked : [];
if (featured.length !== 1) throw new Error(`Expected exactly 1 featured product, received ${featured.length}`);
if (ranked.length !== expectedRanked) throw new Error(`Expected ${expectedRanked} ranked products, received ${ranked.length}`);

function publicIdFor(id) {
  return createHash('sha256').update(`businessboy-catalog:${id}`).digest('base64url').slice(0, 24);
}

const seenIds = new Set();
const seenPublicIds = new Set();
function approvedRecord(record, isFeatured) {
  if (!record || typeof record !== 'object' || !String(record.id || '')) throw new Error('Catalog record is missing id');
  if (!isFeatured && record.reviewStatus !== 'approved') throw new Error(`Ranked record ${record.id} is not approved`);
  if (!String(record.normalizedSearchText || '').trim()) throw new Error(`Record ${record.id} is missing normalizedSearchText`);
  const id = String(record.id);
  const publicId = publicIdFor(id);
  if (seenIds.has(id) || seenPublicIds.has(publicId)) throw new Error(`Duplicate catalog identifier: ${id}`);
  seenIds.add(id);
  seenPublicIds.add(publicId);
  const { shopId: _shopId, itemId: _itemId, ...safeRecord } = record;
  return {
    ...safeRecord,
    featured: isFeatured,
    publicId,
    riskTier: isFeatured ? 'green' : record.riskTier,
    reviewStatus: 'approved',
    reviewMethod: isFeatured ? 'owner-featured' : record.reviewMethod,
  };
}

const outputPath = resolve(outputArgument);
const approvedRecords = [...featured.map((item) => approvedRecord(item, true)), ...ranked.map((item) => approvedRecord(item, false))];
await mkdir(dirname(outputPath), { recursive: true });
const outputHandle = await open(outputPath, 'wx');
const output = outputHandle.createWriteStream({ encoding: 'utf8' });
for (const record of approvedRecords) {
  if (!output.write(`${JSON.stringify(record)}\n`)) await once(output, 'drain');
}
const finished = once(output, 'finish');
output.end();
await finished;
process.stdout.write(`Exported ${expectedRanked} approved ranked products and 1 featured product to ${outputPath}\n`);
