import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPLIANCE_FAN_V5_GOLDEN_FIXTURES,
  NEW_RULE_SPECS_V5,
  PHONE_RUGGED_CASE_V5_GOLDEN_FIXTURES,
  RELIGIOUS_DENY,
  RELIGIOUS_DENY_V5_GOLDEN_FIXTURES,
  TABLET_CASE_IDENTITY_V5,
  TABLET_CASE_IDENTITY_V5_GOLDEN_FIXTURES,
  TAXONOMY_V5_POLICY_GOLDEN_FIXTURES,
  TAXONOMY_V5_REJECTION_GOLDEN_FIXTURES,
  cosmeticTitleFamilyV5,
  isConsumerApplianceFanV5,
  isPassiveReplacementFilterTitleV5,
  isRuggedPhoneCaseV5,
} from './taxonomy-v5.mjs';
import { CATALOG_RULES } from './sellable-catalog-lib.mjs';

function matchingLeaves(fixture) {
  return NEW_RULE_SPECS_V5.filter((category) =>
    category.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title));
}

test('every admitted taxonomy golden maps to exactly one intended leaf', () => {
  for (const fixture of TAXONOMY_V5_POLICY_GOLDEN_FIXTURES) {
    const matches = matchingLeaves(fixture);
    assert.deepEqual(matches.map(({ key }) => key), [fixture.expectedKey], fixture.name);
    assert.equal(Boolean(matches[0].deny?.test(fixture.title)), fixture.denied, fixture.name);
  }
});

test('strong makeup organizer identity outranks incidental brush wording', () => {
  const fixture = TAXONOMY_V5_POLICY_GOLDEN_FIXTURES.find(({ name }) =>
    name === 'makeup organizer outranks incidental brushes');
  assert.ok(fixture);
  assert.equal(cosmeticTitleFamilyV5(fixture.title), 'beauty-makeup-organizers');
});

test('exact source C3 and tablet identity split mobile accessories before legacy phone cases', () => {
  const classify = (c3, title) => CATALOG_RULES.find((category) =>
    category.matcher('Mobile & Gadgets', 'Accessories', c3, title));
  const phoneCases = CATALOG_RULES.find(({ key }) => key === 'phone-cases');
  const mobilePouches = CATALOG_RULES.find(({ key }) => key === 'mobile-pouches');
  const tabletCases = CATALOG_RULES.find(({ key }) => key === 'tablet-cases');
  const tabletTitles = [
    'เคส iPad Air', 'เคสไอแพดรุ่นใหม่', 'เคสแท็บเล็ต 11 นิ้ว', 'tablet case 10 inch',
    'Case Galaxy Tab S10', 'MatePad protective cover', 'Redmi Pad case', 'Xiaomi Pad cover', 'Lenovo Tab case',
    ...TABLET_CASE_IDENTITY_V5_GOLDEN_FIXTURES.positive.map(({ title }) => title),
  ];

  assert.equal(classify('Phone Straps & Keychains', 'อุปกรณ์มือถือรุ่น A')?.key, 'phone-grips-straps');
  assert.equal(classify('Phone Grips', 'อุปกรณ์มือถือรุ่น B')?.key, 'phone-grips-straps');
  assert.equal(classify('Mobile Pouches', 'ซองอุปกรณ์มือถือรุ่น A')?.key, 'mobile-pouches');
  for (const title of tabletTitles) assert.equal(classify('Cases, Covers, & Skins', title)?.key, 'tablet-cases', title);
  assert.equal(classify('Cases, Covers, & Skins', 'เคสใสโทรศัพท์รุ่น A')?.key, 'phone-cases');
  assert.equal(phoneCases.matcher('Mobile & Gadgets', 'Accessories', 'Phone Straps & Keychains', 'เคสพร้อมสายคล้อง'), false);
  assert.equal(phoneCases.matcher('Mobile & Gadgets', 'Accessories', 'Phone Grips', 'เคสพร้อมที่จับ'), false);
  assert.equal(phoneCases.matcher('Mobile & Gadgets', 'Accessories', 'Mobile Pouches', 'ซองใส่มือถือ'), false);
  for (const title of tabletTitles) assert.equal(phoneCases.matcher('Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', title), false, title);
  assert.equal(mobilePouches.matcher('Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', 'ซองใส่มือถือ'), false);
  assert.equal(tabletCases.matcher('Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', 'เคสใสโทรศัพท์รุ่น A'), false);
  for (const { name, title } of TABLET_CASE_IDENTITY_V5_GOLDEN_FIXTURES.negative) {
    assert.equal(TABLET_CASE_IDENTITY_V5.test(title), false, name);
    assert.equal(classify('Cases, Covers, & Skins', title)?.key, 'phone-cases', name);
    assert.equal(tabletCases.matcher('Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', title), false, name);
    assert.equal(phoneCases.matcher('Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', title), true, name);
  }
  assert.equal(Boolean(mobilePouches.deny.test('Mobile pouch power bank battery')), true);
  assert.equal(Boolean(tabletCases.deny.test('iPad case with power bank battery')), true);
});

