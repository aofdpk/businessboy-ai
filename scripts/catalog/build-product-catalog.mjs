import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { streamCsvRows } from './catalog-lib.mjs';
import {
  CAMPAIGN_TAGS,
  CATALOG_SCHEMA_VERSION,
  CATALOG_CATEGORY_DEFINITIONS,
  CATALOG_GROUP_DEFINITIONS,
  CATALOG_MERCHANDISING_TAG_DEFINITIONS,
  CATALOG_SUBCATEGORY_DEFINITIONS,
  DEFAULT_BUNDLED_FALLBACK_RANKED_COUNT,
  DEFAULT_RANKED_TARGET,
  DEFAULT_RESERVE_TARGET,
  CLIMATE_SEASONS,
  MINIMUM_RANKED_COUNT,
  MinHeap,
  evaluateSellableRow,
  makeColumnIndex,
  makeFeaturedBook,
  newRejectionCounts,
  parseCheckedAtFromFilename,
  rejectionBreakdown,
  semanticSummaryFingerprint,
  selectSellableCatalog,
  SEASONAL_METADATA_VERSION,
  toRuntimeModule,
} from './sellable-catalog-lib.mjs';

function parseArgs(argv) {
  const args = {
    input: resolve('..', '..', '1006_200101_Product Feed All Global Category_20260817T053145_1.csv'),
    outputDir: resolve('data', 'products'),
    runtimeModule: resolve('api', '_gen3-products.js'),
    rankedCount: DEFAULT_RANKED_TARGET,
    reserveCount: DEFAULT_RESERVE_TARGET,
    minimumRankedCount: MINIMUM_RANKED_COUNT,
    bundledFallbackRankedCount: DEFAULT_BUNDLED_FALLBACK_RANKED_COUNT,
    // Keep enough depth for large, shop-diverse leaves such as phone cases.
    // A 5,000-row heap exhausted the ranked shop cap before the non-dominant
    // half-share invariant, even though 7,000+ safe source rows were eligible.
    candidatesPerCategory: 8_000,
    maxRows: Infinity,
    checkedAt: '',
    writeRuntime: true,
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
    else if (value === '--bundled-fallback-ranked') args.bundledFallbackRankedCount = Number(next), index += 1;
    else if (value === '--candidates-per-category') args.candidatesPerCategory = Number(next), index += 1;
    else if (value === '--max-rows') args.maxRows = Number(next), index += 1;
    else if (value === '--checked-at') args.checkedAt = next, index += 1;
    else if (value === '--skip-runtime') args.writeRuntime = false;
    else if (value === '--help') {
      process.stdout.write('Usage: node scripts/catalog/build-product-catalog.mjs [--input feed.csv] [--output-dir data/products] [--runtime-module api/_gen3-products.js] [--ranked 60000] [--reserve 6000] [--minimum-ranked 54000] [--bundled-fallback-ranked 20000] [--skip-runtime] [--checked-at ISO]\n');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${value}`);
  }
  for (const [name, number] of Object.entries({ ranked: args.rankedCount, reserve: args.reserveCount, minimumRanked: args.minimumRankedCount, bundledFallbackRanked: args.bundledFallbackRankedCount, candidates: args.candidatesPerCategory })) {
    if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a positive integer`);
  }
  if (args.rankedCount < args.minimumRankedCount) throw new Error(`ranked target ${args.rankedCount} is below the declared minimum ${args.minimumRankedCount}`);
  if (!(args.maxRows === Infinity || (Number.isInteger(args.maxRows) && args.maxRows > 0))) throw new Error('max-rows must be a positive integer');
  return args;
}

