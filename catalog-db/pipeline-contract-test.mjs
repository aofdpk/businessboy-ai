import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const workspace = new URL('../', import.meta.url);
const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
const activate = await readFile(new URL('./activate-run.mjs', import.meta.url), 'utf8');
const rollback = await readFile(new URL('./rollback-run.mjs', import.meta.url), 'utf8');
const productsApp = await readFile(new URL('../gen3-src/products-app.tsx', import.meta.url), 'utf8');
assert.match(schema, /actual_ranked\s*<>\s*p_expected_ranked/);
assert.match(schema, /actual_featured\s*<>\s*1/);
assert.match(schema, /actual_total\s*<>\s*p_expected_ranked\s*\+\s*1/);
assert.match(schema, /current_status\s*<>\s*'staged'/);
assert.match(schema, /current_status\s*<>\s*'retired'/);
assert.match(activate, /gen3_activate_catalog_run\(\$1, \$2, FALSE\)/);
assert.match(rollback, /gen3_activate_catalog_run\(\$1, \$2, TRUE\)/);
for (const column of ['metadata_version', 'evergreen', 'season_scores', 'season_reasons', 'month_scores', 'month_reasons']) {
  assert.match(schema, new RegExp(`\\b${column}\\b`), `schema is missing ${column}`);
}
assert.doesNotMatch(productsApp, /มี\.ค\.–พ\.ค\.|มิ\.ย\.–ต\.ค\.|พ\.ย\.–ก\.พ\./, 'UI must not publish rigid ranges that omit v4 climate transition months');
for (const familiarSeasonLabel of ['หน้าร้อน/ช่วงอากาศร้อน', 'หน้าฝน/ช่วงฝน', 'หน้าหนาว/ช่วงอากาศเย็น']) {
  assert.match(productsApp, new RegExp(familiarSeasonLabel), `UI is missing familiar season label: ${familiarSeasonLabel}`);
}

function runImporter(filePath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['catalog-db/import-jsonl-to-neon.mjs', filePath, 'contract-test-run', '1', '--validate-only'], {
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
    monthTags: [2], monthScores: { 2: 88 }, monthReasons: { 2: ['เหมาะกับแคมเปญเดือนกุมภาพันธ์'] }, campaignTags: ['valentine'],
  };
  const v4Path = join(temporaryDirectory, 'valid-v4.jsonl');
  await writeFile(v4Path, `${JSON.stringify({ ...v4, id: 'featured-v4', featured: true })}\n${JSON.stringify({ ...v4, id: 'ranked-v4', featured: false, rank: 1 })}\n`, 'utf8');
  const validV4 = await runImporter(v4Path);
  assert.equal(validV4.code, 0, validV4.stderr);

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
