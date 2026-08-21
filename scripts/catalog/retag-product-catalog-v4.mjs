import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';
import {
  CAMPAIGN_TAGS,
  CATALOG_SCHEMA_VERSION,
  CLIMATE_SEASONS,
  makeSeasonalMetadataV4,
  SEASONAL_METADATA_VERSION,
  toRuntimeModule,
} from './sellable-catalog-lib.mjs';

const SEASONAL_FIELDS = new Set([
  'metadataVersion', 'evergreen', 'seasonTags', 'seasonScores', 'seasonReasons',
  'monthTags', 'monthScores', 'monthReasons', 'campaignTags', 'seasonalScore', 'seasonReason',
]);
const MAX_TRACKED_ARTIFACT_BYTES = 95 * 1024 * 1024;

function parseArgs(argv) {
  const args = {
    fullCatalog: resolve('data', 'products', 'catalog-full.json.gz'),
    catalog: resolve('data', 'products', 'catalog.json'),
    reserve: resolve('data', 'products', 'catalog-reserve.json'),
    report: resolve('data', 'products', 'build-report.json'),
    manifest: resolve('data', 'products', 'catalog-manifest.json'),
    runtimeModule: resolve('api', '_gen3-products.js'),
    generatedAt: '',
    dryRun: false,
    writeRuntime: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--full-catalog') args.fullCatalog = resolve(next), index += 1;
    else if (value === '--catalog') args.catalog = resolve(next), index += 1;
    else if (value === '--reserve') args.reserve = resolve(next), index += 1;
    else if (value === '--report') args.report = resolve(next), index += 1;
    else if (value === '--manifest') args.manifest = resolve(next), index += 1;
    else if (value === '--runtime-module') args.runtimeModule = resolve(next), index += 1;
    else if (value === '--generated-at') args.generatedAt = next, index += 1;
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--skip-runtime') args.writeRuntime = false;
    else if (value === '--help') {
      process.stdout.write('Usage: node scripts/catalog/retag-product-catalog-v4.mjs [--full-catalog data/products/catalog-full.json.gz] [--catalog data/products/catalog.json] [--reserve data/products/catalog-reserve.json] [--report data/products/build-report.json] [--manifest data/products/catalog-manifest.json] [--runtime-module api/_gen3-products.js] [--generated-at ISO] [--dry-run] [--skip-runtime]\n');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${value}`);
  }
  if (args.generatedAt && Number.isNaN(Date.parse(args.generatedAt))) throw new Error('generated-at must be an ISO timestamp');
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function withoutSeasonalMetadata(product) {
  return Object.fromEntries(Object.entries(product).filter(([key]) => !SEASONAL_FIELDS.has(key)));
}

function coreHash(products) {
  return sha256(JSON.stringify(products.map(withoutSeasonalMetadata)));
}

function withoutRank(product) {
  const { rank: _rank, ...rest } = product;
  return rest;
}

function retagProduct(product) {
  assert(product.subcategoryKey, `${product.id ?? 'featured'}: schema-v5 subcategoryKey is required for retag`);
  return {
    ...withoutSeasonalMetadata(product),
    ...makeSeasonalMetadataV4(product.subcategoryKey, product.cleanName, product.summary),
  };
}

function assertRecordInvariant(before, after, label) {
  assert(isDeepStrictEqual(withoutSeasonalMetadata(before), withoutSeasonalMetadata(after)), `${label}: a non-seasonal product field changed during retag`);
}

function countBy(values, keys = []) {
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries(counts);
}

function seasonalReport(products) {
  const seasons = products.flatMap((product) => product.seasonTags);
  const campaigns = products.flatMap((product) => product.campaignTags);
  const selectedByClimateSeason = Object.fromEntries(CLIMATE_SEASONS.map((season) => [season, products.filter((product) => product.seasonTags.includes(season)).length]));
  const selectedByMonth = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return [month, products.filter((product) => product.monthTags.includes(month)).length];
  }));
  return {
    seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
    selectedEvergreenCount: products.filter((product) => product.evergreen).length,
    selectedBySeasonTag: countBy(seasons, ['all-year', ...CLIMATE_SEASONS]),
    selectedByClimateSeason,
    selectedByMonth,
    selectedByCampaignTag: countBy(campaigns, CAMPAIGN_TAGS),
    selectedSeasonCombinations: countBy(products.map((product) => product.seasonTags.join('+'))),
  };
}

function withSeasonalCoverage(coverage, seasonal) {
  return {
    ...coverage,
    byClimateSeason: seasonal.selectedByClimateSeason,
    byMonth: seasonal.selectedByMonth,
  };
}

const args = parseArgs(process.argv.slice(2));
const [inputFullGzip, inputFallbackBytes, inputReserveBytes, inputReportBytes, inputManifestBytes] = await Promise.all([
  readFile(args.fullCatalog), readFile(args.catalog), readFile(args.reserve), readFile(args.report), readFile(args.manifest),
]);
const inputManifest = JSON.parse(inputManifestBytes.toString('utf8'));
assert(inputManifest.artifactVersion === 'catalog-artifacts-v5' && inputManifest.schemaVersion === CATALOG_SCHEMA_VERSION, 'retag requires a complete schema-v5 artifact manifest');
assert(inputManifest.artifacts.fullCatalog.path === basename(args.fullCatalog), 'full catalog path does not match manifest');
assert(inputManifest.artifacts.bundledFallback.path === basename(args.catalog), 'fallback catalog path does not match manifest');
assert(inputManifest.artifacts.reserve.path === basename(args.reserve), 'reserve path does not match manifest');
assert(inputManifest.artifacts.buildReport.path === basename(args.report), 'report path does not match manifest');
assert(inputFullGzip.byteLength === inputManifest.artifacts.fullCatalog.compressedBytes && sha256(inputFullGzip) === inputManifest.artifacts.fullCatalog.compressedSha256, 'input full gzip hash mismatch');
assert(inputFallbackBytes.byteLength === inputManifest.artifacts.bundledFallback.bytes && sha256(inputFallbackBytes) === inputManifest.artifacts.bundledFallback.sha256, 'input fallback hash mismatch');
assert(inputReserveBytes.byteLength === inputManifest.artifacts.reserve.bytes && sha256(inputReserveBytes) === inputManifest.artifacts.reserve.sha256, 'input reserve hash mismatch');
assert(inputReportBytes.byteLength === inputManifest.artifacts.buildReport.bytes && sha256(inputReportBytes) === inputManifest.artifacts.buildReport.sha256, 'input report hash mismatch');

const inputFullBytes = gunzipSync(inputFullGzip);
assert(inputFullBytes.byteLength === inputManifest.artifacts.fullCatalog.uncompressedBytes && sha256(inputFullBytes) === inputManifest.artifacts.fullCatalog.uncompressedSha256, 'input uncompressed full hash mismatch');
const inputFull = JSON.parse(inputFullBytes.toString('utf8'));
const inputFallback = JSON.parse(inputFallbackBytes.toString('utf8'));
const inputReserve = JSON.parse(inputReserveBytes.toString('utf8'));
const inputReport = JSON.parse(inputReportBytes.toString('utf8'));
for (const [name, artifact] of [['full', inputFull], ['fallback', inputFallback], ['reserve', inputReserve]]) {
  assert(artifact.schemaVersion === CATALOG_SCHEMA_VERSION && artifact.taxonomyVersion === 'taxonomy-v5', `${name}: retag requires schema-v5/taxonomy-v5`);
}
assert(inputFull.catalogArtifactMode === 'full-approved' && inputFallback.catalogArtifactMode === 'bundled-fallback', 'catalog artifact modes are invalid');
assert(inputFull.ranked.length === inputFull.rankedCount && inputFallback.ranked.length === inputFallback.rankedCount && inputReserve.reserve.length === inputReserve.reserveCount, 'input artifact counts are invalid');
assert(inputFull.ranked.every((product, index) => product.rank === index + 1), 'full ranks are not contiguous');
assert(inputFallback.ranked.every((product, index) => product.rank === index + 1), 'fallback ranks are not contiguous');
assert(inputReserve.reserve.every((product, index) => product.reserveOrder === index + 1), 'reserve order is not contiguous');

const generatedAt = args.generatedAt || new Date().toISOString();
const ranked = inputFull.ranked.map(retagProduct);
const reserve = inputReserve.reserve.map(retagProduct);
const featured = retagProduct(inputFull.featured);
inputFull.ranked.forEach((product, index) => assertRecordInvariant(product, ranked[index], `full.ranked[${index + 1}]`));
inputReserve.reserve.forEach((product, index) => assertRecordInvariant(product, reserve[index], `reserve[${index + 1}]`));
assertRecordInvariant(inputFull.featured, featured, 'featured');

const inputFullById = new Map(inputFull.ranked.map((product) => [product.id, product]));
const rankedById = new Map(ranked.map((product) => [product.id, product]));
const fallbackRanked = inputFallback.ranked.map((fallback, index) => {
  const fullBefore = inputFullById.get(fallback.id);
  const fullAfter = rankedById.get(fallback.id);
  assert(fullBefore && fullAfter, `fallback[${index + 1}]: ID is absent from full catalog`);
  assert(isDeepStrictEqual(withoutRank(withoutSeasonalMetadata(fallback)), withoutRank(withoutSeasonalMetadata(fullBefore))), `fallback[${index + 1}]: non-rank fields differ from full catalog`);
  const result = { ...fullAfter, rank: index + 1 };
  assertRecordInvariant(fallback, result, `fallback[${index + 1}]`);
  return result;
});
assert(isDeepStrictEqual(inputFull.ranked.map((product) => product.id), ranked.map((product) => product.id)), 'full IDs/order changed during retag');
assert(isDeepStrictEqual(inputFallback.ranked.map((product) => product.id), fallbackRanked.map((product) => product.id)), 'fallback IDs/order changed during retag');
assert(isDeepStrictEqual(inputReserve.reserve.map((product) => product.id), reserve.map((product) => product.id)), 'reserve IDs/order changed during retag');

const fullCatalog = {
  ...inputFull,
  schemaVersion: CATALOG_SCHEMA_VERSION,
  seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
  generatedAt,
  featured,
  ranked,
};
const fallbackCatalog = {
  ...inputFallback,
  schemaVersion: CATALOG_SCHEMA_VERSION,
  seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
  generatedAt,
  featured,
  ranked: fallbackRanked,
};
const reserveCatalog = {
  ...inputReserve,
  schemaVersion: CATALOG_SCHEMA_VERSION,
  seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
  generatedAt,
  reserve,
};
const fullSeasonal = seasonalReport(ranked);
const fallbackSeasonal = seasonalReport(fallbackRanked);
const reserveSeasonal = seasonalReport(reserve);
const report = {
  ...inputReport,
  schemaVersion: CATALOG_SCHEMA_VERSION,
  seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
  generatedAt,
  ...fullSeasonal,
  fullCoverage: withSeasonalCoverage(inputReport.fullCoverage, fullSeasonal),
  bundledFallbackCoverage: withSeasonalCoverage(inputReport.bundledFallbackCoverage, fallbackSeasonal),
  bundledFallbackSeasonalMetadata: fallbackSeasonal,
  reserveSeasonalMetadata: reserveSeasonal,
  qualityChecks: {
    ...inputReport.qualityChecks,
    seasonalRetagOnly: true,
    fullIdOrderPreserved: true,
    fallbackIdOrderPreserved: true,
    fallbackLocalRanksPreserved: true,
    reserveIdOrderPreserved: true,
    nonSeasonalRecordContentPreserved: true,
    everySeasonCovered: CLIMATE_SEASONS.every((season) => fullSeasonal.selectedByClimateSeason[season] > 0),
    everyMonthCovered: Object.values(fullSeasonal.selectedByMonth).every((count) => count > 0),
    bundledFallbackEverySeasonCovered: CLIMATE_SEASONS.every((season) => fallbackSeasonal.selectedByClimateSeason[season] > 0),
    bundledFallbackEveryMonthCovered: Object.values(fallbackSeasonal.selectedByMonth).every((count) => count > 0),
  },
};

const fullCatalogBytes = Buffer.from(`${JSON.stringify(fullCatalog)}\n`, 'utf8');
const fullCatalogGzip = gzipSync(fullCatalogBytes, { level: 9, mtime: 0 });
const fallbackCatalogBytes = Buffer.from(`${JSON.stringify(fallbackCatalog)}\n`, 'utf8');
const reserveCatalogBytes = Buffer.from(`${JSON.stringify(reserveCatalog)}\n`, 'utf8');
for (const [name, bytes] of [['catalog-full.json.gz', fullCatalogGzip], ['catalog.json', fallbackCatalogBytes], ['catalog-reserve.json', reserveCatalogBytes]]) {
  assert(bytes.byteLength < MAX_TRACKED_ARTIFACT_BYTES, `${name} exceeds the 95 MiB tracked-artifact limit`);
}
report.qualityChecks.trackedArtifactsBelow95MiB = true;
report.fullArtifact = {
  path: basename(args.fullCatalog),
  catalogArtifactMode: 'full-approved',
  rankedCount: ranked.length,
  compression: 'gzip',
  compressedBytes: fullCatalogGzip.byteLength,
  compressedSha256: sha256(fullCatalogGzip),
  uncompressedBytes: fullCatalogBytes.byteLength,
  uncompressedSha256: sha256(fullCatalogBytes),
};
report.bundledFallbackArtifact = {
  path: basename(args.catalog),
  catalogArtifactMode: 'bundled-fallback',
  rankedCount: fallbackRanked.length,
  bytes: fallbackCatalogBytes.byteLength,
  sha256: sha256(fallbackCatalogBytes),
};
report.reserveArtifact = {
  path: basename(args.reserve),
  reserveCount: reserve.length,
  bytes: reserveCatalogBytes.byteLength,
  sha256: sha256(reserveCatalogBytes),
};
const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
const manifest = {
  ...inputManifest,
  artifactVersion: 'catalog-artifacts-v5',
  schemaVersion: CATALOG_SCHEMA_VERSION,
  taxonomyVersion: 'taxonomy-v5',
  generatedAt,
  sourceCheckedAt: fullCatalog.sourceCheckedAt,
  artifacts: {
    fullCatalog: report.fullArtifact,
    bundledFallback: report.bundledFallbackArtifact,
    reserve: report.reserveArtifact,
    buildReport: {
      path: basename(args.report),
      bytes: reportBytes.byteLength,
      sha256: sha256(reportBytes),
    },
  },
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
const runtimeText = args.writeRuntime ? toRuntimeModule(fallbackCatalog) : '';
assert(!args.writeRuntime || !/"reserve"\s*:/u.test(runtimeText), 'runtime payload unexpectedly contains the offline reserve');

const result = {
  status: args.dryRun ? 'dry-run-valid' : 'retagged',
  schemaVersion: CATALOG_SCHEMA_VERSION,
  metadataVersion: SEASONAL_METADATA_VERSION,
  generatedAt,
  fullRankedCount: ranked.length,
  fallbackRankedCount: fallbackRanked.length,
  reserveCount: reserve.length,
  before: {
    fullCatalogCompressedSha256: sha256(inputFullGzip),
    fallbackCatalogSha256: sha256(inputFallbackBytes),
    reserveSha256: sha256(inputReserveBytes),
    reportSha256: sha256(inputReportBytes),
    manifestSha256: sha256(inputManifestBytes),
    fullCoreSha256: coreHash(inputFull.ranked),
    fallbackCoreSha256: coreHash(inputFallback.ranked),
    reserveCoreSha256: coreHash(inputReserve.reserve),
  },
  after: {
    fullCatalogCompressedSha256: sha256(fullCatalogGzip),
    fallbackCatalogSha256: sha256(fallbackCatalogBytes),
    reserveSha256: sha256(reserveCatalogBytes),
    reportSha256: sha256(reportBytes),
    manifestSha256: sha256(manifestBytes),
    runtimeSha256: args.writeRuntime ? sha256(runtimeText) : null,
    fullCoreSha256: coreHash(ranked),
    fallbackCoreSha256: coreHash(fallbackRanked),
    reserveCoreSha256: coreHash(reserve),
  },
  fullSeasonalReport: fullSeasonal,
  bundledFallbackSeasonalReport: fallbackSeasonal,
  reserveSeasonalReport: reserveSeasonal,
};
assert(result.before.fullCoreSha256 === result.after.fullCoreSha256, 'full core content hash changed during retag');
assert(result.before.fallbackCoreSha256 === result.after.fallbackCoreSha256, 'fallback core content hash changed during retag');
assert(result.before.reserveCoreSha256 === result.after.reserveCoreSha256, 'reserve core content hash changed during retag');

if (!args.dryRun) {
  const writes = [
    writeFile(args.fullCatalog, fullCatalogGzip),
    writeFile(args.catalog, fallbackCatalogBytes),
    writeFile(args.reserve, reserveCatalogBytes),
    writeFile(args.report, reportBytes),
    writeFile(args.manifest, manifestBytes),
  ];
  if (args.writeRuntime) writes.push(writeFile(args.runtimeModule, runtimeText, 'utf8'));
  await Promise.all(writes);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
