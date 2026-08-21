import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';

const workspace = new URL('../', import.meta.url);
const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
const activate = await readFile(new URL('./activate-run.mjs', import.meta.url), 'utf8');
const rollback = await readFile(new URL('./rollback-run.mjs', import.meta.url), 'utf8');
const importer = await readFile(new URL('./import-jsonl-to-neon.mjs', import.meta.url), 'utf8');
const exporter = await readFile(new URL('./export-approved-jsonl.mjs', import.meta.url), 'utf8');
const catalogDataSource = await readFile(new URL('../api/_catalog-data-source.js', import.meta.url), 'utf8');
const productsApp = await readFile(new URL('../gen3-src/products-app.tsx', import.meta.url), 'utf8');
assert.match(schema, /actual_ranked\s*<>\s*p_expected_ranked/);
assert.match(schema, /actual_featured\s*<>\s*1/);
assert.match(schema, /actual_total\s*<>\s*p_expected_ranked\s*\+\s*1/);
assert.match(schema, /current_status\s*<>\s*'staged'/);
assert.match(schema, /current_status\s*<>\s*'retired'/);
assert.match(schema, /pg_advisory_xact_lock/, 'activation and rollback must be serialized');
assert.match(schema, /actual_distinct_ranks\s*<>\s*p_expected_ranked/, 'activation must verify exact rank continuity');
assert.match(activate, /gen3_activate_catalog_run\(\$1, \$2, FALSE\)/);
assert.match(rollback, /gen3_activate_catalog_run\(\$1, \$2, TRUE\)/);
for (const column of ['metadata_version', 'evergreen', 'season_scores', 'season_reasons', 'month_scores', 'month_reasons']) {
  assert.match(schema, new RegExp(`\\b${column}\\b`), `schema is missing ${column}`);
}
assert.match(schema, /merchandising_tags/);
for (const tag of ['fashion-sleepwear', 'fashion-plus-size', 'fashion-office']) assert.match(schema, new RegExp(tag));
assert.match(schema, /gen3_catalog_price_min_effective_idx[\s\S]{0,180}COALESCE\(price_min, price_max, 9000000000000\)/, 'price-ascending index must use the runtime sentinel');
assert.equal([...catalogDataSource.matchAll(/COALESCE\(p\.price_min, p\.price_max, 9000000000000\)/g)].length, 2, 'month and non-month price-ascending SQL must match the expression index');
assert.doesNotMatch(catalogDataSource, /COALESCE\(p\.price_min, p\.price_max, 9007199254740991\)/, 'price-ascending SQL must not bypass the expression index with a different sentinel');
assert.doesNotMatch(importer, /\|\|\s*'20000'/, 'importer must not default full Neon runs to 20,000');
assert.doesNotMatch(exporter, /_gen3-products/, 'full Neon export must not read the compact bundled fallback');
assert.doesNotMatch(productsApp, /มี\.ค\.–พ\.ค\.|มิ\.ย\.–ต\.ค\.|พ\.ย\.–ก\.พ\./, 'UI must not publish rigid ranges that omit v4 climate transition months');
for (const familiarSeasonLabel of ['หน้าร้อน/ช่วงอากาศร้อน', 'หน้าฝน/ช่วงฝน', 'หน้าหนาว/ช่วงอากาศเย็น']) {
  assert.match(productsApp, new RegExp(familiarSeasonLabel), `UI is missing familiar season label: ${familiarSeasonLabel}`);
}

