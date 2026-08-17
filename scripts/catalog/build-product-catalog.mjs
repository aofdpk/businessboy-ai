import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  CATALOG_SCHEMA_VERSION,
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
    rankedCount: 500,
    reserveCount: 100,
    candidatesPerCategory: 2_500,
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
    else if (value === '--candidates-per-category') args.candidatesPerCategory = Number(next), index += 1;
    else if (value === '--max-rows') args.maxRows = Number(next), index += 1;
    else if (value === '--checked-at') args.checkedAt = next, index += 1;
    else if (value === '--help') {
      process.stdout.write('Usage: node scripts/catalog/build-product-catalog.mjs [--input feed.csv] [--output-dir data/products] [--runtime-module api/_gen3-products.js] [--checked-at ISO]\n');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${value}`);
  }
  for (const [name, number] of Object.entries({ ranked: args.rankedCount, reserve: args.reserveCount, candidates: args.candidatesPerCategory })) {
    if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a positive integer`);
  }
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
const { ranked, reserve } = selectCatalog(candidatesByCategory, args.rankedCount, args.reserveCount);
const generatedAt = new Date().toISOString();
const metadata = {
  schemaVersion: CATALOG_SCHEMA_VERSION,
  catalogName: 'Top 500 ที่คัดสำหรับทำคลิปแนวโกดัง',
  generatedAt,
  sourceCheckedAt: checkedAt,
  rankedCount: ranked.length,
  reserveCount: reserve.length,
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
  eligibleByCategory: Object.fromEntries([...eligibleByCategory.entries()].sort((a, b) => b[1] - a[1])),
  selectedByCategory: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.category, (counts.get(product.category) ?? 0) + 1), new Map())]),
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
  rankedCount: ranked.length,
  reserveCount: reserve.length,
  nulBytesRemoved: result.nulBytesRemoved,
  outputDir: args.outputDir,
  runtimeModule: args.runtimeModule,
}, null, 2)}\n`);
