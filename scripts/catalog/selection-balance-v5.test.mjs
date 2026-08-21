import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CATALOG_SUBCATEGORY_DEFINITIONS,
  selectSellableCatalog,
} from './sellable-catalog-lib.mjs';

const DOMINANT_GROUPS = new Set(['fashion', 'home', 'learning']);

function candidate(subcategoryKey, categoryGroupKey, suffix, score, shopId = `shop-${subcategoryKey}-${suffix}`) {
  const id = `${subcategoryKey}-${suffix}`;
  return {
    id,
    subcategoryKey,
    categoryGroupKey,
    shopId,
    score,
    recommendationScore: score,
    itemSold: score,
    rating: 5,
    titleFingerprint: `title-${id}`,
    summaryFingerprint: `summary-${id}`,
    imageFingerprint: `image-${id}`,
    sourceCategoryPath: `source-${id}`,
  };
}

function pool(candidates) {
  return {
    toSortedDescending: () => [...candidates].sort((left, right) =>
      right.score - left.score || right.itemSold - left.itemSold || right.rating - left.rating || left.id.localeCompare(right.id, 'en')),
  };
}

function leafKeys(groupKey, count) {
  const keys = CATALOG_SUBCATEGORY_DEFINITIONS.filter((definition) => definition.groupKey === groupKey).map((definition) => definition.key);
  assert.ok(keys.length >= count, `test fixture needs ${count} ${groupKey} leaves`);
  return keys.slice(0, count);
}

function sharedShopCollisionFixture() {
  const sharedShopId = 'shared-shop-at-ranked-cap';
  const candidatesByCategory = new Map();
  for (const groupKey of ['tech', 'tools']) {
    const [subcategoryKey] = leafKeys(groupKey, 1);
    candidatesByCategory.set(subcategoryKey, pool(Array.from({ length: 9 }, (_, index) =>
      candidate(subcategoryKey, groupKey, `outside-${index}`, 200 - index, sharedShopId))));
  }
  let dominantScore = 10_000;
  for (const groupKey of DOMINANT_GROUPS) {
    for (const subcategoryKey of leafKeys(groupKey, 4)) {
      candidatesByCategory.set(subcategoryKey, pool([
        candidate(subcategoryKey, groupKey, 'shared', dominantScore, sharedShopId),
        candidate(subcategoryKey, groupKey, 'unique-a', dominantScore - 1),
        candidate(subcategoryKey, groupKey, 'unique-b', dominantScore - 2),
      ]));
      dominantScore -= 10;
    }
  }
  return { candidatesByCategory, sharedShopId };
}

test('non-dominant breadth is selected before dominant candidates consume the shared shop cap', () => {
  const { candidatesByCategory, sharedShopId } = sharedShopCollisionFixture();
  const selection = selectSellableCatalog(candidatesByCategory, 36, 4);
  const sharedShopRanked = selection.ranked.filter((product) => product.shopId === sharedShopId);
  const nonDominantCount = selection.ranked.filter((product) => !DOMINANT_GROUPS.has(product.categoryGroupKey)).length;

  assert.equal(selection.ranked.length, 36);
  assert.equal(selection.reserve.length, 4);
  assert.equal(nonDominantCount, 18);
  assert.equal(sharedShopRanked.length, 18);
  assert.ok(sharedShopRanked.every((product) => !DOMINANT_GROUPS.has(product.categoryGroupKey)), 'dominant rows consumed shared-shop capacity before non-dominant breadth');
  assert.deepEqual(selection.ranked.map((product) => product.rank), Array.from({ length: 36 }, (_, index) => index + 1));
  assert.deepEqual(selection.reserve.map((product) => product.reserveOrder), Array.from({ length: 4 }, (_, index) => index + 1));
  assert.equal(new Set([...selection.ranked, ...selection.reserve].map((product) => product.id)).size, 40);
});

test('selection fails closed when safe non-dominant supply cannot reach half of ranked capacity', () => {
  const [outsideLeaf] = leafKeys('tech', 1);
  const [dominantLeaf] = leafKeys('fashion', 1);
  const candidatesByCategory = new Map([
    [outsideLeaf, pool(Array.from({ length: 4 }, (_, index) => candidate(outsideLeaf, 'tech', `outside-${index}`, 100 - index)))],
    [dominantLeaf, pool(Array.from({ length: 20 }, (_, index) => candidate(dominantLeaf, 'fashion', `dominant-${index}`, 10_000 - index)))],
  ]);

  const diagnostics = {};
  assert.throws(
    () => selectSellableCatalog(candidatesByCategory, 10, 1, { diagnostics }),
    /Could select only 4 of 5 required non-dominant ranked products without relaxing quality gates/u,
  );
  assert.equal(diagnostics.rankedNonDominant.targetCount, 5);
  assert.equal(diagnostics.rankedNonDominant.selectedCount, 4);
  assert.equal(diagnostics.rankedNonDominant.candidateCount, 4);
  assert.equal(diagnostics.rankedNonDominant.availableNow, 0);
});