const args = parseArgs(process.argv.slice(2));
const SELECTION_COHORT_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'food', label: 'อาหารและเครื่องดื่ม', matches: (product) => product.categoryGroupKey === 'food' }),
  Object.freeze({ key: 'fashion', label: 'แฟชั่นและเครื่องแต่งกาย', matches: (product) => product.categoryGroupKey === 'fashion' }),
  Object.freeze({ key: 'agriculture', label: 'เกษตรและสวน', matches: (product) => product.categoryGroupKey === 'agriculture' }),
  Object.freeze({ key: 'cosmetics', label: 'เครื่องสำอางและอุปกรณ์แต่งหน้า', matches: (product) => product.categoryKey === 'makeup' || product.categoryKey === 'beauty-tools' }),
  Object.freeze({ key: 'pet-food', label: 'อาหารและขนมสัตว์', matches: (product) => product.categoryKey === 'pet-food' }),
  Object.freeze({ key: 'religious', label: 'พระเครื่องและศาสนวัตถุ', matches: (product) => product.categoryGroupKey === 'religious' }),
  Object.freeze({ key: 'actual-amulets', label: 'พระเครื่องและเหรียญบูชา', matches: (product) => product.subcategoryKey === 'religious-amulets' }),
  Object.freeze({ key: 'religious-accessories', label: 'กรอบ ตลับ สร้อย ที่เก็บ และของบูชา', matches: (product) => product.categoryGroupKey === 'religious' && product.subcategoryKey !== 'religious-amulets' }),
  Object.freeze({ key: 'shop-supplies', label: 'อุปกรณ์ร้านค้าและแพ็กสินค้า', matches: (product) => product.categoryGroupKey === 'shop-supplies' }),
]);

const FULL_COHORT_FLOORS = Object.freeze({ food: 2_500, fashion: 10_000, agriculture: 900, cosmetics: 1_000, 'pet-food': 500, religious: 250, 'shop-supplies': 1_000 });
const FALLBACK_COHORT_FLOORS = Object.freeze({ food: 1_500, fashion: 3_000, agriculture: 700, cosmetics: 800, 'pet-food': 400, religious: 200, 'shop-supplies': 400 });
const FULL_TAG_FLOORS = Object.freeze({ 'fashion-sleepwear': 200, 'fashion-plus-size': 500, 'fashion-office': 100 });
const FALLBACK_TAG_FLOORS = Object.freeze({ 'fashion-sleepwear': 50, 'fashion-plus-size': 100, 'fashion-office': 10 });

function cohortCounts(products) {
  return Object.fromEntries(SELECTION_COHORT_DEFINITIONS.map(({ key, matches }) => [key, products.filter(matches).length]));
}

function semanticSummaryStats(products) {
  const counts = new Map();
  for (const product of products) {
    const fingerprint = semanticSummaryFingerprint(product.summary);
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  }
  const uniqueCount = counts.size;
  return {
    count: products.length,
    uniqueCount,
    uniquePercent: products.length ? Math.round(uniqueCount / products.length * 1_000_000) / 10_000 : 100,
    maxIdenticalCount: counts.size ? Math.max(...counts.values()) : 0,
  };
}

const checkedAt = args.checkedAt || parseCheckedAtFromFilename(args.input);
const candidatesByCategory = new Map();
const rejectionCounts = newRejectionCounts();
const eligibleByCategory = new Map();
const eligibleBySubcategory = new Map();
const eligibleByGroup = new Map();
const eligibleByMerchandisingTag = new Map(CATALOG_MERCHANDISING_TAG_DEFINITIONS.map(({ key }) => [key, 0]));
const eligibleByGroupKey = new Map();
const eligibleByCategoryKey = new Map();
const eligibleBySubcategoryKey = new Map();
const eligibleBySelectionCohort = new Map(SELECTION_COHORT_DEFINITIONS.map(({ key }) => [key, 0]));
const eligibleByRiskTier = new Map();
let columnIndex = null;
let eligibleRows = 0;

