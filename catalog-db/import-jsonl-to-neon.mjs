import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename } from 'node:path';
import { createGunzip } from 'node:zlib';
import { neon } from '@neondatabase/serverless';

const argumentsList = process.argv.slice(2);
const validateOnly = argumentsList.includes('--validate-only');
const positional = argumentsList.filter((value) => value !== '--validate-only');
const [filePath, runId, expectedArgument] = positional;
const expectedText = expectedArgument || process.env.GEN3_CATALOG_EXPECTED_RANKED || '';
const expectedRanked = expectedText ? Number.parseInt(expectedText, 10) : null;
const connectionString = process.env.GEN3_CATALOG_DATABASE_URL || process.env.DATABASE_URL;
if (!filePath || !runId) throw new Error('Usage: node catalog-db/import-jsonl-to-neon.mjs <catalog.jsonl> <new-run-id> [expected-ranked] [--validate-only]');
if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,80}$/.test(runId)) throw new Error('Run ID must be 3–81 safe characters');
if (expectedRanked !== null && (!Number.isInteger(expectedRanked) || expectedRanked < 1)) throw new Error('Expected ranked count must be a positive integer');
if (!validateOnly && !connectionString) throw new Error('Set GEN3_CATALOG_DATABASE_URL before importing');

const columns = [
  'run_id', 'id', 'public_id', 'rank', 'featured', 'category_group_key', 'category_group', 'category_key', 'category',
  'subcategory_key', 'subcategory', 'image_url', 'clean_name', 'summary', 'price_min', 'price_max', 'price_type',
  'checked_at', 'product_url', 'shop_name', 'item_sold', 'rating', 'likes', 'shop_rating', 'shop_type',
  'stock_status', 'stock_level', 'merchandising_tags', 'recommendation_score', 'reason_codes', 'season_tags', 'month_tags',
  'seasonal_score', 'season_reason', 'metadata_version', 'evergreen', 'season_scores', 'season_reasons', 'month_scores',
  'month_reasons', 'campaign_tags', 'risk_tier', 'review_status', 'review_method', 'normalized_search_text', 'source_hash',
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
    record.stockLevel || null, record.merchandisingTags || [], record.recommendationScore ?? 0, record.reasonCodes || [], record.seasonTags || [],
    record.monthTags || [], record.seasonalScore ?? 0, record.seasonReason || '', record.metadataVersion || 'seasonal-legacy',
    record.evergreen === true, JSON.stringify(record.seasonScores || {}), JSON.stringify(record.seasonReasons || {}),
    JSON.stringify(record.monthScores || {}), JSON.stringify(record.monthReasons || {}), record.campaignTags || [], record.riskTier || 'green',
    record.reviewStatus, record.reviewMethod || null, record.normalizedSearchText, record.sourceHash || null,
  ];
}

