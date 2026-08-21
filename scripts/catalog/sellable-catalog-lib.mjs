import { basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  MinHeap,
  canonicalProductUrl,
  field,
  findImageUrl,
  parsePriceRange,
  sanitizeText,
  toFiniteNumber,
} from './catalog-lib.mjs';
import {
  makeSeasonalMetadataV4,
  SEASONAL_METADATA_VERSION,
} from './seasonal-metadata-v4.mjs';
import {
  CATEGORY_PARENTS_V5,
  GROUP_QUOTAS_V5,
  GROUPS_V5,
  LEGACY_HIERARCHY_V5,
  MERCHANDISING_TAG_DEFINITIONS,
  merchandisingTagsV5,
  NEW_RULE_SPECS_V5,
  PASSIVE_MOBILE_ACCESSORY_DENY_V5,
  TABLET_CASE_IDENTITY_V5,
  isRuggedPhoneCaseV5,
} from './taxonomy-v5.mjs';

export { MinHeap };
export {
  CAMPAIGN_RULES,
  CAMPAIGN_TAGS,
  CLIMATE_MONTH_PROFILES,
  CLIMATE_RULES,
  CLIMATE_SEASONS,
  INTENTIONAL_WHOLE_CATEGORY_CAMPAIGN_RULE_IDS,
  makeSeasonalMetadataV4,
  SEASONAL_METADATA_VERSION,
  SEASONAL_V4_GOLDEN_FIXTURES,
  STRICT_SUN_TOKEN,
} from './seasonal-metadata-v4.mjs';

export const CATALOG_SCHEMA_VERSION = 5;
export const DEFAULT_RANKED_TARGET = 60_000;
export const DEFAULT_RESERVE_TARGET = 6_000;
export const MINIMUM_RANKED_COUNT = 54_000;
export const DEFAULT_BUNDLED_FALLBACK_RANKED_COUNT = 20_000;

export const REQUIRED_SELLABLE_COLUMNS = Object.freeze([
  'global_category1', 'global_category2', 'global_category3', 'stock', 'item_sold',
  'title', 'shopid', 'itemid', 'description', 'model_prices', 'sale_price', 'price',
  'item_rating', 'shop_rating', 'like', 'image_link', 'is_official_shop',
  'is_preferred_shop', 'shopee_verified_flag', 'product_link',
]);

const GROUPS = GROUPS_V5;

const rule = (key, label, groupKey, quota, matcher, options = {}) => Object.freeze({
  key, label, groupKey, group: GROUPS[groupKey], quota, matcher,
  categoryKey: options.categoryKey ?? key,
  category: options.category ?? label,
  riskTier: options.riskTier ?? 'green',
  deny: options.deny ?? null,
  summaryKind: options.summaryKind ?? 'general',
  trustedShopOnly: options.trustedShopOnly ?? false,
  expiryGate: options.expiryGate ?? false,
  quotaWeight: options.quotaWeight ?? quota,
});

const is = (value, pattern) => pattern.test(value);
const pathText = (c1, c2, c3) => `${c1} > ${c2} > ${c3}`;

// Automotive is intentionally limited to passive accessories.  The source
// categories are broad (for example, "Seats & Seat Covers" also contains
// complete motorcycle seats), so the readable public name must independently
// identify one of these low-risk product types.
const AUTO_ORGANIZER_IDENTITY = /(?:จัดเก็บ|จัดระเบียบ|กล่อง|ช่องว่าง|ที่แขวน|ตะขอ|ถังขยะ|ทิชชู|ที่วาง|organizer|storage|holder|seat\s*gap|trash|tissue)/iu;
const AUTO_COVER_IDENTITY = /(?:พรม|carpet|(?:floor|trunk|cargo|cup)?\s*mats?\b|ผ้าคลุมเบาะ|ที่หุ้มเบาะ|seat\s*covers?|เบาะรอง(?:นั่ง|หลัง|คอ)|seat\s*(?:cushion|pad)|บังแดด|ม่านบังแดด|sun\s*(?:shade|shield)|dash\s*cover|ผ้าใบปิดกระบะ|tonneau\s*cover|ถาดท้าย|ที่รองแก้ว|coaster)/iu;
const AUTO_KEY_STYLE_IDENTITY = /(?:กุญแจ.{0,28}(?:เคส|ปลอก|ฝาครอบ|ซอง|พวง)|(?:เคส|ปลอก|ฝาครอบ|ซอง).{0,28}กุญแจ|key\s*(?:case|cover|holder|shell|chain)|สติกเกอร์|รูปลอก|โลโก้|ตราสัญลักษณ์|กรอบป้ายทะเบียน|กันโคลน|sticker|decal|emblem|badge|license\s*plate\s*(?:frame|cover)|mud\s*flap)/iu;
const AUTO_CLEANING_IDENTITY = /(?:ผ้า|ไมโครไฟเบอร์|ฟองน้ํา|ฟองน้ำ|แปรง|ถุงมือล้าง|ไม้ปัด|ยางปาด|microfib|sponge|brush|wash\s*mitt|duster|squeegee|towel|cloth)/iu;

function hasAutoLowRiskIdentity(categoryKey, value) {
  if (categoryKey === 'auto-organizers') return AUTO_ORGANIZER_IDENTITY.test(value);
  if (categoryKey === 'auto-covers-mats') return AUTO_COVER_IDENTITY.test(value);
  if (categoryKey === 'auto-key-style') return AUTO_KEY_STYLE_IDENTITY.test(value);
  if (categoryKey === 'auto-cleaning') return AUTO_CLEANING_IDENTITY.test(value);
  return false;
}

// Forty leaf categories are grouped into ten learner-friendly departments.  The
// source category path is always checked first; title patterns only narrow a
// path and never open a broad high-risk department by themselves.
const LEGACY_CATALOG_RULES = Object.freeze([
  rule('auto-organizers', 'ที่จัดเก็บและของใช้ในรถ', 'automotive', 170, (c1, c2, c3, title) =>
    c1 === 'Automobiles' && is(c3, /Organizers & Compartments|Phone Holders|Car Mattresses/iu) &&
    is(title, AUTO_ORGANIZER_IDENTITY),
  { riskTier: 'amber', summaryKind: 'automotive' }),
  rule('auto-covers-mats', 'พรม ผ้าคลุม และบังแดดรถ', 'automotive', 150, (c1, c2, c3, title) =>
    /^(?:Automobiles|Motorcycles)$/u.test(c1) && is(c3, /^(?:Carpets|Carpets & Mats|Seats & Seat Covers|Sun Shields & Dash Covers|Car Mattresses|Covers)$/iu) &&
    is(title, AUTO_COVER_IDENTITY),
  { riskTier: 'amber', summaryKind: 'automotive' }),
  rule('auto-key-style', 'เคสกุญแจและของตกแต่งรถ', 'automotive', 170, (c1, c2, c3, title) =>
    /^(?:Automobiles|Motorcycles)$/u.test(c1) &&
    (is(c2, /Automotive Keychains & Key Covers/iu) || is(c3, /Stickers, Logos & Emblems|Sill Plates|Garnish|License Plate Accessories|Mud Flaps & Splash Guards/iu)) &&
    is(title, AUTO_KEY_STYLE_IDENTITY),
  { riskTier: 'amber', summaryKind: 'automotive' }),
  rule('auto-cleaning', 'ผ้า แปรง และอุปกรณ์ดูแลรถ', 'automotive', 140, (c1, c2, c3, title) =>
    c1 === 'Automobiles' && c2 === 'Automotive Care' &&
    is(title, AUTO_CLEANING_IDENTITY) &&
    !is(title, /น้ําย|น้ำยา|สเปรย์|แวกซ์|เคลือบ|ขัดเงา|โพลิช|wax|polish|coating|sealant|spray|liquid|chemical/iu),
  { riskTier: 'amber', summaryKind: 'automotive' }),

  rule('hand-tools', 'เครื่องมือช่างแบบใช้มือ', 'tools', 850, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && c2 === 'Tools & Home Improvement' && c3 === 'Tools' &&
    is(title, /ไขควง|ประแจ|คีม|ค้อน|ตลับเมตร|สายวัด|ระดับน้ํา|ระดับน้ำ|แคลมป์|หกเหลี่ยม|ลูกบล็อก|เกรียง|ชะแลง|screwdriver|wrench|pliers?|hammer|measuring\s*tape|spirit\s*level|clamp|hex\s*key|socket/iu),
  { deny: /ไฟฟ้า|แบต|ชาร์จ|ไร้สาย|ตัด|เลื่อย|มีด|ใบมีด|สว่าน|เจียร|เชื่อม|หัวแร้ง|เลเซอร์|ลองไฟ|วัดไฟ|1000\s*v|บล็อกลม|ลูกบล็อกลม|ปั๊มลม|อัดลม|ถอดล้อ|ขันล้อ|เกจ(?:์)?วัดแรงดัน|electric|battery|cordless|cutter|cutting|saw|knife|blade|drill|grinder|weld|solder|laser|voltage|pneumatic|impact\s*socket|air\s*(?:impact|wrench|tool)|pressure\s*gauge/iu }),
  rule('diy-hardware', 'ฮาร์ดแวร์และอุปกรณ์ DIY', 'tools', 500, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && c2 === 'Tools & Home Improvement' &&
    is(c3, /Industrial Adhesives & Tapes|Doors & Windows|Construction Materials|Others/iu) &&
    is(title, /เทป|ตะขอ|ลูกล้อ|บานพับ|มือจับ|น็อต|สกรู|พุก|ขายึด|ยางรอง|ซีล|tape|hook|caster|hinge|handle|screw|bolt|bracket|seal/iu),
  { deny: /กาวช้าง|กาวร้อน|สารเคมี|น้ําย|น้ำยา|ปืน|ล็อก|กันขโมย|ไฟฟ้าไร้สาย|ไร้สาย|สว่าน|แผงวงจร|แบตเตอรี่|chemical|gun|security\s*lock|cordless|electric\s*(?:scrubber|tool)|power\s*tool|\bdrill\b|circuit\s*board|battery/iu }),

  rule('physical-books', 'หนังสือเล่มและสื่อการเรียนรู้', 'learning', 750, (c1, c2, c3, title) =>
    c1 === 'Books & Magazines' && c2 === 'Books' && is(title, /หนังสือ|แบบฝึกหัด|คู่มือ|พจนานุกรม|นิยาย|การ์ตูน|มังงะ|สมุดระบายสี|workbook|textbook|dictionary|novel|manga|\bbook\b/iu),
  { deny: /e[-\s]?book|อีบุ๊[กค]|\bpdf\b|ไฟล์|ดาวน์โหลด|download|คอร์สออนไลน์|audiobook|สแกน/iu }),
  rule('writing-supplies', 'ปากกา ดินสอ และอุปกรณ์เขียน', 'learning', 650, (c1, c2, c3, title) =>
    c1 === 'Stationery' && is(c2, /Writing & Correction|School & Office Equipment/iu) &&
    is(title, /ปากกา|ดินสอ|ยางลบ|ไม้บรรทัด|ไฮไลต์|มาร์กเกอร์|ดินสอกด|pen|pencil|eraser|ruler|marker|highlighter/iu),
  { deny: /คัตเตอร์|มีด|ใบมีด|pen\s*knife|cutter|blade/iu }),
  rule('paper-notebooks', 'สมุด กระดาษ และแฟ้ม', 'learning', 600, (c1, c2, c3, title) =>
    c1 === 'Stationery' && is(c2, /Notebooks & Papers|Letters & Envelopes|School & Office Equipment/iu) &&
    is(title, /สมุด|กระดาษ|แฟ้ม|ซองเอกสาร|ซองจดหมาย|คลิปหนีบ|โน้ต|notebook|paper|folder|envelope|memo|document/iu)),
  rule('art-craft', 'ศิลปะและงานฝีมือ', 'learning', 550, (c1, c2, c3, title) =>
    (c1 === 'Stationery' && is(c2, /Art Supplies|School & Office Equipment/iu) || c1 === 'Hobbies & Collections' && c2 === 'Needlework') &&
    is(title, /พู่กัน|สีไม้|สีชอล์ก|สีน้ํา|สีน้ำ|ผ้าใบวาด|ลูกปัด|ไหมพรม|ด้าย|สะดึง|เข็มถัก|brush|colored\s*pencil|watercolor|canvas|bead|yarn|thread|crochet/iu),
  { deny: /ทินเนอร์|สเปรย์|สารเคมี|เรซิ่น|resin|solvent|spray|chemical/iu }),
  rule('packing-gifts', 'แพ็กสินค้าและห่อของขวัญ', 'learning', 500, (c1, c2, c3, title) =>
    c1 === 'Stationery' && c2 === 'Gift & Wrapping' &&
    is(title, /ริบบิ้น|กล่อง|ถุง|กระดาษห่อ|บับเบิ้ล|บับเบิล|กันกระแทก|สติกเกอร์|ป้าย|ribbon|box|bag|wrap|bubble|sticker|label/iu)),

  rule('food-storage', 'กล่องอาหารและจัดเก็บในครัว', 'home', 800, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && c2 === 'Kitchenware' && is(c3, /Food Storage|Kitchen Racks|Others/iu) &&
    is(title, /กล่อง|โหล|กระปุก|ถุงซิป|ที่เก็บ|ชั้น|ตะแกรง|container|jar|storage|rack|zip\s*bag/iu)),
  rule('dining-drinkware', 'จาน ชาม แก้ว และโต๊ะอาหาร', 'home', 800, (c1, c2, c3) =>
    c1 === 'Home & Living' && c2 === 'Dinnerware' && !is(c3, /Knives|Scissors/iu)),
  rule('kitchen-utensils', 'อุปกรณ์เตรียมและทำอาหาร', 'home', 750, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && c2 === 'Kitchenware' &&
    is(title, /ตะหลิว|ทัพพี|ที่คีบ|กระชอน|ตะแกรง|ถาด|แม่พิมพ์|ที่เปิดขวด|ช้อนตวง|ถ้วยตวง|spatula|ladle|tongs?|strainer|tray|mold|opener|measuring/iu),
  { deny: /มีด|กรรไกร|ใบมีด|knife|scissors?|blade/iu }),
  rule('cleaning-tools', 'แปรง ผ้า และอุปกรณ์ทำความสะอาด', 'home', 800, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && c2 === 'Home Care Supplies' &&
    is(title, /แปรง|ผ้า(?:เช็ด|ไมโคร|ทำความสะอาด|ทําความสะอาด)|ไม้กวาด|ไม้ถูพื้น|ลูกกลิ้ง|ฟองน้ํา|ฟองน้ำ|ที่โกย|ไม้ปาด|ถุงมือ|ใยขัด|brush|cloth|broom|mop|roller|sponge|dustpan|squeegee|glove/iu) &&
    !is(c3, /Cleaning Agents|Pest & Weed Control/iu) && !is(title, /น้ำยา|น้ํายา|ผงซัก|ซักผ้า|ปรับผ้านุ่ม|ฟอกขาว|ไฟน์ไลน์|detergent|softener|bleach|fineline|laundry\s*liquid|cleaning\s*liquid/iu)),
  rule('household-paper-bags', 'กระดาษใช้ในบ้านและถุงจัดการขยะ', 'home', 650, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && c2 === 'Home Care Supplies' &&
    (is(c3, /Tissue & Paper Towels|Plastic Bags & Trash Bags/iu) || is(title, /ทิชชู|กระดาษชําระ|กระดาษชำระ|กระดาษอเนกประสงค์|ถุงขยะ|ถุงหูหิ้ว|tissue|paper\s*towel|trash\s*bag|plastic\s*bag/iu))),
  rule('home-organizers', 'กล่อง ชั้น และอุปกรณ์จัดระเบียบบ้าน', 'home', 850, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && (c2 === 'Home Organizers' || c2 === 'Furniture' && is(c3, /Shelves & Racks|Cupboards & Cabinets/iu)) &&
    is(title, /กล่อง|ตะกร้า|ชั้น|ที่แขวน|ตะขอ|ที่ใส่|ถุงจัดเก็บ|ลิ้นชัก|organizer|storage|basket|rack|hook|holder|drawer|cabinet/iu)),
  rule('bath-laundry', 'ห้องน้ำและซักล้าง', 'home', 650, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && (c2 === 'Bathrooms' || c2 === 'Home Care Supplies' && is(c3, /Laundry Care|Clotheslines & Drying Racks/iu)) &&
    is(title, /ชั้น|ที่วาง|กล่องสบู่|ขวดปั๊ม|ม่าน|ราวตาก|เชือกตาก|ตะกร้า|กะละมัง|ถัง|ขัน|rack|holder|soap|curtain|drying|laundry|basin|bucket/iu),
  { deny: /น้ําย|น้ำยา|ผงซัก|ฟอกขาว|ฆ่าเชื้อ|detergent|bleach|chemical/iu }),
  rule('home-textiles', 'ผ้า พรม และสิ่งทอในบ้าน', 'home', 650, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && is(c2, /Bedding|Bathrooms|Decoration/iu) &&
    is(title, /ผ้าขนหนู|ผ้าเช็ดมือ|พรม|เสื่อ|ปลอกหมอน|ผ้าปูโต๊ะ|ม่าน|ที่รองจาน|towel|doormat|mat|pillowcase|tablecloth|curtain|placemat/iu),
  { deny: /สุขภาพ|รักษา|ลดปวด|แก้ปวด|health|therapy|pain/iu }),
  rule('home-decor', 'ของแต่งบ้านและผนัง', 'home', 550, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && c2 === 'Decoration' &&
    is(title, /ดอกไม้ประดิษฐ์|ดอกไม้ปลอม|กรอบรูป|แต่งผนัง|วอลล์เปเปอร์|สติกเกอร์ผนัง|แจกัน|กระจก|พรม|artificial\s*flower|photo\s*frame|wall|wallpaper|vase|mirror|rug/iu),
  { deny: /ต้นไม้จริง|ดอกไม้สด|มีราก|เมล็ด|เทียน|น้ําหอม|น้ำหอม|หลอดไฟ|ไฟตกแต่ง|live\s*plant|fresh\s*flower|candle|fragrance|lamp|\bled\b/iu }),

  rule('garden-supplies', 'กระถางและอุปกรณ์ทำสวนเสี่ยงต่ำ', 'outdoor', 500, (c1, c2, c3, title) =>
    c1 === 'Home & Living' && c2 === 'Gardening' && is(c3, /Pots & Planters|Garden Decorations|Gardening Tools|Irrigation Systems|Others/iu) &&
    is(title, /กระถาง|บัวรดน้ํา|บัวรดน้ำ|ถุงมือ|คลิปต้นไม้|ตาข่าย|ป้ายต้นไม้|ข้อต่อ|หัวน้ําหยด|หัวน้ำหยด|pot|planter|watering|glove|plant\s*clip|(?<![\p{L}\p{M}\p{N}])net(?![\p{L}\p{M}\p{N}])|label|connector|drip/iu),
  { deny: /ต้นไม้จริง|ต้นกล้า|เมล็ด|หัวพันธุ์|ปุ๋ย|ดิน|ยาฆ่า|สารเคมี|ฮอร์โมน(?:พืช)?|เพาะเลี้ยงเนื้อเยื่อ|สารควบคุมการเจริญเติบโต|มีด|กรรไกร|เลื่อย|live\s*plant|seed|fertili|soil|pesticide|plant\s*growth\s*regulator|tissue\s*culture|(?<![\p{L}\p{M}\p{N}])(?:ba|naa|iba|tdz|kinetin|2\s*,\s*4\s*-\s*d|iaa)(?![\p{L}\p{M}\p{N}])|knife|scissors|saw/iu }),
  rule('camping-rain', 'แคมป์ปิง กันฝน และปิกนิก', 'outdoor', 600, (c1, c2, c3, title) =>
    (c1 === 'Sports & Outdoors' && is(c2, /Sports & Outdoor Recreation Equipments|Sports & Outdoor Accessories/iu) || c1 === 'Home & Living' && c2 === 'Tools & Home Improvement') &&
    is(title, /เต็นท์|ฟลายชีท|ผ้าใบ|เสื่อปิกนิก|โต๊ะแคมป์|เก้าอี้แคมป์|ถุงกันน้ํา|ถุงกันน้ำ|ร่ม(?:กันฝน|พับ|สนาม|กอล์ฟ|ออโต้|อัตโนมัติ)|เสื้อกันฝน|สมอบก|หมุดเต็นท์|tent|flysheet|tarpaulin|picnic|camping|dry\s*bag|umbrella|rain\s*coat|tent\s*peg/iu),
  { deny: /เตา|แก๊ส|ก๊าซ|เชื้อเพลิง|มีด|ขวาน|เลื่อย|ไฟฉาย|ตะเกียง|หัวพ่นไฟ|stove|gas\b|fuel|knife|axe|saw\b|torch|lantern/iu }),
  rule('travel-organizers', 'กระเป๋าจัดระเบียบและอุปกรณ์เดินทาง', 'outdoor', 550, (c1, c2, c3, title) =>
    c1 === 'Travel & Luggage' && c2 === 'Travel Accessories' &&
    is(title, /จัดระเบียบ|ถุงแยก|ถุงใส่รองเท้า|กระเป๋าอาบน้ํา|กระเป๋าอาบน้ำ|ป้ายกระเป๋า|ซองพาสปอร์ต|ขวดแบ่ง|packing\s*cube|organizer|shoe\s*bag|toiletry|luggage\s*tag|passport|travel\s*bottle/iu),
  { deny: /อิเล็กทรอนิกส์|สายเคเบิล|ชาร์จ|rfid|electronics?|cable|charger/iu }),

  rule('phone-cases', 'เคสมือถือ', 'tech', 950, (c1, c2, c3, title) =>
    c1 === 'Mobile & Gadgets' && c2 === 'Accessories' && c3 === 'Cases, Covers, & Skins' &&
    is(title, /เคส|ซอง|case|cover|pouch/iu) && !TABLET_CASE_IDENTITY_V5.test(title) && !isRuggedPhoneCaseV5(title),
  { deny: PASSIVE_MOBILE_ACCESSORY_DENY_V5 }),
  rule('passive-tech', 'อุปกรณ์คอมพิวเตอร์แบบไม่ใช้ไฟ', 'tech', 700, (c1, c2, c3, title) =>
    c1 === 'Computers & Accessories' && c2 === 'Peripherals & Accessories' &&
    is(title, /เมาส์แพด|แผ่นรองเมาส์|แท่นวาง|โต๊ะวาง|สกิน|เคส|ซอง|แผ่นคลุมคีย์บอร์ด|mouse\s*pad|laptop\s*(?:stand|desk|skin|cover|sleeve)|keyboard\s*cover|case|pouch/iu),
  { deny: /แบต|ชาร์จ|สายไฟ|ยูเอสบี|\busb\b|พัดลม|ฮับ|hub|battery|charger|cable|adapter|power/iu }),

  rule('pet-feeding', 'ชามและอุปกรณ์ให้อาหารสัตว์', 'pets', 450, (c1, c2, c3, title) =>
    c1 === 'Pets' && c2 === 'Pet Accessories' && c3 === 'Bowls & Feeders' && is(title, /ชาม|จาน|ถ้วย|ที่ให้น้ํา|ที่ให้น้ำ|bowl|feeder|water/iu),
  { deny: /อัตโนมัติ|ไฟฟ้า|แบต|ชาร์จ|automatic|electric|battery|charger/iu }),
  rule('pet-home-toys', 'ที่นอน ที่ลับเล็บ และของเล่นสัตว์', 'pets', 450, (c1, c2, c3, title) =>
    c1 === 'Pets' && c2 === 'Pet Accessories' && is(c3, /Pet Furniture|Toys|Travel Essentials/iu) &&
    is(title, /เบาะ|ที่นอน|บ้าน|คอนโด|ที่ลับเล็บ|ของเล่น|กระเป๋า|bed|house|furniture|scratcher|toy|carrier/iu),
  { deny: /แคทนิป|กัญชาแมว|มาทาทาบิ|catnip|matatabi|silvervine|ไฟฟ้า|แบต|เลเซอร์|electric|battery|laser/iu }),
  rule('pet-hygiene', 'กระบะทราย แผ่นรอง และเก็บมูลสัตว์', 'pets', 400, (c1, c2, c3, title) =>
    c1 === 'Pets' && c2 === 'Litter & Toilet' && is(title, /กระบะ|ที่ตักทราย|แผ่นรอง|แผ่นรองฉี่|ถุงเก็บมูล|ถุงอึ|litter|scoop|training\s*pad|poop\s*bag|toilet/iu),
  { deny: /ดับกลิ่น|ฆ่าเชื้อ|สเปรย์|น้ําย|น้ำยา|deodor|antibacterial|spray|liquid/iu }),

  rule('skincare-cleanser', 'ผลิตภัณฑ์ทำความสะอาดผิวหน้า', 'beauty', 500, (c1, c2, c3, title) =>
    c1 === 'Beauty' && c2 === 'Skincare' && c3 === 'Facial Cleanser' &&
    is(title, /cleanser|cleansing|facial\s*wash|face\s*wash|soap|foam|mousse|micellar|คลีนเซอร์|คลีนซิ่ง|ล้างหน้า|โฟม|มูส|สบู่|ไมเซลลาร์/iu),
  { riskTier: 'amber', summaryKind: 'skincare' }),
  rule('skincare-moisturizer', 'มอยส์เจอไรเซอร์และเซรั่ม', 'beauty', 650, (c1, c2, c3, title) =>
    c1 === 'Beauty' && c2 === 'Skincare' && is(c3, /Facial Moisturizer|Facial Serum & Essence|Toner & Mist|Eye Cream/iu) &&
    is(title, /moist|serum|essence|ampoule|toner|mist|cream|gel|lotion|เซรั่ม|เอสเซนส์|แอมพูล|โทนเนอร์|น้ําตบ|น้ำตบ|มอยส์|ครีม|เจล|โลชั่น/iu),
  { riskTier: 'amber', summaryKind: 'skincare' }),
  rule('skincare-sunscreen', 'ผลิตภัณฑ์กันแดดสำหรับใบหน้า', 'beauty', 300, (c1, c2, c3, title) =>
    c1 === 'Beauty' && c2 === 'Skincare' && c3 === 'Face Sunscreen' &&
    is(title, /sunscreen|sun\s*screen|sunblock|กันแดด|ยูวี|\buv\b/iu),
  { riskTier: 'amber', summaryKind: 'skincare' }),
  rule('skincare-mask-lip', 'มาสก์หน้าและลิปแคร์', 'beauty', 450, (c1, c2, c3, title) =>
    c1 === 'Beauty' && c2 === 'Skincare' && is(c3, /Face Mask & Packs|Lip Balm & Treatment/iu) &&
    is(title, /mask|pack|lip|balm|มาสก์|มาร์ค|ลิป|บาล์ม/iu),
  { riskTier: 'amber', summaryKind: 'skincare' }),
  rule('hair-body-care', 'แชมพู สบู่ และโลชั่น', 'beauty', 500, (c1, c2, c3, title) =>
    c1 === 'Beauty' && (c2 === 'Hair Care' && is(c3, /Shampoo|Hair Treatment|Conditioner/iu) || c2 === 'Bath & Body Care' && is(c3, /Body Wash & Soap|Body Cream, Lotion & Butter/iu)) &&
    is(title, /shampoo|conditioner|treatment|hair|tonic|soap|body\s*wash|shower|lotion|cream|แชมพู|ครีมนวด|ทรีทเมนท์|ทรีทเม้นท์|หมักผม|แฮร์|โทนิค|สบู่|ครีมอาบ|เจลอาบ|โลชั่น|ครีมทาผิว|บอดี้/iu),
  { riskTier: 'amber', summaryKind: 'skincare' }),

  rule('supplements-wellbeing', 'วิตามินและแร่ธาตุทั่วไป', 'supplements', 350, (c1, c2, c3, title) =>
    c1 === 'Health' && c2 === 'Food Supplement' && c3 === 'Well Being' && is(title, /วิตามิน|แร่ธาตุ|ซิงค์|สังกะสี|แมกนีเซียม|แคลเซียม|multivitamin|vitamin|mineral|zinc|magnesium|calcium/iu),
  { riskTier: 'amber', summaryKind: 'supplement' }),
  rule('supplements-beauty', 'อาหารเสริมกลุ่มบิวตี้', 'supplements', 250, (c1, c2, c3, title) =>
    c1 === 'Health' && c2 === 'Food Supplement' && c3 === 'Beauty Supplements' && is(title, /คอลลาเจน|วิตามิน|ซิงค์|ไบโอติน|collagen|vitamin|zinc|biotin/iu),
  { riskTier: 'amber', summaryKind: 'supplement' }),
  rule('supplements-sports', 'โปรตีนและโภชนาการกีฬา', 'supplements', 250, (c1, c2, c3, title) =>
    c1 === 'Health' && c2 === 'Food Supplement' && is(c3, /Fitness|Well Being/iu) &&
    is(title, /โปรตีน|เวย์|กรดอะมิโน|protein|whey|amino/iu) && !is(title, /ช้อนตวง|แก้วเชค|กระบอกเชค|scoop|shaker/iu),
  { riskTier: 'amber', summaryKind: 'supplement' }),

  rule('apparel-basics', 'เสื้อผ้าพื้นฐาน', 'fashion', 850, (c1, c2, c3) =>
    /^(?:Women Clothes|Men Clothes)$/u.test(c1) && is(c2, /Tops|Pants|Shorts|Socks|Skirts|Dresses|Jackets, Coats & Vests|Sweaters & Cardigans/iu)),
  rule('bags-wallets', 'กระเป๋าและกระเป๋าสตางค์', 'fashion', 550, (c1, c2) =>
    /^(?:Women Bags|Men Bags)$/u.test(c1) && !is(c2, /Laptop Bags/iu)),
  rule('fashion-accessories', 'เครื่องประดับแฟชั่นและของใช้ส่วนตัว', 'fashion', 650, (c1, c2, c3, title) =>
    c1 === 'Fashion Accessories' && is(c2, /Hair Accessories|Belts|Hats & Caps|Additional Accessories|Scarves & Shawls|Gloves/iu) &&
    is(title, /กิ๊บ|ยางรัดผม|ที่คาดผม|เข็มกลัด|พวงกุญแจ|เข็มขัด|หมวก|ผ้าพันคอ|ถุงมือ|hair|clip|scrunch|headband|brooch|keychain|belt|hat|cap|scarf|glove/iu)),
  rule('hobby-learning', 'งานอดิเรก เกม และของสะสม', 'fashion', 550, (c1, c2, c3, title) =>
    c1 === 'Hobbies & Collections' && is(c2, /Toys & Games|Collectible Items|Souvenirs|Needlework/iu) &&
    is(title, /บอร์ดเกม|การ์ดเกม|จิ๊กซอว์|โมเดล|ฟิกเกอร์|พวงกุญแจ|งานปัก|งานถัก|board\s*game|card\s*game|puzzle|model|figure|keychain|needlework|crochet/iu),
  { deny: /พนัน|คาสิโน|ไพ่ป๊อก|อาวุธ|ปืน|มีด|18\+|ผู้ใหญ่|gambling|casino|weapon|gun|knife|adult/iu }),
]);

