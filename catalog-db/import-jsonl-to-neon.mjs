import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename } from 'node:path';
import { neon } from '@neondatabase/serverless';

const argumentsList = process.argv.slice(2);
const validateOnly = argumentsList.includes('--validate-only');
const positional = argumentsList.filter((value) => value !== '--validate-only');
const [filePath, runId, expectedArgument] = positional;
const expectedRanked = Number.parseInt(expectedArgument || process.env.GEN3_CATALOG_EXPECTED_RANKED || '20000', 10);
const connectionString = process.env.GEN3_CATALOG_DATABASE_URL || process.env.DATABASE_URL;
if (!filePath || !runId) throw new Error('Usage: node catalog-db/import-jsonl-to-neon.mjs <catalog.jsonl> <new-run-id> [expected-ranked] [--validate-only]');
if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,80}$/.test(runId)) throw new Error('Run ID must be 3–81 safe characters');
if (!Number.isInteger(expectedRanked) || expectedRanked < 1) throw new Error('Expected ranked count must be a positive integer');
if (!validateOnly && !connectionString) throw new Error('Set GEN3_CATALOG_DATABASE_URL before importing');

const columns = [
  'run_id', 'id', 'public_id', 'rank', 'featured', 'category_group_key', 'category_group', 'category_key', 'category',
  'subcategory_key', 'subcategory', 'image_url', 'clean_name', 'summary', 'price_min', 'price_max', 'price_type',
  'checked_at', 'product_url', 'shop_name', 'item_sold', 'rating', 'likes', 'shop_rating', 'shop_type',
  'stock_status', 'stock_level', 'recommendation_score', 'reason_codes', 'season_tags', 'month_tags',
  'seasonal_score', 'season_reason', 'risk_tier', 'review_status', 'review_method', 'normalized_search_text', 'source_hash',
];

function publicIdFor(record) {
  if (/^[A-Za-z0-9_-]{12,80}$/.test(String(record.publicId || ''))) return String(record.publicId);
  return createHash('sha256').update(`businessboy-catalog:${record.id}`).digest('base64url').slice(0, 24);
}

function trustedShopeeUrl(value, image) {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return false;
    if (host === 'shopee.co.th' || host.endsWith('.shopee.co.th')) return true;
    return image && (host === 'susercontent.com' || host.endsWith('.susercontent.com'));
  } catch {
    return false;
  }
}

function valueFor(record) {
  return [
    runId, String(record.id), publicIdFor(record), record.rank ?? null, record.featured === true, record.categoryGroupKey, record.categoryGroup,
    record.categoryKey, record.category, record.subcategoryKey || null, record.subcategory || null, record.imageUrl,
    record.cleanName, record.summary || '', record.priceMin ?? null, record.priceMax ?? null, record.priceType || 'fixed',
    record.checkedAt, record.productUrl, record.shopName || null, record.itemSold ?? null, record.rating ?? null,
    record.likes ?? null, record.shopRating ?? null, record.shopType || 'general', record.stockStatus || 'unknown',
    record.stockLevel || null, record.recommendationScore ?? 0, record.reasonCodes || [], record.seasonTags || [],
    record.monthTags || [], record.seasonalScore ?? 0, record.seasonReason || '', record.riskTier || 'green',
    record.reviewStatus, record.reviewMethod || null, record.normalizedSearchText, record.sourceHash || null,
  ];
}

async function* jsonLines() {
  const input = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of input) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      yield { lineNumber, record: JSON.parse(line) };
    } catch (error) {
      throw new Error(`Invalid JSON on line ${lineNumber}: ${error.message}`);
    }
  }
}