const result = await streamCsvRows(args.input, (row, header) => {
  if (!columnIndex) columnIndex = makeColumnIndex(header);
  const candidate = evaluateSellableRow(row, columnIndex, checkedAt, rejectionCounts);
  if (!candidate) return;
  eligibleRows += 1;
  eligibleByCategory.set(candidate.category, (eligibleByCategory.get(candidate.category) ?? 0) + 1);
  eligibleBySubcategory.set(candidate.subcategory, (eligibleBySubcategory.get(candidate.subcategory) ?? 0) + 1);
  eligibleByGroup.set(candidate.categoryGroup, (eligibleByGroup.get(candidate.categoryGroup) ?? 0) + 1);
  eligibleByGroupKey.set(candidate.categoryGroupKey, (eligibleByGroupKey.get(candidate.categoryGroupKey) ?? 0) + 1);
  eligibleByCategoryKey.set(candidate.categoryKey, (eligibleByCategoryKey.get(candidate.categoryKey) ?? 0) + 1);
  eligibleBySubcategoryKey.set(candidate.subcategoryKey, (eligibleBySubcategoryKey.get(candidate.subcategoryKey) ?? 0) + 1);
  for (const { key, matches } of SELECTION_COHORT_DEFINITIONS) if (matches(candidate)) eligibleBySelectionCohort.set(key, eligibleBySelectionCohort.get(key) + 1);
  for (const tag of candidate.merchandisingTags) eligibleByMerchandisingTag.set(tag, eligibleByMerchandisingTag.get(tag) + 1);
  eligibleByRiskTier.set(candidate.riskTier, (eligibleByRiskTier.get(candidate.riskTier) ?? 0) + 1);
  let heap = candidatesByCategory.get(candidate.subcategoryKey);
  if (!heap) {
    heap = new MinHeap(args.candidatesPerCategory);
    candidatesByCategory.set(candidate.subcategoryKey, heap);
  }
  heap.push(candidate);
}, { maxRows: args.maxRows });

if (!columnIndex) throw new Error('CSV did not contain a header row');
const selectionDiagnostics = process.env.BUSINESSBOY_CATALOG_SELECTION_DIAGNOSTICS === '1' ? {} : null;
let ranked;
let reserve;
try {
  ({ ranked, reserve } = selectSellableCatalog(
    candidatesByCategory,
    args.rankedCount,
    args.reserveCount,
    { diagnostics: selectionDiagnostics },
  ));
} catch (error) {
  if (selectionDiagnostics) process.stderr.write(`Selection diagnostics:\n${JSON.stringify(selectionDiagnostics, null, 2)}\n`);
  throw error;
}
if (selectionDiagnostics) process.stderr.write(`Selection diagnostics:\n${JSON.stringify(selectionDiagnostics, null, 2)}\n`);
if (ranked.length < args.minimumRankedCount) {
  throw new Error(`Only ${ranked.length} safe ranked products were selected; minimum is ${args.minimumRankedCount}. Quality gates were not relaxed.`);
}
const generatedAt = new Date().toISOString();
function selectBundledFallback(products, count) {
  const target = Math.min(count, products.length);
  const selected = [];
  const selectedIds = new Set();
  const groupCounts = new Map();
  const add = (product) => {
    if (selectedIds.has(product.id) || selected.length >= target) return false;
    selected.push(product);
    selectedIds.add(product.id);
    groupCounts.set(product.categoryGroupKey, (groupCounts.get(product.categoryGroupKey) ?? 0) + 1);
    return true;
  };
  const groupTargets = new Map(CATALOG_GROUP_DEFINITIONS.map((definition) => [
    definition.key,
    Math.max(1, Math.floor(target * definition.quota / DEFAULT_RANKED_TARGET)),
  ]));

  for (const group of CATALOG_GROUP_DEFINITIONS) {
    const leaves = CATALOG_SUBCATEGORY_DEFINITIONS.filter((definition) => definition.groupKey === group.key);
    for (const leaf of leaves) {
      const leafTarget = Math.max(1, Math.floor(target * leaf.quota / DEFAULT_RANKED_TARGET));
      let leafSelected = 0;
      for (const product of products) {
        if (leafSelected >= leafTarget || (groupCounts.get(group.key) ?? 0) >= groupTargets.get(group.key)) break;
        if (product.subcategoryKey === leaf.key && add(product)) leafSelected += 1;
      }
    }
    for (const product of products) {
      if ((groupCounts.get(group.key) ?? 0) >= groupTargets.get(group.key)) break;
      if (product.categoryGroupKey === group.key) add(product);
    }
  }

  for (const product of products) {
    if (selected.length >= target) break;
    const groupTarget = groupTargets.get(product.categoryGroupKey) ?? 1;
    const softCap = Math.max(groupTarget + 250, Math.ceil(groupTarget * 1.35));
    if ((groupCounts.get(product.categoryGroupKey) ?? 0) < softCap) add(product);
  }
  for (const product of products) {
    if (selected.length >= target) break;
    add(product);
  }
  if (selected.length !== target) throw new Error(`Could select only ${selected.length} of ${target} bundled fallback products`);
  return selected
    .sort((left, right) => left.rank - right.rank)
    .map((product, index) => ({ ...product, rank: index + 1 }));
}