function materializeV5Rule(source, legacy = false) {
  const hierarchy = legacy ? LEGACY_HIERARCHY_V5[source.key] : [source.groupKey, source.categoryKey];
  if (!hierarchy) throw new Error(`Missing v5 hierarchy for legacy leaf ${source.key}`);
  const [groupKey, categoryKey] = hierarchy;
  const parentDefinition = CATEGORY_PARENTS_V5[categoryKey];
  if (!GROUPS[groupKey] || !parentDefinition) throw new Error(`Invalid v5 hierarchy for ${source.key}`);
  return {
    ...source,
    groupKey,
    group: GROUPS[groupKey],
    categoryKey,
    category: parentDefinition.label,
    quotaWeight: legacy ? Math.max(0.5, source.quota / 500) : source.quotaWeight,
    trustedShopOnly: source.trustedShopOnly ?? false,
    expiryGate: source.expiryGate ?? false,
  };
}

function allocateGroupQuotas(rules) {
  const allocations = new Map();
  for (const [groupKey, target] of Object.entries(GROUP_QUOTAS_V5)) {
    const groupRules = rules.filter((category) => category.groupKey === groupKey);
    if (!groupRules.length) throw new Error(`No taxonomy leaves for group ${groupKey}`);
    const totalWeight = groupRules.reduce((sum, category) => sum + category.quotaWeight, 0);
    const provisional = groupRules.map((category) => {
      const exactQuota = target * category.quotaWeight / totalWeight;
      return { category, quota: Math.floor(exactQuota), remainder: exactQuota - Math.floor(exactQuota) };
    });
    let unallocated = target - provisional.reduce((sum, entry) => sum + entry.quota, 0);
    provisional.sort((left, right) => right.remainder - left.remainder || left.category.key.localeCompare(right.category.key, 'en'));
    for (let index = 0; index < unallocated; index += 1) provisional[index].quota += 1;
    for (const entry of provisional) allocations.set(entry.category.key, entry.quota);
  }
  return allocations;
}

const V5_RULES_WITHOUT_QUOTAS = [
  ...NEW_RULE_SPECS_V5.map((category) => materializeV5Rule(category, false)),
  ...LEGACY_CATALOG_RULES.map((category) => materializeV5Rule(category, true)),
];
if (new Set(V5_RULES_WITHOUT_QUOTAS.map((category) => category.key)).size !== V5_RULES_WITHOUT_QUOTAS.length) {
  throw new Error('Duplicate schema-v5 subcategory key');
}
const V5_QUOTAS = allocateGroupQuotas(V5_RULES_WITHOUT_QUOTAS);

export const CATALOG_RULES = Object.freeze(V5_RULES_WITHOUT_QUOTAS.map((category) => Object.freeze({
  ...category,
  quota: V5_QUOTAS.get(category.key),
})));

export const CATALOG_SUBCATEGORY_DEFINITIONS = Object.freeze(CATALOG_RULES.map(({
  key, label, groupKey, group, categoryKey, category, quota, riskTier,
}) => Object.freeze({ key, label, groupKey, group, categoryKey, category, quota, riskTier })));

export const CATALOG_CATEGORY_DEFINITIONS = Object.freeze([...CATALOG_RULES.reduce((definitions, category) => {
  if (!definitions.has(category.categoryKey)) definitions.set(category.categoryKey, Object.freeze({
    key: category.categoryKey,
    label: category.category,
    groupKey: category.groupKey,
    group: category.group,
    quota: GROUP_QUOTAS_V5[category.groupKey],
  }));
  return definitions;
}, new Map()).values()]);

export const CATALOG_GROUP_DEFINITIONS = Object.freeze(Object.entries(GROUPS).map(([key, label]) => Object.freeze({
  key,
  label,
  quota: GROUP_QUOTAS_V5[key],
})));

export const CATALOG_MERCHANDISING_TAG_DEFINITIONS = MERCHANDISING_TAG_DEFINITIONS;
export const CATALOG_GROUP_QUOTAS = GROUP_QUOTAS_V5;