async function preflight() {
  const ids = new Set();
  const publicIds = new Set();
  const ranks = new Set();
  let ranked = 0;
  let featured = 0;
  let total = 0;
  for await (const { lineNumber, record } of jsonLines()) {
    const id = String(record?.id || '');
    const requiredText = ['cleanName', 'summary', 'normalizedSearchText', 'categoryGroupKey', 'categoryGroup', 'categoryKey', 'category', 'imageUrl', 'productUrl', 'checkedAt'];
    if (!id || requiredText.some((field) => !String(record[field] || '').trim())) {
      throw new Error(`Line ${lineNumber} is missing one or more required catalog fields`);
    }
    if (record.reviewStatus !== 'approved') throw new Error(`Line ${lineNumber} (${id}) is not approved`);
    if (!['green', 'amber'].includes(record.riskTier)) throw new Error(`Line ${lineNumber} (${id}) has invalid riskTier`);
    if (!Number.isFinite(Date.parse(record.checkedAt))) throw new Error(`Line ${lineNumber} (${id}) has invalid checkedAt`);
    if (![record.priceMin, record.priceMax].some((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) {
      throw new Error(`Line ${lineNumber} (${id}) has no valid non-negative price`);
    }
    if (!trustedShopeeUrl(record.imageUrl, true) || !trustedShopeeUrl(record.productUrl, false)) {
      throw new Error(`Line ${lineNumber} (${id}) has an untrusted product or image URL`);
    }
    const publicId = publicIdFor(record);
    if (ids.has(id) || publicIds.has(publicId)) throw new Error(`Duplicate identifier on line ${lineNumber}: ${id}`);
    ids.add(id);
    publicIds.add(publicId);
    if (record.featured === true) featured += 1;
    else {
      if (!Number.isInteger(record.rank) || record.rank < 1 || ranks.has(record.rank)) throw new Error(`Line ${lineNumber} (${id}) has invalid or duplicate rank`);
      ranks.add(record.rank);
      ranked += 1;
    }
    total += 1;
  }
  if (ranked !== expectedRanked || featured !== 1 || total !== expectedRanked + 1) {
    throw new Error(`JSONL count mismatch: expected ${expectedRanked} ranked + 1 featured, received ${ranked} ranked + ${featured} featured`);
  }
  for (let rank = 1; rank <= expectedRanked; rank += 1) {
    if (!ranks.has(rank)) throw new Error(`JSONL is missing rank ${rank}`);
  }
  return { ranked, featured, total };
}

const counts = await preflight();
if (validateOnly) {
  process.stdout.write(`JSONL valid: ${counts.ranked} approved ranked products + ${counts.featured} featured product\n`);
  process.exit(0);
}

const sql = neon(connectionString);
const existing = await sql.query(`SELECT r.id, r.status, COUNT(p.id)::int AS row_count
  FROM gen3_catalog_runs r LEFT JOIN gen3_catalog_products p ON p.run_id = r.id
  WHERE r.id = $1 GROUP BY r.id, r.status`, [runId]);
if (existing[0]) throw new Error(`Run ID ${runId} already exists (${existing[0].status}, ${existing[0].row_count} rows); use a new run ID`);

await sql.query(`INSERT INTO gen3_catalog_runs (id, status, schema_version, generated_at, total_count, metadata)
  VALUES ($1, 'staged', 3, NOW(), $2, $3::jsonb)`, [runId, expectedRanked, JSON.stringify({ importedFrom: basename(filePath), expectedRanked })]);

let imported = 0;
let batch = [];
async function flush() {
  if (!batch.length) return;
  const params = [];
  const rows = batch.map((record) => {
    const values = valueFor(record);
    const placeholders = values.map((value) => { params.push(value); return `$${params.length}`; });
    return `(${placeholders.join(',')})`;
  });
  await sql.query(`INSERT INTO gen3_catalog_products (${columns.join(',')}) VALUES ${rows.join(',')}`, params);
  imported += batch.length;
  batch = [];
}

try {
  for await (const { record } of jsonLines()) {
    batch.push(record);
    if (batch.length >= 100) await flush();
  }
  await flush();
  const verified = await sql.query(`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE featured = false AND review_status = 'approved')::int AS approved_ranked,
      COUNT(*) FILTER (WHERE featured = true AND review_status = 'approved')::int AS approved_featured
    FROM gen3_catalog_products WHERE run_id = $1`, [runId]);
  const result = verified[0];
  if (Number(result.total) !== expectedRanked + 1 || Number(result.approved_ranked) !== expectedRanked || Number(result.approved_featured) !== 1) {
    throw new Error(`Database verification failed after import: ${JSON.stringify(result)}`);
  }
} catch (error) {
  await sql.query(`DELETE FROM gen3_catalog_runs WHERE id = $1 AND status = 'staged'`, [runId]).catch(() => undefined);
  throw error;
}

process.stdout.write(`Staged and verified ${imported} records (${expectedRanked} approved ranked + 1 featured) in new run ${runId}\n`);
