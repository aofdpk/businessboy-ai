import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BROKEN_THAI_TOKEN,
  CATALOG_CATEGORY_DEFINITIONS,
  CATALOG_SCHEMA_VERSION,
  CLEAR_GIBBERISH,
  DEFAULT_RANKED_TARGET,
  DEFAULT_RESERVE_TARGET,
  FINAL_ADDITIONAL_GARBLE,
  FINAL_ADDITIONAL_POLICY,
  FINAL_DEFECT,
  FINAL_GARBLE_OR_RAW_HEADER,
  FINAL_FEED_NOISE,
  FINAL_FEED_NOISE_ADDITIONAL,
  FINAL_FEED_NOISE_THIRD,
  FINAL_LOCKED_BLOCKER_TEXT,
  FINAL_HEALTH_CLAIM_ADDITIONAL,
  FINAL_HIGH_RISK_CLAIM,
  FINAL_PROMO_POLICY,
  FINAL_NONOBJECTIVE_TEXT,
  FINAL_SELLER_VOICE,
  FINAL_UNSUITABLE_BODY_PRODUCT,
  PROHIBITED_SAFETY_ADDITIONAL,
  SOURCE_TITLE_POLICY,
  SOURCE_TITLE_ADDITIONAL,
  RAW_TEXT_BOUNDARY,
  RAW_NAME_BOUNDARY,
  TRAILING_INCOMPLETE_NAME,
  TRAILING_INCOMPLETE_SUMMARY,
  UNREADABLE_THAI_RUN,
  hasConflictingLayerCounts,
  hasConflictingDimensions,
  hasConflictingUnitCounts,
  hasAuthenticityClaim,
  hasBalancedPairs,
  hasDominantSummaryToken,
  hasDescriptionBrandAuthenticityClaim,
  hasPassiveMeterCaseMismatch,
  hasRepeatedSummaryPhrase,
  hasUnsupportedCertification,
  makeSeasonalMetadata,
  summaryMatchesProductFamily,
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

const CATEGORY_LABEL_BY_KEY = new Map(CATALOG_CATEGORY_DEFINITIONS.map(({ key, label }) => [key, label]));
const ALLOWED_SEASON_TAGS = Object.freeze(['all-year', 'hot', 'rainy', 'cool']);

function validateSeasonalMetadata(product, id) {
  assert(Array.isArray(product.seasonTags), `${id}: seasonTags must be an array`);
  assert(Array.isArray(product.monthTags), `${id}: monthTags must be an array`);
  assert(new Set(product.seasonTags).size === product.seasonTags.length, `${id}: duplicate season tag`);
  assert(product.seasonTags.every((tag) => ALLOWED_SEASON_TAGS.includes(tag)), `${id}: invalid season tag`);
  assert(new Set(product.monthTags).size === product.monthTags.length, `${id}: duplicate month tag`);
  assert(product.monthTags.every((month) => Number.isInteger(month) && month >= 1 && month <= 12), `${id}: invalid month tag`);
  assert(product.monthTags.every((month, index) => index === 0 || product.monthTags[index - 1] < month), `${id}: monthTags must be strictly sorted`);
  if (product.seasonTags.includes('all-year')) {
    assert(product.seasonTags.length === 1 && product.monthTags.length === 0, `${id}: all-year products must not contain seasonal months or another season`);
  } else {
    assert(product.monthTags.length > 0, `${id}: seasonal product must include at least one month`);
  }
  assert(Number.isInteger(product.seasonalScore) && product.seasonalScore >= 0 && product.seasonalScore <= 100, `${id}: invalid seasonal score`);
  assert(typeof product.seasonReason === 'string' && product.seasonReason.length >= 20 && product.seasonReason.length <= 120, `${id}: invalid season reason`);
  const expected = makeSeasonalMetadata(product.categoryKey, product.cleanName, product.summary);
  for (const field of ['seasonTags', 'monthTags', 'seasonalScore', 'seasonReason']) {
    assert(JSON.stringify(product[field]) === JSON.stringify(expected[field]), `${id}: ${field} differs from deterministic seasonal rules`);
  }
}