const ILLEGAL_OR_RED = /(?:บุหรี่|ยาสูบ|บุหรี่ไฟฟ้า|พอต(?:ไฟฟ้า)?|\bvape\b|กัญชา|กระท่อม|อาวุธ|ปืน|กระสุน|ระเบิด|เซ็กซ์ทอย|sex\s*toy|adult\s*toy|สล็อต|พนัน|คาสิโน|prescription|ยา(?:รักษา|ลดน้ําหนัก|ลดน้ำหนัก|เพิ่มสมรรถภาพ)|ไวอากร้า|เพิ่มสมรรถภาพ|ยาฆ่าแมลง|สารกําจัดศัตรูพืช|สารกำจัดศัตรูพืช|ลด\s*(?:อาการ\s*)?ปวด(?:เมื่อย|หลัง|ข้อมือ)?|แก้\s*ปวด|บรรเทา\s*(?:อาการ\s*)?ปวด|สเปรย์(?:พริกไทย|ป้องกันหมาป่า|ป้องกันตัว|ป้องกันสัตว์)|(?:พวงกุญแจ|อุปกรณ์|สเปรย์).{0,30}ป้องกันตัว|pepper\s*spray|self[-\s]?defen[cs]e|stun\s*gun|taser|nizoral|ไนโซรัล|นีโซรัล|ketoconazole|roihi|tsuboko|โรอิฮิ|ammunition|weapon|pesticide|not\s+for\s+sale|ของแถมห้ามขาย)/iu;
// The public catalog offers passive cleaning tools, not liquids, chemical
// cleaners, disinfectants or pre-treated wet wipes.  Match the product title
// only so care instructions in a garment description do not create false hits.
const ACTIVE_CLEANING_OR_DISINFECTANT = /(?:(?:น้ำยา|น้ํายา).{0,32}(?:ทำความสะอาด|ทําความสะอาด|ล้างจาน|ซักผ้า|ขจัดคราบ|กำจัดคราบ|กําจัดคราบ|ฆ่าเชื้อ)|(?:ครีม|สเปรย์|เจล|ผง).{0,24}(?:ทำความสะอาด|ทําความสะอาด|ขจัดคราบ|กำจัดคราบ|กําจัดคราบ|ฆ่าเชื้อ)|(?:ทำความสะอาด|ทําความสะอาด|ขจัดคราบ|กำจัดคราบ|กําจัดคราบ|ฆ่าเชื้อ).{0,24}(?:น้ำยา|น้ํายา|ครีม|สเปรย์|เจล|ผง)|แผ่นซักผ้า|ทิชชู(?:่)?เปียก|ผ้าเช็ด.{0,20}แบบเปียก|แผ่นเช็ด.{0,20}(?:พร้อมใช้|แบบเปียก)|เครื่องจ่าย.{0,20}(?:แอลกอฮอล์|น้ำยาฆ่าเชื้อ|น้ํายาฆ่าเชื้อ)|disinfect\w*|antibacter\w*|bacteria\s*reduction|wet\s*wipes?|cleaning\s*wipes?|surface\s*wipes?|glass.{0,12}wipes?|dish\s*(?:soap|liquid)|laundry\s*(?:detergent|sheet|liquid)|detergent|softener|bleach|alcohol\s*dispenser)/iu;
const SEVERE_HEALTH_CLAIM = /(?:รักษา|ป้องกันโรค|หายขาด|เห็นผลทันที|รับประกันผล|ลดน้ําหนัก|ลดน้ำหนัก|ลดความอ้วน|ผอมไว|ดักจับไขมัน|ดีท็อกซ์|detox|เพิ่มสมรรถภาพ|เสริมสมรรถภาพ|ไวอากร้า|ฮอร์โมน|เพิ่มน้ํานม|เพิ่มน้ำนม|มะเร็ง|เบาหวาน|ความดัน|หัวใจ|ไต|ตับ|ซึมเศร้า|ภูมิแพ้|โควิด|covid|โรค\p{L}*|ยา\p{L}*)/iu;
const SENSITIVE_TITLE_CLAIM = /(?:รักษา|แก้สิว|ลดสิว|ลดฝ้า|ฝ้าหาย|สิวหาย|ขาวถาวร|ขาวใน\s*\d+|ผิวขาวไว|การันตี|ปลอดภัย\s*100\s*%|ไม่แพ้|ไม่ระคายเคือง|hypoallergenic|clinically\s*proven|รับรองโดยแพทย์|แพทย์แนะนํา|แพทย์แนะนำ|ลดน้ําหนัก|ลดน้ำหนัก|ผอม|ดีท็อกซ์|detox|เพิ่มสมรรถภาพ|ฮอร์โมน|ป้องกันโรค|รักษาโรค|ต้านมะเร็ง|แก้เบาหวาน|แก้ความดัน)/iu;
const UNSUPPORTED_SPF = /(?:spf\s*\d+|pa\s*\+{1,4}|เอสพีเอฟ\s*\d+|พีเอ\s*\+{1,4}|กันแดด\s*\d+)/iu;
const ACTIVE_AUTO_RISK = /(?:หมวกกันน็อค|เบรก|ยางรถ|แบต(?:เตอรี่)?|ถ่าน|เครื่องยนต์|อะไหล่|ถุงลม|เข็มขัดนิรภัย|พวงมาลัย|แร็ค|แรค|สวิตช์ควบคุม|กระจกมอง|ไฟหน้า|ไฟท้าย|ท่อไอเสีย|ล็อกกันขโมย|ตัวรีโมต|ตัวรีโมท|ชิป|วงจร|พักเท้า|แผ่นรองพักเท้า|เบาะนั่งมอเตอร์ไซค์|ฝาครอบกรอง|ฝาครอบถัง|ขาตั้งรถ|แม่แรง|transponder|315\s*mhz|433\s*mhz|program(?:ming)?|copy\s*key|มีด|ใบมีด|wireless|เครื่องดูด|vacuum|steering|control\s*switch|rack|knife|blade|brake|tire|battery|engine|airbag|seat\s*belt|exhaust|collision|electronic|foot\s*rest|footrest|floorboard|motorcycle\s*seat|filter\s*cover|fuel\s*tank\s*cover|tank\s*cover|(?:jack|axle|car)\s*stands?)/iu;
// Controlled products are deliberately narrow. Source marketing is rejected rather
// than rewritten: a public name may contain brand, product type, formula/flavour,
// size and count, but no promised outcome, condition, safety or medical language.
const CONTROLLED_ACTION_OR_OUTCOME = /(?:มีส่วนช่วย|ช่วย|บำรุง|ดูแล|ป้องกัน|รักษา|แก้(?:ปัญหา)?|ลด|เลือน|ล้าง(?:ฝ้า|กระ|สิว|รอย)|เพิ่ม|เสริม|ส่งผล|เห็นผล|ต้าน|ฟื้นฟู|ขจัด|บอกลา|ฆ่าเชื้อ|กระชับ|อิ่มฟู|คุม(?:มัน|สิว|หิว)|ปลอบประโลม|สลาย|เชื่อมแกน|ผ่อนคลาย|ดีขึ้น|แข็งแรง|สุขภาพดี|ชุ่มชื้น|ชุ่มขื้น|ชุ่มชื่น|ดูดซึม|ขาว(?:ทันที|ไว|ขึ้น)?|กระจ่างใส|หน้าใส|ขึงหน้า|ล้ำลึก|ล้ําลึก|ผิวหน้า(?:ขาว|ใส|กระจ่าง)|เข้มข้น|หอม|เนียน|นุ่ม|เด้ง|ฟู|อิ่มน้ำ|อิ่มน้ํา|เปล่งปลั่ง|ออร่า|โกลว์|โทนอัพ|ไชน์|บูสเตอร์|(?:prevent|protect\w*|treat|cure|heal|repair|restore|improve|boost|support|results?|visible\s+results?|fast[-\s]?acting|instant|clinically\s+proven|sooth\w*|hydrat\w*|radiance|purif\w*|refresh\w*|deep\s*clean|moisture\s*therapy|revitali\w*|nourish\w*|firming|lifting|shine|silky|smooth|gentle|glow\w*|clarif\w*|calm\w*|strengthen\w*|renew\w*|youth\w*|elastic\w*|plump\w*|flawless|tone\s*up))/iu;
const CONTROLLED_CONDITION_OR_BODY_CLAIM = /(?:ริ้วรอย|ฝ้า|เมลาสม่า|จุดด่าง(?:ดำ|ดํา)?|กระ(?:จุด|แดด)?|รอย(?:ดำ|ดํา|แดง|แผลเป็น)|แผลเป็น|สิว|รังแค|แบคทีเรีย|เชื้อรา|กลิ่น(?:ตัว|แก่|ไม่พึงประสงค์)|ตัวหอม|ตุ่มหนังไก่|ขนคุด|ผมร่วง|ผมหงอก|คัน|ตกขาว|น้องสาว|นอนกรน|หลับลึก|นอนหลับ|ไมเกรน|ตะคริว|ปวด|อักเสบ|ภูมิ(?:คุ้มกัน|ต้านทาน)?|สมอง|ความจำ|ความจํา|สมาธิ|กระดูก|ข้อต่อ|ข้อเข่า|เหงือก|ฟัน|น้ำหนัก|น้ําหนัก|กล้าม(?:เนื้อ|ลีน)|ลีนไขมัน|ไขมันต่ำ|แคล(?:อรี)?ต่ำ|น้ำตาล\s*0|น้ําตาล\s*0|โปรตีนสูง|ทุกปัญหาผิว|เพื่อสุขภาพ|ผิว\s*&\s*ภูมิ|dark\s*spots?|melasma|scar|acne|dandruff|bacteri(?:a|al)|anti[-\s]?(?:wrinkle|aging|melasma|spot|acne|dandruff|hair\s*loss)|wrinkles?|hair\s*loss|whit\w*|bright\w*|ไวท์\w*|ไบรท์\w*|weight\s*(?:gain|loss)|mass\s*gainer|fat\s*burn|sleep|snor(?:e|ing)|pain|inflamm\w*|immun\w*|brain|memory|focus|joint|bone|teeth|absorb\w*|therapy|skin\s*barrier|barrier\s*(?:repair|care|cream|serum|shampoo))/iu;
const CONTROLLED_EFFICACY_CLAIM = /(?:มีส่วนช่วย|ช่วย|บำรุง|ดูแล|ป้องกัน|รักษา|แก้(?:ปัญหา)?|ลด|เลือน|ล้าง(?:ฝ้า|กระ|สิว|รอย)|เพิ่ม|เสริม|ส่งผล|เห็นผล|ต้าน|ฟื้นฟู|ขจัด|บอกลา|ฆ่าเชื้อ|กระชับ|อิ่มฟู|คุม(?:มัน|สิว|หิว)|ปลอบประโลม|สลาย|เชื่อมแกน|ผ่อนคลาย|แข็งแรง|สุขภาพดี|ชุ่มชื้น|ชุ่มขื้น|ดูดซึม(?:ไว|ง่าย)|ขาว(?:ทันที|ไว|ขึ้น)?|กระจ่างใส|หน้าใส|ขึงหน้า|ล้ำลึก|ล้ําลึก|ริ้วรอย|ฝ้า|เมลาสม่า|จุดด่าง(?:ดำ|ดํา)?|รอยแผล|สิว|รังแค|กลิ่น(?:ตัว|แก่)|ตัวหอม|ตุ่มหนังไก่|ขนคุด|ผมร่วง|คัน|ตกขาว|น้องสาว|นอนกรน|หลับลึก|ปวด|ภูมิ(?:คุ้มกัน)?|สมอง|ความจำ|ความจํา|สมาธิ|กระดูก|ข้อต่อ|ฟัน|น้ำหนัก|น้ําหนัก|กล้าม(?:เนื้อ|ลีน)|ลีนไขมัน|ทุกปัญหาผิว|dark\s*spots?|melasma|scar|acne|dandruff|anti[-\s]?(?:wrinkle|aging|melasma|spot|acne|dandruff|hair\s*loss)|wrinkles?|hair\s*loss|whit\w*|bright\w*|ไวท์\w*|ไบรท์\w*|weight\s*(?:gain|loss)|mass\s*gainer|fat\s*burn|sleep|snor(?:e|ing)|pain|inflamm\w*|immun\w*|brain|memory|focus|joint|bone|teeth|absorb\w*|therapy|sooth\w*|hydrat\w*|radiance|purif\w*|refresh\w*|deep\s*clean|revitali\w*|nourish\w*|firming|lifting|shine)/iu;
const CONTROLLED_SAFETY_CLAIM = /(?:อ่อนโยน|แพ้ง่าย|ไม่แพ้|ไม่ระคาย|ปลอดภัย|dermatolog|clinical(?:ly)?|แพทย์|หมอ|doctor|physician|fda\s*approved)/iu;
const CONTROLLED_MEDICAL_NUTRITION = /(?:อาหารทางการแพทย์|อาหารสูตรครบถ้วน|สำหรับผู้ป่วย|เอนชัวร์|\bensure\b)/iu;
const CONTROLLED_TIMEFRAME_CLAIM = /(?:(?:เห็นผล|ผลลัพธ์|ขาว|ดีขึ้น).{0,24}\d+\s*(?:นาที|ชั่วโมง|วัน|สัปดาห์|เดือน)|\d+\s*(?:นาที|ชั่วโมง|วัน|สัปดาห์|เดือน).{0,24}(?:เห็นผล|ผลลัพธ์|ขาว|ดีขึ้น)|before\s*(?:&|and|\/)\s*after)/iu;
const BEAUTY_EXTRA_RISK = /(?:รูขุมขน|แอคทีฟ\s*พอร์|พอร์เลส|เฟิร์ม|ไทท์|ไทท์เทนนิ่ง|สดชื่น|เฟรช|ใช้ดี|บูส|บาเรียร์|ไบร์ท|บริ้ง|เพอร์เฟ็ค|อัลติเมท|คลาริตี้|ผิวซีด|ผิวใส|หน้าเงา|เซนซิทีฟ|อินเทนซีฟ|รีเจน|รีจู|รีแพร์|ควบคุม(?:ความมัน|มัน)|ไม่เป็นคร\p{L}*|ลบ(?:ริ้ว|ริว)?รอย|กลูต้า|กลูตา(?:ไธโอน)?|คลินิก|คลีนิค|ไนโซรัล|นีโซรัล|ซูธ|ไฮจีนิค|ซอฟต์|คอนเซนเทรต|แอคเน่|เบาน์ซิ่ง|บาลานซิ่ง|ล็อคสีผม|ล็อกสีผม|active\s*pore|tighten\w*|firm\w*|pore\w*|acni\w*|fresh\w*|perfect\w*|intensive|concentrat\w*|sensitive|hygien\w*|antiseptic|comfort|stretchy|regener\w*|reju\w*|clarity|glassy|bounc\w*|balanc\w*|quick\s*clean|skin\s*power|stress|oil\s*control|control\w*.{0,12}oil|sunblock|uv\s*\+?\s*\d+|nizoral|roihi|tsuboko|clinic|doctor|spots?|gluta\w*|btox|botox)/iu;
const SUPPLEMENT_EXTRA_RISK = /(?:กรดไหลย้อน|อ่อนเพลีย|พลังงาน|เวลเนส|เวิร์ค\s*สมาร์ท|สมดุล|เผาผลาญ|ระบบย่อย|ล[ำํา]ไส้|หัวใจ|ตับ|ไต|สายตา|ดวงตา|เล็บ|ผิว|ผม|แอคทีฟ|ศักยภาพ|energy|wellness|work\s*smart|active|high\s*potency|max\s*strength|metabol\w*|digest\w*|\bgut\b|heart|liver|kidney|eye\s*health|\bskin\b|\bhair\b|\bnails?\b|vitality|well[-\s]?being)/iu;
const CONTROLLED_TITLE_NOISE = /(?:ตะกร้า|ช่องหลัก|บริษัท|แถม|ฟรี(?=\s|!|！|$)|gift(?=\s|\]|\)|$)|มีคอม|ค่าคอม|คอมมิชชั่น|affiliate|รับตรง|เอามาขาย|แน่นอน|ใช้ดี|ราคา|\d+(?:[.,]\d+)?\s*บ(?:าท)?(?=[\s.!?\-–—|]|$)|ซื้อคู่|ถูกกว่า|ป้ายเหลือง|ไลฟ์|มีไลท์|\blive\b|ล[็๊]?อต|\blot\s*\d|\bexp(?:iry)?\.?|หมดอายุ|ผลิตปี|แพ\p{M}*ค\p{M}*เก\p{M}*[จต]\s*ใหม่|มาใหม่|รุ่นใหม่|สูตรใหม่|โปรโมชั่น|โปรโมชัน|พิเศษ|สุดค(?:ุ)?้ม|1\s*\+\s*1|โค้ด|แจก|สินค้าตามภาพ|ของแท้|แท้(?=\s|\[|\]|\)|$)|พรีเมี่ยม|premium|(?:อย\.|อย\s*ไทย)|เก็บ(?:เงิน)?ปลายทาง|ส่งไว|ส่งฟรี|พร้อมส่ง|ป้าย(?:ห้าง|ไทย|คิง)|แบ่งขาย|มีขาย|ขายครบ|ครบสี|ไซส์ทดลอง|\btester\b|\bactive\w*|qr\s*code|โปร(?=\s|สบู่|ซื้อ|ลด|แถม|ราคา|รร))/iu;
const AUTO_UNSUPPORTED_CLAIM = /(?:ไม่เป็นรอย|ไม่ทำให้เกิดรอย|ไม่ทำลายสี|ป้องกันการชน|กันกระแทก\s*100\s*%)/iu;
const BAD_SOURCE_FORMAT = /(?:https?:\/\/|www\.|line\s*id|โทร\.?\s*\d|ทักแชท|ติดต่อร้าน|ก่อนสั่ง|มือ\s*(?:สอง|2)|พรีออเดอร์|pre[-\s]?order|หลุด\s*qc|สินค้ามีตำหนิ|สินค้าสมนาคุณ|สินค้าแถม|ของแถม(?:ห้ามขาย)?|\(สุ่ม\)|not\s+for\s+sale|ลิง[กค]์?\s*ช[ำํา]ระเงิน|ช[ำํา]ระเงิน(?:จาก|ใน)?\s*ไลฟ์|สั่งในไลฟ์|พบกันในไลฟ์|รวมสินค้าในไลฟ์|เฉพาะไลฟ์(?:สด)?|ส[ำํา]หรับไลฟ์สดเท่านั้น|ไลฟ์สดเท่านั้น|เฉพาะ.{0,80}(?:กด)?สั่งพร้อม|ต้อง(?:ซื้อ|สั่ง)พร้อม|แพ\p{M}*[คก]\p{M}*เก\p{M}*[จต]\p{M}*ใหม่|มีคอม|ค่าคอม|คอมมิชชั่น|commission|affiliate|ตะกร้า(?:บริษัท|เจ้าของแบรนด์|หลัก)|ช่องหลักบริษัท|รับท[ำํา]|สั่งท[ำํา]|made\s*to\s*order|เมื่อซื้อครบ|เฉพาะยอดสั่งซื้อ|โปรป้ายยา|ป้ายยาลดแรง|โปรแรง|(?:ลาย|ขนาด)ใหม่|แบ่งขาย|ฟรี(?:สติ๊กเกอร์|สติกเกอร์|กาว|ปกใส|ของแถม)|แท้\s*%|ขายส่ง|สั่งแยก|ออเดอร์ละ|คลังไทย|ส่งเร็ว|ถึงเร็ว|ข้อเสนอผลิตภัณฑ์ใหม่|ยี่ห้อใหม่|สินค้ามี.{0,20}(?:ส่ง|บริการ)|(?<![\p{L}\p{M}])ใหม่(?=[A-Z]))/iu;
const LISTING_PRICE_OR_ORDER_NOISE = /(?:\d[\d,.]*\s*(?:บาท|฿)|(?:^|[\s([\{\-–—])(?:แสดง|เปลี่ยน)?ราคา\s*\d|ลูกค้าใหม่\s*\d|ค่าส่ง|มีปลายทาง|ปลีก\s*[-–—]\s*ส่ง|คละส่ง|จัดส่งแบบสุ่ม|สุ่มสี|^[^\p{L}\p{M}\p{N}]{0,16}คูปอง\s*!)/iu;
// Case-sensitive on purpose: catches glued seller markers such as COD1,
// CODstorage and boxCOD without rejecting Cody/CODE/CODING product names.
const UPPERCASE_COD_NOISE = /COD(?:(?=\d)|(?=[a-z])|(?=[A-Z][a-z])|$|\b)/u;
const PROMO_OR_NOISE = /(?:(?:ใช้|ใส่)?\s*โค้ด(?:ลด)?\s*(?:\d+\s*%\s*(?:max\.?\s*[\d,]+)?|[A-Z0-9]{3,24})?|สั่งในไลฟ์(?:สด)?\s*ลด\s*\d+(?:[.,]\d+)?\s*(?:%|บาท|\.?-)?|ลด\s*\d+(?:[.,]\d+)?\s*(?:%|บาท|\.?-)|\b(?:extra|code)[-_]?[A-Z0-9]*\d+[A-Z0-9]*\b|ช้อปครบ[^\]\[(){}|]{0,35}|รับฟรี|บริษัทโดยตรง|ส่งจากคลัง[^\]\[(){}|]{0,30}|ส่งตรงจากโรงงาน|ขายปลีก\s*-?\s*ส่ง|สินค้าเกรดเอ|ราคา(?:ส่ง|โรงงาน|มหาชน)|โรงงาน|(?<![\p{L}\p{M}])(?:สินค้า)?ใหม่[!！]*(?=[\s.!?]|$)|พร้อมส่ง|ส่งด่วน|ส่งฟรี|เก็บเงินปลายทาง|ราคาพิเศษ|ราคาถูก|ถูกที่สุด|(?<![\p{L}\p{M}])ถูก(?![\p{L}\p{M}])|โปรโมชั่น|โปร(?=\s|[:!！(){}\[\]|\-]|$)|flash\s*sale|hot\s*sale|the\s+best|ต้องลอง|แถมฟรี|แพ็คคู่|1\s*\+\s*1|live\s*\d+\s*%|(?:ซื้อ\s*)?\d+\s*แถม\s*\d+|ของแท้(?:\s*100\s*%)?|ขายดี|ยอดนิยม|อันดับ\s*1|เบอร์\s*1|\bno\.?\s*1\b|สุดคุ้ม|คุณภาพสูง|คุณภาพดี|แข็งแรงทนทาน|หรูหรา|งานสวย|ปั้มครบ|รวมทุกอย่าง)/giu;
const PUBLIC_PROMO_NOISE = /(?:(?:ใช้|ใส่)?\s*โค้ด(?:ลด)?|สั่งในไลฟ์(?:สด)?\s*ลด\s*\d+(?:[.,]\d+)?\s*(?:%|บาท|\.?-)?|ลด\s*\d+(?:[.,]\d+)?\s*(?:%|บาท|\.?-)|\b(?:extra|code)[-_]?[A-Z0-9]*\d+[A-Z0-9]*\b|ส่งตรงจากโรงงาน|ขายปลีก\s*-?\s*ส่ง|ราคา(?:ส่ง|โรงงาน|มหาชน)|flash\s*sale|hot\s*sale|เก็บเงินปลายทาง|พร้อมส่ง|ส่งด่วน|ส่งฟรี)/iu;
const EXTRA_PROMO_OR_NOISE = /(?:\blive\b|เฉพาะไลฟ์(?:สด)?|(?:ล[็๊]?อต|เข้า|สูตร)\s*ใหม่|สินค้า\s*ใหม่|(?:แบบ\s*)?ใหม่ล่าสุด|ล่าสุด|ราคาส่วนลด|ส่วนลด(?:\s*เยอะ)?|ปรับราคา(?:ใหม่)?|ถูกลง|ถูกสุด|คุณภาพ(?:ดี|สูง|เยี่ยม)?|พรีเมี่ยม|premium|\bsale\b|(?:ก้อน|ชิ้น|ขวด|ซอง)?ละ\s*[\d,.]+\s*บาท|ราคา\s*[\d,.]+\s*บ(?:าท)?|[\d,.]+\s*บ(?:าท)?(?=[\s.!?\-–—|]|$)|(?:\bexp(?:iry)?\.?|\bbbf?\b|\bbest\s*before\b|วันหมดอายุ|หมดอายุ)\s*[:.]?\s*(?:\d{1,2}\s*[\/.-]\s*){0,2}\d{2,4}(?:\s*[-–]\s*\d{2,4})?)/giu;
const EXTRA_PUBLIC_PROMO_NOISE = /(?:\blive\b|เฉพาะไลฟ์(?:สด)?|(?:ล[็๊]?อต|เข้า|สูตร)\s*ใหม่|สินค้า\s*ใหม่|(?:แบบ\s*)?ใหม่ล่าสุด|ล่าสุด|ราคาส่วนลด|ส่วนลด(?:\s*เยอะ)?|ปรับราคา(?:ใหม่)?|ถูกลง|ถูกสุด|คุณภาพ(?:ดี|สูง|เยี่ยม)?|พรีเมี่ยม|premium|\bsale\b|(?:ก้อน|ชิ้น|ขวด|ซอง)?ละ\s*[\d,.]+\s*บาท|ราคา\s*[\d,.]+\s*บ(?:าท)?|[\d,.]+\s*บ(?:าท)?(?=[\s.!?\-–—|]|$)|(?:\bexp(?:iry)?\.?|\bbbf?\b|\bbest\s*before\b|วันหมดอายุ|หมดอายุ)\s*[:.]?\s*(?:\d{1,2}\s*[\/.-]\s*){0,2}\d{2,4})/iu;
const SELLER_OR_LISTING_NOISE = /(?:ตะกร้า(?:เจ้าของแบรนด์|บริษัท|หลัก)|ช่องหลักบริษัท|พิเศษ\s*affiliate|affiliate|มีคอม|ค่าคอม|คอมมิชชั่น|ซื้อคู่ถูกกว่า|แถม|ฟรี(?=\s|!|！|$)|ราคาต่อ\s*\d*\s*(?:ชิ้น|ขวด|ก้อน|ซอง)?|ราคาชุด|ส่งไว|เก็บ(?:เงิน)?ปลายทาง|แพ[ค็ก]เก(?:จ|ต)ใหม่|มาใหม่|รุ่นใหม่|ล[็๊]?อต(?:\s*[\d./-]+)?|\blot\.?\s*[\d./-]*|ผลิตปี\s*\d{4}|ป้าย(?:ห้าง|ไทย|คิง)|จาก\s*(?:central|king\s*power|ช็อปนอก)|(?<![\p{L}\p{M}])(?:ของ)?แท้(?:\s*100\s*%?|\s*%)?(?![\p{L}\p{M}])|รับตรง(?:กับ)?[^\]\[(){}|]{0,30}|มีขายครบสี|ขายครบสี|โปร(?=สบู่|ซื้อ|ลด|แถม|ราคา|รร))/giu;
const SELLER_OR_LISTING_PUBLIC_NOISE = /(?:ตะกร้า(?:เจ้าของแบรนด์|บริษัท|หลัก)|ช่องหลักบริษัท|affiliate|มีคอม|ค่าคอม|คอมมิชชั่น|ซื้อคู่ถูกกว่า|แถม|ฟรี(?=\s|!|！|$)|ราคาต่อ\s*\d*\s*(?:ชิ้น|ขวด|ก้อน|ซอง)?|ราคาชุด|ส่งไว|เก็บ(?:เงิน)?ปลายทาง|แพ[ค็ก]เก(?:จ|ต)ใหม่|มาใหม่|รุ่นใหม่|ล[็๊]?อต(?:\s*[\d./-]+)?|\blot\.?\s*[\d./-]*|ผลิตปี\s*\d{4}|ป้าย(?:ห้าง|ไทย|คิง)|จาก\s*(?:central|king\s*power|ช็อปนอก)|(?<![\p{L}\p{M}])(?:ของ)?แท้(?:\s*100\s*%?|\s*%)?(?![\p{L}\p{M}])|มีขายครบสี|ขายครบสี|โปร(?=สบู่|ซื้อ|ลด|แถม|ราคา|รร))/iu;
const NAME_FORBIDDEN = /(?:https?:\/\/|www\.|\bline\b|โทร\.?\s*\d|[<>#*`]|\\|\u0000)/iu;
const SUMMARY_FORBIDDEN = /(?:รักษา|ป้องกันโรค|รับประกันผล|เห็นผลทันที|ลดน้ําหนัก|ลดน้ำหนัก|ผอม|ดีท็อกซ์|detox|ขาวถาวร|ลดสิว|ลดฝ้า|ปลอดภัย\s*100\s*%|ไม่ระคาย|hypoallergenic|clinically|แพทย์|การันตี|commission|ค่าคอม|มีคอม|คอมมิชชั่น|affiliate|เก็บเงินปลายทาง|\bcod\b|รีวิว\s*\d+)/iu;

// Add-on-only, test, defective and "do not order" records are not normal
// retail products. Keep title-only defect detection separate from public-text
// detection: descriptions can legitimately tell buyers to inspect an item for
// defects, and books can discuss how to identify defects in amulets.
const ENGLISH_NON_RETAIL_MARKER = /(?:^|[^\p{L}\p{N}])(?:gwp|free[\s_-]*gifts?|gift[\s_-]*(?:with|w\s*\/)[\s_-]*purchase|not[\s_-]*for[\s_-]*sale)(?=$|[^\p{L}\p{N}])/iu;
const THAI_COMPLIMENTARY_GIFT = /ของ\s*สมนาคุณ/iu;
const THAI_COMPLIMENTARY_ITEM_ORIGIN = /สินค้า\s*(?:ของ)?\s*สมนาคุณ\s*จาก\s*(?:เคาน์เตอร์(?:แบรนด์)?|แบรนด์|ร้าน|บริษัท|ผู้ผลิต)/iu;
const THAI_NOT_FOR_SALE = /งด\s*จำหน่าย/iu;
const THAI_GIVEAWAY_ONLY_ITEM = /(?<![\p{L}\p{M}\p{N}])สินค้า\s*สำหรับ\s*แถม/iu;
const LISTING_ORDER_INSTRUCTION = /(?:(?:กรุณา\s*)?อย่า\s*(?:สั่ง(?:\s*ซื้อ)?|ซื้อ)|ห้าม\s*สั่ง(?:\s*ซื้อ)?|(?:ลูกค้า|กรุณา).{0,24}(?:อย่า|ห้าม)\s*กด|(?:อย่า|ห้าม)\s*กด\s*(?:สั่ง|ซื้อ|ตะกร้า|สินค้า|ออเดอร์|นะ|ค่ะ|คะ|ครับ|เอง))/iu;
const ORDER_MARKER = /(?:ออเดอร์|ออร์เดอร์|(?:คำ|ใบ)\s*สั่ง\s*ซื้อ|orders?)/giu;
const ORDER_LIMIT_MARKER = /(?:ไม่\s*เกิน|ส[ูุ]ง\s*สุด|ขั้นต่ำ|จำกัด(?:\s*ไม่\s*เกิน)?|max(?:imum)?|minimum)/iu;
const SELL_UNIT_SOURCE = String.raw`(?:แพ\p{M}*[คก]\p{M}*|packs?|กล่อง|boxes?|ม้วน|rolls?|ชิ้น|ชื้น|pieces?|ชุด|sets?|เซ[็๊]?ท|ใบ|อัน|ขวด|ถุง|ซอง|คู่|ตัว|ข้าง|กระจก|จุ่ม|ลัง|กระสอบ|ตู้|ห่อ|แผ่น|แผง|ลูก|ถาด|หลอด|ดอก|เม็ด|กระปุก|กระป๋อง|ปี๊บ|กิโลกรัม|กก\.?|หลา|yards?|เมตร|met(?:er|re)s?|ฟุต|feet|items?)`;
const ORDER_QUANTITY_WITH_UNIT = new RegExp(String.raw`\d+(?:[.,]\d+)?\s*${SELL_UNIT_SOURCE}`, 'iu');
const MINIMUM_PURCHASE_QUANTITY = new RegExp(String.raw`(?<!ไม่มี)(?<!ไม่มี\s)ขั้นต่ำ\s*\d+(?:[.,]\d+)?(?:\s*${SELL_UNIT_SOURCE}|\s*[-–—)])`, 'iu');
const DIRECT_PURCHASE_LIMIT = new RegExp(String.raw`(?:กด\s*)?สั่ง(?:\s*ซื้อ)?(?:\s*สินค้า)?(?:\s*ได้)?[^.!?！。\r\n]{0,32}(?:ไม่\s*เกิน|ส[ูุ]ง\s*สุด|ขั้นต่ำ|จำกัด(?:\s*ไม่\s*เกิน)?)[^.!?！。\r\n]{0,24}\d+(?:[.,]\d+)?\s*${SELL_UNIT_SOURCE}`, 'iu');
const ORDER_TOKEN_SOURCE = String.raw`(?:ออเดอร์|ออร์เดอร์|(?:คำ|ใบ)\s*สั่ง\s*ซื้อ|orders?)`;
const EXPLICIT_PER_ORDER_QUANTITY = new RegExp(String.raw`(?:\d+(?:[.,]\d+)?\s*${SELL_UNIT_SOURCE}\s*(?:(?:ต่อ|/)\s*)?(?:\d+\s*)?${ORDER_TOKEN_SOURCE}|(?:\d+\s*)?${ORDER_TOKEN_SOURCE}\s*(?:(?:ต่อ|/)\s*)?\d+(?:[.,]\d+)?\s*${SELL_UNIT_SOURCE})`, 'iu');
const PURCHASE_BATCH_QUANTITY = new RegExp(String.raw`(?:กด\s*)?สั่ง(?:\s*ซื้อ)?(?:\s*สินค้า)?(?:\s*ได้)?(?:\s*(?:ครั้ง|รอบ|ที)ละ|\s*จำนวน)?\s*\d+(?:[.,]\d+)?\s*${SELL_UNIT_SOURCE}`, 'iu');
const SPLIT_SHIPPING_INSTRUCTION = /(?:สั่ง\s*รวม\s*สินค้า(?:ชิ้น)?\s*อื่น\s*(?:ไม่|มิ)\s*ได้|(?:รบกวน\s*)?ไม่\s*สั่ง\s*ร่วม(?:กัน)?\s*(?:กับ)?\s*สินค้า(?:อื่น)?|ไม่\s*สามารถ\s*แพ[็๊]?ก?ค?\s*รวม|ไม่\s*รับ\s*รวม\s*(?:ออเดอร์|ออร์เดอร์|สินค้า)|(?:ต้อง|กรุณา)\s*(?:กด\s*)?(?:สั่ง\s*)?แยก\s*(?:ออเดอร์|ออร์เดอร์|คำ\s*สั่ง\s*ซื้อ)|แยก\s*(?:แพ[็๊]?ก|แพ[็คค]|จัด\s*ส่ง)\s*เท่านั้น)/iu;
const BEFORE_ORDER_INSTRUCTION = /(?:(?:(?:โปรด|กรุณา|รบกวน)\s*อ่าน|อ่าน\s*(?:ใน\s*)?(?:รายละเอียด|ไซ[ซส์]|คำ\s*อธิบาย)|อ่าน(?=\s*ก่อน)|เช(?:็ค|็ด)\s*ขนาด|วัด\s*ขนาด|สอบถาม\s*(?:สต[๊็]?อก|stock))[\s\S]{0,90}?ก่อน(?:\s*(?:การ|ท[ำํา]การ))?\s*(?:(?:กด\s*)?สั่ง(?:\s*(?:ซื้อ|สินค้า))?|ซื้อ))/iu;
const ORDER_CTA_OR_TIMING = /(?:(?:สนใจ\s*)?(?:กด\s*)?สั่ง(?:\s*ซื้อ)?\s*ได้\s*เลย|(?:สนใจ\s*)?(?:กด\s*)?สั่ง(?:\s*ซื้อ)?\s*(?:ใน|ผ่าน)\s*ระบบ|(?:กด\s*)?สั่ง(?:\s*ซื้อ)?\s*ได้\s*ไม่\s*จำกัด|สั่ง(?:\s*ซื้อ)?\s*ก่อน.{0,36}(?:จัด\s*ส่ง|ส่ง\s*(?:ภายใน|วัน)))/iu;
const ADD_ON_OR_LIVE_ONLY_LISTING = /(?:เฉพาะ\s*ลูกค้า.{0,80}สั่ง\s*สินค้า.{0,80}สามารถ\s*สั่ง\s*ซื้อ|รวม\s*เฉพาะ\s*กับ\s*การ\s*ซื้อ.{0,100}(?:ไม่\s*(?:ได้)?\s*จัด\s*ส่ง|ผ่าน\s*ลิง[กค]์)|สั่ง\s*ซื้อ\s*สินค้า\s*จาก\s*ไลฟ์\s*สด|ไม่\s*ขาย.{0,24}แยก(?:\s*ชิ้น)?.{0,90}(?:เฉพาะ\s*ลูกค้า.{0,48}สั่ง|ซื้อ\s*พร้อม\s*สินค้า\s*ใน\s*ร้าน)|สำหรับ\s*ผู้\s*ที่\s*ซื้อ.{0,80}(?:ไม่\s*ได้|ไม่)\s*ขาย\s*แยก|ไม่\s*ขาย\s*(?:ถุง|กล่อง|แพ[ค็ก]เกจ|บรรจุภัณฑ์)\s*แยก)/iu;
const ABUSIVE_SELLER_COPY = /(?:ไม่\s*รับ\s*ของ.{0,48}(?:ขอ\s*ให้|แช่ง|ไม่มี\s*ใคร\s*รัก))/iu;
const PROMOTIONAL_OFFER_LISTING = /(?:special\s*promotion|(?:^|[\[({])\s*(?:ฟรี|free)\s*(?=$|[\])}:;!！])|(?:buy|ซื้อ)\s*\d+\s*(?:get|แถม(?:\s*ฟรี)?)\s*\d+(?:\s*free)?|ซื้อ\s*\d+\s+\d+(?=\s+\p{L})|(?:get\s*)?\d+\s*free\s*\d+|(?:^|[\[({【])\s*order\s*get\s*\d+\s*gifts?(?=$|[\s\])}】:;!！|])|mystery\s*gift)/iu;
const PREORDER_MARKER = /(?:\bpre\s*(?:-\s*)?orders?\b|พรี\s*อ(?:อ|อร์)?เดอร์)/iu;
const SOURCE_DESCRIPTION_CONTACT = /(?:(?:ติดต่อ|ทัก).{0,32}(?:line|ไลน์)\s*(?::|id|@)|(?:line|ไลน์)\s*(?:id\s*)?[:@]\s*[\p{L}\p{N}_.@-]+|(?:ติดต่อ|สอบถาม).{0,36}(?:โทร(?:ศัพท์)?\s*)?0\d[\d\s-]{7,12})/iu;
const LIVE_ONLY_PUBLIC_LISTING = /(?:(?:ลิง[กค]์?|ลิ[้๊]ง(?:ก์|ค์)?)\s*ช[ำํา]ระ\s*เงิน[^.!?]{0,20}ไลฟ์\s*สด|(?:^|[\[({【|/])\s*(?:ลิง[กค]์?|ลิ[้๊]ง(?:ก์|ค์)?)\s*(?:สำหรับ\s*)?ไลฟ์\s*สด|(?:^|[\[({【|/])\s*(?:ตะ|ตระ)กร้า\s*\d+(?:[.,]\d+)?\s*(?:บาท|฿)?\s*(?:สำหรับ|ใน)\s*ไลฟ์\s*สด|กด\s*ใน\s*ไลฟ์\s*สด|(?:^|[\[({【|/])\s*เก็บ\s*ใน\s*ไลฟ์\s*สด(?=$|[\s)\]}】|/]))/iu;
const PAYMENT_LINK_LISTING = /(?:ลิง[กค]์?|ลิ[้๊]ง(?:ก์|ค์)?)\s*(?:สำหรับ\s*)?ช[ำํา]ระ\s*เงิน/iu;
const INVOICE_DOCUMENT_SOURCE = String.raw`(?:ใบ\s*เสร็จ(?:\s*รับ\s*เงิน)?|บิล(?:\s*เบิก)?|ใบ\s*กำกับ\s*ภาษี)`;
const BOUNDED_INVOICE_DOCUMENT_SOURCE = String.raw`(?<![\p{L}\p{M}])${INVOICE_DOCUMENT_SOURCE}`;
const INVOICE_ORDER_INSTRUCTION = new RegExp(String.raw`(?:(?<![\p{L}\p{M}])ออก\s*${INVOICE_DOCUMENT_SOURCE}[^.!?]{0,40}(?:แจ้ง|ระบุ|แนบ)[^.!?]{0,40}${ORDER_TOKEN_SOURCE}|(?<![\p{L}\p{M}])(?:มี\s*${INVOICE_DOCUMENT_SOURCE}|(?:ใส่|ออก)[^.!?]{0,12}${INVOICE_DOCUMENT_SOURCE})[^.!?]{0,32}${ORDER_TOKEN_SOURCE}|${BOUNDED_INVOICE_DOCUMENT_SOURCE}[^.!?]{0,24}(?:ให้\s*)?ทุก\s*${ORDER_TOKEN_SOURCE})`, 'iu');
const INVOICE_ACTION_SOURCE = String.raw`(?:ทัก|(?<![\p{L}\p{M}])แจ้ง(?!\s*หนี้)|ระบุ|พิมพ์|หมาย\s*เหตุ|ข้อความ|แชท)`;
const INVOICE_CONTACT_INSTRUCTION = new RegExp(String.raw`(?:(?<![\p{L}\p{M}])(?:รับ|ขอ|ต้องการ)\s*${INVOICE_DOCUMENT_SOURCE}[^!?]{0,48}(?:รบกวน|กรุณา)?\s*${INVOICE_ACTION_SOURCE}|(?<![\p{L}\p{M}])ออก\s*${INVOICE_DOCUMENT_SOURCE}[^!?]{0,36}(?:ทัก|(?<![\p{L}\p{M}])แจ้ง(?!\s*หนี้)|หมาย\s*เหตุ|ข้อความ|แชท)|${BOUNDED_INVOICE_DOCUMENT_SOURCE}(?:\s*(?:รบกวน|กรุณา)[^!?]{0,16}${INVOICE_ACTION_SOURCE}|\s*หมาย\s*เหตุ)|(?<![\p{L}\p{M}])(?:ทัก|แจ้ง|หมาย\s*เหตุ)[^!?]{0,16}(?:รับ|ขอ|ต้องการ)\s*${INVOICE_DOCUMENT_SOURCE})`, 'iu');
const SELLER_CHAT_INSTRUCTION = /(?:(?:แจ้ง|ระบุ|บอก)\s*(?:สี|ไซ[ซส์]|รุ่น|แบบ|ลาย|ชื่อ|เบอร์|ขนาด|ข้อความ|รายละเอียด|ข้อมูล|เลข|วัน)?[^.!?]{0,24}(?:ใน|ทาง)?\s*(?:ช่อง)?แชท|ส่ง\s*(?:รูป|ไฟล์|แบบ|ลาย|ชื่อ|ข้อมูล)[^.!?]{0,20}(?:ใน|ทาง)?\s*(?:ช่อง)?แชท)/iu;
const CONFIGURATION_BEFORE_ORDER = /(?:(?:แจ้ง|ระบุ|บอก)\s*(?:รุ่น(?:\s*มือถือ)?|สี|ไซ[ซส์]|แบบ|ลาย|ขนาด)[^.!?]{0,40}ก่อน(?:\s*(?:การ|ทำ\s*การ))?\s*(?:กด\s*)?สั่ง(?:\s*ซื้อ)?)/iu;
const ORDER_ACCEPTANCE_PRESSURE = /(?:สั่ง.{0,16}กรุณา\s*รับ\s*ของ|สั่ง\s*แล้ว.{0,28}(?:กรุณา\s*)?รับ\s*ของ)/iu;
const SELLER_RETURN_OR_UNBOXING_INSTRUCTION = /(?:(?:กรณี\s*)?สินค้า[^!?]{0,64}(?:ชำรุด|เสียหาย)[^!?]{0,64}(?:ไม่\s*ครบ|ผิด\s*(?:สี|ขนาด))|(?:กล่อง|บรรจุภัณฑ์)[^!?]{0,48}(?:แตก|ขาด|ชำรุด)[^!?]{0,40}(?:ไม่\s*ต้อง|ปฏิเสธ)\s*รับ\s*สินค้า|(?:หลัง\s*จาก|เมื่อ)\s*ได้\s*รับ\s*สินค้า(?:\s*แล้ว)?[^!?]{0,64}ถ่าย\s*วิดีโอ[^!?]{0,40}(?:แกะ|เปิด)\s*กล่อง|ไม่\s*รับ\s*เปลี่ยน\s*คืน|ใส่\s*ไม่\s*ได้[^!?]{0,16}คืน\s*สินค้า|ทัก\s*ร้าน[^!?]{0,20}แจ้ง\s*ขนาด)/iu;
const ORDER_INTAKE_WINDOW = /(?:รับ\s*ออเดอร์\s*วันนี้\s*[-–—]\s*\d{1,2}|(?:กด\s*)?สั่ง(?:\s*ซื้อ)?(?:\s*ได้)?\s*ตั้งแต่\s*\d+(?:[.,]\d+)?\s*(?:[-–—]|ถึง)\s*\d+(?:[.,]\d+)?\s*(?:ใบ|ชิ้น|ชุด|แพ[ค็ก]|กล่อง|ถุง|ซอง|อัน|ตัว))/iu;
const GENERIC_LISTING_LINK_MARKER = /(?:(?:^|[\[({【|/])\s*(?:links?|ลิง[กค]์?|ลิ[้๊]ง(?:ก์|ค์)?)\s*\d+|(?:links?|ลิง[กค]์?|ลิ[้๊]ง(?:ก์|ค์)?)(?:\s*รวม|\s*สำหรับ\s*ลูกค้า|\s*มี|\s*\d+\s*\/\s*\d+)|(?:คลิก|ต่อ).{0,24}(?:links?|ลิง[กค]์?|ลิ[้๊]ง(?:ก์|ค์)?))/iu;
const STRAY_TERMINAL_LINK = /(?:^|[\s:|])(?:ลิง[กค]์?|ลิ[้๊]ง(?:ก์|ค์)?)(?=$|[\s.!?！。)\]}】])/iu;
const GLUED_FREE_PROMO = /(?<![\p{L}\p{M}])ฟรี(?=[\p{L}\p{M}\p{N}])/iu;
const THAI_FREE_GIFT_PROMO = /(?:แ|เ\s*เ)ถม\s*ฟรี/iu;
const CUSTOMIZATION_FREE_OFFER = /(?:การ\s*)?ปรับ\s*แต่ง(?:\s*(?:โลโก้|ชื่อ|ข้อความ))?\s*ฟรี/iu;
const SUPERLATIVE_PRICE_PROMO = /(?:ถูก\s*กว่า\s*นี้\s*ไม่มี(?:อีก\s*แล้ว)?)/iu;
const CASH_ON_DELIVERY_MARKER = /(?:ช[ำํา]ระ\s*เงิน\s*ปลาย\s*ทาง|cash\s*on\s*delivery|\bcod\b)/iu;
const DEFECTIVE_PUBLIC_COPY = /(?:ผลิต(?:ภัณฑ์)?\s*จำนวน\s*มาก.{0,64}(?:อาจ\s*)?มี\s*ตำหนิ|อาจ\s*มี\s*ตำหนิ|ไม่\s*รับ\s*เคลม(?:\s*ทุก\s*กรณี)?)/iu;
const ACTUAL_DEFECTIVE_PRODUCT_COPY = /(?:ริบบิ้น|ผ้า|ม้วน|สินค้า|งาน|ของ)(?:(?!รับ\s*ประกัน)[^!?]){0,40}ตำหนิ\s*จาก\s*การ\s*ผลิต(?:\s*จาก\s*โรงงาน)?/iu;
const USED_ITEMS_PLACEHOLDER = /(?:สินค้า\s*มือ(?=\s|✌|สอง|2)(?:\s*(?:✌(?:️|\uFE0F)?|สอง|2))?.{0,120}(?:ครอป|เดรส).{0,120}(?:กระเป๋า|รองเท้า))/iu;
const BARE_CLICK_INSTRUCTION_TITLE = /(?:อย่า|ห้าม)\s*กด(?!\s*(?:ปุ่ม|สวิตช์|รีโมต|รีโมท))/iu;
const BODY_SHAMING_LANGUAGE = /เด็ก\s*อ้วน/iu;
const BODY_SIZE_REDUCTION_CLAIM = /(?:ช่วย\s*)?ให้\s*(?:ต้น\s*ขา|ขา|เอว|หน้า\s*ท้อง)[^.!?]{0,18}ดู\s*เล็ก\s*ลง/iu;
const ADULT_BODY_SHAMING_CLAIM = /(?:คน\s*อ้วน[^.!?]{0,120}(?:ช่วย\s*)?ให้\s*(?:ต้น\s*ขา|ขา|เอว|หน้า\s*ท้อง)[^.!?]{0,18}ดู\s*เล็ก\s*ลง|(?:ช่วย\s*)?ให้\s*(?:ต้น\s*ขา|ขา|เอว|หน้า\s*ท้อง)[^.!?]{0,18}ดู\s*เล็ก\s*ลง[^.!?]{0,120}คน\s*อ้วน)/iu;
const CHILD_BODY_SHAMING_CLAIM = /(?:(?:เด็ก|ลูก\s*ของ\s*คุณ)[^!?]{0,35}(?:อวบ[^!?]{0,10})?อ้วน|(?:อวบ[^!?]{0,10})?อ้วน[^!?]{0,35}(?:เด็ก|ทารก))/iu;
const DEROGATORY_OR_OUTCOME_BODY_COPY = /(?:พุง\s*หมา(?:\s*น้อย)?|หุ่น\s*พัง|ตัว\s*ใหญ่\s*ยักษ์|อ้วน\s*แค่\s*ไหน|ไม่\s*ลง\s*พุง|(?:ขา|พุง|หน้า\s*ท้อง)[^!?]{0,25}(?:เรียว\s*เล็ก\s*ลง|ยุบ|แบน\s*เรียบ)|เปลี่ยน[^!?]{0,24}หุ่น\s*พัง[^!?]{0,24}หุ่น\s*ปัง)/iu;
const CARTOON_ANIMAL_BODY_NEAR_MISS = /(?:ลาย[^!?]{0,20}(?:เสือ|หมี|แมว|หมู|สัตว์)[^!?]{0,12}อ้วน|ลาย\s*เสื้อ\s*อ้วน|(?:ลาย|รูปแบบ)[^!?]{0,32}เด็ก(?:\s*ผู้หญิง|\s*ผู้ชาย)?[^!?]{0,12}อ้วน|น่ารัก\s*อ้วน\s*เด็ก[^!?]{0,24}รูปแบบ|ตาข่าย\s*อ้วน\s*เสื้อ)/giu;
const WEIGHT_TOKEN_SOURCE = String.raw`น\s*[้๊๋่]?\s*ำ\s*หนัก`;
const SELLER_INPUT_VERB_SOURCE = String.raw`(?:(?:กรุณา|รบกวน|ไซ(?:ซ|ส)์?|ขนาด)\s*(?:บอก|แจ้ง|ส่ง)|(?<![\p{L}\p{M}])(?:บอก|แจ้ง|ส่ง))`;
const SELLER_MEASUREMENT_INSTRUCTION = new RegExp(String.raw`${SELLER_INPUT_VERB_SOURCE}[^.!?]{0,72}(?:ส่วน\s*สูง[^.!?]{0,48}${WEIGHT_TOKEN_SOURCE}|${WEIGHT_TOKEN_SOURCE}[^.!?]{0,48}ส่วน\s*สูง)`, 'iu');
const USED_OR_SECONDHAND_LISTING = /(?:สินค้า(?:เป็น\s*สินค้า)?\s*มือ\s*(?:สอง|2)|การ์ด[^.!?]{0,48}ตี\s*เป็น(?:\s*การ์ด)?\s*มือ\s*(?:สอง|2)|มือ\s*1\s*[-–—/]\s*2)/iu;
const ALLOWED_SECONDHAND_CONTEXT = /(?:(?:หาก|กรณี)[^!?]{0,20}สินค้า(?:เป็น\s*สินค้า)?\s*มือ\s*(?:สอง|2)[^!?]{0,96}(?:การ\s*)?รับ\s*ประกัน[^!?]{0,48}(?:สิ้น\s*สุด|หมด|ไม่\s*ครอบ\s*คลุม)|ไม่\s*(?:มี|ใช่|ได้\s*เป็น|ส่ง)[^!?]{0,96}สินค้า(?:เป็น\s*สินค้า)?\s*มือ\s*(?:สอง|2)|(?:แยก\s*ความ\s*แตก\s*ต่าง\s*(?:กับ|จาก)|แตก\s*ต่าง\s*จาก)[^!?]{0,48}สินค้า(?:เป็น\s*สินค้า)?\s*มือ\s*(?:สอง|2)|(?:การ\s*)?รับ\s*ประกัน[^!?]{0,180}(?:ไม่\s*ครอบ\s*คลุม|ยก\s*เว้น)[^!?]{0,180}สินค้า(?:เป็น\s*สินค้า)?\s*มือ\s*(?:สอง|2))/giu;
const INVOICE_PAPER_PRODUCT = /(?:กระดาษ|สมุด|แบบ\s*ฟอร์ม)[^!?]{0,96}(?:ใบ\s*กำกับ\s*ภาษี|ใบ\s*เสร็จ(?:\s*รับ\s*เงิน)?|บิล)/iu;
const BEAUTY_STORAGE_IDENTITY = /(?:กระเป๋า|กล่อง|เคส)[^!?]{0,96}(?:เครื่อง\s*สำอาง|แต่ง\s*หน้า)/iu;
const POWERED_STORAGE_MARKER = /(?:ไฟ\s*led|กระจก\s*led|แบต(?:เตอรี่)?|ชาร์จ(?:ใหม่)?|type\s*-?\s*c)/iu;
const STALE_2022_DATE_SOURCE = String.raw`(?:(?:0?[1-9]|[12]\d|3[01])\s*[/.-]\s*)?(?:0?[1-9]|1[0-2])\s*[/.-]\s*2022`;
const COSMETICS_SEMANTIC_MISMATCH = new RegExp(String.raw`(?:(?:กระเป๋า\s*ใส่\s*ลิป|lipstick\s*case)[^!?]{0,80}(?:เฉพาะ\s*เคส|ไม่\s*รวม\s*ลิป)|\bdetangling\b[^!?]{0,80}\bbrush\b|เหลือ\s*สี\s*ที่\s*เทส|(?:beauty|concealer|คอนซีลเลอร์|ลิป)[^!?]{0,96}เทส\s*เตอร์|(?:ผลิต|mfg\.?)\s*${STALE_2022_DATE_SOURCE}[^!?]{0,120}(?:lip(?:stick)?|ลิป|eyeshadow|อาย\s*แชโดว์)|(?:lip(?:stick)?|ลิป|eyeshadow|อาย\s*แชโดว์)[^!?]{0,120}(?:ผลิต|mfg\.?)\s*${STALE_2022_DATE_SOURCE}|hair(?:care)?\s*mascara|แฮร์\s*มาสคาร่า|มาสคาร่า\s*เก็บ\s*ไร\s*ผม|มาสคาร่า[^!?]{0,48}(?:ปกปิด\s*)?ผม\s*ขาว|ปกปิด\s*ผม\s*ขาว[^!?]{0,48}มาสคาร่า|brush\s*cleanser|สบู่\s*ล้าง\s*แปรง(?:\s*แต่ง\s*หน้า)?|(?:ชิมเมอร์|ไฮไลท์|ผง\s*วิ้ง)[^!?]{0,56}(?:ตก\s*แต่ง|ทา)\s*เล็บ|(?:primer|ไพรเมอร์)[^!?]{0,80}ทา\s*ตัว|ทา\s*ตัว[^!?]{0,80}(?:primer|ไพรเมอร์))`, 'iu');
const DEFECTIVE_LISTING_TITLE = /(?:(?:สินค้า|งาน|ของ)\s*(?:มี\s*)?ตำหนิ|(?:มี|พบ|เซลล์|เซล|พร้อม)\s*ตำหนิ|(?:ผ้าห่ม|งาน\s*ตีกลับ)\s*ตำหนิ|ตำหนิ\s*(?:เล็กน้อย|นิดหน่อย|เบา)|(?:^|[\[({/|])\s*ตำหนิ(?=$|[\s!！:;,.\])}/|])|\bdefective\b|\b(?:tiny|minor|small|slight|cosmetic|factory)\s+defects?\b|\bdefects?\s+(?:tiny|minor|small|slight|sale|sales|item|items|product|products|stock|packaging)\b|(?:^|[\[({/|])\s*defects?\s*(?=$|[\])}/|]))/iu;
const NONINFORMATIVE_REPEATED_SPOT = /^(?:สปอต\s*){3,}(?:#?\s*hairdressing)?$/iu;
const BRACKETED_PUBLIC_NAME_SEGMENT = /(?:\[[^\]]*\]|\([^)]*\)|【[^】]*】|\{[^}]*\})/gu;

function canonicalPolicyText(value) {
  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
  return sanitizeText(value).normalize('NFC')
    .replace(/[๐-๙]/gu, (digit) => String(thaiDigits.indexOf(digit)))
    .replace(/\u0E4D\u0E32/gu, '\u0E33')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function hasUsedOrSecondhandListing(text) {
  return USED_OR_SECONDHAND_LISTING.test(text.replace(ALLOWED_SECONDHAND_CONTEXT, ' '));
}

function hasPoweredBeautyStorage(text) {
  return BEAUTY_STORAGE_IDENTITY.test(text) && POWERED_STORAGE_MARKER.test(text);
}

function hasBodyPolicyRisk(text) {
  const withoutAnimalMotifs = text.replace(CARTOON_ANIMAL_BODY_NEAR_MISS, ' ');
  return BODY_SHAMING_LANGUAGE.test(withoutAnimalMotifs) ||
    CHILD_BODY_SHAMING_CLAIM.test(withoutAnimalMotifs) ||
    ADULT_BODY_SHAMING_CLAIM.test(withoutAnimalMotifs) ||
    BODY_SIZE_REDUCTION_CLAIM.test(withoutAnimalMotifs) ||
    DEROGATORY_OR_OUTCOME_BODY_COPY.test(withoutAnimalMotifs);
}

function hasNonRetailCanonicalText(text) {
  return ENGLISH_NON_RETAIL_MARKER.test(text) || THAI_COMPLIMENTARY_ITEM_ORIGIN.test(text) || THAI_GIVEAWAY_ONLY_ITEM.test(text) ||
    LISTING_ORDER_INSTRUCTION.test(text) || hasMaxOrderInstruction(text) || DIRECT_PURCHASE_LIMIT.test(text) ||
    EXPLICIT_PER_ORDER_QUANTITY.test(text) || PURCHASE_BATCH_QUANTITY.test(text) || SPLIT_SHIPPING_INSTRUCTION.test(text) ||
    BEFORE_ORDER_INSTRUCTION.test(text) || ORDER_CTA_OR_TIMING.test(text) || ADD_ON_OR_LIVE_ONLY_LISTING.test(text) ||
    ABUSIVE_SELLER_COPY.test(text) || PROMOTIONAL_OFFER_LISTING.test(text) || PREORDER_MARKER.test(text) ||
    LIVE_ONLY_PUBLIC_LISTING.test(text) || PAYMENT_LINK_LISTING.test(text) || INVOICE_ORDER_INSTRUCTION.test(text) ||
    INVOICE_CONTACT_INSTRUCTION.test(text) || SELLER_CHAT_INSTRUCTION.test(text) || CONFIGURATION_BEFORE_ORDER.test(text) ||
    ORDER_INTAKE_WINDOW.test(text) || MINIMUM_PURCHASE_QUANTITY.test(text) || GENERIC_LISTING_LINK_MARKER.test(text) ||
    STRAY_TERMINAL_LINK.test(text) || GLUED_FREE_PROMO.test(text) || THAI_FREE_GIFT_PROMO.test(text) ||
    CUSTOMIZATION_FREE_OFFER.test(text) || SUPERLATIVE_PRICE_PROMO.test(text) ||
    CASH_ON_DELIVERY_MARKER.test(text) || DEFECTIVE_PUBLIC_COPY.test(text) || ACTUAL_DEFECTIVE_PRODUCT_COPY.test(text) ||
    USED_ITEMS_PLACEHOLDER.test(text) || hasPoweredBeautyStorage(text) || COSMETICS_SEMANTIC_MISMATCH.test(text) ||
    ORDER_ACCEPTANCE_PRESSURE.test(text) || SELLER_RETURN_OR_UNBOXING_INSTRUCTION.test(text) ||
    SOURCE_DESCRIPTION_CONTACT.test(text) ||
    hasBodyPolicyRisk(text) || SELLER_MEASUREMENT_INSTRUCTION.test(text) ||
    DEFECTIVE_PUBLIC_COPY.test(text) || ACTUAL_DEFECTIVE_PRODUCT_COPY.test(text) || USED_ITEMS_PLACEHOLDER.test(text) ||
    (THAI_COMPLIMENTARY_GIFT.test(text) &&
      (THAI_NOT_FOR_SALE.test(text) || BARE_CLICK_INSTRUCTION_TITLE.test(text)));
}

function hasSevereSourceDescriptionPolicyRisk(text, title) {
  // Description copy is much noisier than the product identity. Keep true
  // non-retail status, do-not-order, add-on/live-only, abusive, and body-risk
  // signals as source-level blockers. Ordinary seller CTA, order-cap, and
  // before-order prose may remain in the private source only; cleanName and
  // summary are independently checked with the complete public policy below.
  return ENGLISH_NON_RETAIL_MARKER.test(text) || THAI_COMPLIMENTARY_ITEM_ORIGIN.test(text) ||
    THAI_GIVEAWAY_ONLY_ITEM.test(text) || LISTING_ORDER_INSTRUCTION.test(text) ||
    (SOURCE_DESCRIPTION_CONTACT.test(text) || PREORDER_MARKER.test(text)) || SPLIT_SHIPPING_INSTRUCTION.test(text) ||
    ADD_ON_OR_LIVE_ONLY_LISTING.test(text) || ABUSIVE_SELLER_COPY.test(text) ||
    PAYMENT_LINK_LISTING.test(text) ||
    (!INVOICE_PAPER_PRODUCT.test(title) && (INVOICE_ORDER_INSTRUCTION.test(text) || INVOICE_CONTACT_INSTRUCTION.test(text))) ||
    THAI_FREE_GIFT_PROMO.test(text) || CUSTOMIZATION_FREE_OFFER.test(text) ||
    SELLER_RETURN_OR_UNBOXING_INSTRUCTION.test(text) ||
    hasBodyPolicyRisk(text) || SELLER_MEASUREMENT_INSTRUCTION.test(text) ||
    hasUsedOrSecondhandListing(text) || hasPoweredBeautyStorage(text) || COSMETICS_SEMANTIC_MISMATCH.test(text) ||
    DEFECTIVE_PUBLIC_COPY.test(text) || ACTUAL_DEFECTIVE_PRODUCT_COPY.test(text) || USED_ITEMS_PLACEHOLDER.test(text) ||
    (THAI_COMPLIMENTARY_GIFT.test(text) &&
      (THAI_NOT_FOR_SALE.test(text) || BARE_CLICK_INSTRUCTION_TITLE.test(text)));
}

function hasMaxOrderInstruction(text) {
  // Seller limit syntax appears in several orders (for example
  // "1ออเดอร์ไม่เกิน2แพ็ค" and "สั่งได้สูงสุดต่อออเดอร์ 2 เซ็ท").
  // Anchor on an order token, then require a limit plus a numeric sell unit in
  // a bounded local window so ordinary package quantities remain eligible.
  for (const match of text.matchAll(ORDER_MARKER)) {
    const window = text.slice(Math.max(0, match.index - 72), Math.min(text.length, match.index + match[0].length + 96));
    if (ORDER_LIMIT_MARKER.test(window) && ORDER_QUANTITY_WITH_UNIT.test(window)) return true;
  }
  return false;
}

export function hasNonRetailListingMarker(value) {
  return hasNonRetailCanonicalText(canonicalPolicyText(value));
}

export function hasDefectiveListingTitle(value) {
  return DEFECTIVE_LISTING_TITLE.test(canonicalPolicyText(value));
}

export function hasSourceListingPolicyRisk(rawTitle, description = '') {
  const title = canonicalPolicyText(rawTitle);
  // Listing-policy instructions normally occur near the beginning. Capping the
  // description keeps this hard gate inexpensive across the million-row feed.
  const descriptionStart = canonicalPolicyText(String(description ?? '').slice(0, 1_800));
  const sourceStart = `${title} ${descriptionStart}`.trim();
  return hasNonRetailCanonicalText(title) || hasSevereSourceDescriptionPolicyRisk(sourceStart, title) || DEFECTIVE_LISTING_TITLE.test(title) ||
    BARE_CLICK_INSTRUCTION_TITLE.test(title) || hasBodyShamingAnywhere(description);
}

function hasBodyShamingAnywhere(value) {
  const raw = String(value ?? '');
  // The million-row source contains some very long descriptions. Avoid a full
  // normalization pass for ordinary rows, but scan the complete description
  // whenever both relevant Thai tokens are present so late seller copy cannot
  // bypass the 1,800-character general policy window.
  if (!/(?:อ้วน|พุง|หุ่น|เรียว|แบน)/u.test(raw)) return false;
  const text = canonicalPolicyText(raw);
  return hasBodyPolicyRisk(text);
}

export function isNonInformativePublicName(value) {
  const canonical = canonicalPolicyText(value);
  if (NONINFORMATIVE_REPEATED_SPOT.test(canonical)) return true;
  const outsideWrappers = canonical
    .replace(BRACKETED_PUBLIC_NAME_SEGMENT, ' ')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '')
    .trim();
  return outsideWrappers.length === 0;
}

export const SOURCE_POLICY_V5_GOLDEN_FIXTURES = Object.freeze({
  blocked: Object.freeze([
    Object.freeze({ name: 'bounded GWP marker', title: '(GWP) GIFT WITH PURCHASE / DEFECT / NO PACKAGING' }),
    Object.freeze({ name: 'free gift marker', title: '[FREE GIFT] SKINTIFIC Makeup Bag' }),
    Object.freeze({ name: 'not for sale marker', title: 'Display pouch - NOT FOR SALE' }),
    Object.freeze({ name: 'Thai complimentary gift not for sale', title: '(ของสมนาคุณ งดจําหน่าย) Mini Tote Bag' }),
    Object.freeze({ name: 'Thai complimentary gift do not click', title: 'ของสมนาคุณ ลูกค้าอย่ากดนะคะ' }),
    Object.freeze({ name: 'Thai complimentary item from brand counter', title: 'PF-13 Passport Holderสินค้าของสมนาคุณจากเคาน์เตอร์แบรนด์' }),
    Object.freeze({ name: 'Thai giveaway-only item with conditions', title: '(สินค้าสำหรับแถม ตามเงื่อนไขเท่านั้น งดจำหน่าย) กระเป๋าใบเล็ก' }),
    Object.freeze({ name: 'Thai giveaway-only item', title: '[งดจำหน่าย สินค้าสำหรับแถมโดยเฉพาะ] ของแถมประจำร้าน' }),
    Object.freeze({ name: 'tiny defect title', title: 'TINY DEFECT กระเป๋าผ้า' }),
    Object.freeze({ name: 'reversed tiny defect title', title: 'Defect Tiny stars phone case' }),
    Object.freeze({ name: 'defect sales title', title: 'DEFECT SALES เสื้อยืด' }),
    Object.freeze({ name: 'Thai defective product title', title: 'สินค้ามีตําหนิ กระเป๋า' }),
    Object.freeze({ name: 'Thai defective work title', title: 'งานตำหนิ เสื้อเชิ้ต' }),
    Object.freeze({ name: 'Thai slight defect title', title: 'แก้วเซรามิก ตำหนิเล็กน้อย' }),
    Object.freeze({ name: 'Thai returned defective blanket title', title: 'ผ้าห่มตําหนิ ผ้าห่มนวม งานตีกลับตําหนิสภาพดี' }),
    Object.freeze({ name: 'Thai leading defect title', title: 'ตําหนิ!! กางเกงขายาว กางเกงเลกกิ้งเด็ก' }),
    Object.freeze({ name: 'Thai included defect title', title: 'กระถางต้นไม้เซรามิค พร้อมตําหนิ สําหรับตกแต่งบ้าน' }),
    Object.freeze({ name: 'seller do not order instruction', title: 'เสื้อเด็ก', description: 'กรุณาอย่าสั่งซื้อด้วยตัวเอง ให้ทักร้านก่อน' }),
    Object.freeze({ name: 'body shaming and seller measurement instruction', title: 'ชุดเด็ก', description: 'เด็กอ้วนกรุณาอย่าสั่งซื้อด้วยตัวเอง บอกส่วนสูงและน้ำหนักของเด็ก' }),
    Object.freeze({ name: 'seller order cap after order marker', title: 'ขนมขบเคี้ยว 1ออเดอร์ไม่เกิน2แพ็ค' }),
    Object.freeze({ name: 'seller order cap before order marker', title: 'สติกเกอร์ กดสั่งสูงสุด 2 ม้วน ต่อ 1 ออเดอร์' }),
    Object.freeze({ name: 'seller slash order cap', title: 'อาหารกระป๋อง สั่งไม่เกิน 2 กล่อง/ออร์เดอร์' }),
    Object.freeze({ name: 'seller reordered order cap', title: 'สินค้าแฟชั่น สั่งได้สูงสุดต่อออเดอร์ 2 เซ็ท' }),
    Object.freeze({ name: 'seller slash before limit', title: 'โปสการ์ด 1 ออเดอร์/ สูงสุด 2 ใบ' }),
    Object.freeze({ name: 'seller explicit limited order cap', title: 'ถุงซิป 1ออเดอร์จำกัดไม่เกิน100ใบ' }),
    Object.freeze({ name: 'seller direct purchase cap', title: 'อาหารสัตว์ สั่งซื้อไม่เกิน 2 ถุง' }),
    Object.freeze({ name: 'seller per-purchase cap without order token', title: 'กระดาษ สั่งได้ไม่เกิน 10 แพค/ครั้ง' }),
    Object.freeze({ name: 'seller carton cap', title: 'สินค้ายกลัง สั่งสูงสุด 3 ลัง / 1 ออเดอร์เท่านั้น' }),
    Object.freeze({ name: 'seller one piece per order', title: '[1 ชิ้น ต่อ 1 ออเดอร์]' }),
    Object.freeze({ name: 'seller one roll per order', title: 'กดสั่ง 1 ม้วน ต่อ 1 ออเดอร์เท่านั้น' }),
    Object.freeze({ name: 'seller reverse one item per order', title: '1ออเดอร์ต่อ1ตัว' }),
    Object.freeze({ name: 'seller slash one pack per order', title: '1 ออเดอร์/1แพ็ก' }),
    Object.freeze({ name: 'seller one sheet per order', title: 'สั่งได้ 1 ใบ ต่อ 1 ออเดอร์เท่านั้น' }),
    Object.freeze({ name: 'seller order before compact box quantity', title: 'กดสั่งได้ครั้งล่ะ 1 ออเดอร์ 50ชิ้น/1กล่อง' }),
    Object.freeze({ name: 'seller compact carton per order', title: 'ขนม 20ห่อ/ลัง (1ลัง1ออเดอร์)' }),
    Object.freeze({ name: 'seller pack per purchase order', title: '(กด 1 แพ็ค ต่อ 1 คำสั่งซื้อ)' }),
    Object.freeze({ name: 'seller sack per purchase order', title: '(1กระสอบต่อ1คำสั่งซื้อ)' }),
    Object.freeze({ name: 'seller per-round panel cap', title: 'กดสั่งครั้งละไม่เกิน5แผง' }),
    Object.freeze({ name: 'seller misspelled maximum cap', title: 'สั่งได้สุงสุด 12 กล่อง' }),
    Object.freeze({ name: 'seller piece per purchase order', title: '(1 ชิ้น ต่อ 1 คำสั่งซื้อ)' }),
    Object.freeze({ name: 'seller polite carton per purchase order', title: 'กรุณาสั่ง1ลังต่อคำสั่งซื้อ' }),
    Object.freeze({ name: 'seller per-round item cap', title: 'สั่งได้รอบละไม่เกิน400ลูก' }),
    Object.freeze({ name: 'seller box per purchase order', title: '1 กล่องต่อ 1 คำสั่งซื้อ' }),
    Object.freeze({ name: 'seller read details before ordering', title: 'โปรดอ่านรายละเอียดสินค้าก่อนการสั่งซื้อ' }),
    Object.freeze({ name: 'seller check size before ordering', title: 'กรุณาเช็คขนาดสมุดก่อนกดสั่งซื้อ' }),
    Object.freeze({ name: 'seller ask stock before ordering', title: 'สอบถามสต๊อกก่อนกดสั่งน๊า' }),
    Object.freeze({ name: 'seller direct order CTA', title: 'สนใจสั่งซื้อได้เลยค่ะ' }),
    Object.freeze({ name: 'seller order timing', title: 'สั่งซื้อก่อน 7 โมงเช้า จัดส่งภายในวันที่สั่งซื้อ' }),
    Object.freeze({ name: 'seller once-per-batch quantity', title: 'กดสั่งครั้งละ 1 ตัว' }),
    Object.freeze({ name: 'seller purchase-order sheet', title: 'สั่งซื้อได้1ถุง/1ใบสั่งซื้อเท่านั้น' }),
    Object.freeze({ name: 'seller side-per-batch quantity', title: 'แนะนำให้ลูกค้ากดสั่งทีละ 1 ข้าง' }),
    Object.freeze({ name: 'seller quantity mapping', title: 'กดสั่งจำนวน 1ชิ้น = ได้5ชิ้น' }),
    Object.freeze({ name: 'seller minimum order', title: 'สติกเกอร์ กดสั่งซื้อขั้นต่ำ10แผ่น' }),
    Object.freeze({ name: 'existing-customer add-on only', title: 'เฉพาะลูกค้าที่สั่งสินค้าในร้านสามารถสั่งซื้อถุงได้' }),
    Object.freeze({ name: 'packaging link not delivered', title: 'กล่องบรรจุภัณฑ์รวมเฉพาะกับการซื้อถุง โปรดทราบว่าสั่งซื้อผ่านลิงค์นี้ไม่ได้จัดส่ง' }),
    Object.freeze({ name: 'live-only item', title: 'สั่งซื้อสินค้าจากไลฟ์สด (แขนยาวผ้าร่ม)' }),
    Object.freeze({ name: 'abusive seller threat', title: 'ไม่รับของขอให้ไม่มีใครรักน๊าา' }),
    Object.freeze({ name: 'special promotion free bundle', title: 'Special Promotion | FREE Keyboard, Case, Screen Protector & Mystery Gift' }),
    Object.freeze({ name: 'get two free one offer', title: '[Get 2 Free 1] กระเป๋า' }),
    Object.freeze({ name: 'one free one offer', title: '1 Free 1 เสื้อยืด' }),
    Object.freeze({ name: 'buy one get one offer', title: 'Buy 1 get 1 Free แก้วน้ำ' }),
    Object.freeze({ name: 'Thai buy five get one offer', title: 'ซื้อ 5 แถม 1 ถุงซิป' }),
    Object.freeze({ name: 'Thai buy five get one free offer', title: 'ซื้อ 5 แถมฟรี 1 กระเป๋าผ้า' }),
    Object.freeze({ name: 'bracketed free-only item', title: '[ฟรี] กล่องของขวัญ' }),
    Object.freeze({ name: 'seller cannot combine products', title: 'สินค้าชิ้นนี้สั่งรวมสินค้าอื่นไม่ได้ ไม่สามารถแพ็ครวม' }),
    Object.freeze({ name: 'direct Line contact in source description', title: 'ซองเอกสาร 6 ซอง', description: 'หากต้องการจำนวนมาก กรุณาติดต่อ Line : @krpacks' }),
    Object.freeze({ name: 'preorder status in source description', title: 'เคสโทรศัพท์หนัง', description: 'สำหรับสินค้าพรีออเดอร์บางรายการ เราจะใช้เวลาจัดส่ง 7 วัน' }),
    Object.freeze({ name: 'split-order requirement in source description', title: 'กันสาดพร้อมผ้า', description: 'ซื้อสินค้าหลายรายการหรือน้ำหนักเยอะ ต้องสั่งแยกออเดอร์' }),
    Object.freeze({ name: 'live payment link', title: 'ลิงค์ชำระเงินจากไลฟ์สด' }),
    Object.freeze({ name: 'live cart price', title: 'ตระกร้า 690 สำหรับไลฟ์สด' }),
    Object.freeze({ name: 'live checkout only', title: 'สินค้าชิ้นนี้กดในไลฟ์สด' }),
    Object.freeze({ name: 'live collection listing', title: 'เก็บ ในไลฟ์สด รองเท้า' }),
    Object.freeze({ name: 'existing-customer embroidery add-on', title: 'ตราปัก ไม่ขายแยกชิ้น เฉพาะลูกค้าที่สั่งเสื้อกาวน์' }),
    Object.freeze({ name: 'shop purchase add-on bag', title: 'ไม่ขายถุงแยก ซื้อพร้อมสินค้าในร้าน' }),
    Object.freeze({ name: 'invoice order instruction', title: 'ออกใบกำกับภาษีแจ้งพร้อมออเดอร์' }),
    Object.freeze({ name: 'Thai preorder variant', title: 'พร้อมส่ง ไม่ต้องรอพรีออร์เดอร์' }),
    Object.freeze({ name: 'English spaced preorder', title: 'Pre - Order หนังสือออก 7 ก.ย. 69' }),
    Object.freeze({ name: 'limited custom-order intake', title: 'รับออเดอร์วันนี้-18 ส.ค. รอบส่ง 21 ส.ค. 69' }),
    Object.freeze({ name: 'seller purchase quantity range', title: 'สั่งได้ตั้งแต่ 50-150 ใบ' }),
    Object.freeze({ name: 'order gift promotion', title: '【Order Get 1 Gift】' }),
    Object.freeze({ name: 'direct contact phone number', title: 'หัวปากกา ติดต่อสอบถามเพิ่มเติมได้ที่ 0861496991' }),
    Object.freeze({ name: 'buyer-only gift packaging', title: 'กล่องของขวัญสำหรับผู้ที่ซื้อกระเป๋า ไม่ได้ขายแยกต่างหาก' }),
    Object.freeze({ name: 'gift box not sold separately', title: '(ไม่ขายกล่องแยก) Gift Box' }),
    Object.freeze({ name: 'do not buy seller warning', title: 'ใครที่ซีเรียสเรื่องวัสดุอย่าซื้อนะจ๊ะ' }),
    Object.freeze({ name: 'seller size do not buy warning', title: 'ผ้าม่านอย่าซื้อเล็กเกินไป ไม่งั้นจะใช้ไม่ได้' }),
    Object.freeze({ name: 'invoice chat request', title: '(ขอบิลเบิกรร.ทัก)' }),
    Object.freeze({ name: 'model in chat instruction', title: 'กรุณาแจ้งรุ่นในแชท' }),
    Object.freeze({ name: 'photo in chat instruction', title: 'ส่งรูปในแชทหลังสั่งซื้อ' }),
    Object.freeze({ name: 'do not combine with other products', title: 'รบกวนไม่สั่งร่วมกันสินค้าอื่น' }),
    Object.freeze({ name: 'seller order acceptance pressure', title: '(สั่ง กรุณารับของด้วยนะคะ)' }),
    Object.freeze({ name: 'read details before buying', title: 'อ่านรายละเอียดก่อนซื้อค่ะ' }),
    Object.freeze({ name: 'minimum purchase quantity', title: 'กระเป๋าของชำร่วย ขั้นต่ำ 2 ใบ คละแบบได้' }),
    Object.freeze({ name: 'generic numbered listing link', title: '[ลิ้งค์ 3] เสื้อแขนยาวคอตตอน' }),
    Object.freeze({ name: 'combined listing link navigation', title: 'กระดาษทิชชู่แบบแขวน ลิงก์รวม' }),
    Object.freeze({ name: 'glued free accessory promo', title: 'ขวดน้ำเด็ก ฟรีสายคล้องคอ' }),
    Object.freeze({ name: 'price superlative promo', title: 'ถูกกว่านี้ไม่มีอีกแล้ว ไส้กรองน้ำ 5 ขั้นตอน' }),
    Object.freeze({ name: 'cash on delivery listing', title: 'ชุดนอนผ้าไหม ชำระเงินปลายทาง' }),
    Object.freeze({ name: 'generic payment link listing', title: 'ลิงค์ชำระเงิน เสื้อแฟชั่น' }),
    Object.freeze({ name: 'minimum yard purchase', title: 'กระดาษสา สั่งขั้นต่ำ3หลา' }),
    Object.freeze({ name: 'system order CTA', title: 'สินค้างานปักตามสั่ง สนใจกดสั่งในระบบ' }),
    Object.freeze({ name: 'model before order instruction', title: 'แจ้งรุ่นมือถือก่อนกดสั่งซื้อ' }),
    Object.freeze({ name: 'free customization offer', title: 'การปรับแต่งฟรีของพวงกุญแจหนัง' }),
    Object.freeze({ name: 'receipt note instruction', title: 'รับใบเสร็จรบกวนแจ้งในหมายเหตุ' }),
    Object.freeze({ name: 'invoice detail note instruction', title: 'ต้องการบิลระบุเพิ่มในหมายเหตุ' }),
    Object.freeze({ name: 'invoice note before confirmation', title: 'แจ้งรับบิล กรุณาหมายเหตุก่อนยืนยันคำสั่งซื้อ' }),
    Object.freeze({ name: 'invoice chat after order', title: 'ออกบิลได้ทักแจ้งชื่อหลังสั่งซื้อทันที' }),
    Object.freeze({ name: 'invoice every order copy', title: 'มีบิลเบิกทุกออเดอร์' }),
    Object.freeze({ name: 'misspelled free gift promo', title: 'ซองมือถือ', description: 'เเถมฟรีสายคล้อง ผลิตจากวัสดุ PVC' }),
    Object.freeze({ name: 'age weight height order instruction', title: 'ชุดเด็ก', description: 'แจ้งอายุ+น้ำหนัก+ส่วนสูง ก่อนสั่งซื้อนะคะหากไม่แน่ใจ' }),
    Object.freeze({ name: 'weight height message instruction', title: 'ชุดเด็ก', description: 'ไม่แน่ใจขนาดไซส์แจ้ง น้ำหนักส่วนสูงทางข้อความได้เลยค่ะ' }),
    Object.freeze({ name: 'secondhand apparel listing', title: 'เสื้อแขนยาว', description: 'สินค้าเป็นสินค้ามือสองย้ำว่าเป็นมือสอง ขอคนเข้าใจงานมือสอง' }),
    Object.freeze({ name: 'mixed first and secondhand listing', title: 'ตุ๊กตาสะสม', description: 'พร้อมส่ง มือ 1-2 สภาพดี สินค้ามือ 2 อาจมีรอยหรือฝุ่นบ้าง' }),
    Object.freeze({ name: 'secondhand trading cards', title: 'การ์ดสะสม', description: 'การ์ดทุกใบสภาพตีเป็นการ์ดมือสองสภาพ 90% ขึ้นไป' }),
    Object.freeze({ name: 'actual manufactured defect item', title: 'ริบบิ้นเงา', description: 'ริบบิ้นตำหนิจากการผลิตจากโรงงาน แต่ละม้วนแตกต่างกัน' }),
    Object.freeze({ name: 'disrespectful adult body claim', title: '90-160KG กางเกงคนอ้วน เอวยางยืดช่วยให้ต้นขาดูเล็กลง' }),
    Object.freeze({ name: 'body size reduction claim', title: 'กางเกงเอวยางยืดช่วยให้ต้นขาดูเล็กลง' }),
    Object.freeze({ name: 'powered LED makeup case', title: 'กระเป๋าเครื่องสำอางพร้อมไฟ LED และกระจก', description: 'แบตเตอรี่ลิเธียม 1200mAh ชาร์จผ่าน Type-C' }),
    Object.freeze({ name: 'lipstick case only', title: 'กระเป๋าใส่ลิป Lipstick Case เฉพาะเคส ไม่รวมลิป' }),
    Object.freeze({ name: 'hair detangling brush', title: 'Detangling Bio-Keratin Brush หวีลดไฟฟ้าสถิตย์' }),
    Object.freeze({ name: 'tested cosmetic shade', title: 'ลิปครีม 3in1 เหลือสีที่เทส' }),
    Object.freeze({ name: 'Thai cosmetic tester', title: 'RARE BEAUTY Concealer เทสเตอร์' }),
    Object.freeze({ name: 'stale lipstick manufacture date', title: '(ผลิต 07/2022) Huda Beauty Liquid Matte Lipstick' }),
    Object.freeze({ name: 'stale full cosmetic manufacture date', title: 'MFG 02/07-2022 Liquid Matte Lipstick' }),
    Object.freeze({ name: 'stale eyeshadow manufacture date', title: 'Urban Decay Eyeshadow Palette ผลิต 5/2022' }),
    Object.freeze({ name: 'hair mascara in eye makeup taxonomy', title: 'Haircare Mascara มาสคาร่าเก็บไรผม' }),
    Object.freeze({ name: 'white-hair mascara', title: 'มาสคาร่าแบบซอง ปกปิดผมขาวชั่วคราว' }),
    Object.freeze({ name: 'makeup brush cleanser soap', title: 'Brush Cleanser สบู่ล้างแปรงแต่งหน้า' }),
    Object.freeze({ name: 'nail shimmer in face highlight taxonomy', title: 'ผงชิมเมอร์ ไฮไลท์ ผงวิ้ง ตกแต่งเล็บ' }),
    Object.freeze({ name: 'mixed body and face primer', title: 'Snail Bright Primer / Brightening Collagen / ทาตัว' }),
    Object.freeze({ name: 'mass-produced defect disclaimer', title: 'เคสโทรศัพท์', description: 'ผลิตภัณฑ์ผลิตจำนวนมากและอาจมีตำหนิเล็กน้อย' }),
    Object.freeze({ name: 'no-claim seller disclaimer', title: 'ชุดเซตผู้หญิง ไม่รับเคลมทุกกรณี' }),
    Object.freeze({ name: 'mixed used-items placeholder', title: 'เสื้อผ้าแฟชั่น', description: 'สินค้ามือ✌️ สภาพดี ครอป เดรส กระเป๋า รองเท้า' }),
    Object.freeze({ name: 'seller damaged-item logistics', title: 'แก้วเก็บความเย็น', description: 'กรณีสินค้าชำรุด แตก หัก เสียหาย ไม่ครบ ผิดสี ผิดขนาด ให้ดำเนินการตามร้าน' }),
    Object.freeze({ name: 'seller reject damaged parcel', title: 'สีเพ้นท์หน้า', description: 'กล่องหรือบรรจุภัณฑ์ แตก ขาด ชำรุด ไม่ต้องรับสินค้านะคะ' }),
    Object.freeze({ name: 'seller fit return copy', title: 'ฝาปิดขวดน้ำ ใส่ไม่ได้-คืนสินค้าได้ค่ะ' }),
    Object.freeze({ name: 'seller unboxing video after receipt', title: 'ถาดน้ำแข็ง', description: 'หลังจากได้รับสินค้าแล้ว โปรดถ่ายวิดีโอการแกะกล่อง' }),
    Object.freeze({ name: 'seller unedited unboxing video', title: 'แก้วมัทฉะ', description: 'เมื่อได้รับสินค้าแล้วควรถ่ายวิดีโอแบบไม่ตัดต่อขณะเปิดกล่อง' }),
    Object.freeze({ name: 'seller refuses returns', title: 'ไม่รับเปลี่ยนคืนห้ามเผื่อไซส์ ชุดเดรส' }),
    Object.freeze({ name: 'seller asks shop for size', title: 'ผ้ารองรีด ทักร้านแจ้งขนาดค่า' }),
    Object.freeze({ name: 'derogatory belly copy', title: 'กางเกงเอวสูง เก็บพุงหมาน้อย' }),
    Object.freeze({ name: 'leg slimming outcome', title: 'ถุงน่องช่วยให้ขาเรียวเล็กลง' }),
    Object.freeze({ name: 'flat belly outcome', title: 'ถุงน่องยกสะโพก พุงยุบ หน้าท้องแบนเรียบ' }),
    Object.freeze({ name: 'derogatory adult sizing', title: 'อ้วนแค่ไหนก็เอาอยู่ กางเกงคนอ้วน', description: 'คนอ้วนมาก ตัวใหญ่ยักษ์ใส่ได้' }),
    Object.freeze({ name: 'child fat sizing copy', title: 'ชุดเดรสเด็ก', description: 'หากลูกของคุณอ้วนขึ้นให้เลือกขนาดที่ใหญ่กว่า' }),
    Object.freeze({ name: 'child chubby fat copy', title: 'กางเกงเด็กโตอวบอ้วน 6-7 ปี มาทางนี้เลย' }),
    Object.freeze({ name: 'child chubby fit claim', title: 'ชุดไทยเด็กหญิง อวบอ้วนใส่ได้' }),
    Object.freeze({ name: 'baby fat sizing instruction', title: 'ชุดเด็กทารก', description: 'ทารกอ้วนแนะนำให้เลือกขนาดที่ใหญ่กว่า' }),
    Object.freeze({ name: 'baby slight-fat sizing instruction', title: 'ชุดเด็กวัยหัดเดิน', description: 'หากอ้วนเล็กน้อยโปรดเลือกขนาดที่ใหญ่กว่า' }),
    Object.freeze({ name: 'food flat belly outcome', title: 'ขนมคลีน ไม่ลงพุง' }),
    Object.freeze({ name: 'derogatory body transformation', title: 'เสื้อโปโลเปลี่ยนหุ่นพังให้เป็นหุ่นปัง' }),
    Object.freeze({
      name: 'late full-description body shaming',
      title: 'ชุดเด็กผ้าฝ้าย',
      description: `${'รายละเอียดเนื้อผ้าและตารางขนาด '.repeat(90)}เด็กอ้วนกรุณาแจ้งร้านก่อนสั่ง`,
    }),
    Object.freeze({
      name: 'late adult body shaming',
      title: 'กางเกงพลัสไซส์',
      description: `${'รายละเอียดเนื้อผ้าและตารางขนาด '.repeat(90)}กางเกงคนอ้วนช่วยให้ต้นขาดูเล็กลง`,
    }),
  ]),
  allowed: Object.freeze([
    Object.freeze({ name: 'legitimate promotional-use pen', title: 'ปากกาพิมพ์โลโก้สำหรับแจกเป็นของสมนาคุณ' }),
    Object.freeze({ name: 'legitimate branded pen intended for buyer giveaway', title: 'ปากกาพิมพ์โลโก้บริษัท สำหรับแจกเป็นของสมนาคุณแก่ลูกค้า' }),
    Object.freeze({ name: 'amulet-defect reference book', title: 'หนังสือชี้ตำหนิพระ ฉบับนักสะสม' }),
    Object.freeze({ name: 'expanded amulet-defect reference book', title: 'หนังสือพระยอดนิยม คู่มือชี้ตําหนิพระสำหรับนักสะสม' }),
    Object.freeze({ name: 'manufacturing-defect warranty', title: 'YETI รับประกัน (จำกัดเฉพาะตำหนิจากการผลิต) ให้หมายเลขซีเรียลตรวจสอบได้' }),
    Object.freeze({ name: 'bounded GWP near miss', title: 'GWPower เครื่องชาร์จอเนกประสงค์' }),
    Object.freeze({ name: 'generic defect inspection in description', title: 'แปรงทำความสะอาดอเนกประสงค์', description: 'ก่อนทำความสะอาดตรวจว่าสินค้ามีตำหนิหรือไม่' }),
    Object.freeze({ name: 'neutral size chart', title: 'ชุดเด็กผ้าฝ้าย', description: 'ตารางไซส์แสดงส่วนสูงและน้ำหนักโดยประมาณของเด็กแต่ละช่วงอายุ' }),
    Object.freeze({ name: 'ordinary multipack quantity', title: 'กระดาษทิชชู แพ็ค 2 กล่อง รวม 12 ม้วน' }),
    Object.freeze({ name: 'ordinary combined packing feature', title: 'กล่องจัดระเบียบ', description: 'รองรับการแพ็กรวมอุปกรณ์ชิ้นเล็กไว้ด้วยกัน' }),
    Object.freeze({ name: 'buyer giveaway packing bag', title: 'ถุงแพ็คสินค้าสำหรับแถมลูกค้า 100 ใบ' }),
    Object.freeze({ name: 'ordinary instruction manual', title: 'เครื่องเย็บกระดาษ', description: 'โปรดอ่านคู่มือก่อนใช้งาน' }),
    Object.freeze({ name: 'ordinary sugar-free food', title: 'ลูกอมไม่มีน้ำตาล sugar free 20 เม็ด' }),
    Object.freeze({ name: 'ordinary fixed package contents', title: 'แก้วน้ำ 1 ชุด มี 5 ชิ้น' }),
    Object.freeze({ name: 'ordinary one-item order mapping', title: 'บานพับจุดหมุน 1 ชิ้น', description: '1ออเดอร์ = 1 ชิ้น สีเงิน วัสดุสแตนเลส' }),
    Object.freeze({ name: 'ordinary pack contents order mapping', title: 'ห่วงม่าน 20 ห่วงต่อถุง', description: 'ออเดอร์ 1 ถุง บรรจุ 20 ห่วง' }),
    Object.freeze({ name: 'ordinary live-streaming light', title: 'ไฟวงแหวนสำหรับไลฟ์สด ปรับความสว่างได้' }),
    Object.freeze({ name: 'ordinary tax invoice book', title: 'สมุดใบกำกับภาษี 2 ชั้น 10 เล่ม' }),
    Object.freeze({ name: 'ordinary package range', title: 'ถุงซิป มีขนาดบรรจุ 50-150 ใบ' }),
    Object.freeze({ name: 'ordinary live-streaming basket volume', title: 'ตะกร้า 690 มล. สำหรับไลฟ์สด' }),
    Object.freeze({ name: 'ordinary stored shoe box', title: 'กล่องเก็บในไลฟ์สด ใช้วางรองเท้า' }),
    Object.freeze({ name: 'ordinary order notebook', title: 'สมุดรับออเดอร์ รอบส่งสินค้า 50 แผ่น' }),
    Object.freeze({ name: 'ordinary gelatin package clarification', title: 'เจลาตินแบบแผ่น 10 ชิ้น ไม่ได้ขายเป็นกล่อง' }),
    Object.freeze({ name: 'ordinary live-link handbook', title: 'หนังสือคู่มือสร้างลิงค์สำหรับไลฟ์สด' }),
    Object.freeze({ name: 'ordinary inseparable complete set', title: 'ชุดช้อนส้อม 4 ชิ้น ไม่ขายแยก ซื้อพร้อมสินค้าครบชุด' }),
    Object.freeze({ name: 'ordinary game phrase card', title: 'การ์ดคำศัพท์ประโยค Order Get 1 Gift สำหรับเกม' }),
    Object.freeze({ name: 'ordinary chat vocabulary book', title: 'หนังสือรวมคำศัพท์แชทภาษาอังกฤษ' }),
    Object.freeze({ name: 'ordinary blank tax invoice paper', title: 'กระดาษต่อเนื่อง ใบกำกับภาษี ใบแจ้งหนี้ ใบเสร็จรับเงิน 100 ชุด' }),
    Object.freeze({
      name: 'invoice paper seller service copy',
      title: 'กระดาษต่อเนื่อง 6 ชั้น ใบกำกับภาษี ใบแจ้งหนี้ ใบเสร็จรับเงิน',
      description: 'หากต้องการออกใบกำกับภาษี เมื่อสั่งซื้อแล้วแจ้งเลขที่ออเดอร์และเลขผู้เสียภาษีทางแชทได้ค่ะ',
    }),
    Object.freeze({ name: 'ordinary no-minimum listing', title: 'แก้วสกรีน ไม่มีขั้นต่ำ ออกแบบเองได้' }),
    Object.freeze({ name: 'ordinary TP Link router', title: 'TP-Link Archer AX12 เราเตอร์ Wi-Fi 6' }),
    Object.freeze({ name: 'ordinary free-swing handle term', title: 'ด้ามฟรีหัวสวิง 3/8DR 72T' }),
    Object.freeze({ name: 'ordinary invoice availability', title: 'ของเล่นเปียโนเด็ก ออกบิลได้' }),
    Object.freeze({ name: 'ordinary tax invoice availability', title: 'ร้านนี้ออกใบกำกับภาษีได้' }),
    Object.freeze({ name: 'respectful adult plus size', title: 'กางเกงคาร์โก้พลัสไซส์ 36-48 นิ้ว เอวยางยืด' }),
    Object.freeze({ name: 'negated secondhand status', title: 'กระเป๋าผู้หญิง', description: 'สินค้าใหม่ ไม่ใช่สินค้ามือสอง' }),
    Object.freeze({ name: 'new item distinguished from secondhand', title: 'กางเกงยีนส์ผู้ชาย', description: 'สินค้าของเราเป็นสินค้าใหม่เอี่ยม เพื่อแยกความแตกต่างกับสินค้ามือสอง' }),
    Object.freeze({ name: 'secondhand warranty condition', title: 'เต็นท์แคมป์ปิง', description: 'หากเป็นสินค้ามือสอง การรับประกันจะสิ้นสุดทันที' }),
    Object.freeze({ name: 'secondhand non-shipment promise', title: 'กระเป๋าผู้หญิง', description: 'เราจะไม่ส่งสินค้าที่เสียหายหรือสินค้ามือสอง' }),
    Object.freeze({ name: 'passive makeup organizer', title: 'กระเป๋าเครื่องสำอางแบบพกพา มีช่องแบ่ง 4 ช่อง' }),
    Object.freeze({ name: 'ordinary makeup brush', title: 'แปรงแต่งหน้า 8 ชิ้น พร้อมกระเป๋า' }),
    Object.freeze({ name: 'ordinary eye mascara', title: 'มาสคาร่าขนตาสีดำ กันน้ำ 8 มล.' }),
    Object.freeze({ name: 'fresh lipstick manufacture date', title: '(ผลิต 07/2026) Liquid Matte Lipstick 4.2ml' }),
    Object.freeze({ name: 'ordinary face highlighter', title: 'ผงชิมเมอร์ไฮไลท์ใบหน้า สีแชมเปญ' }),
    Object.freeze({ name: 'ordinary face primer', title: 'ไพรเมอร์สำหรับใช้ก่อนแต่งหน้า 6 กรัม' }),
    Object.freeze({ name: 'neutral condition and size inspection', title: 'แก้วน้ำสเตนเลส', description: 'โปรดตรวจสอบสภาพและขนาดของสินค้าก่อนใช้งาน' }),
    Object.freeze({ name: 'ordinary shapewear wording', title: 'กางเกงกระชับสัดส่วน ช่วยเก็บพุงและพรางพุง' }),
    Object.freeze({ name: 'neutral adult size wording', title: 'กางเกงไซส์ใหญ่สำหรับคนอ้วน เอว 40-50 นิ้ว' }),
    Object.freeze({ name: 'cartoon animal body motif', title: 'เสื้อเด็กลายเสืออ้วนสวมหมวก' }),
    Object.freeze({ name: 'translated mesh compound', title: 'เสื้อเด็กผู้หญิงตาข่ายอ้วนเสื้อ', description: 'วัสดุผ้าฝ้ายและตาข่าย' }),
  ]),
  rejectedPublicNames: Object.freeze(['[เมย์บิวตี้]', '(Brand only)', '【ร้านตัวอย่าง】', 'สปอตสปอตสปอต Hairdressing']),
  allowedPublicNames: Object.freeze(['[เมย์บิวตี้] กล่องเก็บแปรงแต่งหน้า', 'กระเป๋ารุ่น X100']),
  blockedPublicText: Object.freeze([
    'เด็กอ้วนกรุณาอย่าสั่งซื้อด้วยตัวเอง บอกส่วนสูงและน้ำหนักของเด็ก',
    'ของสมนาคุณ ลูกค้าอย่ากดนะคะ',
    '1ออเดอร์ไม่เกิน2แพ็ค',
    'กดสั่งสูงสุด 2 ม้วน ต่อ 1 ออเดอร์',
    'สั่งรวมสินค้าอื่นไม่ได้ ไม่สามารถแพ็ครวม',
    'สินค้าสำหรับแถมโดยเฉพาะ งดจำหน่าย',
    'สั่งได้สูงสุดต่อออเดอร์ 2 เซ็ท',
    '1 ออเดอร์/ สูงสุด 2 ใบ',
    '1ออเดอร์จำกัดไม่เกิน100ใบ',
    'สั่งซื้อไม่เกิน 2 ถุง',
    'สั่งได้ไม่เกิน 10 แพค/ครั้ง',
    'สินค้ายกลัง สั่งสูงสุด 3 ลัง / 1 ออเดอร์เท่านั้น',
    '[1 ชิ้น ต่อ 1 ออเดอร์]',
    'กดสั่ง 1 ม้วน ต่อ 1 ออเดอร์เท่านั้น',
    '1ออเดอร์ต่อ1ตัว',
    '1 ออเดอร์/1แพ็ก',
    'สั่งได้ 1 ใบ ต่อ 1 ออเดอร์เท่านั้น',
    'กดสั่งได้ครั้งล่ะ 1 ออเดอร์ 50ชิ้น/1กล่อง',
    'ขนม 20ห่อ/ลัง (1ลัง1ออเดอร์)',
    '(กด 1 แพ็ค ต่อ 1 คำสั่งซื้อ)',
    '(1กระสอบต่อ1คำสั่งซื้อ)',
    'กดสั่งครั้งละไม่เกิน5แผง',
    'สั่งได้สุงสุด 12 กล่อง',
    '(1 ชิ้น ต่อ 1 คำสั่งซื้อ)',
    'กรุณาสั่ง1ลังต่อคำสั่งซื้อ',
    'สั่งได้รอบละไม่เกิน400ลูก',
    '1 กล่องต่อ 1 คำสั่งซื้อ',
    'โปรดอ่านรายละเอียดสินค้าก่อนการสั่งซื้อ',
    'กรุณาเช็คขนาดก่อนกดสั่งซื้อ',
    'สนใจสั่งซื้อได้เลยค่ะ',
    'กดสั่งครั้งละ 1 ตัว',
    'สั่งซื้อได้1ถุง/1ใบสั่งซื้อเท่านั้น',
    'กดสั่งซื้อขั้นต่ำ10แผ่น',
    'เฉพาะลูกค้าที่สั่งสินค้าในร้านสามารถสั่งซื้อถุงได้',
    'สั่งซื้อสินค้าจากไลฟ์สด',
    'ไม่รับของขอให้ไม่มีใครรัก',
    'Special Promotion | FREE Keyboard, Case & Mystery Gift',
    '[Get 2 Free 1]',
    'Buy 1 get 1 Free',
    'ซื้อ 5 แถม 1',
    'ซื้อ 5 1 กระเป๋าผ้า',
    '[ฟรี] กล่องของขวัญ',
    'ลิงค์ชำระเงินจากไลฟ์สด',
    'ตระกร้า 690 สำหรับไลฟ์สด',
    'สินค้าชิ้นนี้กดในไลฟ์สด',
    'เก็บ ในไลฟ์สด รองเท้า',
    'ตราปัก ไม่ขายแยกชิ้น เฉพาะลูกค้าที่สั่งเสื้อกาวน์',
    'ไม่ขายถุงแยก ซื้อพร้อมสินค้าในร้าน',
    'ออกใบกำกับภาษีแจ้งพร้อมออเดอร์',
    'พร้อมส่ง ไม่ต้องรอพรีออร์เดอร์',
    'Pre - Order หนังสือออก 7 ก.ย. 69',
    'รับออเดอร์วันนี้-18 ส.ค. รอบส่ง 21 ส.ค. 69',
    'สั่งได้ตั้งแต่ 50-150 ใบ',
    '【Order Get 1 Gift】',
    'หัวปากกา ติดต่อสอบถามเพิ่มเติมได้ที่ 0861496991',
    'กล่องของขวัญสำหรับผู้ที่ซื้อกระเป๋า ไม่ได้ขายแยกต่างหาก',
    '(ไม่ขายกล่องแยก) Gift Box',
    'ใครที่ซีเรียสเรื่องวัสดุอย่าซื้อนะจ๊ะ',
    'ผ้าม่านอย่าซื้อเล็กเกินไป ไม่งั้นจะใช้ไม่ได้',
    '(ขอบิลเบิกรร.ทัก)',
    'กรุณาแจ้งรุ่นในแชท',
    'ส่งรูปในแชทหลังสั่งซื้อ',
    'รบกวนไม่สั่งร่วมกันสินค้าอื่น',
    '(สั่ง กรุณารับของด้วยนะคะ)',
    'อ่านรายละเอียดก่อนซื้อค่ะ',
    'กระเป๋าของชำร่วย ขั้นต่ำ 2 ใบ คละแบบได้',
    '[ลิ้งค์ 3] เสื้อแขนยาวคอตตอน',
    'กระดาษทิชชู่แบบแขวน ลิงก์รวม',
    'ขวดน้ำเด็ก ฟรีสายคล้องคอ',
    'ถูกกว่านี้ไม่มีอีกแล้ว ไส้กรองน้ำ 5 ขั้นตอน',
    'ชุดนอนผ้าไหม ชำระเงินปลายทาง',
    'ลิงค์ชำระเงิน เสื้อแฟชั่น',
    'กระดาษสา สั่งขั้นต่ำ3หลา',
    'สินค้างานปักตามสั่ง สนใจกดสั่งในระบบ',
    'แจ้งรุ่นมือถือก่อนกดสั่งซื้อ',
    'การปรับแต่งฟรีของพวงกุญแจหนัง',
    'รับใบเสร็จรบกวนแจ้งในหมายเหตุ',
    'ต้องการบิลระบุเพิ่มในหมายเหตุ',
    'แจ้งรับบิล กรุณาหมายเหตุก่อนยืนยันคำสั่งซื้อ',
    'ออกบิลได้ทักแจ้งชื่อหลังสั่งซื้อทันที',
    'มีบิลเบิกทุกออเดอร์',
    'เเถมฟรีสายคล้อง',
    'แจ้งอายุ+น้ำหนัก+ส่วนสูง ก่อนสั่งซื้อ',
    'แจ้ง น้ำหนักส่วนสูงทางข้อความได้เลยค่ะ',
    'เสื้อโปโลเนื้อผ้า TK ลิ้งค์',
    'ริบบิ้นตำหนิจากการผลิตจากโรงงาน แต่ละม้วนแตกต่างกัน',
    '90-160KG กางเกงคนอ้วน เอวยางยืดช่วยให้ต้นขาดูเล็กลง',
    'เอวยางยืดช่วยให้ต้นขาดูเล็กลง',
    'กระเป๋าเครื่องสำอางพร้อมไฟ LED และกระจก แบตเตอรี่ 1200mAh Type-C',
    'กระเป๋าใส่ลิป Lipstick Case เฉพาะเคส ไม่รวมลิป',
    'Detangling Bio-Keratin Brush หวีลดไฟฟ้าสถิตย์',
    'ลิปครีม 3in1 เหลือสีที่เทส',
    'RARE BEAUTY Concealer เทสเตอร์',
    '(ผลิต 07/2022) Huda Beauty Liquid Matte Lipstick',
    'MFG 02/07-2022 Liquid Matte Lipstick',
    'Urban Decay Eyeshadow Palette ผลิต 5/2022',
    'Haircare Mascara มาสคาร่าเก็บไรผม',
    'มาสคาร่าแบบซอง ปกปิดผมขาวชั่วคราว',
    'Brush Cleanser สบู่ล้างแปรงแต่งหน้า',
    'ผงชิมเมอร์ ไฮไลท์ ผงวิ้ง ตกแต่งเล็บ',
    'Snail Bright Primer / Brightening Collagen / ทาตัว',
    'ผลิตภัณฑ์ผลิตจำนวนมากและอาจมีตำหนิเล็กน้อย',
    'ชุดเซตผู้หญิง ไม่รับเคลมทุกกรณี',
    'สินค้ามือ✌️ สภาพดี ครอป เดรส กระเป๋า รองเท้า',
    'กรณีสินค้าชำรุด แตก หัก เสียหาย ไม่ครบ ผิดสี ผิดขนาด',
    'กล่องหรือบรรจุภัณฑ์ แตก ขาด ชำรุด ไม่ต้องรับสินค้านะคะ',
    'ฝาปิดขวดน้ำ ใส่ไม่ได้-คืนสินค้าได้ค่ะ',
    'หลังจากได้รับสินค้าแล้ว โปรดถ่ายวิดีโอการแกะกล่อง',
    'เมื่อได้รับสินค้าแล้วควรถ่ายวิดีโอแบบไม่ตัดต่อขณะเปิดกล่อง',
    'ไม่รับเปลี่ยนคืนห้ามเผื่อไซส์',
    'ผ้ารองรีด ทักร้านแจ้งขนาดค่า',
    'กางเกงเอวสูง เก็บพุงหมาน้อย',
    'ถุงน่องช่วยให้ขาเรียวเล็กลง',
    'ถุงน่องยกสะโพก พุงยุบ หน้าท้องแบนเรียบ',
    'อ้วนแค่ไหนก็เอาอยู่ คนอ้วนมาก ตัวใหญ่ยักษ์',
    'หากลูกของคุณอ้วนขึ้นให้เลือกขนาดที่ใหญ่กว่า',
    'กางเกงเด็กโตอวบอ้วน 6-7 ปี มาทางนี้เลย',
    'ชุดไทยเด็กหญิง อวบอ้วนใส่ได้',
    'ชุดเด็กทารก ทารกอ้วนแนะนำให้เลือกขนาดที่ใหญ่กว่า',
    'ชุดเด็กวัยหัดเดิน หากอ้วนเล็กน้อยโปรดเลือกขนาดที่ใหญ่กว่า',
    'ขนมคลีน ไม่ลงพุง',
    'เสื้อโปโลเปลี่ยนหุ่นพังให้เป็นหุ่นปัง',
  ]),
  allowedPublicText: Object.freeze([
    'ก่อนทำความสะอาดตรวจว่าสินค้ามีตำหนิหรือไม่',
    'ตารางไซส์แสดงส่วนสูงและน้ำหนักโดยประมาณ',
    'แพ็ค 2 กล่อง รวม 12 ม้วน',
    'ถุงแพ็คสินค้าสำหรับแถมลูกค้า 100 ใบ',
    'โปรดอ่านคู่มือก่อนใช้งาน',
    'ลูกอมไม่มีน้ำตาล sugar free 20 เม็ด',
    'แก้วน้ำ 1 ชุด มี 5 ชิ้น',
    'ไฟวงแหวนสำหรับไลฟ์สด ปรับความสว่างได้',
    'สมุดใบกำกับภาษี 2 ชั้น 10 เล่ม',
    'ถุงซิป มีขนาดบรรจุ 50-150 ใบ',
    'ตะกร้า 690 มล. สำหรับไลฟ์สด',
    'กล่องเก็บในไลฟ์สด ใช้วางรองเท้า',
    'สมุดรับออเดอร์ รอบส่งสินค้า 50 แผ่น',
    'เจลาตินแบบแผ่น 10 ชิ้น ไม่ได้ขายเป็นกล่อง',
    'หนังสือคู่มือสร้างลิงค์สำหรับไลฟ์สด',
    'ชุดช้อนส้อม 4 ชิ้น ไม่ขายแยก ซื้อพร้อมสินค้าครบชุด',
    'การ์ดคำศัพท์ประโยค Order Get 1 Gift สำหรับเกม',
    'หนังสือรวมคำศัพท์แชทภาษาอังกฤษ',
    'กระดาษต่อเนื่อง ใบกำกับภาษี ใบแจ้งหนี้ ใบเสร็จรับเงิน 100 ชุด',
    'แก้วสกรีน ไม่มีขั้นต่ำ ออกแบบเองได้',
    'TP-Link Archer AX12 เราเตอร์ Wi-Fi 6',
    'ด้ามฟรีหัวสวิง 3/8DR 72T',
    'ของเล่นเปียโนเด็ก ออกบิลได้',
    'ร้านนี้ออกใบกำกับภาษีได้',
    'กางเกงคาร์โก้พลัสไซส์ 36-48 นิ้ว เอวยางยืด',
    'กระเป๋าเครื่องสำอางแบบพกพา มีช่องแบ่ง 4 ช่อง',
    'แปรงแต่งหน้า 8 ชิ้น พร้อมกระเป๋า',
    'มาสคาร่าขนตาสีดำ กันน้ำ 8 มล.',
    '(ผลิต 07/2026) Liquid Matte Lipstick 4.2ml',
    'ผงชิมเมอร์ไฮไลท์ใบหน้า สีแชมเปญ',
    'ไพรเมอร์สำหรับใช้ก่อนแต่งหน้า 6 กรัม',
    'โปรดตรวจสอบสภาพและขนาดของสินค้าก่อนใช้งาน',
    'กางเกงกระชับสัดส่วน ช่วยเก็บพุงและพรางพุง',
    'กางเกงไซส์ใหญ่สำหรับคนอ้วน เอว 40-50 นิ้ว',
    'เสื้อเด็กลายเสืออ้วนสวมหมวก',
    'เสื้อเด็กผู้หญิงตาข่ายอ้วนเสื้อ วัสดุผ้าฝ้ายและตาข่าย',
  ]),
});

function normalizeExpiryYear(value) {
  let year = Number(value);
  if (!Number.isInteger(year)) return null;
  if (year >= 2500) year -= 543;
  else if (year < 100) year = year >= 60 ? year + 1957 : year + 2000;
  return year >= 2000 && year <= 2200 ? year : null;
}

function validUtcDate(year, month, day, monthPrecision = false) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = monthPrecision
    ? new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
    : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  if (!monthPrecision && (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)) return null;
  return date;
}

function expiryDatesFromContext(context) {
  const dates = [];
  const add = (yearValue, monthValue, dayValue, monthPrecision = false) => {
    const year = normalizeExpiryYear(yearValue);
    const date = validUtcDate(year, Number(monthValue), Number(dayValue), monthPrecision);
    if (date) dates.push(date);
  };
  for (const match of context.matchAll(/(?<!\d)(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{2,4})(?!\d)/gu)) {
    add(match[3], match[2], match[1]);
  }
  for (const match of context.matchAll(/(?<!\d)(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?!\d)/gu)) {
    add(match[1], match[2], match[3]);
  }
  for (const match of context.matchAll(/(?<![\d\/.-])(\d{1,2})\s*[\/.-]\s*(\d{2,4})(?![\d\/.-])/gu)) {
    add(match[2], match[1], 1, true);
  }
  // A bare or ranged year next to an expiry marker is treated as year-end.
  // This intentionally rejects ambiguous controlled stock when the earliest
  // stated year is already expired or inside the near-expiry window.
  for (const match of context.matchAll(/(?<!\d)((?:20|25)\d{2})(?!\d)/gu)) {
    add(match[1], 12, 1, true);
  }
  return dates;
}

export function hasExpiredOrNearExpiry(value, checkedAt, minimumShelfLifeDays = 180) {
  const text = canonicalPolicyText(value);
  const marker = /(?:\bexp(?:iry)?\.?|\bbbf?\b|\bbest\s*before\b|หมดอายุ|วันหมดอายุ|ควรบริโภคก่อน)/giu;
  const contexts = [];
  for (const match of text.matchAll(marker)) {
    contexts.push(text.slice(Math.max(0, match.index - 18), Math.min(text.length, match.index + match[0].length + 64)));
  }
  if (!contexts.length) return false;
  const reference = new Date(checkedAt);
  if (!Number.isFinite(reference.getTime())) throw new Error(`Invalid checkedAt for expiry policy: ${checkedAt}`);
  const cutoff = new Date(reference.getTime() + minimumShelfLifeDays * 86_400_000);
  return contexts.flatMap(expiryDatesFromContext).some((date) => date <= cutoff);
}

export function hasControlledSourceRisk(groupKey, value) {
  if (groupKey !== 'beauty' && groupKey !== 'supplements') return false;
  const text = canonicalPolicyText(value);
  return SEVERE_HEALTH_CLAIM.test(text) || SENSITIVE_TITLE_CLAIM.test(text) ||
    CONTROLLED_ACTION_OR_OUTCOME.test(text) || CONTROLLED_CONDITION_OR_BODY_CLAIM.test(text) ||
    CONTROLLED_SAFETY_CLAIM.test(text) || CONTROLLED_MEDICAL_NUTRITION.test(text) ||
    CONTROLLED_TIMEFRAME_CLAIM.test(text) ||
    (groupKey === 'beauty' && (UNSUPPORTED_SPF.test(text) || BEAUTY_EXTRA_RISK.test(text))) ||
    (groupKey === 'supplements' && SUPPLEMENT_EXTRA_RISK.test(text));
}

export function hasControlledTitleNoise(value) {
  return CONTROLLED_TITLE_NOISE.test(canonicalPolicyText(value));
}

export function hasControlledPublicClaim(groupKey, value) {
  const text = canonicalPolicyText(value);
  if (groupKey === 'beauty' || groupKey === 'supplements') {
    return hasControlledSourceRisk(groupKey, text) || hasControlledTitleNoise(text);
  }
  return groupKey === 'automotive' && AUTO_UNSUPPORTED_CLAIM.test(text);
}

function usesLegacyControlledClaimPolicy(category) {
  return category.summaryKind === 'skincare' || category.summaryKind === 'supplement' || category.summaryKind === 'automotive';
}

function hasCategoryControlledSourceRisk(category, value) {
  if (category.summaryKind === 'skincare') return hasControlledSourceRisk('beauty', value);
  if (category.summaryKind === 'supplement') return hasControlledSourceRisk('supplements', value);
  return false;
}

function hasCategoryControlledPublicClaim(category, value) {
  if (category.summaryKind === 'skincare') return hasControlledPublicClaim('beauty', value);
  if (category.summaryKind === 'supplement') return hasControlledPublicClaim('supplements', value);
  if (category.summaryKind === 'automotive') return hasControlledPublicClaim('automotive', value);
  return false;
}

export function isUnsafeAutomotiveText(value) {
  return ACTIVE_AUTO_RISK.test(canonicalPolicyText(value));
}

export function hasPublicPromoNoise(value) {
  const text = String(value ?? '');
  return PUBLIC_PROMO_NOISE.test(text) || EXTRA_PUBLIC_PROMO_NOISE.test(text) || SELLER_OR_LISTING_PUBLIC_NOISE.test(text);
}

export function hasListingPriceNoise(value) {
  return LISTING_PRICE_OR_ORDER_NOISE.test(canonicalPolicyText(value));
}

export function hasUppercaseCodNoise(value) {
  return UPPERCASE_COD_NOISE.test(String(value ?? ''));
}

export function isActiveCleaningProduct(value) {
  return ACTIVE_CLEANING_OR_DISINFECTANT.test(canonicalPolicyText(value));
}

export function makeColumnIndex(header) {
  const index = new Map(header.map((name, position) => [sanitizeText(name).trim(), position]));
  const missing = REQUIRED_SELLABLE_COLUMNS.filter((name) => !index.has(name));
  if (missing.length) throw new Error(`Feed is missing required columns: ${missing.join(', ')}`);
  return index;
}

function classify(c1, c2, c3, title) {
  for (const category of CATALOG_RULES) {
    if (category.matcher(c1, c2, c3, title)) return category;
  }
  return null;
}

function truthyShopFlag(value, word) {
  const normalized = sanitizeText(value).trim().toLowerCase();
  if (normalized.includes(`non-${word}`) || normalized.startsWith('non ')) return false;
  return /^(?:true|1|yes)$/u.test(normalized) || normalized.includes(word);
}

function shopType(row, index) {
  if (truthyShopFlag(field(row, index, 'is_official_shop'), 'official')) return 'official';
  if (truthyShopFlag(field(row, index, 'is_preferred_shop'), 'preferred')) return 'preferred';
  return 'general';
}

function normalizeSearch(value) {
  return sanitizeText(value).toLocaleLowerCase('th-TH').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function semanticSummaryFingerprint(value) {
  return sanitizeText(value).normalize('NFKC').toLocaleLowerCase('th-TH').replace(/\s+/gu, ' ').trim();
}

export function makeSearchText(product) {
  return normalizeSearch([product.cleanName, product.summary, product.subcategory, product.category, product.categoryGroup].join(' '));
}

function titleFingerprint(value) {
  const stripped = sanitizeText(value).normalize('NFKC')
    .replace(/\b(?:สี|color)\s*[\p{L}\p{N}-]+/giu, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:ชิ้น|pcs?|cm|mm|ml|g|kg)\b/giu, ' ');
  return normalizeSearch(stripped);
}

function sanitizeName(rawTitle, sensitive = false) {
  let name = sanitizeText(rawTitle)
    .replace(/<[^>]*>/gu, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[\[(【{][^\])】}]{0,70}(?:พร้อมส่ง|ส่งฟรี|โปรโมชั่น|ส่วนลด|ปรับราคา|ราคาส่วนลด|\bsale\b|โปร(?=\s|[:!！\-]|$)|โค้ด|ลด\s*\d+(?:[.,]\d+)?\s*(?:%|บาท|\.?-)?|สั่งในไลฟ์|เฉพาะไลฟ์|แถม|รับฟรี|บริษัทโดยตรง|ส่งจากคลัง|live\s*\d*\s*%?)[^\])】}]{0,70}[\])】}]/giu, ' ')
    .replace(PROMO_OR_NOISE, ' ')
    .replace(EXTRA_PROMO_OR_NOISE, ' ')
    .replace(SELLER_OR_LISTING_NOISE, ' ')
    .replace(/[#*`]+/gu, ' ')
    .replace(/\[(?:โปรโมชั่น|โปร|ส่งฟรี|พร้อมส่ง)[^\]]*\]/giu, ' ')
    .replace(/\((?:โปรโมชั่น|โปร|ส่งฟรี|พร้อมส่ง)[^)]*\)/giu, ' ')
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/gu, ' ')
    .replace(/[{}]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
  name = name.replace(/\s+สูตร$/u, '').trim();
  if (name.length > 105) {
    const cut = name.slice(0, 105);
    name = (cut.replace(/\s+\S*$/u, '') || cut).trim();
  }
  return name.replace(/^[+\s|:;,_\-–—*#~.!?]+|[+\s|:;,_\-–—*#~.!?]+$/g, '').trim();
}

function extractFacts(value) {
  const text = sanitizeText(value).slice(0, 700);
  const facts = [];
  const unitMatches = text.match(/\b\d+(?:[.,]\d+)?\s*(?:มล\.?|ml|กรัม|ก\.?|g|กก\.?|kg|ซม\.?|cm|มม\.?|mm|ลิตร|liters?|ชิ้น|ใบ|แผ่น|ซอง|เม็ด|แคปซูล|capsules?|tablets?|pcs?)\b/giu) ?? [];
  for (const match of unitMatches) {
    const clean = match.replace(/\s+/g, ' ').trim();
    if (!facts.some((fact) => fact.toLowerCase() === clean.toLowerCase())) facts.push(clean);
    if (facts.length === 2) break;
  }
  const material = text.match(/(?:ผลิตจาก|วัสดุ|เนื้อผ้า)\s*[:：]?\s*(?:สแตนเลส|พลาสติก|ซิลิโคน|ผ้าฝ้าย|คอตตอน|ไมโครไฟเบอร์|ไม้|กระดาษ|อะลูมิเนียม|อลูมิเนียม|เหล็ก|เซรามิก|แก้ว|โพลีเอสเตอร์|nylon|stainless\s*steel|silicone|plastic|cotton|microfiber|wood|paper|aluminium|aluminum|steel|ceramic|glass|polyester)/iu);
  if (material) facts.push(material[0].replace(/\s+/g, ' ').trim());
  return facts.slice(0, 2);
}

function trimAtWord(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength + 1).replace(/\s+\S*$/u, '').trim();
  return cut || text.slice(0, maxLength).trim();
}

const OBJECTIVE_DETAIL_SIGNAL = /(?:วัสดุ|ผลิตจาก|ทำจาก|ทําจาก|เนื้อผ้า|ขนาด|ความจุ|จำนวน|จํานวน|บรรจุ|รองรับ|ใช้สำหรับ|ใช้สําหรับ|มี\s*\d+\s*(?:ช่อง|ชั้น|ชิ้น)|ปรับ(?:ระดับ|ขนาด|ความยาว)|พับได้|ถอดล้าง|ซักได้|เส้นผ่านศูนย์กลาง|น้ำหนัก|น้ําหนัก)/iu;
const OBJECTIVE_DETAIL_BLOCK = /(?:สินค้าอยู่|อยู่ระหว่าง|ปรับขนาดบรรจุภัณฑ์|ร้าน|ลูกค้า|ทัก|แชท|จัดส่ง|ขนส่ง|รับประกัน|คืนสินค้า|โปรโมชั่น|โปร(?=\s|ใหม่|โมชัน|โมชั่|ฯ|$)|ส่วนลด|คูปอง|ของแถม|กดสั่ง|กดเพิ่ม|ราคา|สุดคุ้ม|ระบบ(?:จะ)?ลด|อัตโนมัติ|อัติโนมัติ|ภาพอาจ|สีอาจ|คลาดเคลื่อน|สอบถาม|ติดต่อ|facebook|tiktok|line\s*id|โทร\.?|หมดอายุ|\bexp(?:iry)?\b|เก็บเงินปลายทาง|\bcod\b|commission|ค่าคอม|มีคอม|affiliate|ดีที่สุด|ขายดี|ยอดนิยม|ล่าสุด|อัพเดต|อัปเดต|อัตเดท|ตารางไซส์|คุณภาพ|พรีเมี่ยม|premium|ความจุสูง|เสถียร|ได้มาก|แข็งแรง|ทนทาน|สะดวก|ง่าย|ประหยัด|พร้อม|ใส่สบาย|ยืดหยุ่น|แห้งไว|นิ่ม|นุ่ม|ละเอียด|สีสันสด|สวย|หรู|น่ารัก|ใช้งานจริง|ส่งฟรี|ส่งไว|ส่งด่วน|ส่งเร็ว|ถึงเร็ว)/iu;

function extractObjectiveDetail(description, cleanName) {
  const source = sanitizeText(description).slice(0, 2_500)
    .replace(/<[^>]*>/gu, ' ')
    .replace(/https?:\/\/\S+/giu, ' ')
    .replace(/\\/gu, ' ')
    .replace(/[*`#\[\]【】{}]+/gu, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[•●▪◼◆►▶✓✔■□]+/gu, '\n');
  const fragments = source.split(/(?:\r?\n+|(?<=[.!?。])\s+|\s*[|]+\s*)/u)
    .map((fragment) => fragment.replace(/^\s*[-–—*#:=\d.)]+\s*/u, '').replace(/\s+/g, ' ').trim())
    .filter((fragment) => fragment.length >= 18 && fragment.length <= 105)
    .filter((fragment) => OBJECTIVE_DETAIL_SIGNAL.test(fragment) && !OBJECTIVE_DETAIL_BLOCK.test(fragment))
    .filter((fragment) => !hasPublicPromoNoise(fragment) && !hasListingPriceNoise(fragment))
    .filter((fragment) => !ILLEGAL_OR_RED.test(fragment) && !SEVERE_HEALTH_CLAIM.test(fragment) && !SUMMARY_FORBIDDEN.test(fragment))
    .filter((fragment) => !normalizeSearch(cleanName).includes(normalizeSearch(fragment)));
  return fragments.length ? trimAtWord(fragments[0], 88) : '';
}

function makeSummary(category, cleanName, rawTitle, description) {
  const sensitive = category.riskTier === 'amber';
  const facts = extractFacts(sensitive ? rawTitle : `${rawTitle} ${description.slice(0, 500)}`);
  const identity = trimAtWord(cleanName, sensitive ? 62 : 70);
  const identitySearch = normalizeSearch(identity);
  const uniqueFacts = facts.filter((fact) => !identitySearch.includes(normalizeSearch(fact)));
  const factText = uniqueFacts.length ? ` ระบุ ${uniqueFacts.join(' และ ')}` : '';
  if (category.summaryKind === 'automotive') {
    return `${identity}${factText} เป็น${category.label} ควรตรวจสอบรุ่นรถ ปี ขนาด และตำแหน่งติดตั้งก่อนสั่งซื้อ`;
  }
  if (category.summaryKind === 'skincare') {
    return `${identity}${factText} เป็น${category.label} โปรดตรวจสอบสูตร ปริมาณ วิธีใช้ และคำเตือนบนฉลากก่อนเลือกซื้อ`;
  }
  if (category.summaryKind === 'supplement') {
    return `${identity}${factText} เป็น${category.label} โปรดตรวจสอบส่วนประกอบ ปริมาณต่อหน่วยบริโภค และคำแนะนำบนฉลาก`;
  }
  if (category.summaryKind === 'food') {
    return `${identity}${factText} เป็น${category.label} โปรดตรวจสอบส่วนประกอบ ผู้ผลิต ปริมาณ อายุสินค้า และการจัดเก็บบนฉลาก`;
  }
  if (category.summaryKind === 'pet-food') {
    return `${identity}${factText} เป็น${category.label} โปรดตรวจสอบชนิดสัตว์ ช่วงวัย ส่วนประกอบ ปริมาณ และอายุสินค้าบนฉลาก`;
  }
  if (category.summaryKind === 'cosmetics') {
    return `${identity}${factText} เป็น${category.label} โปรดตรวจสอบสูตร สีหรือเฉด ปริมาณ อายุสินค้า วิธีใช้ และคำเตือนบนฉลาก`;
  }
  if (category.summaryKind === 'religious') {
    return `${identity}${factText} เป็น${category.label} ควรตรวจสอบแหล่งที่มา วัสดุ ขนาด สภาพ และหลักฐานจากผู้ขายก่อนเลือกซื้อ`;
  }
  if (category.summaryKind === 'electrical') {
    return `${identity}${factText} เป็น${category.label} ควรตรวจสอบแรงดัน กำลังไฟ ชนิดปลั๊ก มาตรฐาน และเงื่อนไขรับประกันก่อนสั่งซื้อ`;
  }
  if (category.summaryKind === 'baby') {
    return `${identity}${factText} เป็น${category.label} ควรตรวจสอบช่วงอายุ ขนาด วัสดุ วิธีใช้ และคำเตือนด้านความปลอดภัยก่อนเลือกซื้อ`;
  }
  const detail = extractObjectiveDetail(description, cleanName);
  return detail
    ? `${identity}${factText} เป็นสินค้าในหมวด${category.label} รายละเอียดระบุว่า ${detail}`
    : `${identity}${factText} เป็นสินค้าในหมวด${category.label} โดยควรตรวจสอบขนาด จำนวน และตัวเลือกก่อนสั่งซื้อ`;
}

function passesControlledReview({ category, cleanName, summary, sourceText, checkedAt, shopType: type }) {
  if (category.riskTier !== 'amber') return true;
  const publicText = `${cleanName} ${summary}`;
  if (forbiddenPublicText(publicText) || hasCategoryControlledPublicClaim(category, publicText)) return false;
  if (usesLegacyControlledClaimPolicy(category) && hasCategoryControlledSourceRisk(category, sourceText)) return false;
  if (category.expiryGate && hasExpiredOrNearExpiry(sourceText, checkedAt)) return false;
  if (category.trustedShopOnly && type === 'general') return false;
  if (category.groupKey === 'automotive') {
    if (isUnsafeAutomotiveText(`${sourceText} ${publicText}`) || !/ตรวจสอบรุ่นรถ/u.test(summary)) return false;
    if (!hasAutoLowRiskIdentity(category.key, cleanName)) return false;
  }
  if (category.summaryKind === 'skincare' && (!/โปรดตรวจสอบสูตร/u.test(summary) || UNSUPPORTED_SPF.test(publicText))) return false;
  if (category.summaryKind === 'supplement' && (type === 'general' || !/โปรดตรวจสอบส่วนประกอบ/u.test(summary))) return false;
  if (category.summaryKind === 'food' && !/โปรดตรวจสอบส่วนประกอบ/u.test(summary)) return false;
  if (category.summaryKind === 'pet-food' && !/โปรดตรวจสอบชนิดสัตว์/u.test(summary)) return false;
  if (category.summaryKind === 'cosmetics' && !/โปรดตรวจสอบสูตร/u.test(summary)) return false;
  if (category.summaryKind === 'religious' && !/ตรวจสอบแหล่งที่มา/u.test(summary)) return false;
  if (category.summaryKind === 'electrical' && !/ตรวจสอบแรงดัน/u.test(summary)) return false;
  if (category.summaryKind === 'baby' && !/ตรวจสอบช่วงอายุ/u.test(summary)) return false;
  return true;
}

function priceFitScore(priceMin) {
  if (priceMin >= 39 && priceMin <= 799) return 1;
  if (priceMin >= 20 && priceMin <= 1_999) return 0.85;
  if (priceMin <= 4_999) return 0.6;
  return 0.35;
}

function recommendationScore({ itemSold, rating, likes, shopRating, shopType: type, stock, priceMin, descriptionLength, seasonalScore }) {
  const soldSignal = Math.min(1, Math.log10(itemSold + 1) / 4.5);
  // Shrink sparse perfect scores towards 4.2 so 5.0 with a few sales does not
  // outrank 4.8 backed by substantial cumulative sales.
  const confidence = itemSold / (itemSold + 50);
  const adjustedRating = 4.2 + (rating - 4.2) * confidence;
  const ratingSignal = Math.max(0, Math.min(1, (adjustedRating - 4.2) / 0.8));
  const shopSignal = Math.max(0, Math.min(1, (shopRating - 4) / 1));
  const shopTypeSignal = type === 'official' ? 1 : type === 'preferred' ? 0.75 : 0.45;
  const likeSignal = Math.min(1, Math.log10(likes + 1) / 4);
  const stockSignal = stock >= 100 ? 1 : stock >= 20 ? 0.75 : 0.5;
  const completeness = descriptionLength >= 200 ? 1 : descriptionLength >= 80 ? 0.7 : 0.45;
  const seasonSignal = seasonalScore / 100;
  const total = soldSignal * 35 + ratingSignal * 20 + (shopSignal * 0.55 + shopTypeSignal * 0.45) * 15 +
    stockSignal * 5 + likeSignal * 5 + priceFitScore(priceMin) * 10 + completeness * 5 + seasonSignal * 5;
  return Math.round(Math.max(0, Math.min(100, total)) * 100) / 100;
}

function reasonCodes({ itemSold, rating, likes, shopType: type, seasonalScore, priceMin, priceMax }) {
  const reasons = [];
  if (itemSold >= 1_000) reasons.push('high-cumulative-sales');
  else if (itemSold >= 100) reasons.push('strong-cumulative-sales');
  else reasons.push('established-sales-signal');
  if (rating >= 4.8) reasons.push('high-rating');
  if (type === 'official') reasons.push('official-shop');
  else if (type === 'preferred') reasons.push('preferred-shop');
  if (likes >= 100) reasons.push('high-like-signal');
  if (seasonalScore > 50) reasons.push('season-fit');
  if (priceMin === priceMax) reasons.push('clear-fixed-price');
  return reasons.slice(0, 4);
}

function increment(rejections, key) {
  rejections[key] = (rejections[key] ?? 0) + 1;
  const category = rejections._activeCategory;
  if (category) {
    const groupCounts = rejections._byGroup.get(category.groupKey) ?? new Map();
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    rejections._byGroup.set(category.groupKey, groupCounts);
    const leafCounts = rejections._bySubcategory.get(category.key) ?? new Map();
    leafCounts.set(key, (leafCounts.get(key) ?? 0) + 1);
    rejections._bySubcategory.set(category.key, leafCounts);
  }
}

export function evaluateSellableRow(row, index, checkedAt, rejectionCounts) {
  rejectionCounts._activeCategory = null;
  if (row.length !== index.size) { increment(rejectionCounts, 'malformed'); return null; }
  const c1 = sanitizeText(field(row, index, 'global_category1')).trim();
  const c2 = sanitizeText(field(row, index, 'global_category2')).trim();
  const c3 = sanitizeText(field(row, index, 'global_category3')).trim();
  const sourceTitle = field(row, index, 'title');
  const sourceDescription = field(row, index, 'description');
  const rawTitle = sanitizeText(sourceTitle).trim();
  const description = sanitizeText(sourceDescription);
  const earlyText = `${rawTitle} ${description.slice(0, 1_800)}`;
  // Apply the source gate before whole-field NFKC normalization. Thai Sara Am
  // can expand under NFKC, so normalizing first and slicing second can move a
  // policy phrase across the bounded 1,800-character inspection window.
  if (hasSourceListingPolicyRisk(sourceTitle, sourceDescription)) { increment(rejectionCounts, 'sourcePolicy'); return null; }
  if (ILLEGAL_OR_RED.test(earlyText)) { increment(rejectionCounts, 'riskRed'); return null; }
  const category = classify(c1, c2, c3, rawTitle);
  if (!category) { increment(rejectionCounts, 'outsideTaxonomy'); return null; }
  rejectionCounts._activeCategory = category;
  const controlledSourceText = category.riskTier === 'amber' ? `${rawTitle} ${description}` : rawTitle;
  if (BAD_SOURCE_FORMAT.test(rawTitle) || hasListingPriceNoise(rawTitle) || hasUppercaseCodNoise(rawTitle)) {
    increment(rejectionCounts, 'sourcePolicy'); return null;
  }
  if (ACTIVE_CLEANING_OR_DISINFECTANT.test(rawTitle)) { increment(rejectionCounts, 'categorySafety'); return null; }
  if (category.riskTier === 'amber' && hasControlledTitleNoise(rawTitle)) {
    increment(rejectionCounts, 'controlledTitleNoise'); return null;
  }
  if (category.deny?.test(`${rawTitle} ${description.slice(0, 700)}`)) { increment(rejectionCounts, 'categorySafety'); return null; }
  if (category.summaryKind === 'automotive' && isUnsafeAutomotiveText(earlyText)) { increment(rejectionCounts, 'categorySafety'); return null; }
  if (category.summaryKind === 'automotive' && hasControlledPublicClaim(category.groupKey, rawTitle)) { increment(rejectionCounts, 'unsafeClaims'); return null; }
  if ((category.expiryGate || category.summaryKind === 'skincare' || category.summaryKind === 'supplement') && hasExpiredOrNearExpiry(controlledSourceText, checkedAt)) {
    increment(rejectionCounts, 'expiredOrNearExpiry'); return null;
  }
  if (usesLegacyControlledClaimPolicy(category) && hasCategoryControlledSourceRisk(category, controlledSourceText)) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  if (category.riskTier === 'amber' && (SEVERE_HEALTH_CLAIM.test(earlyText) || SENSITIVE_TITLE_CLAIM.test(rawTitle))) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  if (hasCategoryControlledPublicClaim(category, rawTitle)) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  if (category.summaryKind === 'skincare' && UNSUPPORTED_SPF.test(rawTitle)) {
    increment(rejectionCounts, 'unsupportedEvidenceClaim'); return null;
  }

  const stock = Math.floor(Math.max(0, toFiniteNumber(field(row, index, 'stock'))));
  if (stock <= 0) { increment(rejectionCounts, 'outOfStock'); return null; }
  if (/^(?:true|1|yes)$/iu.test(field(row, index, 'holiday_mode_on').trim())) { increment(rejectionCounts, 'holidayMode'); return null; }
  const shopId = field(row, index, 'shopid').trim();
  const itemId = field(row, index, 'itemid').trim();
  const productUrl = canonicalProductUrl(shopId, itemId);
  if (!productUrl) { increment(rejectionCounts, 'invalidIds'); return null; }
  const imageUrl = findImageUrl(row, index);
  if (!imageUrl) { increment(rejectionCounts, 'invalidImage'); return null; }
  const prices = parsePriceRange(row, index);
  if (!prices) { increment(rejectionCounts, 'invalidPrice'); return null; }
  const maxPrice = category.riskTier === 'amber' ? 15_000 : 30_000;
  const maxRatio = category.riskTier === 'amber' ? 5 : 8;
  if (prices.suspiciousDeepSale || prices.priceMin < 10 || prices.priceMax > maxPrice || prices.priceMax / prices.priceMin > maxRatio) {
    increment(rejectionCounts, 'priceBait'); return null;
  }

  const itemSold = Math.floor(Math.max(0, toFiniteNumber(field(row, index, 'item_sold'))));
  const likes = Math.floor(Math.max(0, toFiniteNumber(field(row, index, 'like'))));
  const rating = Math.round(Math.min(5, Math.max(0, toFiniteNumber(field(row, index, 'item_rating')))) * 100) / 100;
  const sellerRatingRaw = toFiniteNumber(field(row, index, 'shop_rating'));
  const shopRating = Math.round(Math.min(5, Math.max(0, sellerRatingRaw || 0)) * 100) / 100;
  const type = shopType(row, index);
  const sensitive = category.riskTier === 'amber';
  if (rating < (sensitive ? 4.7 : 4.5) || shopRating < (sensitive ? 4.6 : 4.4)) {
    increment(rejectionCounts, 'lowRating'); return null;
  }
  if (sensitive ? itemSold < 20 && likes < 20 : itemSold < 10 && likes < 10) {
    increment(rejectionCounts, 'lowSignal'); return null;
  }
  if ((category.summaryKind === 'supplement' || category.trustedShopOnly) && type === 'general') {
    increment(rejectionCounts, 'controlledShopGate'); return null;
  }

  const cleanName = sanitizeName(rawTitle, sensitive);
  if (cleanName.length < 8 || cleanName.length > 105 || NAME_FORBIDDEN.test(cleanName) || SUMMARY_FORBIDDEN.test(cleanName) ||
      hasPublicPromoNoise(cleanName) || hasListingPriceNoise(cleanName) || hasUppercaseCodNoise(cleanName) ||
      hasNonRetailListingMarker(cleanName) || hasDefectiveListingTitle(cleanName) || isNonInformativePublicName(cleanName) ||
      (sensitive && (SENSITIVE_TITLE_CLAIM.test(cleanName) || SEVERE_HEALTH_CLAIM.test(cleanName)))) {
    increment(rejectionCounts, 'invalidName'); return null;
  }
  if (hasCategoryControlledPublicClaim(category, cleanName)) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  if (category.summaryKind === 'automotive' && hasControlledPublicClaim(category.groupKey, cleanName)) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  const summary = makeSummary(category, cleanName, rawTitle, description).replace(/\s+/g, ' ').trim();
  const invalidSummaryReason = summary.length < 45 || summary.length > 190 ? 'invalidSummaryLength'
    : SUMMARY_FORBIDDEN.test(summary) ? 'invalidSummaryForbidden'
      : hasPublicPromoNoise(summary) ? 'invalidSummaryPromo'
        : hasListingPriceNoise(summary) ? 'invalidSummaryPrice'
          : hasUppercaseCodNoise(summary) ? 'invalidSummaryCod'
            : hasNonRetailListingMarker(`${cleanName} ${summary}`) ? 'invalidSummaryPolicy'
              : '';
  if (invalidSummaryReason) {
    increment(rejectionCounts, invalidSummaryReason);
    increment(rejectionCounts, 'invalidSummary'); return null;
  }
  if (!passesControlledReview({ category, cleanName, summary, sourceText: controlledSourceText, checkedAt, shopType: type })) {
    increment(rejectionCounts, 'controlledReview'); return null;
  }
  const seasonal = makeSeasonalMetadataV4(category, cleanName, summary);
  const score = recommendationScore({
    itemSold, rating, likes, shopRating, shopType: type, stock, priceMin: prices.priceMin,
    descriptionLength: description.trim().length, seasonalScore: seasonal.seasonalScore,
  });
  const base = {
    id: `${shopId}-${itemId}`,
    categoryGroupKey: category.groupKey,
    categoryGroup: category.group,
    categoryKey: category.categoryKey,
    category: category.category,
    subcategoryKey: category.key,
    subcategory: category.label,
    merchandisingTags: merchandisingTagsV5(category, cleanName, rawTitle),
    imageUrl,
    cleanName,
    summary,
    priceMin: prices.priceMin,
    priceMax: prices.priceMax,
    priceType: prices.priceMin === prices.priceMax ? 'fixed' : 'range',
    checkedAt,
    productUrl,
    shopId,
    itemId,
    itemSold,
    rating,
    likes,
    shopRating,
    shopType: type,
    sellerVerified: truthyShopFlag(field(row, index, 'shopee_verified_flag'), 'verified'),
    stockStatus: 'in-stock',
    stockLevel: stock >= 100 ? 'high' : stock >= 20 ? 'available' : 'low',
    riskTier: category.riskTier,
    reviewStatus: 'approved',
    reviewMethod: sensitive ? 'automated-controlled-policy-v5' : 'automated-ruleset-v5',
    recommendationScore: score,
    reasonCodes: [],
    ...seasonal,
  };
  base.reasonCodes = reasonCodes({ ...base, seasonalScore: seasonal.seasonalScore });
  base.normalizedSearchText = makeSearchText(base);
  return {
    ...base,
    score,
    titleFingerprint: titleFingerprint(cleanName),
    summaryFingerprint: semanticSummaryFingerprint(summary),
    imageFingerprint: new URL(imageUrl).pathname.split('/').filter(Boolean).at(-1),
    sourceCategoryPath: pathText(c1, c2, c3),
  };
}

function publicProduct(candidate) {
  const { score, titleFingerprint: _title, summaryFingerprint: _summary, imageFingerprint: _image, sourceCategoryPath: _source, ...record } = candidate;
  return record;
}

function candidateOrder(left, right) {
  return right.score - left.score || right.itemSold - left.itemSold || right.rating - left.rating || left.id.localeCompare(right.id, 'en');
}

export function selectSellableCatalog(candidatesByCategory, rankedCount = DEFAULT_RANKED_TARGET, reserveCount = DEFAULT_RESERVE_TARGET, { diagnostics = null } = {}) {
  const pools = new Map([...candidatesByCategory].map(([key, heap]) => [key, heap.toSortedDescending()]));
  const selectedIds = new Set();
  const selectedTitles = new Set();
  const selectedImages = new Set();
  const selectedSummaryCounts = new Map();
  const shopCounts = new Map();

  const canUse = (candidate, shopCap, categoryCounts, categoryCap, groupCounts, groupCaps = null) =>
    !selectedIds.has(candidate.id) && candidate.titleFingerprint.length >= 6 && !selectedTitles.has(candidate.titleFingerprint) &&
    candidate.summaryFingerprint && (selectedSummaryCounts.get(candidate.summaryFingerprint) ?? 0) < 5 &&
    candidate.imageFingerprint && !selectedImages.has(candidate.imageFingerprint) &&
    (shopCounts.get(candidate.shopId) ?? 0) < shopCap && (categoryCounts.get(candidate.subcategoryKey) ?? 0) < categoryCap &&
    (!groupCaps || (groupCounts.get(candidate.categoryGroupKey) ?? 0) < (groupCaps.get(candidate.categoryGroupKey) ?? Infinity));

  const add = (target, candidate, categoryCounts, groupCounts) => {
    target.push(candidate);
    selectedIds.add(candidate.id);
    selectedTitles.add(candidate.titleFingerprint);
    selectedImages.add(candidate.imageFingerprint);
    selectedSummaryCounts.set(candidate.summaryFingerprint, (selectedSummaryCounts.get(candidate.summaryFingerprint) ?? 0) + 1);
    shopCounts.set(candidate.shopId, (shopCounts.get(candidate.shopId) ?? 0) + 1);
    categoryCounts.set(candidate.subcategoryKey, (categoryCounts.get(candidate.subcategoryKey) ?? 0) + 1);
    groupCounts.set(candidate.categoryGroupKey, (groupCounts.get(candidate.categoryGroupKey) ?? 0) + 1);
  };

  const selectInto = (target, count, { quotas, shopCap, categoryCap, stagedGroupCaps = false }) => {
    const categoryCounts = new Map();
    const groupCounts = new Map();
    const historicallyDominant = new Set(['fashion', 'home', 'learning']);
    const nonDominantGroupKeys = Object.keys(CATALOG_GROUP_QUOTAS).filter((key) => !historicallyDominant.has(key));
    const dominantGroupKeys = Object.keys(CATALOG_GROUP_QUOTAS).filter((key) => historicallyDominant.has(key));
    let quotaScale = 1;
    let quotaOrder = [];
    const protectedControlled = (category) => category.groupKey === 'automotive' || category.groupKey === 'supplements' || category.summaryKind === 'skincare';
    const applyCategoryQuotas = (dominant, protection = 'all') => {
      for (const category of quotaOrder) {
        if (historicallyDominant.has(category.groupKey) !== dominant) continue;
        if (protection === 'protected' && !protectedControlled(category)) continue;
        if (protection === 'ordinary' && protectedControlled(category)) continue;
        const pool = pools.get(category.key) ?? [];
        const scaledQuota = Math.max(1, Math.floor(category.quota * quotaScale));
        for (const candidate of pool) {
          if (target.length >= count || (categoryCounts.get(category.key) ?? 0) >= scaledQuota) break;
          if (canUse(candidate, shopCap, categoryCounts, scaledQuota, groupCounts)) add(target, candidate, categoryCounts, groupCounts);
        }
      }
    };
    if (quotas) {
      const declaredQuotaTotal = CATALOG_RULES.reduce((sum, category) => sum + category.quota, 0);
      quotaScale = Math.min(1, count / declaredQuotaTotal);
      quotaOrder = [...CATALOG_RULES].sort((left, right) =>
        Number(protectedControlled(right)) - Number(protectedControlled(left)) ||
        Number(historicallyDominant.has(left.groupKey)) - Number(historicallyDominant.has(right.groupKey)));
      // Secure the scarce controlled cohorts first. Ordinary category and group
      // quotas are completed after the cardinality pass below, so their
      // high-scoring rows cannot consume a shared shop slot while also blocking
      // a shop-diverse alternative with the same title or image.
      applyCategoryQuotas(false, 'protected');
    }
    const merged = [...pools.values()].flat().sort(candidateOrder);
    let groupQuotaScale = 1;
    const applyGroupQuotas = (groupKeys) => {
      for (const groupKey of groupKeys) {
        const declaredQuota = CATALOG_GROUP_QUOTAS[groupKey];
        const groupTarget = Math.max(1, Math.floor(declaredQuota * groupQuotaScale));
        for (const candidate of merged) {
          if (target.length >= count || (groupCounts.get(groupKey) ?? 0) >= groupTarget) break;
          if (candidate.categoryGroupKey === groupKey && canUse(candidate, shopCap, categoryCounts, categoryCap, groupCounts)) {
            add(target, candidate, categoryCounts, groupCounts);
          }
        }
      }
    };
    if (quotas) groupQuotaScale = Math.min(1, count / DEFAULT_RANKED_TARGET);
    if (stagedGroupCaps) {
      const nonDominantCandidates = merged.filter((candidate) => !historicallyDominant.has(candidate.categoryGroupKey));
      const nonDominantShopSupply = nonDominantCandidates.reduce((counts, candidate) =>
        counts.set(candidate.shopId, (counts.get(candidate.shopId) ?? 0) + 1), new Map());
      const nonDominantSubcategorySupply = nonDominantCandidates.reduce((counts, candidate) =>
        counts.set(candidate.subcategoryKey, (counts.get(candidate.subcategoryKey) ?? 0) + 1), new Map());
      const nonDominantShopDepth = new Map();
      const shopDiverseNonDominantEntries = nonDominantCandidates.map((candidate) => {
        const depth = (nonDominantShopDepth.get(candidate.shopId) ?? 0) + 1;
        nonDominantShopDepth.set(candidate.shopId, depth);
        const subcategorySupply = nonDominantSubcategorySupply.get(candidate.subcategoryKey);
        return {
          candidate,
          depth,
          shopSupply: nonDominantShopSupply.get(candidate.shopId),
          subcategorySupply,
          surplusSubcategory: subcategorySupply > categoryCap,
        };
      }).sort((left, right) =>
        Number(left.surplusSubcategory) - Number(right.surplusSubcategory) ||
        left.depth - right.depth || left.shopSupply - right.shopSupply || candidateOrder(left.candidate, right.candidate));
      const shopDiverseNonDominant = shopDiverseNonDominantEntries.map(({ candidate }) => candidate);
      const scarceNonDominant = shopDiverseNonDominantEntries.filter(({ surplusSubcategory }) => !surplusSubcategory).map(({ candidate }) => candidate);
      const surplusNonDominant = shopDiverseNonDominantEntries.filter(({ surplusSubcategory }) => surplusSubcategory).map(({ candidate }) => candidate);
      const groupPools = (candidates) => new Map(nonDominantGroupKeys.map((key) =>
        [key, candidates.filter((candidate) => candidate.categoryGroupKey === key)]));
      const scarceByGroup = groupPools(scarceNonDominant);
      const surplusByGroup = groupPools(surplusNonDominant);
      const byGroup = new Map(Object.keys(CATALOG_GROUP_QUOTAS).map((key) => [key,
        historicallyDominant.has(key)
          ? merged.filter((candidate) => candidate.categoryGroupKey === key)
          : shopDiverseNonDominant.filter((candidate) => candidate.categoryGroupKey === key),
      ]));
      const cursors = new Map(Object.keys(CATALOG_GROUP_QUOTAS).map((key) => [key, 0]));
      const scarceCursors = new Map(nonDominantGroupKeys.map((key) => [key, 0]));
      const surplusCursors = new Map(nonDominantGroupKeys.map((key) => [key, 0]));
      const fillBreadthFirst = (groupKeys, stopAt = count, candidatePools = byGroup, candidateCursors = cursors) => {
        let madeProgress = true;
        while (target.length < stopAt && madeProgress) {
          madeProgress = false;
          for (const groupKey of groupKeys) {
            const groupPool = candidatePools.get(groupKey) ?? [];
            let cursor = candidateCursors.get(groupKey) ?? 0;
            while (cursor < groupPool.length) {
              const candidate = groupPool[cursor];
              cursor += 1;
              if (canUse(candidate, shopCap, categoryCounts, categoryCap, groupCounts)) {
                add(target, candidate, categoryCounts, groupCounts);
                madeProgress = true;
                break;
              }
            }
            candidateCursors.set(groupKey, cursor);
            if (target.length >= stopAt) break;
          }
        }
      };
      // Reserve at least half of ranked capacity for the thirteen
      // non-dominant groups before fashion, home and learning can consume the
      // shared shop cap. This makes the <=50% concentration rule a selection
      // invariant instead of a post-build artifact check.
      const minimumNonDominantCount = Math.ceil(count / 2);
      // Select leaves whose retained supply fits under the unchanged
      // subcategory cap before considering a surplus leaf. A surplus leaf can
      // then use alternate shops to fill the remaining slots instead of winning
      // a title/image/shop collision that strands a scarce-category product.
      fillBreadthFirst(nonDominantGroupKeys, minimumNonDominantCount, scarceByGroup, scarceCursors);
      fillBreadthFirst(nonDominantGroupKeys, minimumNonDominantCount, surplusByGroup, surplusCursors);
      if (diagnostics) {
        const blockerCounts = new Map();
        const primaryBlockerCounts = new Map();
        let availableNow = 0;
        let unselectedCandidateCount = 0;
        for (const candidate of nonDominantCandidates) {
          if (selectedIds.has(candidate.id)) continue;
          unselectedCandidateCount += 1;
          const blockers = [];
          if (candidate.titleFingerprint.length < 6) blockers.push('short-title-fingerprint');
          if (selectedTitles.has(candidate.titleFingerprint)) blockers.push('duplicate-title');
          if (!candidate.summaryFingerprint) blockers.push('missing-summary-fingerprint');
          if ((selectedSummaryCounts.get(candidate.summaryFingerprint) ?? 0) >= 5) blockers.push('summary-cap');
          if (!candidate.imageFingerprint) blockers.push('missing-image-fingerprint');
          if (selectedImages.has(candidate.imageFingerprint)) blockers.push('duplicate-image');
          if ((shopCounts.get(candidate.shopId) ?? 0) >= shopCap) blockers.push('shop-cap');
          if ((categoryCounts.get(candidate.subcategoryKey) ?? 0) >= categoryCap) blockers.push('subcategory-cap');
          if (!blockers.length) availableNow += 1;
          else {
            primaryBlockerCounts.set(blockers[0], (primaryBlockerCounts.get(blockers[0]) ?? 0) + 1);
            for (const blocker of blockers) blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1);
          }
        }
        diagnostics.rankedNonDominant = {
          targetCount: minimumNonDominantCount,
          selectedCount: target.length,
          candidateCount: nonDominantCandidates.length,
          unselectedCandidateCount,
          availableNow,
          blockerCounts: Object.fromEntries([...blockerCounts].sort(([left], [right]) => left.localeCompare(right, 'en'))),
          primaryBlockerCounts: Object.fromEntries([...primaryBlockerCounts].sort(([left], [right]) => left.localeCompare(right, 'en'))),
          selectedByGroup: Object.fromEntries(nonDominantGroupKeys.map((key) => [key, groupCounts.get(key) ?? 0])),
          selectedBySubcategory: Object.fromEntries([...categoryCounts].sort(([left], [right]) => left.localeCompare(right, 'en'))),
        };
      }
      if (target.length < minimumNonDominantCount) {
        throw new Error(`Could select only ${target.length} of ${minimumNonDominantCount} required non-dominant ranked products without relaxing quality gates`);
      }
      if (quotas) {
        applyCategoryQuotas(false, 'ordinary');
        applyGroupQuotas(nonDominantGroupKeys);
        applyCategoryQuotas(true);
        applyGroupQuotas(dominantGroupKeys);
      }
      fillBreadthFirst(Object.keys(CATALOG_GROUP_QUOTAS));
    } else {
      if (quotas) {
        applyCategoryQuotas(true);
        applyGroupQuotas(dominantGroupKeys);
      }
      for (const candidate of merged) {
        if (target.length >= count) break;
        if (canUse(candidate, shopCap, categoryCounts, categoryCap, groupCounts)) add(target, candidate, categoryCounts, groupCounts);
      }
    }
    if (quotas && stagedGroupCaps) {
      const concentratedCount = dominantGroupKeys.reduce((sum, key) => sum + (groupCounts.get(key) ?? 0), 0);
      const maximumConcentratedCount = Math.floor(count / 2);
      if (concentratedCount > maximumConcentratedCount) {
        throw new Error(`Dominant groups selected ${concentratedCount} rows; maximum is ${maximumConcentratedCount}`);
      }
    }
    return { categoryCounts, groupCounts };
  };

  const ranked = [];
  selectInto(ranked, rankedCount, { quotas: true, shopCap: 18, categoryCap: Math.max(650, Math.ceil(rankedCount * 0.08)), stagedGroupCaps: true });
  if (ranked.length !== rankedCount) throw new Error(`Could select only ${ranked.length} of ${rankedCount} ranked products`);
  ranked.sort(candidateOrder);
  const reserve = [];
  selectInto(reserve, reserveCount, { quotas: false, shopCap: 24, categoryCap: Math.max(150, Math.ceil(reserveCount * 0.12)) });
  if (reserve.length !== reserveCount) throw new Error(`Could select only ${reserve.length} of ${reserveCount} reserve products`);
  reserve.sort(candidateOrder);
  return {
    ranked: ranked.map((candidate, index) => ({ rank: index + 1, ...publicProduct(candidate) })),
    reserve: reserve.map((candidate, index) => ({ reserveOrder: index + 1, ...publicProduct(candidate) })),
  };
}

export function parseCheckedAtFromFilename(inputPath) {
  const match = basename(inputPath).match(/_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:_|\.)/u);
  if (!match) throw new Error('Could not derive checked time from feed filename; pass --checked-at explicitly');
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`;
}

export function makeFeaturedBook() {
  const seasonal = makeSeasonalMetadataV4(
    'physical-books',
    'หนังสือคว้าเงินล้านในอากาศ ด้วยคลิป AI ปักตะกร้า ฉบับนายหน้า TikTok',
    'หนังสือสอนสร้างคลิป AI สำหรับนายหน้า TikTok ตั้งแต่หาแนวคิด วางเนื้อหา ไปจนถึงทำคลิปปักตะกร้าเป็นขั้นตอน',
  );
  const base = {
    id: 'featured-dkub-book', featured: true,
    categoryGroupKey: 'learning', categoryGroup: GROUPS.learning,
    categoryKey: 'books', category: CATEGORY_PARENTS_V5.books.label,
    subcategoryKey: 'physical-books', subcategory: 'หนังสือเล่มและสื่อการเรียนรู้',
    merchandisingTags: [],
    imageUrl: 'https://down-th.img.susercontent.com/file/th-11134207-81ztc-moxgell974lp5f',
    cleanName: 'หนังสือคว้าเงินล้านในอากาศ ด้วยคลิป AI ปักตะกร้า ฉบับนายหน้า TikTok',
    summary: 'หนังสือสอนสร้างคลิป AI สำหรับนายหน้า TikTok ตั้งแต่หาแนวคิด วางเนื้อหา ไปจนถึงทำคลิปปักตะกร้าเป็นขั้นตอน',
    priceMin: 345, priceMax: 345, priceType: 'fixed', checkedAt: '2026-08-17T15:26:00+07:00',
    productUrl: 'https://shopee.co.th/product/1032408641/48511491095',
    ...seasonal,
    shopName: 'DkubStore', shopId: '1032408641', itemId: '48511491095',
  };
  return { ...base, normalizedSearchText: makeSearchText(base) };
}

export function newRejectionCounts() {
  const counts = {
    malformed: 0, riskRed: 0, outsideTaxonomy: 0, sourcePolicy: 0, categorySafety: 0,
    unsafeClaims: 0, controlledTitleNoise: 0, expiredOrNearExpiry: 0, unsupportedEvidenceClaim: 0, outOfStock: 0, holidayMode: 0,
    invalidIds: 0, invalidImage: 0, invalidPrice: 0, priceBait: 0, lowRating: 0,
    lowSignal: 0, controlledShopGate: 0, controlledReview: 0, invalidName: 0, invalidSummary: 0,
    invalidSummaryLength: 0, invalidSummaryForbidden: 0, invalidSummaryPromo: 0, invalidSummaryPrice: 0, invalidSummaryCod: 0,
    invalidSummaryPolicy: 0,
  };
  Object.defineProperties(counts, {
    _activeCategory: { value: null, writable: true, enumerable: false },
    _byGroup: { value: new Map(), enumerable: false },
    _bySubcategory: { value: new Map(), enumerable: false },
  });
  return counts;
}

export function rejectionBreakdown(rejectionCounts) {
  const convert = (source) => Object.fromEntries([...source.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], 'en'))
    .map(([scope, counts]) => [scope, Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1]))]));
  return {
    byGroup: convert(rejectionCounts._byGroup),
    bySubcategory: convert(rejectionCounts._bySubcategory),
  };
}

export function toRuntimeModule(catalog) {
  const payload = JSON.stringify(catalog);
  const compressed = gzipSync(Buffer.from(payload, 'utf8'), { level: 9 }).toString('base64');
  return [
    "'use strict';", '',
    '// Generated by scripts/catalog/build-product-catalog.mjs. Do not edit directly.',
    "const { gunzipSync } = require('node:zlib');",
    `const payload = JSON.parse(gunzipSync(Buffer.from('${compressed}', 'base64')).toString('utf8'));`,
    'module.exports = Object.freeze(payload);', '',
  ].join('\n');
}

export function forbiddenPublicText(value) {
  return SUMMARY_FORBIDDEN.test(String(value ?? '')) || ILLEGAL_OR_RED.test(String(value ?? '')) ||
    hasNonRetailListingMarker(value);
}