async function* jsonLines() {
  const rawInput = createReadStream(filePath);
  const decodedInput = filePath.toLowerCase().endsWith('.gz') ? rawInput.pipe(createGunzip()) : rawInput;
  const input = createInterface({ input: decodedInput, crlfDelay: Infinity });
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
  const rankedMetadataVersions = new Set();
  const catalogSchemaVersions = new Set();
  const allowedMerchandisingTags = new Set(['fashion-sleepwear', 'fashion-plus-size', 'fashion-office']);

  function validateScores(value, allowedKeys, fieldName, lineNumber, id) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Line ${lineNumber} (${id}) has invalid ${fieldName}`);
    for (const [key, score] of Object.entries(value)) {
      if (!allowedKeys.has(String(key)) || !Number.isInteger(score) || score < 0 || score > 100) {
        throw new Error(`Line ${lineNumber} (${id}) has invalid ${fieldName}.${key}`);
      }
    }
  }

  function validateReasons(value, allowedKeys, fieldName, lineNumber, id) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Line ${lineNumber} (${id}) has invalid ${fieldName}`);
    for (const [key, reasons] of Object.entries(value)) {
      if (!allowedKeys.has(String(key)) || !Array.isArray(reasons) || reasons.length < 1 || reasons.length > 4 || reasons.some((reason) =>
        typeof reason !== 'string' || reason.length < 8 || reason.length > 120 || /[\n\r\\#*`<>]/u.test(reason))) {
        throw new Error(`Line ${lineNumber} (${id}) has invalid ${fieldName}.${key}`);
      }
    }
  }

  function validateSeasonalV4(record, lineNumber, id) {
    const seasonKeys = new Set(['hot', 'rainy', 'cool']);
    const monthKeys = new Set(Array.from({ length: 12 }, (_, index) => String(index + 1)));
    if (typeof record.evergreen !== 'boolean') throw new Error(`Line ${lineNumber} (${id}) is missing evergreen`);
    validateScores(record.seasonScores, seasonKeys, 'seasonScores', lineNumber, id);
    validateReasons(record.seasonReasons, seasonKeys, 'seasonReasons', lineNumber, id);
    validateScores(record.monthScores, monthKeys, 'monthScores', lineNumber, id);
    validateReasons(record.monthReasons, monthKeys, 'monthReasons', lineNumber, id);
    const seasonTags = Array.isArray(record.seasonTags) ? record.seasonTags : [];
    const monthTags = Array.isArray(record.monthTags) ? record.monthTags : [];
    if (record.evergreen !== seasonTags.includes('all-year')) throw new Error(`Line ${lineNumber} (${id}) has inconsistent evergreen/all-year metadata`);
    for (const month of monthTags) {
      if (!Number.isInteger(month) || month < 1 || month > 12 || !(Number(record.monthScores[String(month)]) > 0)) {
        throw new Error(`Line ${lineNumber} (${id}) has a monthTags/monthScores mismatch`);
      }
    }
    for (const [month, score] of Object.entries(record.monthScores)) {
      if (score > 0 && (!monthTags.includes(Number(month)) || !record.monthReasons[month]?.length)) {
        throw new Error(`Line ${lineNumber} (${id}) has a monthScores/monthReasons mismatch`);
      }
    }
    for (const season of seasonTags.filter((tag) => seasonKeys.has(tag))) {
      if (!(record.seasonScores[season] > 0) || !record.seasonReasons[season]?.length) {
        throw new Error(`Line ${lineNumber} (${id}) has a season tag/score/reason mismatch`);
      }
    }
  }

  for await (const { lineNumber, record } of jsonLines()) {
    const id = String(record?.id || '');
    const requiredText = ['cleanName', 'summary', 'normalizedSearchText', 'categoryGroupKey', 'categoryGroup', 'categoryKey', 'category', 'imageUrl', 'productUrl', 'checkedAt'];
    if (!id || requiredText.some((field) => !String(record[field] || '').trim())) {
      throw new Error(`Line ${lineNumber} is missing one or more required catalog fields`);
    }
    if (record.reviewStatus !== 'approved') throw new Error(`Line ${lineNumber} (${id}) is not approved`);
    const inferredSchemaVersion = Object.hasOwn(record, 'merchandisingTags') ? 5 : record.metadataVersion === 'seasonal-v4' ? 4 : 3;
    const catalogSchemaVersion = Number(record.catalogSchemaVersion || inferredSchemaVersion);
    if (!Number.isInteger(catalogSchemaVersion) || catalogSchemaVersion < 3 || catalogSchemaVersion > 5) {
      throw new Error(`Line ${lineNumber} (${id}) has unsupported catalogSchemaVersion`);
    }
    catalogSchemaVersions.add(catalogSchemaVersion);
    const merchandisingTags = record.merchandisingTags ?? [];
    if (!Array.isArray(merchandisingTags) || merchandisingTags.some((tag) => !allowedMerchandisingTags.has(tag)) || new Set(merchandisingTags).size !== merchandisingTags.length) {
      throw new Error(`Line ${lineNumber} (${id}) has invalid merchandisingTags`);
    }
    if (catalogSchemaVersion >= 5 && !Object.hasOwn(record, 'merchandisingTags')) {
      throw new Error(`Line ${lineNumber} (${id}) is missing schema-v5 merchandisingTags`);
    }
    if (record.metadataVersion === 'seasonal-v4') validateSeasonalV4(record, lineNumber, id);
    else if (record.metadataVersion && record.metadataVersion !== 'seasonal-legacy') throw new Error(`Line ${lineNumber} (${id}) has unsupported metadataVersion`);
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
      rankedMetadataVersions.add(record.metadataVersion === 'seasonal-v4' ? 'seasonal-v4' : 'seasonal-legacy');
      if (!Number.isInteger(record.rank) || record.rank < 1 || ranks.has(record.rank)) throw new Error(`Line ${lineNumber} (${id}) has invalid or duplicate rank`);
      ranks.add(record.rank);
      ranked += 1;
    }
    total += 1;
  }
  if (expectedRanked !== null && ranked !== expectedRanked) {
    throw new Error(`JSONL count mismatch: expected ${expectedRanked} ranked + 1 featured, received ${ranked} ranked + ${featured} featured`);
  }
  if (ranked < 1 || featured !== 1 || total !== ranked + 1) {
    throw new Error(`JSONL must contain a positive ranked set and exactly 1 featured product; received ${ranked} ranked + ${featured} featured`);
  }
  for (let rank = 1; rank <= ranked; rank += 1) {
    if (!ranks.has(rank)) throw new Error(`JSONL is missing rank ${rank}`);
  }
  if (rankedMetadataVersions.size !== 1) throw new Error('Ranked records mix legacy and seasonal-v4 metadata');
  if (catalogSchemaVersions.size !== 1) throw new Error('Records mix catalog schema versions');
  const schemaVersion = [...catalogSchemaVersions][0];
  if (schemaVersion >= 5 && !rankedMetadataVersions.has('seasonal-v4')) {
    throw new Error('Schema-v5 ranked records must use seasonal-v4 metadata');
  }
  if (schemaVersion < 5 && rankedMetadataVersions.has('seasonal-v4')) return { ranked, featured, total, schemaVersion: 4 };
  return { ranked, featured, total, schemaVersion };
}