test('rugged handset cases form a distinct first-match leaf without device-family leakage', () => {
  const classify = (fixture) => CATALOG_RULES.find((category) =>
    category.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title));
  const ruggedCases = CATALOG_RULES.find(({ key }) => key === 'phone-rugged-cases');
  const phoneCases = CATALOG_RULES.find(({ key }) => key === 'phone-cases');
  assert.ok(ruggedCases);
  assert.ok(phoneCases);

  for (const fixture of PHONE_RUGGED_CASE_V5_GOLDEN_FIXTURES.positive) {
    assert.equal(isRuggedPhoneCaseV5(fixture.title), true, fixture.id);
    assert.equal(ruggedCases.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title), true, fixture.id);
    assert.equal(phoneCases.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title), false, fixture.id);
    assert.deepEqual(matchingLeaves(fixture).map(({ key }) => key), ['phone-rugged-cases'], fixture.id);
    assert.equal(classify(fixture)?.key, 'phone-rugged-cases', fixture.id);
  }
  for (const fixture of PHONE_RUGGED_CASE_V5_GOLDEN_FIXTURES.negative) {
    assert.equal(isRuggedPhoneCaseV5(fixture.title), false, fixture.id);
    assert.equal(ruggedCases.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title), false, fixture.id);
    assert.notEqual(classify(fixture)?.key, 'phone-rugged-cases', fixture.id);
  }

  const [ordinaryPhoneCase, ruggedTabletCase] = PHONE_RUGGED_CASE_V5_GOLDEN_FIXTURES.nearMiss;
  assert.equal(classify(ordinaryPhoneCase)?.key, 'phone-cases');
  assert.equal(classify(ruggedTabletCase)?.key, 'tablet-cases');
  assert.equal(phoneCases.matcher(ordinaryPhoneCase.c1, ordinaryPhoneCase.c2, ordinaryPhoneCase.c3, ordinaryPhoneCase.title), true);
  assert.equal(phoneCases.matcher(ruggedTabletCase.c1, ruggedTabletCase.c2, ruggedTabletCase.c3, ruggedTabletCase.title), false);
});