function coverage(products) {
  const countBy = (key, definitions = []) => Object.fromEntries([...products.reduce((counts, product) => {
    const value = product[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map(definitions.map(({ key: definitionKey }) => [definitionKey, 0]))).entries()].sort((left, right) => left[0].localeCompare(right[0], 'en')));
  return {
    count: products.length,
    byGroupKey: countBy('categoryGroupKey', CATALOG_GROUP_DEFINITIONS),
    byCategoryKey: countBy('categoryKey', CATALOG_CATEGORY_DEFINITIONS),
    bySubcategoryKey: countBy('subcategoryKey', CATALOG_SUBCATEGORY_DEFINITIONS),
    byMerchandisingTag: Object.fromEntries(CATALOG_MERCHANDISING_TAG_DEFINITIONS.map(({ key }) => [key, products.filter((product) => product.merchandisingTags.includes(key)).length])),
    bySelectionCohort: cohortCounts(products),
    byClimateSeason: Object.fromEntries(CLIMATE_SEASONS.map((season) => [season, products.filter((product) => product.seasonTags.includes(season)).length])),
    byMonth: Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return [month, products.filter((product) => product.monthTags.includes(month)).length];
    })),
  };
}

const bundledFallbackCount = Math.min(args.bundledFallbackRankedCount, ranked.length);
const bundledFallbackRanked = selectBundledFallback(ranked, bundledFallbackCount);
const fullCohortCounts = cohortCounts(ranked);
const fallbackCohortCounts = cohortCounts(bundledFallbackRanked);
const fullTagCounts = Object.fromEntries(CATALOG_MERCHANDISING_TAG_DEFINITIONS.map(({ key }) => [key, ranked.filter((product) => product.merchandisingTags.includes(key)).length]));
const fallbackTagCounts = Object.fromEntries(CATALOG_MERCHANDISING_TAG_DEFINITIONS.map(({ key }) => [key, bundledFallbackRanked.filter((product) => product.merchandisingTags.includes(key)).length]));
const fullAndReserveSummaryStats = semanticSummaryStats([...ranked, ...reserve]);
const bundledFallbackSummaryStats = semanticSummaryStats(bundledFallbackRanked);
const enforceReleaseFloors = args.rankedCount === DEFAULT_RANKED_TARGET && args.reserveCount === DEFAULT_RESERVE_TARGET && args.bundledFallbackRankedCount === DEFAULT_BUNDLED_FALLBACK_RANKED_COUNT;
if (enforceReleaseFloors) {
  for (const [key, floor] of Object.entries(FULL_COHORT_FLOORS)) {
    if ((fullCohortCounts[key] ?? 0) < floor) throw new Error(`Full selection cohort ${key} has ${fullCohortCounts[key] ?? 0}; floor is ${floor}. Safety gates were not relaxed.`);
  }
  for (const [key, floor] of Object.entries(FALLBACK_COHORT_FLOORS)) {
    if ((fallbackCohortCounts[key] ?? 0) < floor) throw new Error(`Bundled fallback cohort ${key} has ${fallbackCohortCounts[key] ?? 0}; floor is ${floor}. Safety gates were not relaxed.`);
  }
  for (const [key, floor] of Object.entries(FULL_TAG_FLOORS)) {
    if ((fullTagCounts[key] ?? 0) < floor) throw new Error(`Full merchandising tag ${key} has ${fullTagCounts[key] ?? 0}; floor is ${floor}`);
  }
  for (const [key, floor] of Object.entries(FALLBACK_TAG_FLOORS)) {
    if ((fallbackTagCounts[key] ?? 0) < floor) throw new Error(`Bundled fallback merchandising tag ${key} has ${fallbackTagCounts[key] ?? 0}; floor is ${floor}`);
  }
}
const metadata = {
  schemaVersion: CATALOG_SCHEMA_VERSION,
  seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
  catalogName: 'คลังสินค้าน่าขาย',
  catalogDescription: 'สินค้าคัดจากยอดขายสะสม คะแนนสินค้า คุณภาพร้าน ราคา และความเหมาะกับช่วงเวลา',
  generatedAt,
  sourceCheckedAt: checkedAt,
  targetRankedCount: args.rankedCount,
  minimumRankedCount: args.minimumRankedCount,
  rankedCount: ranked.length,
  targetReserveCount: args.reserveCount,
  reserveCount: reserve.length,
  bundledFallbackRankedCount: Math.min(args.bundledFallbackRankedCount, ranked.length),
  taxonomyVersion: 'taxonomy-v5',
  selectionStatus: ranked.length === args.rankedCount && reserve.length === args.reserveCount ? 'target-met' : 'safe-source-shortfall',
};
const fullCatalog = {
  ...metadata,
  catalogArtifactMode: 'full-approved',
  approvedRankedCount: ranked.length,
  groupDefinitions: CATALOG_GROUP_DEFINITIONS,
  categoryDefinitions: CATALOG_CATEGORY_DEFINITIONS,
  subcategoryDefinitions: CATALOG_SUBCATEGORY_DEFINITIONS,
  merchandisingTagDefinitions: CATALOG_MERCHANDISING_TAG_DEFINITIONS,
  selectionCohortDefinitions: SELECTION_COHORT_DEFINITIONS.map(({ key, label }) => ({ key, label })),
  selectionFloors: { full: FULL_COHORT_FLOORS, bundledFallback: FALLBACK_COHORT_FLOORS, fullTags: FULL_TAG_FLOORS, bundledFallbackTags: FALLBACK_TAG_FLOORS },
  featured: makeFeaturedBook(),
  ranked,
};
const catalog = {
  ...fullCatalog,
  catalogArtifactMode: 'bundled-fallback',
  rankedCount: bundledFallbackCount,
  approvedRankedCount: ranked.length,
  fullCatalogArtifact: 'catalog-full.json.gz',
  ranked: bundledFallbackRanked,
};
const reserveCatalog = {
  schemaVersion: CATALOG_SCHEMA_VERSION,
  seasonalMetadataVersion: SEASONAL_METADATA_VERSION,
  taxonomyVersion: 'taxonomy-v5',
  generatedAt,
  sourceCheckedAt: checkedAt,
  approvedRankedCount: ranked.length,
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
  rejectionBreakdown: rejectionBreakdown(rejectionCounts),
  groupDefinitions: CATALOG_GROUP_DEFINITIONS,
  categoryDefinitions: CATALOG_CATEGORY_DEFINITIONS,
  subcategoryDefinitions: CATALOG_SUBCATEGORY_DEFINITIONS,
  merchandisingTagDefinitions: CATALOG_MERCHANDISING_TAG_DEFINITIONS,
  eligibleByRiskTier: Object.fromEntries([...eligibleByRiskTier.entries()].sort((left, right) => left[0].localeCompare(right[0], 'en'))),
  eligibleByGroupKey: Object.fromEntries(CATALOG_GROUP_DEFINITIONS.map(({ key }) => [key, eligibleByGroupKey.get(key) ?? 0])),
  eligibleByCategoryKey: Object.fromEntries(CATALOG_CATEGORY_DEFINITIONS.map(({ key }) => [key, eligibleByCategoryKey.get(key) ?? 0])),
  eligibleBySubcategoryKey: Object.fromEntries(CATALOG_SUBCATEGORY_DEFINITIONS.map(({ key }) => [key, eligibleBySubcategoryKey.get(key) ?? 0])),
  eligibleBySelectionCohort: Object.fromEntries(eligibleBySelectionCohort),
  eligibleByGroup: Object.fromEntries([...eligibleByGroup.entries()].sort((left, right) => right[1] - left[1])),
  eligibleByCategory: Object.fromEntries([...eligibleByCategory.entries()].sort((a, b) => b[1] - a[1])),
  eligibleBySubcategory: Object.fromEntries([...eligibleBySubcategory.entries()].sort((a, b) => b[1] - a[1])),
  eligibleByMerchandisingTag: Object.fromEntries(eligibleByMerchandisingTag),
  selectedByCategory: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.category, (counts.get(product.category) ?? 0) + 1), new Map())]),
  selectedByCategoryKey: Object.fromEntries(ranked.reduce((counts, product) => counts.set(product.categoryKey, (counts.get(product.categoryKey) ?? 0) + 1), new Map(CATALOG_CATEGORY_DEFINITIONS.map(({ key }) => [key, 0])))),
  selectedBySubcategory: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.subcategory, (counts.get(product.subcategory) ?? 0) + 1), new Map())]),
  selectedBySubcategoryKey: Object.fromEntries(ranked.reduce((counts, product) => counts.set(product.subcategoryKey, (counts.get(product.subcategoryKey) ?? 0) + 1), new Map(CATALOG_SUBCATEGORY_DEFINITIONS.map(({ key }) => [key, 0])))),
  selectedByMerchandisingTag: Object.fromEntries(CATALOG_MERCHANDISING_TAG_DEFINITIONS.map(({ key }) => [key, ranked.filter((product) => product.merchandisingTags.includes(key)).length])),
  selectedBySeasonTag: Object.fromEntries([...ranked.reduce((counts, product) => {
    for (const tag of product.seasonTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return counts;
  }, new Map())]),
  selectedEvergreenCount: ranked.filter((product) => product.evergreen).length,
  selectedByClimateSeason: Object.fromEntries(CLIMATE_SEASONS.map((season) => [season, ranked.filter((product) => product.seasonTags.includes(season)).length])),
  selectedByCampaignTag: Object.fromEntries(CAMPAIGN_TAGS.map((campaign) => [campaign, ranked.filter((product) => product.campaignTags.includes(campaign)).length])),
  selectedSeasonCombinations: Object.fromEntries([...ranked.reduce((counts, product) => {
    const combination = product.seasonTags.join('+');
    counts.set(combination, (counts.get(combination) ?? 0) + 1);
    return counts;
  }, new Map())]),
  selectedByMonth: Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return [month, ranked.filter((product) => product.monthTags.includes(month)).length];
  })),
  selectedByGroup: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.categoryGroup, (counts.get(product.categoryGroup) ?? 0) + 1), new Map())]),
  selectedByRiskTier: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.riskTier, (counts.get(product.riskTier) ?? 0) + 1), new Map())]),
  selectedByReviewStatus: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.reviewStatus, (counts.get(product.reviewStatus) ?? 0) + 1), new Map())]),
  selectedByReviewMethod: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.reviewMethod, (counts.get(product.reviewMethod) ?? 0) + 1), new Map())]),
  selectedByShopType: Object.fromEntries([...ranked.reduce((counts, product) => counts.set(product.shopType, (counts.get(product.shopType) ?? 0) + 1), new Map())]),
  selectedByReasonCode: Object.fromEntries([...ranked.reduce((counts, product) => {
    for (const reason of product.reasonCodes) counts.set(reason, (counts.get(reason) ?? 0) + 1);
    return counts;
  }, new Map())].sort((left, right) => left[0].localeCompare(right[0], 'en'))),
  qualityChecks: {
    publicApprovedOnly: ranked.every((product) => product.reviewStatus === 'approved') && reserve.every((product) => product.reviewStatus === 'approved'),
    selectedPriceBaitCount: 0,
    selectedDuplicateIdCount: ranked.length + reserve.length - new Set([...ranked, ...reserve].map((product) => product.id)).size,
    reviewCountFieldPresent: false,
    commissionFieldPresent: false,
    maxSelectedPerShop: Math.max(...ranked.reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map()).values()),
    maxSelectedAndReservePerShop: Math.max(...[...ranked, ...reserve].reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map()).values()),
    maxIdenticalSemanticSummary: fullAndReserveSummaryStats.maxIdenticalCount,
    semanticSummaryUniquePercent: fullAndReserveSummaryStats.uniquePercent,
  },
  semanticSummaryStats: {
    fullAndReserve: fullAndReserveSummaryStats,
    bundledFallback: bundledFallbackSummaryStats,
  },
  fullCoverage: coverage(ranked),
  bundledFallbackCoverage: coverage(bundledFallbackRanked),
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const fullCatalogBytes = Buffer.from(`${JSON.stringify(fullCatalog)}\n`, 'utf8');
const fullCatalogGzip = gzipSync(fullCatalogBytes, { level: 9, mtime: 0 });
const fallbackCatalogBytes = Buffer.from(`${JSON.stringify(catalog)}\n`, 'utf8');
const reserveCatalogBytes = Buffer.from(`${JSON.stringify(reserveCatalog)}\n`, 'utf8');
const MAX_TRACKED_ARTIFACT_BYTES = 95 * 1024 * 1024;
for (const [name, bytes] of Object.entries({
  'catalog-full.json.gz': fullCatalogGzip,
  'catalog.json': fallbackCatalogBytes,
  'catalog-reserve.json': reserveCatalogBytes,
})) {
  if (bytes.byteLength >= MAX_TRACKED_ARTIFACT_BYTES) {
    throw new Error(`${name} is ${bytes.byteLength} bytes; tracked catalog artifacts must stay below 95 MiB`);
  }
}
report.qualityChecks.trackedArtifactsBelow95MiB = true;
report.fullArtifact = {
  path: 'catalog-full.json.gz',
  catalogArtifactMode: 'full-approved',
  rankedCount: ranked.length,
  compression: 'gzip',
  compressedBytes: fullCatalogGzip.byteLength,
  compressedSha256: sha256(fullCatalogGzip),
  uncompressedBytes: fullCatalogBytes.byteLength,
  uncompressedSha256: sha256(fullCatalogBytes),
};
report.bundledFallbackArtifact = {
  path: 'catalog.json',
  catalogArtifactMode: 'bundled-fallback',
  rankedCount: bundledFallbackCount,
  bytes: fallbackCatalogBytes.byteLength,
  sha256: sha256(fallbackCatalogBytes),
};
report.reserveArtifact = {
  path: 'catalog-reserve.json',
  reserveCount: reserve.length,
  bytes: reserveCatalogBytes.byteLength,
  sha256: sha256(reserveCatalogBytes),
};
const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
const manifest = {
  artifactVersion: 'catalog-artifacts-v5',
  schemaVersion: CATALOG_SCHEMA_VERSION,
  taxonomyVersion: 'taxonomy-v5',
  generatedAt,
  sourceCheckedAt: checkedAt,
  artifacts: {
    fullCatalog: report.fullArtifact,
    bundledFallback: report.bundledFallbackArtifact,
    reserve: report.reserveArtifact,
    buildReport: {
      path: 'build-report.json',
      bytes: reportBytes.byteLength,
      sha256: sha256(reportBytes),
    },
  },
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

await mkdir(args.outputDir, { recursive: true });
const writes = [
  writeFile(resolve(args.outputDir, 'catalog-full.json.gz'), fullCatalogGzip),
  writeFile(resolve(args.outputDir, 'catalog.json'), fallbackCatalogBytes),
  writeFile(resolve(args.outputDir, 'catalog-reserve.json'), reserveCatalogBytes),
  writeFile(resolve(args.outputDir, 'build-report.json'), reportBytes),
  writeFile(resolve(args.outputDir, 'catalog-manifest.json'), manifestBytes),
];
if (args.writeRuntime) writes.push(writeFile(args.runtimeModule, toRuntimeModule(catalog), 'utf8'));
await Promise.all(writes);

process.stdout.write(`${JSON.stringify({
  status: 'ok',
  input: args.input,
  sourceRowsScanned: result.rowCount,
  eligibleRows,
  targetRankedCount: args.rankedCount,
  rankedCount: ranked.length,
  targetReserveCount: args.reserveCount,
  reserveCount: reserve.length,
  bundledFallbackRankedCount: metadata.bundledFallbackRankedCount,
  nulBytesRemoved: result.nulBytesRemoved,
  outputDir: args.outputDir,
  runtimeModule: args.writeRuntime ? args.runtimeModule : null,
}, null, 2)}\n`);