const counts = await preflight();
const exactRanked = expectedRanked ?? counts.ranked;
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
  VALUES ($1, 'staged', $2, NOW(), $3, $4::jsonb)`, [runId, counts.schemaVersion, exactRanked, JSON.stringify({ importedFrom: basename(filePath), expectedRanked: exactRanked, metadataVersion: counts.schemaVersion >= 4 ? 'seasonal-v4' : 'seasonal-legacy' })]);

let imported = 0;
let batch = [];
const requestedBatchSize = Number.parseInt(process.env.GEN3_CATALOG_IMPORT_BATCH_SIZE || '250', 10);
const batchSize = Number.isInteger(requestedBatchSize) ? Math.min(500, Math.max(50, requestedBatchSize)) : 250;
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
    if (batch.length >= batchSize) await flush();
  }
  await flush();
  const verified = await sql.query(`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE featured = false AND review_status = 'approved')::int AS approved_ranked,
      COUNT(*) FILTER (WHERE featured = true AND review_status = 'approved')::int AS approved_featured
    FROM gen3_catalog_products WHERE run_id = $1`, [runId]);
  const result = verified[0];
  if (Number(result.total) !== exactRanked + 1 || Number(result.approved_ranked) !== exactRanked || Number(result.approved_featured) !== 1) {
    throw new Error(`Database verification failed after import: ${JSON.stringify(result)}`);
  }
} catch (error) {
  await sql.query(`DELETE FROM gen3_catalog_runs WHERE id = $1 AND status = 'staged'`, [runId]).catch(() => undefined);
  throw error;
}

process.stdout.write(`Staged and verified ${imported} records (${exactRanked} approved ranked + 1 featured) in new run ${runId}\n`);