test('appliance fans require a genuine consumer fan identity on a supported source path', () => {
  const fanRule = NEW_RULE_SPECS_V5.find(({ key }) => key === 'appliance-fans');
  const classify = (fixture) => CATALOG_RULES.find((category) =>
    category.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title));
  assert.ok(fanRule);
  assert.equal(APPLIANCE_FAN_V5_GOLDEN_FIXTURES.rejected.length, 18);
  assert.equal(APPLIANCE_FAN_V5_GOLDEN_FIXTURES.allowed.length, 13);

  for (const fixture of APPLIANCE_FAN_V5_GOLDEN_FIXTURES.rejected) {
    assert.equal(isConsumerApplianceFanV5(fixture.c1, fixture.c2, fixture.c3, fixture.title), false, fixture.id);
    assert.equal(fanRule.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title), false, fixture.id);
    assert.equal(matchingLeaves(fixture).some(({ key }) => key === 'appliance-fans'), false, fixture.id);
    assert.notEqual(classify(fixture)?.key, 'appliance-fans', fixture.id);
  }
  for (const fixture of [
    ...APPLIANCE_FAN_V5_GOLDEN_FIXTURES.allowed,
    ...APPLIANCE_FAN_V5_GOLDEN_FIXTURES.nearMiss,
  ]) {
    assert.equal(isConsumerApplianceFanV5(fixture.c1, fixture.c2, fixture.c3, fixture.title), true, fixture.id);
    assert.equal(fanRule.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title), true, fixture.id);
    assert.deepEqual(matchingLeaves(fixture).map(({ key }) => key), ['appliance-fans'], fixture.id);
    assert.equal(classify(fixture)?.key, 'appliance-fans', fixture.id);
  }
});

test('religious claim deny expansion blocks exact claims without swallowing neutral worship language', () => {
  for (const fixture of RELIGIOUS_DENY_V5_GOLDEN_FIXTURES.denied) {
    assert.equal(RELIGIOUS_DENY.test(fixture.title), true, fixture.id);
    const matches = matchingLeaves(fixture);
    assert.deepEqual(matches.map(({ key }) => key), [fixture.expectedKey], fixture.id);
    assert.equal(matches[0].deny.test(fixture.title), true, fixture.id);
  }
  for (const fixture of RELIGIOUS_DENY_V5_GOLDEN_FIXTURES.allowed) {
    assert.equal(RELIGIOUS_DENY.test(fixture.title), false, fixture.id);
  }
});

test('full appliances and mixed accessory listings are not passive replacement filters', () => {
  assert.equal(TAXONOMY_V5_REJECTION_GOLDEN_FIXTURES.length, 53);
  for (const fixture of TAXONOMY_V5_REJECTION_GOLDEN_FIXTURES) {
    assert.equal(isPassiveReplacementFilterTitleV5(fixture.title), false, fixture.name);
    assert.equal(matchingLeaves(fixture).some(({ key }) => key === fixture.excludedKey), false, fixture.name);
  }
  const filter8 = TAXONOMY_V5_REJECTION_GOLDEN_FIXTURES.filter(({ name }) => name.startsWith('filter8 '));
  assert.equal(filter8.length, 8);
  const filterAllows = TAXONOMY_V5_POLICY_GOLDEN_FIXTURES.filter(({ name }) => name.startsWith('filter allow '));
  assert.equal(filterAllows.length, 3);
  for (const fixture of filterAllows) {
    assert.equal(isPassiveReplacementFilterTitleV5(fixture.title), true, fixture.name);
    assert.equal(CATALOG_RULES.find((category) =>
      category.matcher(fixture.c1, fixture.c2, fixture.c3, fixture.title))?.key, 'appliance-replacement-filters', fixture.name);
  }
  assert.equal(isPassiveReplacementFilterTitleV5('ไส้กรองน้ำแบบดิสก์สำหรับเครื่องกรองน้ำดื่ม รุ่น A'), true);
  assert.equal(isPassiveReplacementFilterTitleV5('ไส้กรองคาร์บอนสำหรับเครื่องกรองน้ำระบบ UV รุ่น A'), true);
  const teaBag = TAXONOMY_V5_REJECTION_GOLDEN_FIXTURES.find(({ name }) =>
    name.includes('66426364-2040000521'));
  assert.ok(teaBag);
  assert.notEqual(CATALOG_RULES.find((category) =>
    category.matcher(teaBag.c1, teaBag.c2, teaBag.c3, teaBag.title))?.key, 'appliance-replacement-filters');
  const carrier = TAXONOMY_V5_REJECTION_GOLDEN_FIXTURES.find(({ name }) =>
    name === 'full Carrier air conditioner');
  assert.equal(isPassiveReplacementFilterTitleV5(`${carrier.title} พร้อมแผ่นกรองฝุ่น PM2.5`), false);
});