test('an honest rugged-case leaf recovers cardinality without changing the leaf cap', () => {
  const phoneCaseLeaf = CATALOG_SUBCATEGORY_DEFINITIONS.find(({ key }) => key === 'phone-cases');
  const ruggedCaseLeaf = CATALOG_SUBCATEGORY_DEFINITIONS.find(({ key }) => key === 'phone-rugged-cases');
  const [dominantLeafA, dominantLeafB] = leafKeys('fashion', 2);
  assert.ok(phoneCaseLeaf && ruggedCaseLeaf, 'fixture needs both phone-case product identities');

  const ordinaryPhoneCases = Array.from({ length: 650 }, (_, index) =>
    candidate(phoneCaseLeaf.key, phoneCaseLeaf.groupKey, `ordinary-${index}`, 20_000 - index));
  const ruggedPhoneCase = candidate(ruggedCaseLeaf.key, ruggedCaseLeaf.groupKey, 'rugged', 19_000);
  const dominantA = Array.from({ length: 650 }, (_, index) =>
    candidate(dominantLeafA, 'fashion', `dominant-a-${index}`, 10_000 - index));
  const dominantB = Array.from({ length: 2 }, (_, index) =>
    candidate(dominantLeafB, 'fashion', `dominant-b-${index}`, 9_000 - index));

  const splitPool = new Map([
    [phoneCaseLeaf.key, pool(ordinaryPhoneCases)],
    [ruggedCaseLeaf.key, pool([ruggedPhoneCase])],
    [dominantLeafA, pool(dominantA)],
    [dominantLeafB, pool(dominantB)],
  ]);
  const selection = selectSellableCatalog(splitPool, 1_302, 1);
  const nonDominant = selection.ranked.filter(({ categoryGroupKey }) => !DOMINANT_GROUPS.has(categoryGroupKey));
  assert.equal(nonDominant.length, 651);
  assert.equal(nonDominant.filter(({ subcategoryKey }) => subcategoryKey === phoneCaseLeaf.key).length, 650);
  assert.equal(nonDominant.filter(({ subcategoryKey }) => subcategoryKey === ruggedCaseLeaf.key).length, 1);

  const unsplitPool = new Map([
    [phoneCaseLeaf.key, pool([...ordinaryPhoneCases, { ...ruggedPhoneCase, subcategoryKey: phoneCaseLeaf.key }])],
    [dominantLeafA, pool(dominantA)],
    [dominantLeafB, pool(dominantB)],
  ]);
  assert.throws(
    () => selectSellableCatalog(unsplitPool, 1_302, 1),
    /Could select only 650 of 651 required non-dominant ranked products/u,
  );
});

test('shop-diverse breadth runs before ordinary quotas that collide on both shop and title', () => {
  const sharedShopId = 'ordinary-quota-shared-shop';
  const ordinaryLeaves = CATALOG_SUBCATEGORY_DEFINITIONS.filter(({ groupKey }) =>
    !DOMINANT_GROUPS.has(groupKey) && groupKey !== 'automotive' && groupKey !== 'supplements').slice(0, 18);
  assert.equal(ordinaryLeaves.length, 18, 'fixture needs eighteen ordinary non-dominant leaves');

  const candidatesByCategory = new Map();
  for (const [index, { key: subcategoryKey, groupKey }] of ordinaryLeaves.entries()) {
    const score = 10_000 - index;
    const quotaPrefill = candidate(subcategoryKey, groupKey, `quota-prefill-${index}`, score, sharedShopId);
    const rareShopAlternative = candidate(subcategoryKey, groupKey, `rare-shop-alternative-${index}`, score - 1, `rare-shop-${index}`);
    const sharedShopFallback = candidate(subcategoryKey, groupKey, `shared-shop-fallback-${index}`, score - 2_000, sharedShopId);
    quotaPrefill.titleFingerprint = `collision-title-${index}`;
    rareShopAlternative.titleFingerprint = quotaPrefill.titleFingerprint;
    candidatesByCategory.set(subcategoryKey, pool([quotaPrefill, rareShopAlternative, sharedShopFallback]));
  }

  const [dominantLeaf] = leafKeys('fashion', 1);
  candidatesByCategory.set(dominantLeaf, pool(Array.from({ length: 40 }, (_, index) =>
    candidate(dominantLeaf, 'fashion', `dominant-${index}`, 5_000 - index))));

  const diagnostics = {};
  const selection = selectSellableCatalog(candidatesByCategory, 72, 1, { diagnostics });
  const nonDominant = selection.ranked.filter(({ categoryGroupKey }) => !DOMINANT_GROUPS.has(categoryGroupKey));
  const sharedShopRanked = selection.ranked.filter(({ shopId }) => shopId === sharedShopId);

  assert.equal(selection.ranked.length, 72);
  assert.equal(selection.reserve.length, 1);
  assert.equal(nonDominant.length, 36);
  assert.equal(sharedShopRanked.length, 18);
  assert.ok(nonDominant.every(({ id }) => !id.includes('quota-prefill')), 'score-first ordinary quota rows won the cross-constraint collision');
  assert.equal(nonDominant.filter(({ id }) => id.includes('rare-shop-alternative')).length, 18);
  assert.equal(nonDominant.filter(({ id }) => id.includes('shared-shop-fallback')).length, 18);
  assert.equal(diagnostics.rankedNonDominant.targetCount, 36);
  assert.equal(diagnostics.rankedNonDominant.selectedCount, 36);
  assert.equal(Math.max(...Object.values(diagnostics.rankedNonDominant.selectedBySubcategory)), 2);
});

