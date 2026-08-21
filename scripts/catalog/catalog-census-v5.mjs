import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { field, sanitizeText, streamCsvRows } from './catalog-lib.mjs';

const DEFAULT_INPUT = resolve('..', '..', '1006_200101_Product Feed All Global Category_20260817T053145_1.csv');
const DEFAULT_OUTPUT = resolve('data', 'products', 'catalog-census-v5.json');

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, maxRows: Infinity };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--input') args.input = resolve(next), index += 1;
    else if (value === '--output') args.output = resolve(next), index += 1;
    else if (value === '--max-rows') args.maxRows = Number(next), index += 1;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!(args.maxRows === Infinity || Number.isInteger(args.maxRows) && args.maxRows > 0)) {
    throw new Error('max-rows must be a positive integer');
  }
  return args;
}

const COHORTS = Object.freeze({
  food: (c1) => c1 === 'Food & Beverages',
  fashion: (c1) => /^(?:Women Clothes|Men Clothes|Women Bags|Men Bags|Fashion Accessories|Women Shoes|Men Shoes)$/u.test(c1),
  'fashion-sleepwear': (c1, c2) => /^(?:Women Clothes|Men Clothes)$/u.test(c1) && /Sleepwear|Pajamas/iu.test(c2),
  'fashion-plus-size': (c1, c2, c3, title) => c1 === 'Women Clothes' && /พลัสไซส์|พลัสไซ|สาวอวบ|บิ๊กไซส์|big\s*size|plus\s*size|oversize|อก\s*(?:4[4-9]|[5-9]\d)|(?:2xl|3xl|4xl|5xl|6xl|7xl|8xl)/iu.test(`${c2} ${c3} ${title}`),
  'fashion-office': (c1, c2, c3, title) => c1 === 'Women Clothes' && /ออฟฟิศ|ทำงาน|ทํางาน|ทำงานผู้หญิง|working\s*woman|office|business|formal|สูท|เบลเซอร์|blazer/iu.test(`${c2} ${c3} ${title}`),
  agriculture: (c1, c2) => c1 === 'Home & Living' && c2 === 'Gardening',
  amulets: (c1, c2, c3, title) => c1 === 'Hobbies & Collections' && /พระเครื่อง|พระบูชา|เหรียญพระ|ตะกรุด|เครื่องราง|amulet|buddha|religious/iu.test(`${c2} ${c3} ${title}`),
  religion: (c1, c2, c3) => /Religious Supplies/iu.test(`${c1} ${c2} ${c3}`),
  cosmetics: (c1, c2) => c1 === 'Beauty' && /Makeup|Beauty Tools/iu.test(c2),
  'pet-food': (c1, c2, c3) => c1 === 'Pets' && /Pet Food|Food|Treats/iu.test(`${c2} ${c3}`),
  appliances: (c1) => /^(?:Home Appliances|Small Appliances)$/u.test(c1),
  'baby-family': (c1) => /^(?:Mom & Baby|Baby & Kids Fashion|Toys, Kids & Babies)$/u.test(c1),
  'shop-supplies': (c1, c2, c3, title) => /กล่องพัสดุ|ซองพัสดุ|ถุงแพ็ค|ถุงแพ็ก|เทปแพ็ค|เทปแพ็ก|ป้ายราคา|เครื่องยิงป้าย|สติกเกอร์ขอบคุณ|ชั้นวางสินค้า|พร็อพถ่าย|parcel|mailer|packing\s*(?:bag|box|tape)|price\s*tag|thank\s*you\s*sticker|photo\s*prop/iu.test(`${c1} ${c2} ${c3} ${title}`),
});

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedObject(map, limit = Infinity) {
  return Object.fromEntries([...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'en'))
    .slice(0, limit));
}

const args = parseArgs(process.argv.slice(2));
const byLevel1 = new Map();
const byLevel2 = new Map();
const byPath = new Map();
const cohortCounts = new Map(Object.keys(COHORTS).map((key) => [key, 0]));
let columnIndex;

const result = await streamCsvRows(args.input, (row, header) => {
  if (!columnIndex) columnIndex = new Map(header.map((name, index) => [name, index]));
  const c1 = sanitizeText(field(row, columnIndex, 'global_category1')).trim();
  const c2 = sanitizeText(field(row, columnIndex, 'global_category2')).trim();
  const c3 = sanitizeText(field(row, columnIndex, 'global_category3')).trim();
  const title = sanitizeText(field(row, columnIndex, 'title')).trim();
  increment(byLevel1, c1 || '(empty)');
  increment(byLevel2, `${c1} > ${c2}`);
  increment(byPath, `${c1} > ${c2} > ${c3}`);
  for (const [key, matcher] of Object.entries(COHORTS)) {
    if (matcher(c1, c2, c3, title)) cohortCounts.set(key, cohortCounts.get(key) + 1);
  }
}, { maxRows: args.maxRows });

const report = {
  censusVersion: 'catalog-census-v5',
  sourceFile: basename(args.input),
  sourceRowsScanned: result.rowCount,
  sourceColumns: result.header.length,
  nulBytesRemoved: result.nulBytesRemoved,
  cohortCounts: Object.fromEntries(cohortCounts),
  sourceCategoryLevel1: sortedObject(byLevel1),
  sourceCategoryLevel2: sortedObject(byLevel2),
  sourceCategoryPathsTop500: sortedObject(byPath, 500),
};

await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ status: 'ok', output: args.output, ...report }, null, 2)}\n`);
