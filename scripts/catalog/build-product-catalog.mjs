import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  CATALOG_SCHEMA_VERSION,
  CATALOG_CATEGORY_DEFINITIONS,
  DEFAULT_RANKED_TARGET,
  DEFAULT_RESERVE_TARGET,
  MINIMUM_RANKED_COUNT,
  MinHeap,
  evaluateFeedRow,
  makeColumnIndex,
  makeFeaturedBook,
  newRejectionCounts,
  parseCheckedAtFromFilename,
  selectCatalog,
  streamCsvRows,
  toRuntimeModule,
} from './catalog-lib.mjs';

function parseArgs(argv) {
  const args = {
    input: resolve('..', '..', '1006_200101_Product Feed All Global Category_20260817T053145_1.csv'),
    outputDir: resolve('data', 'products'),
    runtimeModule: resolve('api', '_gen3-products.js'),
    rankedCount: DEFAULT_RANKED_TARGET,
    reserveCount: DEFAULT_RESERVE_TARGET,
    minimumRankedCount: MINIMUM_RANKED_COUNT,
    candidatesPerCategory: 3_500,
    maxRows: Infinity,
    checkedAt: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--input') args.input = resolve(next), index += 1;
    else if (value === '--output-dir') args.outputDir = resolve(next), index += 1;
    else if (value === '--runtime-module') args.runtimeModule = resolve(next), index += 1;
    else if (value === '--ranked') args.rankedCount = Number(next), index += 1;
    else if (value === '--reserve') args.reserveCount = Number(next), index += 1;
    else if (value === '--minimum-ranked') args.minimumRankedCount = Number(next), index += 1;
    else if (value === '--candidates-per-category') args.candidatesPerCategory = Number(next), index += 1;
    else if (value === '--max-rows') args.maxRows = Number(next), index += 1;
    else if (value === '--checked-at') args.checkedAt = next, index += 1;
    else if (value === '--help') {
      process.stdout.write('Usage: node scripts/catalog/build-product-catalog.mjs [--input feed.csv] [--output-dir data/products] [--runtime-module api/_gen3-products.js] [--ranked 2000] [--reserve 300] [--minimum-ranked 1500] [--checked-at ISO]\n');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${value}`);
  }
  for (const [name, number] of Object.entries({ ranked: args.rankedCount, reserve: args.reserveCount, minimumRanked: args.minimumRankedCount, candidates: args.candidatesPerCategory })) {
    if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a positive integer`);
  }
  if (args.rankedCount < args.minimumRankedCount) throw new Error(`ranked target ${args.rankedCount} is below the declared minimum ${args.minimumRankedCount}`);
  if (!(args.maxRows === Infinity || (Number.isInteger(args.maxRows) && args.maxRows > 0))) throw new Error('max-rows must be a positive integer');
  return args;
}

const args = parseArgs(process.argv.slice(2));
const checkedAt = args.checkedAt || parseCheckedAtFromFilename(args.input);
const candidatesByCategory = new Map();
const rejectionCounts = newRejectionCounts();
const eligibleByCategory = new Map();
let columnIndex = null;
let eligibleRows = 0;

const result = await streamCsvRows(args.input, (row, header) => {
  if (!columnIndex) columnIndex = makeColumnIndex(header);
  const candidate = evaluateFeedRow(row, columnIndex, checkedAt, rejectionCounts);
  if (!candidate) return;
  eligibleRows += 1;
  eligibleByCategory.set(candidate.category, (eligibleByCategory.get(candidate.category) ?? 0) + 1);
  let heap = candidatesByCategory.get(candidate.categoryKey);
  if (!heap) {
    heap = new MinHeap(args.candidatesPerCategory);
    candidatesByCategory.set(candidate.categoryKey, heap);
  }
  heap.push(candidate);
}, { maxRows: args.maxRows });

if (!columnIndex) throw new Error('CSV did not contain a header row');
const { ranked, reserve, seasonRuleTrace } = selectCatalog(candidatesByCategory, args.rankedCount, args.reserveCount);
if (ranked.length < args.minimumRankedCount) {
  throw new Error(`Only ${ranked.length} safe ranked products were selected; minimum is ${args.minimumRankedCount}. Quality gates were not relaxed.`);
}
const generatedAt = new Date().toISOString();
const metadata = {
  schemaVersion: CATALOG_SCHEMA_VERSION,
  catalogName: 'คลังสินค้าแนะนำสำหรับทำคลิปแนวโกดัง',
  generatedAt,
  sourceCheckedAt: checkedAt,
  targetRankedCount: args.rankedCount,
  minimumRankedCount: args.minimumRankedCount,
  rankedCount: ranked.length,
  targetReserveCount: args.reserveCount,
  reserveCount: reserve.length,
  selectionStatus: ranked.length === args.rankedCount && reserve.length === args.reserveCount ? 'target-met' : 'safe-source-shortfall',
};
const catalog = { ...metadata, featured: makeFeaturedBook(), ranked };
const reserveCatalog = {
  schemaVersion: CATALOG_SCHEMA_VERSION,
  generatedAt,
  sourceCheckedAt: checkedAt,
  reserveCount: reserve.length,
  reserve,
};
const report = {
  ...metadata,
  sourceFile: basename(args.input),
  sourceRowsScanned: result.rowCount,
  sourceColumns: result.header.length,
  nulBytesRemoved: result.nulBytesRemoved,
  eligibleRows,
  rejectionCounts,
  categoryDefinitions: CATALOG_CATEGORY_DEFINITIONS,
  eligibleByCategory: Object.fromEntries([...eligibleByCategory.entries()].sort((a, b) => b[1] - a[1])),
  selectedByCategory: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.category, (counts.get(product.category) ?? 0) + 1), new Map())]),
  selectedByCategoryKey: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.categoryKey, (counts.get(product.categoryKey) ?? 0) + 1), new Map())]),
  selectedBySeasonTag: Object.fromEntries([...ranked.reduce((counts, product) => {
    for (const tag of product.seasonTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return counts;
  }, new Map())]),
  selectedByMonth: Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return [month, ranked.filter((product) => product.monthTags.includes(month)).length];
  })),
  seasonRuleCounts: Object.fromEntries([...seasonRuleTrace.reduce((counts, trace) => {
    for (const ruleId of trace.ruleIds) counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
    return counts;
  }, new Map())].sort((left, right) => left[0].localeCompare(right[0], 'en'))),
  seasonRuleTrace,
};

await mkdir(args.outputDir, { recursive: true });
await Promise.all([
  writeFile(resolve(args.outputDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8'),
  writeFile(resolve(args.outputDir, 'catalog-reserve.json'), `${JSON.stringify(reserveCatalog, null, 2)}\n`, 'utf8'),
  writeFile(resolve(args.outputDir, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(args.runtimeModule, toRuntimeModule(catalog, reserveCatalog), 'utf8'),
]);

process.stdout.write(`${JSON.stringify({
  status: 'ok',
  input: args.input,
  sourceRowsScanned: result.rowCount,
  eligibleRows,
  targetRankedCount: args.rankedCount,
  rankedCount: ranked.length,
  targetReserveCount: args.reserveCount,
  reserveCount: reserve.length,
  nulBytesRemoved: result.nulBytesRemoved,
  outputDir: args.outputDir,
  runtimeModule: args.runtimeModule,
}, null, 2)}\n`);
