import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BROKEN_THAI_TOKEN,
  CLEAR_GIBBERISH,
  FINAL_DEFECT,
  FINAL_GARBLE_OR_RAW_HEADER,
  FINAL_HIGH_RISK_CLAIM,
  FINAL_PROMO_POLICY,
  FINAL_UNSUITABLE_BODY_PRODUCT,
  TRAILING_INCOMPLETE_NAME,
  TRAILING_INCOMPLETE_SUMMARY,
  UNREADABLE_THAI_RUN,
  hasConflictingLayerCounts,
  hasConflictingUnitCounts,
  hasBalancedPairs,
  hasRepeatedSummaryPhrase,
  summaryMostlyRestatesName,
} from './catalog-lib.mjs';

function parseArgs(argv) {
  const args = {
    catalog: resolve('data', 'products', 'catalog.json'),
    reserve: resolve('data', 'products', 'catalog-reserve.json'),
    runtimeModule: resolve('api', '_gen3-products.js'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--catalog') args.catalog = resolve(argv[++index]);
    else if (argv[index] === '--reserve') args.reserve = resolve(argv[++index]);
    else if (argv[index] === '--runtime-module') args.runtimeModule = resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateUrl(value, type, id) {
  assert(typeof value === 'string' && !value.includes('\0'), `${id}: invalid ${type} URL string`);
  const url = new URL(value);
  assert(url.protocol === 'https:', `${id}: ${type} URL must use HTTPS`);
  if (type === 'product') assert(url.hostname === 'shopee.co.th' && /^\/product\/\d+\/\d+$/.test(url.pathname), `${id}: product URL is not canonical Shopee Thailand`);
  if (type === 'image') assert(/(?:^|\.)(?:susercontent\.com|shopee\.co\.th)$/.test(url.hostname), `${id}: image URL host is not allowlisted`);
}

function validateProduct(product, kind, expectedOrder) {
  const id = `${kind}:${product.id}`;
  const allowedFields = new Set([
    'id', kind === 'ranked' ? 'rank' : 'reserveOrder', 'category', 'imageUrl', 'cleanName', 'summary',
    'priceMin', 'priceMax', 'checkedAt', 'productUrl', 'shopId', 'itemId',
  ]);
  for (const key of Object.keys(product)) assert(allowedFields.has(key), `${id}: unexpected field ${key}`);
  assert(product[kind === 'ranked' ? 'rank' : 'reserveOrder'] === expectedOrder, `${id}: non-contiguous order`);
  assert(typeof product.id === 'string' && product.id === `${product.shopId}-${product.itemId}`, `${id}: id does not match shopId-itemId`);
  assert(/^\d+$/.test(product.shopId) && /^\d+$/.test(product.itemId), `${id}: invalid internal identifiers`);
  assert(typeof product.category === 'string' && product.category.length >= 3, `${id}: invalid category`);
  assert(typeof product.cleanName === 'string' && product.cleanName.length >= 8 && product.cleanName.length <= 90, `${id}: invalid clean name`);
  assert(typeof product.summary === 'string' && product.summary.length >= 35 && product.summary.length <= 170, `${id}: invalid summary length`);
  assert(!product.summary.includes('…'), `${id}: summary contains a truncation marker`);
  assert(!product.summary.startsWith('สินค้าในหมวด') && !/โปรดตรวจสอบรายละเอียด/u.test(product.summary), `${id}: summary contains a generic fallback`);
  assert(!/(?:EMS|ไปรษณีย์|ลงทะเบียน|จัดส่ง|ขนส่ง|กดสั่ง|คำสั่งซื้อ|เคลม|คืนสินค้า|ถ่ายวิดีโอ|สีอาจแตกต่าง|การวัด(?:ด้วยตนเอง)?|ข้อผิดพลาด|ร้าน(?:ค้า|เรา)?|Shopee|GPS|รับเอง|Standard\s*Delivery|หวังว่า|การันตี|ต้องชอบ|ติดใจ|ฟิน|รับประกัน|แชท|ออกใบกำกับ|ใบกํากับ|ลดเหลือ|ใหม่ล่าสุด|คุณภาพดี|เชื่อถือ|หมดปัญหา|กำลังจะมีสินค้า)/iu.test(product.summary), `${id}: summary contains seller policy or marketing text`);
  assert(!product.cleanName.includes('\0') && !product.summary.includes('\0'), `${id}: contains NUL`);
  assert(!/(?:[\uFE0E\uFE0F]|หลุด\s*qc|ตำหนิ|ตําหนิ|รักษา(?:โรค|สิว|ฝ้า)|ฆ่าเชื้อ|ไม่ระคาย|ปลอดภัย\s*100|อันดับ\s*1|ราคาถูกที่สุด|ราคาประหยัด|ราคาโรงงาน|(?:สินค้า)?ส่งจากไทย|ส่งเร็ว|ถูกมาก+|สุดคุ้ม|คุ้ม(?:กว่า|ค่า|มาก|สุด)?|ขายดี|โรงงาน|แจ้งในแชท|ของแท้|เห็นผลทันที|ทางการแพทย์|ป้องกันเชื้อ|ไฟฟ้า|แบต(?:เตอรี่)?|ชาร์จ|\busb\b|\bled\b|บลูทูธ|power\s*bank|ครีม|เซรั่ม|สบู่|แชมพู|โลชั่น|น้ำหอม|ผ้าอ้อม|ทารก|หมวกกันน็อค|ปะเก็น|น้ำมันเครื่อง|มีด|คัตเตอร์|กรรไกร|ใบมีด|น้ำยา|สเปรย์|อาหารเสริม)/iu.test(`${product.cleanName} ${product.summary}`), `${id}: contains a blocked medical, electrical, hazardous, or promotional term`);
  assert(!/[\s|:;,_\-–—*#~.!?]$/u.test(product.cleanName), `${id}: clean name ends with dangling punctuation`);
  const finalText = `${product.cleanName} ${product.summary}`;
  assert(!FINAL_PROMO_POLICY.test(finalText), `${id}: contains final promo or seller-policy text`);
  assert(!FINAL_DEFECT.test(finalText), `${id}: contains a defect or measurement disclaimer`);
  assert(!FINAL_HIGH_RISK_CLAIM.test(finalText), `${id}: contains a health or safety claim`);
  assert(!FINAL_UNSUITABLE_BODY_PRODUCT.test(finalText), `${id}: contains a body-contact travel product`);
  assert(!FINAL_GARBLE_OR_RAW_HEADER.test(product.cleanName) && !FINAL_GARBLE_OR_RAW_HEADER.test(product.summary), `${id}: contains garbled text or a raw seller header`);
  assert(!BROKEN_THAI_TOKEN.test(finalText), `${id}: contains an isolated Thai combining mark`);
  assert(!CLEAR_GIBBERISH.test(product.cleanName) && !CLEAR_GIBBERISH.test(product.summary), `${id}: contains known incomplete or gibberish text`);
  assert(!TRAILING_INCOMPLETE_NAME.test(product.cleanName), `${id}: clean name ends with an incomplete phrase`);
  assert(!TRAILING_INCOMPLETE_SUMMARY.test(product.summary), `${id}: summary ends with an incomplete phrase`);
  assert(!UNREADABLE_THAI_RUN.test(product.cleanName), `${id}: clean name contains an unreadably long unspaced Thai run`);
  assert(!summaryMostlyRestatesName(product.cleanName, product.summary), `${id}: summary only restates the clean name`);
  assert(!hasRepeatedSummaryPhrase(product.summary), `${id}: summary repeats the same phrase`);
  assert(!hasConflictingLayerCounts(product.cleanName, product.summary), `${id}: name and summary disagree on layer count`);
  assert(!hasConflictingUnitCounts(product.cleanName, product.summary), `${id}: name and summary disagree on a unit count`);
  assert(hasBalancedPairs(product.cleanName) && hasBalancedPairs(product.summary), `${id}: contains unbalanced brackets`);
  assert(!/[\u200B-\u200D\u2060\uFEFF]/u.test(finalText), `${id}: contains an invisible format control`);
  assert(Number.isFinite(product.priceMin) && Number.isFinite(product.priceMax) && product.priceMin >= 20 && product.priceMax <= 5_000 && product.priceMax >= product.priceMin && product.priceMax / product.priceMin <= 3, `${id}: invalid or bait price range`);
  assert(!Number.isNaN(Date.parse(product.checkedAt)), `${id}: invalid checkedAt`);
  validateUrl(product.imageUrl, 'image', id);
  validateUrl(product.productUrl, 'product', id);
  assert(product.productUrl === `https://shopee.co.th/product/${product.shopId}/${product.itemId}`, `${id}: product URL/IDs mismatch`);
}

const args = parseArgs(process.argv.slice(2));

for (const fixture of ['อยู่ระหว่างเปลี่ยนแพ็คเกจ', 'ราคาพิเศษ', 'จัดส่งภายใน 24 ชม.', 'ออเดอร์นึงสั่งไม่เกิน', 'กรุณาตรวจสอบขนาดก่อนตัดสินใจซื้อ', 'ออกใบกํากับภาษีได้', 'กดดูแบบและขนาดที่ภาพตัวเลือก', 'ขายเป็นชุด']) {
  assert(FINAL_PROMO_POLICY.test(fixture), `promo-policy regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['จุดหรือฟองอากาศ', 'อาจคลาดเคลื่อน', 'ขึ้นอยู่กับ Lot', 'ขนาดจริงอาจแตกต่าง']) {
  assert(FINAL_DEFECT.test(fixture), `defect regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['ป้องกันแบคทีเรีย', 'แอนตี้แบคทีเรีย', 'ต่อต้านแบคทีเรีย', 'ไม่มีสารเรืองแสง', 'ปลอดสารพิษ', 'BPA Free', 'Food Grade', 'กันไรฝุ่น', 'ปวดคอและซัพพอร์ตคอ']) {
  assert(FINAL_HIGH_RISK_CLAIM.test(fixture), `claim regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['หมอนรองคอเดินทาง', 'ผ้าปิดตา Sleep Mask', 'AirMask', 'Blindfold']) {
  assert(FINAL_UNSUITABLE_BODY_PRODUCT.test(fixture), `body-product regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['ทิชชู๋ม้วน', 'ไม้ถูพืัน', 'ขนาดมาตราฐาน', '43 นัว', 'ขอขึ้น ตะขอประตู', 'ทนต่อการทดสอบของเวลาและกา', 'รายละเอียดสินค้า 24 ช่องใหม่ Empty Storage', 'การสกัดรูปปาก', 'เจาะรูฟรีตะขอแขวนแบริ่งที่']) {
  assert(FINAL_GARBLE_OR_RAW_HEADER.test(fixture), `garble/header regression fixture was not blocked: ${fixture}`);
}
for (const fixture of [' ับสิ่งแวดล้อม', ' ูกค้า', ' ่งใส', ' ุ้มค่า']) {
  assert(BROKEN_THAI_TOKEN.test(fixture), `broken-Thai regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['(8 สี/12', '【 ขนาด', '(มี 3 สี Gray & Blue &']) {
  assert(!hasBalancedPairs(fixture), `unbalanced-bracket regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['ทัพพีตักข้าว ในโลก', 'ซื้อของที่ระลึกได้แล้ว', 'วัสดุที่ และปลอดสารพิษ ไม่มี', 'ในราคา !', 'ราคาแน่นอน จัดไปเลยครับ', 'บรรจุในกระเป๋าอย่าง']) {
  assert(CLEAR_GIBBERISH.test(fixture), `gibberish regression fixture was not blocked: ${fixture}`);
}
assert(TRAILING_INCOMPLETE_NAME.test('สมุดโน้ต จํานวน 1'), 'trailing-incomplete regression fixture was not blocked');
assert(UNREADABLE_THAI_RUN.test('กระเป๋าจัดระเบียบอิเล็กทรอนิกส์ความจุขนาดใหญ่สามชั้นสําหรับสายเคเบิลและอุปกรณ์กันน้ํา'), 'long-Thai-run regression fixture was not blocked');
assert(summaryMostlyRestatesName('ดินสอกด Uni รุ่น X ขนาด 0.5 มม.', 'ดินสอกด Uni รุ่น X ขนาด 0.5 มม.'), 'summary-restatement regression fixture was not blocked');
assert(hasRepeatedSummaryPhrase('รุ่นขอบหนาพิเศษ ทรงวงรีมี 3 ขนาด รุ่นขอบหนาพิเศษ ทรงวงกลมมี 3 ขนาด'), 'repeated-summary regression fixture was not blocked');
assert(hasConflictingLayerCounts('ตู้ลิ้นชัก 5 ชั้น', 'ตู้ลิ้นชักมี 4 ชั้น'), 'conflicting-layer regression fixture was not blocked');
assert(hasConflictingUnitCounts('ทิชชู่ 20 แพ็ค', 'บรรจุ 10 แพ็คต่อกล่อง'), 'conflicting-unit regression fixture was not blocked');
assert(TRAILING_INCOMPLETE_SUMMARY.test('แพคเกจประกอบด้วย 1 ×'), 'trailing-summary regression fixture was not blocked');
const [catalogText, reserveText, runtimeText] = await Promise.all([
  readFile(args.catalog, 'utf8'),
  readFile(args.reserve, 'utf8'),
  readFile(args.runtimeModule, 'utf8'),
]);
for (const [name, text] of [['catalog', catalogText], ['reserve', reserveText], ['runtime', runtimeText]]) {
  assert(!text.includes('\0'), `${name}: contains NUL`);
  assert(!/(?:commission|extra\s*_?comm)/iu.test(text), `${name}: contains a forbidden commission field or phrase`);
  assert(!/"description"\s*:/u.test(text), `${name}: contains raw description`);
}

const catalog = JSON.parse(catalogText);
const reserve = JSON.parse(reserveText);
assert(catalog.schemaVersion === 1 && reserve.schemaVersion === 1, 'schema version mismatch');
assert(catalog.rankedCount === 500 && catalog.ranked.length === 500, 'catalog must contain exactly 500 ranked products');
assert(reserve.reserveCount === 100 && reserve.reserve.length === 100, 'reserve must contain exactly 100 products');
assert(catalog.featured?.id === 'featured-dkub-book' && catalog.featured.rank === undefined, 'featured book must be outside ranking');
assert(catalog.featured.shopId === '1032408641' && catalog.featured.itemId === '48511491095', 'featured book IDs changed unexpectedly');
assert(catalog.featured.checkedAt === '2026-08-17T15:26:00+07:00', 'featured book checkedAt changed unexpectedly');
assert(!Number.isNaN(Date.parse(catalog.generatedAt)) && !Number.isNaN(Date.parse(catalog.sourceCheckedAt)), 'catalog timestamps are invalid');

catalog.ranked.forEach((product, index) => validateProduct(product, 'ranked', index + 1));
reserve.reserve.forEach((product, index) => validateProduct(product, 'reserve', index + 1));
const all = [...catalog.ranked, ...reserve.reserve];
assert(new Set(all.map((product) => product.id)).size === 600, 'ranked/reserve product IDs are not unique');
assert(new Set(all.map((product) => new URL(product.imageUrl).pathname.split('/').filter(Boolean).at(-1))).size === 600, 'ranked/reserve image file IDs are not unique');
assert(new Set(catalog.ranked.map((product) => product.rank)).size === 500, 'rank values are not unique');
const allowedCategories = new Set(['อุปกรณ์สัตว์เลี้ยง', 'กระเป๋าและอุปกรณ์เดินทาง', 'เครื่องเขียนและงานฝีมือ', 'ครัวและโต๊ะอาหาร', 'อุปกรณ์ทำความสะอาด', 'สวนและกิจกรรมกลางแจ้ง', 'ของใช้ในบ้านและสิ่งทอ', 'อุปกรณ์จัดระเบียบและจัดเก็บ']);
assert(all.every((product) => allowedCategories.has(product.category)), 'catalog contains a non-warehouse category');
const rankedShopCounts = catalog.ranked.reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map());
const allShopCounts = all.reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map());
assert(Math.max(...rankedShopCounts.values()) <= 3, 'ranked catalog exceeds per-shop cap of 3');
assert(Math.max(...allShopCounts.values()) <= 4, 'ranked/reserve catalog exceeds per-shop cap of 4');
assert(!all.some((product) => product.id === `${catalog.featured.shopId}-${catalog.featured.itemId}`), 'featured book leaked into ranked/reserve catalog');

const runtimeUrl = `${pathToFileURL(args.runtimeModule).href}?validation=${Date.now()}`;
const runtime = (await import(runtimeUrl)).default;
assert(runtime.ranked.length === 500 && runtime.reserve.length === 100, 'runtime module counts mismatch');
assert(JSON.stringify(runtime.ranked) === JSON.stringify(catalog.ranked), 'runtime ranked payload differs from catalog.json');
assert(JSON.stringify(runtime.reserve) === JSON.stringify(reserve.reserve), 'runtime reserve payload differs from reserve JSON');
assert(JSON.stringify(runtime.featured) === JSON.stringify(catalog.featured), 'runtime featured payload differs from catalog.json');

process.stdout.write(`${JSON.stringify({
  status: 'valid',
  rankedCount: catalog.ranked.length,
  reserveCount: reserve.reserve.length,
  uniqueProductCount: new Set(all.map((product) => product.id)).size,
  categories: new Set(catalog.ranked.map((product) => product.category)).size,
  featuredId: catalog.featured.id,
  sourceCheckedAt: catalog.sourceCheckedAt,
}, null, 2)}\n`);