function runImporter(filePath, expected) {
  return new Promise((resolve) => {
    const args = ['catalog-db/import-jsonl-to-neon.mjs', filePath, 'contract-test-run'];
    if (expected !== undefined) args.push(String(expected));
    args.push('--validate-only');
    const child = spawn(process.execPath, args, {
      cwd: workspace,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function runExporter(sourcePath, outputPath, expected) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['catalog-db/export-approved-jsonl.mjs', outputPath, ...(expected === undefined ? [] : [String(expected)])], {
      cwd: workspace,
      env: { ...process.env, GEN3_CATALOG_JSON: sourcePath },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'businessboy-catalog-contract-'));
try {
  const common = {
    cleanName: 'สินค้าทดสอบ', summary: 'รายละเอียดกลางสำหรับทดสอบ', normalizedSearchText: 'สินค้าทดสอบ',
    reviewStatus: 'approved', riskTier: 'green', categoryGroupKey: 'test', categoryGroup: 'ทดสอบ',
    categoryKey: 'test-item', category: 'สินค้าทดสอบ', imageUrl: 'https://cf.shopee.co.th/file/test',
    productUrl: 'https://shopee.co.th/product/1/2', checkedAt: '2026-08-18T00:00:00+07:00', priceMin: 100,
  };
  const validPath = join(temporaryDirectory, 'valid.jsonl');
  await writeFile(validPath, `${JSON.stringify({ ...common, id: 'featured', featured: true })}\n${JSON.stringify({ ...common, id: 'ranked', featured: false, rank: 1 })}\n`, 'utf8');
  const valid = await runImporter(validPath);
  assert.equal(valid.code, 0, valid.stderr);
  assert.match(valid.stdout, /1 approved ranked products \+ 1 featured product/);

  const v4 = {
    ...common,
    metadataVersion: 'seasonal-v4', evergreen: true, seasonTags: ['all-year'], seasonScores: {}, seasonReasons: {},
    monthTags: [2], monthScores: { 2: 88 }, monthReasons: { 2: [
      'เหมาะกับแคมเปญเดือนกุมภาพันธ์',
      'สอดคล้องกับช่วงอากาศในเดือนนี้',
      'รองรับการวางแผนเนื้อหาตามฤดูกาล',
      'มีเหตุผลเสริมจากแคมเปญประจำเดือน',
    ] }, campaignTags: ['valentine'],
  };
  const v4Path = join(temporaryDirectory, 'valid-v4.jsonl');
  await writeFile(v4Path, `${JSON.stringify({ ...v4, id: 'featured-v4', featured: true })}\n${JSON.stringify({ ...v4, id: 'ranked-v4', featured: false, rank: 1 })}\n`, 'utf8');
  const validV4 = await runImporter(v4Path);
  assert.equal(validV4.code, 0, validV4.stderr);

  const v5 = { ...v4, catalogSchemaVersion: 5, merchandisingTags: ['fashion-office'] };
  const v5Path = join(temporaryDirectory, 'valid-v5.jsonl');
  await writeFile(v5Path, `${JSON.stringify({ ...v5, id: 'featured-v5', featured: true })}\n${JSON.stringify({ ...v5, id: 'ranked-v5-a', featured: false, rank: 1 })}\n${JSON.stringify({ ...v5, id: 'ranked-v5-b', featured: false, rank: 2, merchandisingTags: ['fashion-plus-size', 'fashion-office'] })}\n`, 'utf8');
  const validV5 = await runImporter(v5Path);
  assert.equal(validV5.code, 0, validV5.stderr);
  assert.match(validV5.stdout, /2 approved ranked products \+ 1 featured product/, 'importer must infer variable exact run counts');

  const invalidFeaturePath = join(temporaryDirectory, 'invalid-feature-v5.jsonl');
  await writeFile(invalidFeaturePath, `${JSON.stringify({ ...v5, id: 'featured-feature-bad', featured: true })}\n${JSON.stringify({ ...v5, id: 'ranked-feature-bad', featured: false, rank: 1, merchandisingTags: ['internal-rule-id'] })}\n`, 'utf8');
  const invalidFeature = await runImporter(invalidFeaturePath);
  assert.notEqual(invalidFeature.code, 0, 'unknown merchandising tags must fail preflight');
  assert.match(invalidFeature.stderr, /invalid merchandisingTags/);

  const sourceCatalogPath = join(temporaryDirectory, 'catalog-full.json.gz');
  const sourceManifestPath = join(temporaryDirectory, 'catalog-manifest.json');
  const exportedPath = join(temporaryDirectory, 'catalog-v5.jsonl.gz');
  const fullCatalogText = `${JSON.stringify({
    schemaVersion: 5,
    catalogArtifactMode: 'full-approved',
    rankedCount: 2,
    approvedRankedCount: 2,
    bundledFallbackRankedCount: 1,
    featured: [{ ...v5, id: 'featured-export', featured: true, shopId: 'private-shop', itemId: 'private-item' }],
    ranked: [
      { ...v5, id: 'ranked-export-a', featured: false, rank: 1, shopId: 'private-shop-a', itemId: 'private-item-a' },
      { ...v5, id: 'ranked-export-b', featured: false, rank: 2, merchandisingTags: ['fashion-sleepwear'] },
    ],
    reserve: [{ ...v5, id: 'reserve-must-not-export', reserveOrder: 1 }],
  })}\n`;
  const fullCatalogGzip = gzipSync(Buffer.from(fullCatalogText, 'utf8'), { level: 9, mtime: 0 });
  await writeFile(sourceCatalogPath, fullCatalogGzip);
  await writeFile(sourceManifestPath, JSON.stringify({
    artifactVersion: 'catalog-artifacts-v5', schemaVersion: 5, taxonomyVersion: 'taxonomy-v5',
    artifacts: {
      fullCatalog: {
        path: 'catalog-full.json.gz', catalogArtifactMode: 'full-approved', rankedCount: 2, compression: 'gzip',
        compressedBytes: fullCatalogGzip.length,
        compressedSha256: createHash('sha256').update(fullCatalogGzip).digest('hex'),
        uncompressedBytes: Buffer.byteLength(fullCatalogText),
        uncompressedSha256: createHash('sha256').update(fullCatalogText).digest('hex'),
      },
    },
  }), 'utf8');
  const exported = await runExporter(sourceCatalogPath, exportedPath);
  assert.equal(exported.code, 0, exported.stderr);
  assert.match(exported.stdout, /Exported 2 approved ranked products/);
  const exportedLines = gunzipSync(await readFile(exportedPath)).toString('utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(exportedLines.length, 3, 'export must contain only one featured and the full ranked array');
  assert.equal(exportedLines.some((record) => record.id === 'reserve-must-not-export'), false, 'reserve rows must never enter Neon export');
  assert.equal(exportedLines.every((record) => record.catalogSchemaVersion === 5 && Array.isArray(record.merchandisingTags)), true);
  assert.equal(exportedLines.some((record) => Object.hasOwn(record, 'shopId') || Object.hasOwn(record, 'itemId')), false, 'export leaked private source identifiers');
  const exportedPreflight = await runImporter(exportedPath);
  assert.equal(exportedPreflight.code, 0, exportedPreflight.stderr);
  assert.match(exportedPreflight.stdout, /2 approved ranked products \+ 1 featured product/);
  const tamperedManifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'));
  tamperedManifest.artifacts.fullCatalog.compressedSha256 = '0'.repeat(64);
  await writeFile(sourceManifestPath, JSON.stringify(tamperedManifest), 'utf8');
  const rejectedExportPath = join(temporaryDirectory, 'rejected-manifest.jsonl.gz');
  const rejectedExport = await runExporter(sourceCatalogPath, rejectedExportPath);
  assert.notEqual(rejectedExport.code, 0, 'tampered full-artifact hashes must block export');
  assert.match(rejectedExport.stderr, /manifest mismatch for compressedSha256/);
  await assert.rejects(() => access(rejectedExportPath), 'failed export must remove its partial output');

  const invalidV4Path = join(temporaryDirectory, 'invalid-v4.jsonl');
  await writeFile(invalidV4Path, `${JSON.stringify({ ...v4, id: 'featured-bad-v4', featured: true })}\n${JSON.stringify({ ...v4, id: 'ranked-bad-v4', featured: false, rank: 1, monthScores: {} })}\n`, 'utf8');
  const invalidV4 = await runImporter(invalidV4Path);
  assert.notEqual(invalidV4.code, 0, 'v4 monthTags/monthScores mismatch must fail preflight');
  assert.match(invalidV4.stderr, /monthTags\/monthScores mismatch/);

  const invalidPath = join(temporaryDirectory, 'invalid.jsonl');
  await writeFile(invalidPath, `${JSON.stringify({ ...common, id: 'same', featured: true })}\n${JSON.stringify({ ...common, id: 'same', featured: false, rank: 1 })}\n`, 'utf8');
  const invalid = await runImporter(invalidPath);
  assert.notEqual(invalid.code, 0, 'duplicate IDs must fail preflight');
  assert.match(invalid.stderr, /Duplicate identifier/);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

process.stdout.write('Catalog DB pipeline contract test passed\n');