test('a scarce leaf wins title, image and shop collisions against a surplus leaf', () => {
  const phoneCaseLeaf = CATALOG_SUBCATEGORY_DEFINITIONS.find(({ key }) => key === 'phone-cases');
  const scarceLeaf = CATALOG_SUBCATEGORY_DEFINITIONS.find(({ key }) => key === 'phone-screen-protectors');
  assert.ok(phoneCaseLeaf && scarceLeaf, 'fixture needs the tech surplus and scarce leaves');

  const collisionShop = 'surplus-scarcity-collision-shop';
  const surplusWinnerWithoutScarcity = candidate(phoneCaseLeaf.key, phoneCaseLeaf.groupKey, 'surplus-collision', 20_000, collisionShop);
  const scarceCandidate = candidate(scarceLeaf.key, scarceLeaf.groupKey, 'scarce-collision', 1, collisionShop);
  surplusWinnerWithoutScarcity.titleFingerprint = 'shared-surplus-scarcity-title';
  surplusWinnerWithoutScarcity.imageFingerprint = 'shared-surplus-scarcity-image';
  scarceCandidate.titleFingerprint = surplusWinnerWithoutScarcity.titleFingerprint;
  scarceCandidate.imageFingerprint = surplusWinnerWithoutScarcity.imageFingerprint;

  // Small selections retain a fixed 650-row leaf cap. Keep the phone-case pool
  // one row above it so this test exercises only the surplus/scarcity ordering.
  const surplusPool = [surplusWinnerWithoutScarcity, ...Array.from({ length: 650 }, (_, index) =>
    candidate(phoneCaseLeaf.key, phoneCaseLeaf.groupKey, `surplus-${index}`, 19_000 - index))];
  const [dominantLeaf] = leafKeys('fashion', 1);
  const candidatesByCategory = new Map([
    [phoneCaseLeaf.key, pool(surplusPool)],
    [scarceLeaf.key, pool([scarceCandidate])],
    [dominantLeaf, pool(Array.from({ length: 20 }, (_, index) =>
      candidate(dominantLeaf, 'fashion', `dominant-scarcity-${index}`, 10_000 - index)))],
  ]);

  const selection = selectSellableCatalog(candidatesByCategory, 10, 1);
  const selectedIds = new Set([...selection.ranked, ...selection.reserve].map(({ id }) => id));

  assert.ok(selectedIds.has(scarceCandidate.id), 'scarce leaf lost the cross-constraint collision');
  assert.ok(!selectedIds.has(surplusWinnerWithoutScarcity.id), 'surplus leaf won despite having alternate eligible rows');
});

test('balanced selection IDs and ordering are deterministic across identical runs', () => {
  const firstFixture = sharedShopCollisionFixture();
  const secondFixture = sharedShopCollisionFixture();
  const first = selectSellableCatalog(firstFixture.candidatesByCategory, 36, 4);
  const second = selectSellableCatalog(secondFixture.candidatesByCategory, 36, 4);

  assert.deepEqual(first.ranked.map(({ id, rank }) => ({ id, rank })), second.ranked.map(({ id, rank }) => ({ id, rank })));
  assert.deepEqual(first.reserve.map(({ id, reserveOrder }) => ({ id, reserveOrder })), second.reserve.map(({ id, reserveOrder }) => ({ id, reserveOrder })));
});
