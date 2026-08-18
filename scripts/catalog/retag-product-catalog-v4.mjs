import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
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

function parseArgs(argv) {
  const args = {
    catalog: resolve('data', 'products', 'catalog.json'),
    reserve: resolve('data', 'products', 'catalog-reserve.json'),
    report: resolve('data', 'products', 'build-report.json'),
    runtimeModule: resolve('api', '_gen3-products.js'),
    generatedAt: '',
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--catalog') args.catalog = resolve(next), index += 1;
    else if (value === '--reserve') args.reserve = resolve(next), index += 1;
    else if (value === '--report') args.report = resolve(next), index += 1;
    else if (value === '--runtime-module') args.runtimeModule = resolve(next), index += 1;
    else if (value === '--generated-at') args.generatedAt = next, index += 1;
    else if (value === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (args.generatedAt && Number.isNaN(Date.parse(args.generatedAt))) throw new Error('generated-at must be an ISO timestamp');
  return args;
}

function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function withoutSeasonalMetadata(product) {
  return Object.fromEntries(Object.entries(product).filter(([key]) => !SEASONAL_FIELDS.has(key)));
}

function retagProduct(product) {
  return {
    ...withoutSeasonalMetadata(product),
    ...makeSeasonalMetadataV4(product.categoryKey, product.cleanName, product.summary),
  };
}

function assertRecordInvariant(before, after, label) {
  if (!isDeepStrictEqual(withoutSeasonalMetadata(before), withoutSeasonalMetadata(after))) {
    throw new Error(`${label}: a non-seasonal product field changed during retag`);
  }
}

function countBy(values, keys = []) {
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries(counts);
}

function seasonalReport(products) {
  const seasons = products.flatMap((product) => product.seasonTags);
  const campaigns = products.flatMap((product) => product.campaignTags);
  return {
    seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
    selectedEvergreenCount: products.filter((product) => product.evergreen).length,
    selectedBySeasonTag: countBy(seasons, ['all-year', ...CLIMATE_SEASONS]),
    selectedByMonth: Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return [month, products.filter((product) => product.monthTags.includes(month)).length];
    })),
    selectedByCampaignTag: countBy(campaigns, CAMPAIGN_TAGS),
    selectedSeasonCombinations: countBy(products.map((product) => product.seasonTags.join('+'))),
  };
}

const args = parseArgs(process.argv.slice(2));
const [catalogText, reserveText, reportText] = await Promise.all([
  readFile(args.catalog, 'utf8'),
  readFile(args.reserve, 'utf8'),
  readFile(args.report, 'utf8'),
]);
const inputCatalog = JSON.parse(catalogText);
const inputReserve = JSON.parse(reserveText);
const inputReport = JSON.parse(reportText);
const generatedAt = args.generatedAt || new Date().toISOString();

const ranked = inputCatalog.ranked.map(retagProduct);
const reserve = inputReserve.reserve.map(retagProduct);
const featured = retagProduct(inputCatalog.featured);
inputCatalog.ranked.forEach((product, index) => assertRecordInvariant(product, ranked[index], `ranked[${index + 1}]`));
inputReserve.reserve.forEach((product, index) => assertRecordInvariant(product, reserve[index], `reserve[${index + 1}]`));
assertRecordInvariant(inputCatalog.featured, featured, 'featured');

if (!isDeepStrictEqual(inputCatalog.ranked.map((product) => product.id), ranked.map((product) => product.id))) {
  throw new Error('ranked IDs/order changed during retag');
}
if (!isDeepStrictEqual(inputReserve.reserve.map((product) => product.id), reserve.map((product) => product.id))) {
  throw new Error('reserve IDs/order changed during retag');
}

const catalog = {
  ...inputCatalog,
  schemaVersion: CATALOG_SCHEMA_VERSION,
  seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
  generatedAt,
  featured,
  ranked,
};
const reserveCatalog = {
  ...inputReserve,
  schemaVersion: CATALOG_SCHEMA_VERSION,
  seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
  generatedAt,
  reserve,
};
const rankedSeasonalReport = seasonalReport(ranked);
const reserveSeasonalReport = seasonalReport(reserve);
const report = {
  ...inputReport,
  schemaVersion: CATALOG_SCHEMA_VERSION,
  generatedAt,
  ...rankedSeasonalReport,
  reserveSeasonalMetadata: reserveSeasonalReport,
  qualityChecks: {
    ...inputReport.qualityChecks,
    seasonalRetagOnly: true,
    rankedIdOrderPreserved: true,
    reserveIdOrderPreserved: true,
    nonSeasonalRecordContentPreserved: true,
    everySeasonCovered: CLIMATE_SEASONS.every((season) => rankedSeasonalReport.selectedBySeasonTag[season] > 0),
    everyMonthCovered: Object.values(rankedSeasonalReport.selectedByMonth).every((count) => count > 0),
  },
};

const outputCatalogText = `${JSON.stringify(catalog, null, 2)}\n`;
const outputReserveText = `${JSON.stringify(reserveCatalog, null, 2)}\n`;
const outputReportText = `${JSON.stringify(report, null, 2)}\n`;
const outputRuntimeText = toRuntimeModule(catalog, reserveCatalog);
const result = {
  status: args.dryRun ? 'dry-run-valid' : 'retagged',
  schemaVersion: CATALOG_SCHEMA_VERSION,
  metadataVersion: SEASONAL_METADATA_VERSION,
  generatedAt,
  rankedCount: ranked.length,
  reserveCount: reserve.length,
  before: {
    catalogSha256: hash(catalogText),
    reserveSha256: hash(reserveText),
    reportSha256: hash(reportText),
    rankedCoreSha256: hash(inputCatalog.ranked.map(withoutSeasonalMetadata)),
    reserveCoreSha256: hash(inputReserve.reserve.map(withoutSeasonalMetadata)),
  },
  after: {
    catalogSha256: hash(outputCatalogText),
    reserveSha256: hash(outputReserveText),
    reportSha256: hash(outputReportText),
    runtimeSha256: hash(outputRuntimeText),
    rankedCoreSha256: hash(ranked.map(withoutSeasonalMetadata)),
    reserveCoreSha256: hash(reserve.map(withoutSeasonalMetadata)),
  },
  rankedSeasonalReport,
  reserveSeasonalReport,
};

if (result.before.rankedCoreSha256 !== result.after.rankedCoreSha256 || result.before.reserveCoreSha256 !== result.after.reserveCoreSha256) {
  throw new Error('core content hash changed during retag');
}

if (!args.dryRun) {
  await Promise.all([
    writeFile(args.catalog, outputCatalogText, 'utf8'),
    writeFile(args.reserve, outputReserveText, 'utf8'),
    writeFile(args.report, outputReportText, 'utf8'),
    writeFile(args.runtimeModule, outputRuntimeText, 'utf8'),
  ]);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