function validateProduct(product, kind, expectedOrder) {
  const id = `${kind}:${product.id}`;
  const allowedFields = new Set([
    'id', kind === 'ranked' ? 'rank' : 'reserveOrder', 'categoryKey', 'category', 'imageUrl', 'cleanName', 'summary',
    'priceMin', 'priceMax', 'checkedAt', 'productUrl', 'seasonTags', 'monthTags', 'seasonalScore', 'seasonReason', 'shopId', 'itemId',
  ]);
  for (const key of Object.keys(product)) assert(allowedFields.has(key), `${id}: unexpected field ${key}`);
  assert(product[kind === 'ranked' ? 'rank' : 'reserveOrder'] === expectedOrder, `${id}: non-contiguous order`);
  assert(typeof product.id === 'string' && product.id === `${product.shopId}-${product.itemId}`, `${id}: id does not match shopId-itemId`);
  assert(/^\d+$/.test(product.shopId) && /^\d+$/.test(product.itemId), `${id}: invalid internal identifiers`);
  assert(typeof product.categoryKey === 'string' && CATEGORY_LABEL_BY_KEY.has(product.categoryKey), `${id}: invalid category key`);
  assert(product.category === CATEGORY_LABEL_BY_KEY.get(product.categoryKey), `${id}: category label/key mismatch`);
  assert(typeof product.cleanName === 'string' && product.cleanName.length >= 8 && product.cleanName.length <= 90, `${id}: invalid clean name`);
  assert(typeof product.summary === 'string' && product.summary.length >= 35 && product.summary.length <= 170, `${id}: invalid summary length`);
  assert(!product.summary.includes('…'), `${id}: summary contains a truncation marker`);
  assert(!product.summary.startsWith('สินค้าในหมวด') && !/โปรดตรวจสอบรายละเอียด/u.test(product.summary), `${id}: summary contains a generic fallback`);
  assert(!/(?:EMS|ไปรษณีย์|ลงทะเบียน|จัดส่ง|ขนส่ง|กดสั่ง|คำสั่งซื้อ|เคลม|คืนสินค้า|ถ่ายวิดีโอ|สีอาจแตกต่าง|การวัด(?:ด้วยตนเอง)?|ข้อผิดพลาด|ร้าน(?:ค้า|เรา)?|Shopee|GPS|รับเอง|Standard\s*Delivery|หวังว่า|การันตี|ต้องชอบ|ติดใจ|ฟิน|รับประกัน|แชท|ออกใบกำกับ|ใบกํากับ|ลดเหลือ|ใหม่ล่าสุด|คุณภาพดี|เชื่อถือ|หมดปัญหา|กำลังจะมีสินค้า)/iu.test(product.summary), `${id}: summary contains seller policy or marketing text`);
  assert(!product.cleanName.includes('\0') && !product.summary.includes('\0'), `${id}: contains NUL`);
  assert(!/(?:[\uFE0E\uFE0F]|หลุด\s*qc|ตำหนิ|ตําหนิ|รักษา(?:โรค|สิว|ฝ้า)|ฆ่าเชื้อ|ไม่ระคาย|ปลอดภัย\s*100|อันดับ\s*1|ราคาถูกที่สุด|ราคาประหยัด|ราคาโรงงาน|(?:สินค้า)?ส่งจากไทย|ส่งเร็ว|ถูกมาก+|สุดคุ้ม|คุ้ม(?:กว่า|ค่า|มาก|สุด)?|ขายดี|โรงงาน|แจ้งในแชท|ของแท้|เห็นผลทันที|ทางการแพทย์|ป้องกันเชื้อ|ไฟฟ้า|แบต(?:เตอรี่)?|ชาร์จ|\busb\b|\bled\b|บลูทูธ|power\s*bank|ครีม|เซรั่ม|แชมพู|โลชั่น|น้ำหอม|ผ้าอ้อม|ทารก|หมวกกันน็อค|ปะเก็น|น้ำมันเครื่อง|มีด|คัตเตอร์|กรรไกร|ใบมีด|น้ำยา|สเปรย์|อาหารเสริม)/iu.test(`${product.cleanName} ${product.summary}`), `${id}: contains a blocked medical, electrical, hazardous, or promotional term`);
  assert(!/[\s|:;,_\-–—*#~.!?]$/u.test(product.cleanName), `${id}: clean name ends with dangling punctuation`);
  const finalText = `${product.cleanName} ${product.summary}`;
  assert(!SOURCE_TITLE_POLICY.test(product.cleanName), `${id}: clean name contains seller shipping, stale price, used-condition, or raw-boundary text`);
  assert(!SOURCE_TITLE_ADDITIONAL.test(product.cleanName), `${id}: clean name contains stale stock, seller, counterfeit, or incomplete text`);
  assert(!hasAuthenticityClaim(finalText), `${id}: contains an authenticity or image-match claim`);
  assert(!FINAL_PROMO_POLICY.test(finalText), `${id}: contains final promo or seller-policy text`);
  assert(!FINAL_DEFECT.test(finalText), `${id}: contains a defect or measurement disclaimer`);
  assert(!FINAL_HIGH_RISK_CLAIM.test(finalText), `${id}: contains a health or safety claim`);
  assert(!FINAL_ADDITIONAL_POLICY.test(finalText), `${id}: contains additional seller, counterfeit, therapeutic, or marketing text`);
  assert(!FINAL_SELLER_VOICE.test(finalText), `${id}: contains first-person seller, ordering, or customer-service text`);
  assert(!FINAL_NONOBJECTIVE_TEXT.test(finalText), `${id}: contains non-objective loss-prevention or external-review copy`);
  assert(!FINAL_FEED_NOISE.test(finalText) && !FINAL_FEED_NOISE_ADDITIONAL.test(finalText), `${id}: contains seller feed noise, malformed text, or subjective copy`);
  assert(!FINAL_FEED_NOISE_THIRD.test(finalText), `${id}: contains additional seller, defect, truncation, or category-mismatch noise`);
  assert(!FINAL_LOCKED_BLOCKER_TEXT.test(product.cleanName) && !FINAL_LOCKED_BLOCKER_TEXT.test(product.summary), `${id}: contains a locked hard-blocker phrase`);
  assert(!FINAL_HEALTH_CLAIM_ADDITIONAL.test(finalText), `${id}: contains an additional health or body-safety claim`);
  assert(!PROHIBITED_SAFETY_ADDITIONAL.test(finalText), `${id}: contains catnip, matatabi, or another prohibited ingestible pet substance`);
  assert(!hasUnsupportedCertification(finalText), `${id}: contains an unsupported certification claim without a standard identifier`);
  assert(!FINAL_ADDITIONAL_GARBLE.test(finalText), `${id}: contains an additional garbled or incomplete phrase`);
  assert(!FINAL_UNSUITABLE_BODY_PRODUCT.test(finalText), `${id}: contains a body-contact travel product`);
  assert(!FINAL_GARBLE_OR_RAW_HEADER.test(product.cleanName) && !FINAL_GARBLE_OR_RAW_HEADER.test(product.summary), `${id}: contains garbled text or a raw seller header`);
  assert(!RAW_NAME_BOUNDARY.test(product.cleanName) && !RAW_TEXT_BOUNDARY.test(product.summary), `${id}: contains a raw boundary marker or truncation`);
  assert(!BROKEN_THAI_TOKEN.test(finalText), `${id}: contains an isolated Thai combining mark`);
  assert(!CLEAR_GIBBERISH.test(product.cleanName) && !CLEAR_GIBBERISH.test(product.summary), `${id}: contains known incomplete or gibberish text`);
  assert(!TRAILING_INCOMPLETE_NAME.test(product.cleanName), `${id}: clean name ends with an incomplete phrase`);
  assert(!TRAILING_INCOMPLETE_SUMMARY.test(product.summary), `${id}: summary ends with an incomplete phrase`);
  assert(!UNREADABLE_THAI_RUN.test(product.cleanName), `${id}: clean name contains an unreadably long unspaced Thai run`);
  assert(!summaryMostlyRestatesName(product.cleanName, product.summary), `${id}: summary only restates the clean name`);
  assert(summaryMatchesProductFamily(product.categoryKey, product.cleanName, product.summary), `${id}: summary does not match the assigned product family or is structurally incomplete`);
  assert(!hasPassiveMeterCaseMismatch(product.categoryKey, product.cleanName, product.summary), `${id}: a passive meter case summary describes an active measuring device`);
  assert(!hasRepeatedSummaryPhrase(product.summary), `${id}: summary repeats the same phrase`);
  assert(!hasDominantSummaryToken(product.summary), `${id}: one informative token is repeated excessively`);
  assert(!hasConflictingLayerCounts(product.cleanName, product.summary), `${id}: name and summary disagree on layer count`);
  assert(!hasConflictingUnitCounts(product.cleanName, product.summary), `${id}: name and summary disagree on a unit count`);
  assert(!hasConflictingDimensions(product.cleanName, product.summary), `${id}: name and summary contain conflicting dimensions`);
  assert(hasBalancedPairs(product.cleanName) && hasBalancedPairs(product.summary), `${id}: contains unbalanced brackets`);
  assert(!/[\u200B-\u200D\u2060\uFEFF]/u.test(finalText), `${id}: contains an invisible format control`);
  assert(Number.isFinite(product.priceMin) && Number.isFinite(product.priceMax) && product.priceMin >= 20 && product.priceMax <= 5_000 && product.priceMax >= product.priceMin && product.priceMax / product.priceMin <= 3, `${id}: invalid or bait price range`);
  assert(!Number.isNaN(Date.parse(product.checkedAt)), `${id}: invalid checkedAt`);
  validateUrl(product.imageUrl, 'image', id);
  validateUrl(product.productUrl, 'product', id);
  assert(product.productUrl === `https://shopee.co.th/product/${product.shopId}/${product.itemId}`, `${id}: product URL/IDs mismatch`);
  validateSeasonalMetadata(product, id);
}

const args = parseArgs(process.argv.slice(2));

for (const fixture of ['อยู่ระหว่างเปลี่ยนแพ็คเกจ', 'ราคาพิเศษ', 'จัดส่งภายใน 24 ชม.', 'ออเดอร์นึงสั่งไม่เกิน', 'กรุณาตรวจสอบขนาดก่อนตัดสินใจซื้อ', 'ออกใบกํากับภาษีได้', 'กดดูแบบและขนาดที่ภาพตัวเลือก', 'ขายเป็นชุด']) {
  assert(FINAL_PROMO_POLICY.test(fixture), `promo-policy regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['จัดส่งในระบบ shopee กล่องพัสดุ', 'พร้อมจัดส่ง ค้อนยาง', '47 บาท ริบบิ้น', '(79บาท) กล่องของขวัญ', 'รอ 3 อาทิตย์ กล่องเก็บ', 'หนังสือสภาพ 70%', 'มีสนิม คีมมือสอง', '++ หนังสือ ++', 'ตะขอเกี่ยวเนื้อ', 'เครื่องมือตัด 2 in 1', 'คีม VDE 1000V']) {
  assert(SOURCE_TITLE_POLICY.test(fixture), `source-title regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['สินค้า ค้อนหงอน', 'Tool Box สินค้า', 'หนังสือมีสต๊อก', 'ลิขสิทธิ์แท้ ถูกกว่าปรินท์เอง', 'หนังสือเปลี่ยนหุ่น ปรับฮอร์โมน', 'หนังสือ / My']) {
  assert(SOURCE_TITLE_ADDITIONAL.test(fixture), `additional source-title regression fixture was not blocked: ${fixture}`);
}
for (const fixture of [
  'กระเป๋าจัดระเบียบผลิตภัณฑ์นมในรถของคุณ',
  'ideal as a small present for your customers',
  'ชุดนี้แนะนําเลย',
  'เพียงอ่านหนังสือเล่มนี้ก็จะใช้ Procreate วาดภาพได้',
  '(Please note that this is the CONCISE version)',
  'วัสดุถุงผ้าเป็นขี้ผึ้งเฟอร์รี่',
  'ช่องเก็บของอยู่ด้านในร่ม',
  'cm 130cm x 45 x 20',
  'การออกแบบการออกแบบ: ทรงสี่เหลี่ยม',
  'วัสดุแข็งแรง ต่อน้องแมว',
  'ของเล่นแมว ที่แมว',
  'แบบฝึกหัดชั้น ป.1 จํานวน หน้า 3 วิชา',
  '[แนะนําโดย Boss Lady]',
  'แจ้งข้อความที่ต้องการจะใส่ตรายาง',
  'วัสดสแตนเลส',
  'ขัดได้ทุกซอกท',
  'ดูภาพที่่ 2',
  'ดหลีกเลี่ยงความร้อน',
  'ถุงกระดาษแบรนด์ LOUIS VUITTON',
  'สิ่งที่คุณจะได้รับ: กล่อง 1 ชิ้น',
  'ฉากที่เกี่ยวข้อง: ห้องนอน',
  'จะเหมาะถ้าประตูของคุณแตก',
  'ยางลบยางลบสําหรับดินสอ',
  'ลอกออก กาว จัดๆได้นาน',
  'ดินสอสี Lapis de',
  'ไม่แตกลายงาและเป็นฟู๊ดเกรด',
  'บรรจุ 1 ชิ้น 1 ชิ้น',
  'มุม ดของคุณ',
]) {
  assert(FINAL_LOCKED_BLOCKER_TEXT.test(fixture), `locked-blocker regression fixture was not blocked: ${fixture}`);
}
assert(hasAuthenticityClaim('กล่องเก็บของ IKEA แท้'), 'brand-authenticity regression fixture was not blocked');
assert(hasAuthenticityClaim('สติกเกอร์ PVC 3M แท้'), 'description-authenticity regression fixture was not blocked');
assert(hasAuthenticityClaim('ผ้าเย็น Biore ตรงปก'), 'image-match authenticity fixture was not blocked');
assert(!hasAuthenticityClaim('ชั้นวางไม้สักแท้'), 'objective material authenticity fixture should pass');
assert(hasDescriptionBrandAuthenticityClaim('สติกเกอร์ PVC 3M แท้'), 'raw description brand-authenticity fixture was not blocked');
assert(!hasDescriptionBrandAuthenticityClaim('ผ้าฝ้าย cotton แท้'), 'raw description material-authenticity fixture should pass');
for (const fixture of ['แคทนิป', 'มาทาทาบิ', 'Matatabi powder', 'silvervine stick']) {
  assert(PROHIBITED_SAFETY_ADDITIONAL.test(fixture), `pet-ingestible regression fixture was not blocked: ${fixture}`);
}
assert(hasConflictingDimensions('กระถางต้นไม้ขนาด 5 นิ้ว', 'เส้นผ่านศูนย์กลาง 15.2 นิ้ว'), 'conflicting-inch regression fixture was not blocked');
assert(hasConflictingDimensions('ประแจชุดขนาด 10-32 mm', 'ครอบคลุมขนาด 0-32 mm'), 'conflicting-range regression fixture was not blocked');
assert(!hasConflictingDimensions('กระถางต้นไม้ขนาด 5 นิ้ว', 'เส้นผ่านศูนย์กลาง 5 นิ้ว'), 'matching dimension fixture should pass');
for (const fixture of ['ก่อนสั่งเช็คที่อยู่ให้ถูกต้อง', 'ก่อนการสั่งซื้อสินค้ากรุณาตรวจสอบขนาด', 'การสั่งซื้อให้เลือกตัวเลือกตามจํานวน', 'กรณีต้องการสั่งความยาว 1 เมตร', 'หากคุณสั่งซื้อกรุณาฝากข้อความ', 'อย่าสั่งซื้อหากรุ่นไม่ตรง', 'PRE-ORDER', 'ไม่ได้เป็นหนังสือเผยแพร่อย่างเป็นทางการ', 'แบบใหม่ๆ 24 หน้าแน่นๆ', 'ศาสตร์แห่งการบําบัดอย่างลึกซึ้ง', 'ภาพเปรียบเทียบด้วยรูปถ่ายสินค้า', 'ของขวัญแบบสุ่มเมื่อซื้อสินค้าครบ 250 บาท', 'ขนาดของสินค้าจริงอาจ +/- เล็กน้อย', 'ไม่รวมรายการอื่น ภาพโฆษณาเท่านั้น', 'สํานักพิมพ์ภูมิใจที่ได้จัดพิมพ์หนังสือดี', 'ลดล้างสต๊อกจากสํานักพิมพ์ สภาพ 95% - 99%', 'ดูจากรายละเอียดสินค้าเท่านั้น', 'ดูภาพสินค้าเพิ่มเติมเพื่อเปรียบเทียบขนาด', 'จัดกระเป๋าให้เป็นเรื่องง่าย']) {
  assert(FINAL_ADDITIONAL_POLICY.test(fixture), `additional-policy regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['สั่งซื้อแต่ละชุดประกอบด้วยน็อต 1 ตัว', 'ทีมผู้เชี่ยวชาญของเราพัฒนาผ้าขนหนู', 'ไขควงของเรามีขนาด 173 มม.', 'โปรดติดต่อฝ่ายบริการลูกค้า']) {
  assert(FINAL_SELLER_VOICE.test(fixture), `seller-voice regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['พวงกุญแจเป็นเครื่องประดับที่ขาดไม่ได้และช่วยลดการสูญหายและการสูญเสียกุญแจ', 'รีวิวหนังสือ : เพจโป๊ยเซียนเขียนรีวิว']) {
  assert(FINAL_NONOBJECTIVE_TEXT.test(fixture), `non-objective regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['กดตัวเลือกแล้วใส่ตะกร้า', 'ผู้ช่วยชั้นดีทําให้เป็นเรื่องง่ายดาย', 'วัสดุลย ไม่มีหลุดลอกจ้า', 'ISO 9001 xด้าม', 'ขนาดหัวโรมัน', 'วัสด เหล็ก', 'โมเด็ล F30', 'Please note that this is concise']) {
  assert(FINAL_FEED_NOISE.test(fixture), `feed-noise regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['มาแล้วววว น่าร๊ากกกก', 'วิธีใช้งาน :', 'รีวิวโดยสํานักพิมพ์ :', 'สินค้าต้องอยู่ในสภาพเดิม พร้อมบรรจุภัณฑ์ครบถ้วน', 'ทุกบ้านควรมี', 'ภาพต่อไปนี้สําหรับรุ่นสินค้า']) {
  assert(FINAL_FEED_NOISE_ADDITIONAL.test(fixture), `additional feed-noise regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['เนื้อกระดาษอ่อนโยน เหมาะสําหรับทุกสภาพผิว', 'ไม่ทําให้ระคายเคือง', 'ลดการสะสมของไรฝุ่นด้วย Block Mite']) {
  assert(FINAL_HEALTH_CLAIM_ADDITIONAL.test(fixture), `additional health-claim regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['ไม่ต้องกลัวผิวเสีย', 'จากที่ลองใช้งานมา 1 เดือน', 'ประหยัดพื้นที่ได้ 4 เท่า', 'ตําแหน่งผ่นจากมือเด็ก', 'ชื่อสินค้าลดความเม', 'หนังสือเล่มนี้มีคําตอบ', 'สินค้าจัดใหม่', 'สะดวกสุด P']) {
  assert(FINAL_FEED_NOISE_THIRD.test(fixture), `third-layer feed-noise regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['+ ขนาด 20 ซม.', '< Easily washable', '■ วัสดุเหล็ก', 'ข้อความตัด…']) {
  assert(RAW_TEXT_BOUNDARY.test(fixture), `raw-boundary regression fixture was not blocked: ${fixture}`);
}
assert(hasPassiveMeterCaseMismatch('manual-tools', 'กระเป๋าใส่แคลมป์มิเตอร์', 'ใช้วัดกระแสและความถี่ได้'), 'active meter summary in passive case fixture was not blocked');
assert(!hasPassiveMeterCaseMismatch('manual-tools', 'กระเป๋าใส่แคลมป์มิเตอร์', 'กระเป๋าผ้าสําหรับจัดเก็บมิเตอร์และอุปกรณ์'), 'objective passive meter case fixture should pass');
assert(hasUnsupportedCertification('สินค้าได้รับการรับรองมาตรฐาน'), 'unsupported-certification regression fixture was not blocked');
assert(!hasUnsupportedCertification('สินค้าได้รับการรับรองมาตรฐาน มอก. 1234'), 'certification with a standard ID should pass');
for (const fixture of ['ดตรวจสอบก่อนสั่งซื้อ', 'ดเปรียบเทียบกับปลอกกุญแจเดิม', 'ดทําความสะอาดพื้นผิว', 'วัสดุปล่อยความร้อน', 'ให้ความ กับสินค้าของท่าน', 'ติดตั้งง่ายและ )', 'ในรายการรวมด้วย 1 ชิ้น', '> รายละเอียดสินค้า', 'Q2: ขนาดของรุ่นกุญแจ', 'ขนาด/รายละเอียดสินค้า (Specifications)', 'รายละเอียดสินค้า วัสดุเหล็ก', 'เครื่องมือสําคัญที่เรียกว่า เชิญชวน', 'แบบกระกระดาษ', 'วัสุดยืดยุ่น', 'ผลิตผลการพิมพ์ภายในเล่ม', 'สติกเกอร์ 1 ชิ้นหรือตะแกรง', 'ส่วนต่างๆของร่างกายที่ต้องวาง']) {
  assert(FINAL_ADDITIONAL_GARBLE.test(fixture), `additional-garble regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['จุดหรือฟองอากาศ', 'อาจคลาดเคลื่อน', 'ขึ้นอยู่กับ Lot', 'ขนาดจริงอาจแตกต่าง']) {
  assert(FINAL_DEFECT.test(fixture), `defect regression fixture was not blocked: ${fixture}`);
}
for (const fixture of ['ป้องกันแบคทีเรีย', 'แอนตี้แบคทีเรีย', 'ต่อต้านแบคทีเรีย', 'ไม่มีสารเรืองแสง', 'ปลอดสารพิษ', 'BPA Free', 'Food Grade', 'กันไรฝุ่น', 'ปวดคอและซัพพอร์ตคอ', 'ไม่ทําให้เกิดรอยขีดข่วน', 'ไม่ซีดจาง']) {
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
for (const fixture of ['ทัพพีตักข้าว ในโลก', 'ซื้อของที่ระลึกได้แล้ว', 'วัสดุที่ และปลอดสารพิษ ไม่มี', 'ในราคา !', 'ราคาแน่นอน จัดไปเลยครับ', 'บรรจุในกระเป๋าอย่าง', 'เน้ือกระดาษ', 'ทําโบวเป็นทรง', 'สามารถ ได้สูง']) {
  assert(CLEAR_GIBBERISH.test(fixture), `gibberish regression fixture was not blocked: ${fixture}`);
}
assert(TRAILING_INCOMPLETE_NAME.test('สมุดโน้ต จํานวน 1'), 'trailing-incomplete regression fixture was not blocked');
assert(TRAILING_INCOMPLETE_NAME.test('หนังสือคู่มือการ'), 'trailing-name function-word regression fixture was not blocked');
assert(TRAILING_INCOMPLETE_NAME.test('เซ็ตจานและแก้วมัค +'), 'trailing-name plus regression fixture was not blocked');
assert(UNREADABLE_THAI_RUN.test('กระเป๋าจัดระเบียบอิเล็กทรอนิกส์ความจุขนาดใหญ่สามชั้นสําหรับสายเคเบิลและอุปกรณ์กันน้ํา'), 'long-Thai-run regression fixture was not blocked');
assert(summaryMostlyRestatesName('ดินสอกด Uni รุ่น X ขนาด 0.5 มม.', 'ดินสอกด Uni รุ่น X ขนาด 0.5 มม.'), 'summary-restatement regression fixture was not blocked');
assert(hasRepeatedSummaryPhrase('รุ่นขอบหนาพิเศษ ทรงวงรีมี 3 ขนาด รุ่นขอบหนาพิเศษ ทรงวงกลมมี 3 ขนาด'), 'repeated-summary regression fixture was not blocked');
assert(hasDominantSummaryToken('ประแจ ประแจเลื่อน ประแจอเนกประสงค์ ประแจด้ามจับหุ้มยาง ขนาด 6 8 10 12 นิ้ว adjustable wrench'), 'dominant-token regression fixture was not blocked');
assert(hasConflictingLayerCounts('ตู้ลิ้นชัก 5 ชั้น', 'ตู้ลิ้นชักมี 4 ชั้น'), 'conflicting-layer regression fixture was not blocked');
assert(hasConflictingUnitCounts('ทิชชู่ 20 แพ็ค', 'บรรจุ 10 แพ็คต่อกล่อง'), 'conflicting-unit regression fixture was not blocked');
assert(TRAILING_INCOMPLETE_SUMMARY.test('แพคเกจประกอบด้วย 1 ×'), 'trailing-summary regression fixture was not blocked');
assert(summaryMatchesProductFamily('cleaning', 'ไม้ม็อบถูพื้นแบบพับได้', 'หัวไม้ม็อบปรับได้ 180 องศาและถอดล้างทําความสะอาดได้'), 'mop alias regression fixture should pass semantic matching');
assert(summaryMatchesProductFamily('device-accessories', 'เคสโทรศัพท์ iPhone แบบใส', 'ตัวเคส iPhone ผลิตจาก TPU และมีขอบยก'), 'device-case alias regression fixture should pass semantic matching');
assert(summaryMatchesProductFamily('automotive-accessories', 'เคสกุญแจรถ TPU แบบพอดีรุ่น', 'ฝาครอบกุญแจผลิตจาก TPU และมีช่องตรงกับตําแหน่งปุ่ม'), 'passive automotive key-cover fixture should pass semantic matching');
assert(!summaryMatchesProductFamily('automotive-accessories', 'กุญแจรถเหมาะสําหรับพวงกุญแจ', 'ผลิตจาก TPU ยืดหยุ่นและมีช่องตรงกับตําแหน่งปุ่ม'), 'ambiguous automotive key fixture without passive summary noun was not blocked');
assert(!summaryMatchesProductFamily('device-accessories', 'เคสมือถือ CASETiFY Ripple Case', 'สายสะพายข้าง Crossbody มาพร้อมแผ่นคล้องสาย StrapCard'), 'device case-to-strap mismatch fixture was not blocked');
assert(!summaryMatchesProductFamily('organizing', 'กล่องจัดเก็บอเนกประสงค์', 'เสื้อคลุมผู้หญิง ADIDAS ผลิตจากผ้าเนื้อนุ่ม'), 'organizer-to-clothing mismatch fixture was not blocked');
assert(!summaryMatchesProductFamily('manual-tools', 'คีมปากแหลมเหล็กคาร์บอน', 'หมวกไหมพรมผลิตจากผ้าและมีลวดลาย'), 'pliers-to-hat mismatch fixture was not blocked');
assert(!summaryMatchesProductFamily('manual-tools', 'ค้อนอลูมิเนียมด้ามจับ', 'ใช้ทุบเนื้อสเต็กและสัมผัสอาหารได้'), 'tool-to-kitchen mismatch fixture was not blocked');
assert(!summaryMatchesProductFamily('bathroom-laundry', 'กะละมังสแตนเลสขนาด 30 ซม.', 'กะละมังใช้สําหรับใส่อาหารและผสมแป้ง'), 'bathroom-to-kitchen mismatch fixture was not blocked');
assert(!summaryMatchesProductFamily('books', 'หนังสือเทคนิคการสื่อสาร', 'หนังสือเล่มนี้อธิบายทักษะการสื่อสาร ตัวอย่างเช่น'), 'trailing-example fixture was not blocked');
assert(!summaryMatchesProductFamily('books', 'หนังสือศิลปะจิตรกรรมและเครื่องถ้วย', 'ภายในเล่มรวบรวมสูตรอาหารและขั้นตอนการทําอาหาร'), 'book art-to-recipe mismatch fixture was not blocked');
const [catalogText, reserveText, runtimeText] = await Promise.all([
  readFile(args.catalog, 'utf8'),
  readFile(args.reserve, 'utf8'),
  readFile(args.runtimeModule, 'utf8'),
]);
for (const [name, text] of [['catalog', catalogText], ['reserve', reserveText], ['runtime', runtimeText]]) {
  assert(!text.includes('\0'), `${name}: contains NUL`);
  assert(!/(?:commission|extra\s*_?comm)/iu.test(text), `${name}: contains a forbidden commission field or phrase`);
  assert(!/"description"\s*:/u.test(text), `${name}: contains raw description`);
  assert(!/"ruleIds"\s*:/u.test(text), `${name}: exposes internal seasonal rule IDs`);
}

const catalog = JSON.parse(catalogText);
const reserve = JSON.parse(reserveText);
assert(catalog.schemaVersion === CATALOG_SCHEMA_VERSION && reserve.schemaVersion === CATALOG_SCHEMA_VERSION, 'schema version mismatch');
assert(catalog.targetRankedCount === DEFAULT_RANKED_TARGET, `ranked target must be ${DEFAULT_RANKED_TARGET}`);
assert(catalog.minimumRankedCount >= 1_500 && catalog.minimumRankedCount <= catalog.targetRankedCount, 'invalid minimum ranked count');
assert(catalog.rankedCount === catalog.ranked.length && catalog.rankedCount >= catalog.minimumRankedCount, 'ranked count is below the declared minimum or metadata differs');
assert(catalog.rankedCount === catalog.targetRankedCount && catalog.selectionStatus === 'target-met', 'default production build did not meet the ranked target');
assert(catalog.targetReserveCount === DEFAULT_RESERVE_TARGET, `reserve target must be ${DEFAULT_RESERVE_TARGET}`);
assert(reserve.reserveCount === reserve.reserve.length && reserve.reserveCount === catalog.targetReserveCount, 'reserve count mismatch');
assert(catalog.featured?.id === 'featured-dkub-book' && catalog.featured.rank === undefined, 'featured book must be outside ranking');
assert(catalog.featured.shopId === '1032408641' && catalog.featured.itemId === '48511491095', 'featured book IDs changed unexpectedly');
assert(catalog.featured.checkedAt === '2026-08-17T15:26:00+07:00', 'featured book checkedAt changed unexpectedly');
assert(catalog.featured.categoryKey === 'books' && catalog.featured.category === CATEGORY_LABEL_BY_KEY.get('books'), 'featured book category metadata is invalid');
assert(JSON.stringify(catalog.featured.seasonTags) === JSON.stringify(['all-year']) && catalog.featured.monthTags.length === 0, 'featured book must be all-year');
assert(catalog.featured.seasonalScore === 50 && catalog.featured.seasonReason === 'เหมาะนำเสนอและทำคอนเทนต์ได้ตลอดทั้งปี', 'featured book seasonal metadata changed unexpectedly');
assert(!Number.isNaN(Date.parse(catalog.generatedAt)) && !Number.isNaN(Date.parse(catalog.sourceCheckedAt)), 'catalog timestamps are invalid');

catalog.ranked.forEach((product, index) => validateProduct(product, 'ranked', index + 1));
reserve.reserve.forEach((product, index) => validateProduct(product, 'reserve', index + 1));
const all = [...catalog.ranked, ...reserve.reserve];
assert(new Set(all.map((product) => product.id)).size === all.length, 'ranked/reserve product IDs are not unique');
assert(new Set(all.map((product) => new URL(product.imageUrl).pathname.split('/').filter(Boolean).at(-1))).size === all.length, 'ranked/reserve image file IDs are not unique');
assert(new Set(catalog.ranked.map((product) => product.rank)).size === catalog.ranked.length, 'rank values are not unique');
const selectedCategoryKeys = new Set(catalog.ranked.map((product) => product.categoryKey));
for (const { key } of CATALOG_CATEGORY_DEFINITIONS) assert(selectedCategoryKeys.has(key), `ranked catalog is missing category ${key}`);
const rankedShopCounts = catalog.ranked.reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map());
const allShopCounts = all.reduce((counts, product) => counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1), new Map());
assert(Math.max(...rankedShopCounts.values()) <= 3, 'ranked catalog exceeds per-shop cap of 3');
assert(Math.max(...allShopCounts.values()) <= 10, 'ranked/reserve catalog exceeds per-shop cap of 10');
assert(!all.some((product) => product.id === `${catalog.featured.shopId}-${catalog.featured.itemId}`), 'featured book leaked into ranked/reserve catalog');

const runtimeUrl = `${pathToFileURL(args.runtimeModule).href}?validation=${Date.now()}`;
const runtime = (await import(runtimeUrl)).default;
assert(runtime.schemaVersion === CATALOG_SCHEMA_VERSION && runtime.ranked.length === catalog.ranked.length && runtime.reserve.length === reserve.reserve.length, 'runtime module counts/schema mismatch');
assert(JSON.stringify(runtime.ranked) === JSON.stringify(catalog.ranked), 'runtime ranked payload differs from catalog.json');
assert(JSON.stringify(runtime.reserve) === JSON.stringify(reserve.reserve), 'runtime reserve payload differs from reserve JSON');
assert(JSON.stringify(runtime.featured) === JSON.stringify(catalog.featured), 'runtime featured payload differs from catalog.json');

process.stdout.write(`${JSON.stringify({
  status: 'valid',
  rankedCount: catalog.ranked.length,
  reserveCount: reserve.reserve.length,
  uniqueProductCount: new Set(all.map((product) => product.id)).size,
  categories: selectedCategoryKeys.size,
  allYearCount: catalog.ranked.filter((product) => product.seasonTags.includes('all-year')).length,
  seasonalCount: catalog.ranked.filter((product) => !product.seasonTags.includes('all-year')).length,
  featuredId: catalog.featured.id,
  sourceCheckedAt: catalog.sourceCheckedAt,
}, null, 2)}\n`);
