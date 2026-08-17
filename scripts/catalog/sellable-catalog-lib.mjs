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

export { MinHeap };

export const CATALOG_SCHEMA_VERSION = 3;
export const DEFAULT_RANKED_TARGET = 20_000;
export const DEFAULT_RESERVE_TARGET = 2_000;
export const MINIMUM_RANKED_COUNT = 18_000;

export const REQUIRED_SELLABLE_COLUMNS = Object.freeze([
  'global_category1', 'global_category2', 'global_category3', 'stock', 'item_sold',
  'title', 'shopid', 'itemid', 'description', 'model_prices', 'sale_price', 'price',
  'item_rating', 'shop_rating', 'like', 'image_link', 'is_official_shop',
  'is_preferred_shop', 'shopee_verified_flag', 'product_link',
]);

const GROUPS = Object.freeze({
  automotive: 'รถและการเดินทาง',
  tools: 'เครื่องมือช่างและ DIY',
  learning: 'หนังสือ เครื่องเขียน และงานสร้างสรรค์',
  home: 'บ้าน ครัว และการจัดเก็บ',
  outdoor: 'สวน กีฬา และกลางแจ้ง',
  tech: 'อุปกรณ์มือถือและคอมพิวเตอร์',
  pets: 'อุปกรณ์สัตว์เลี้ยง',
  beauty: 'สกินแคร์และของใช้ส่วนตัว',
  supplements: 'อาหารเสริมและโภชนาการ',
  fashion: 'แฟชั่น กระเป๋า และไลฟ์สไตล์',
});

const rule = (key, label, groupKey, quota, matcher, options = {}) => Object.freeze({
  key, label, groupKey, group: GROUPS[groupKey], quota, matcher,
  riskTier: options.riskTier ?? 'green',
  deny: options.deny ?? null,
  summaryKind: options.summaryKind ?? 'general',
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
export const CATALOG_RULES = Object.freeze([
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

  rule('phone-cases', 'เคส ซอง และสายคล้องมือถือ', 'tech', 950, (c1, c2, c3, title) =>
    c1 === 'Mobile & Gadgets' && c2 === 'Accessories' && is(c3, /Cases, Covers, & Skins|Phone Straps & Keychains|Phone Grips|Mobile Pouches/iu) &&
    is(title, /เคส|ซอง|สายคล้อง|พวงกุญแจ|ที่จับ|กริ๊ป|case|cover|strap|keychain|grip|pouch/iu),
  { deny: /แบต|ชาร์จ|สายไฟ|ยูเอสบี|\busb\b|หลอดไฟ|พัดลม|battery|charger|cable|power\s*bank|\bled\b/iu }),
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

export const CATALOG_CATEGORY_DEFINITIONS = Object.freeze(CATALOG_RULES.map(({ key, label, groupKey, group, quota, riskTier }) =>
  Object.freeze({ key, label, groupKey, group, quota, riskTier })));

export const CATALOG_GROUP_DEFINITIONS = Object.freeze(Object.entries(GROUPS).map(([key, label]) => Object.freeze({ key, label })));

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

function canonicalPolicyText(value) {
  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
  return sanitizeText(value).normalize('NFC')
    .replace(/[๐-๙]/gu, (digit) => String(thaiDigits.indexOf(digit)))
    .replace(/\u0E4D\u0E32/gu, '\u0E33')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

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

export function makeSearchText(product) {
  return normalizeSearch([product.cleanName, product.summary, product.category, product.categoryGroup].join(' '));
}

function titleFingerprint(value) {
  return normalizeSearch(value).replace(/\b(?:สี|color)\s*[\p{L}\p{N}-]+/giu, '').replace(/\b\d+(?:[.,]\d+)?\s*(?:ชิ้น|pcs?|cm|mm|ml|g|kg)\b/giu, '').replace(/\s+/g, ' ').trim();
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
  const detail = extractObjectiveDetail(description, cleanName);
  return detail
    ? `${identity}${factText} เป็นสินค้าในหมวด${category.label} รายละเอียดระบุว่า ${detail}`
    : `${identity}${factText} เป็นสินค้าในหมวด${category.label} โดยควรตรวจสอบขนาด จำนวน และตัวเลือกก่อนสั่งซื้อ`;
}

function passesControlledReview({ category, cleanName, summary, sourceText, checkedAt, shopType: type }) {
  if (category.riskTier !== 'amber') return true;
  const publicText = `${cleanName} ${summary}`;
  if (forbiddenPublicText(publicText) || hasControlledPublicClaim(category.groupKey, publicText)) return false;
  if ((category.groupKey === 'beauty' || category.groupKey === 'supplements') &&
      (hasControlledSourceRisk(category.groupKey, sourceText) || hasExpiredOrNearExpiry(sourceText, checkedAt))) return false;
  if (category.groupKey === 'automotive') {
    if (isUnsafeAutomotiveText(`${sourceText} ${publicText}`) || !/ตรวจสอบรุ่นรถ/u.test(summary)) return false;
    if (!hasAutoLowRiskIdentity(category.key, cleanName)) return false;
  }
  if (category.groupKey === 'beauty' && (!/โปรดตรวจสอบสูตร/u.test(summary) || UNSUPPORTED_SPF.test(publicText))) return false;
  if (category.groupKey === 'supplements' && (type === 'general' || !/โปรดตรวจสอบส่วนประกอบ/u.test(summary))) return false;
  return true;
}

function seasonalMetadata(category, title) {
  const text = `${category.key} ${title}`;
  const tags = [];
  const months = new Set();
  const add = (tag, values) => { tags.push(tag); values.forEach((month) => months.add(month)); };
  let reason = 'เหมาะนำเสนอและทำคอนเทนต์ได้ตลอดทั้งปี';
  if (/กันฝน|ร่ม|เสื้อกันฝน|ผ้าใบ|dry\s*bag|rain|umbrella|bath-laundry|cleaning/iu.test(text)) {
    add('rainy', [6, 7, 8, 9, 10]); reason = 'เหมาะกับการใช้งานและทำคอนเทนต์ในช่วงหน้าฝน';
  }
  if (/กันแดด|บังแดด|sun|แก้ว|ขวดน้ํา|ขวดน้ำ|camping/iu.test(text)) {
    add('hot', [3, 4, 5]); reason = 'เหมาะกับการใช้งานและทำคอนเทนต์ในช่วงอากาศร้อน';
  }
  if (/หนังสือ|สมุด|ปากกา|ดินสอ|school|physical-books|writing|paper/iu.test(text)) {
    [1, 5, 6, 10].forEach((month) => months.add(month)); reason = 'เหมาะกับช่วงเปิดเทอมและการเริ่มต้นเรียนรู้';
  }
  if (/gift|packing|home-decor|fashion|hobby/iu.test(text)) {
    [11, 12, 1].forEach((month) => months.add(month)); reason = 'เหมาะกับคอนเทนต์ของขวัญและเทศกาลปลายปี';
  }
  const uniqueTags = [...new Set(tags)];
  if (!uniqueTags.length) uniqueTags.push('all-year');
  return {
    seasonTags: uniqueTags,
    monthTags: [...months].sort((a, b) => a - b),
    seasonalScore: uniqueTags.includes('all-year') ? 50 : Math.min(95, 70 + months.size * 3),
    seasonReason: reason,
  };
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
}

export function evaluateSellableRow(row, index, checkedAt, rejectionCounts) {
  if (row.length !== index.size) { increment(rejectionCounts, 'malformed'); return null; }
  const c1 = sanitizeText(field(row, index, 'global_category1')).trim();
  const c2 = sanitizeText(field(row, index, 'global_category2')).trim();
  const c3 = sanitizeText(field(row, index, 'global_category3')).trim();
  const rawTitle = sanitizeText(field(row, index, 'title')).trim();
  const description = sanitizeText(field(row, index, 'description'));
  const earlyText = `${rawTitle} ${description.slice(0, 1_800)}`;
  if (ILLEGAL_OR_RED.test(earlyText)) { increment(rejectionCounts, 'riskRed'); return null; }
  const category = classify(c1, c2, c3, rawTitle);
  if (!category) { increment(rejectionCounts, 'outsideTaxonomy'); return null; }
  const controlledSourceText = category.riskTier === 'amber' ? `${rawTitle} ${description}` : rawTitle;
  if (BAD_SOURCE_FORMAT.test(rawTitle) || hasListingPriceNoise(rawTitle) || hasUppercaseCodNoise(rawTitle)) {
    increment(rejectionCounts, 'sourcePolicy'); return null;
  }
  if (ACTIVE_CLEANING_OR_DISINFECTANT.test(rawTitle)) { increment(rejectionCounts, 'categorySafety'); return null; }
  if ((category.groupKey === 'beauty' || category.groupKey === 'supplements') && hasControlledTitleNoise(rawTitle)) {
    increment(rejectionCounts, 'controlledTitleNoise'); return null;
  }
  if (category.deny?.test(`${rawTitle} ${description.slice(0, 700)}`)) { increment(rejectionCounts, 'categorySafety'); return null; }
  if (category.summaryKind === 'automotive' && isUnsafeAutomotiveText(earlyText)) { increment(rejectionCounts, 'categorySafety'); return null; }
  if (category.summaryKind === 'automotive' && hasControlledPublicClaim(category.groupKey, rawTitle)) { increment(rejectionCounts, 'unsafeClaims'); return null; }
  if ((category.groupKey === 'beauty' || category.groupKey === 'supplements') && hasExpiredOrNearExpiry(controlledSourceText, checkedAt)) {
    increment(rejectionCounts, 'expiredOrNearExpiry'); return null;
  }
  if ((category.groupKey === 'beauty' || category.groupKey === 'supplements') && hasControlledSourceRisk(category.groupKey, controlledSourceText)) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  if (category.riskTier === 'amber' && (SEVERE_HEALTH_CLAIM.test(earlyText) || SENSITIVE_TITLE_CLAIM.test(rawTitle))) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  if ((category.groupKey === 'beauty' || category.groupKey === 'supplements') && hasControlledPublicClaim(category.groupKey, rawTitle)) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  if (category.groupKey === 'beauty' && UNSUPPORTED_SPF.test(rawTitle)) {
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
  if (category.summaryKind === 'supplement' && type === 'general') {
    increment(rejectionCounts, 'controlledShopGate'); return null;
  }

  const cleanName = sanitizeName(rawTitle, sensitive);
  if (cleanName.length < 8 || cleanName.length > 105 || NAME_FORBIDDEN.test(cleanName) || SUMMARY_FORBIDDEN.test(cleanName) ||
      hasPublicPromoNoise(cleanName) || hasListingPriceNoise(cleanName) || hasUppercaseCodNoise(cleanName) ||
      (sensitive && (SENSITIVE_TITLE_CLAIM.test(cleanName) || SEVERE_HEALTH_CLAIM.test(cleanName)))) {
    increment(rejectionCounts, 'invalidName'); return null;
  }
  if ((category.groupKey === 'beauty' || category.groupKey === 'supplements') && hasControlledPublicClaim(category.groupKey, cleanName)) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  if (category.summaryKind === 'automotive' && hasControlledPublicClaim(category.groupKey, cleanName)) {
    increment(rejectionCounts, 'unsafeClaims'); return null;
  }
  const summary = makeSummary(category, cleanName, rawTitle, description).replace(/\s+/g, ' ').trim();
  if (summary.length < 45 || summary.length > 190 || SUMMARY_FORBIDDEN.test(summary) ||
      hasPublicPromoNoise(summary) || hasListingPriceNoise(summary) || hasUppercaseCodNoise(summary)) {
    increment(rejectionCounts, 'invalidSummary'); return null;
  }
  if (!passesControlledReview({ category, cleanName, summary, sourceText: controlledSourceText, checkedAt, shopType: type })) {
    increment(rejectionCounts, 'controlledReview'); return null;
  }
  const seasonal = seasonalMetadata(category, cleanName);
  const score = recommendationScore({
    itemSold, rating, likes, shopRating, shopType: type, stock, priceMin: prices.priceMin,
    descriptionLength: description.trim().length, seasonalScore: seasonal.seasonalScore,
  });
  const base = {
    id: `${shopId}-${itemId}`,
    categoryGroupKey: category.groupKey,
    categoryGroup: category.group,
    categoryKey: category.key,
    category: category.label,
    subcategoryKey: category.key,
    subcategory: category.label,
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
    reviewMethod: sensitive ? 'automated-controlled-policy-v3' : 'automated-ruleset-v3',
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
    imageFingerprint: new URL(imageUrl).pathname.split('/').filter(Boolean).at(-1),
    sourceCategoryPath: pathText(c1, c2, c3),
  };
}

function publicProduct(candidate) {
  const { score, titleFingerprint: _title, imageFingerprint: _image, sourceCategoryPath: _source, ...record } = candidate;
  return record;
}

function candidateOrder(left, right) {
  return right.score - left.score || right.itemSold - left.itemSold || right.rating - left.rating || left.id.localeCompare(right.id, 'en');
}

export function selectSellableCatalog(candidatesByCategory, rankedCount = DEFAULT_RANKED_TARGET, reserveCount = DEFAULT_RESERVE_TARGET) {
  const pools = new Map([...candidatesByCategory].map(([key, heap]) => [key, heap.toSortedDescending()]));
  const selectedIds = new Set();
  const selectedTitles = new Set();
  const selectedImages = new Set();
  const shopCounts = new Map();

  const canUse = (candidate, shopCap, categoryCounts, categoryCap) =>
    !selectedIds.has(candidate.id) && candidate.titleFingerprint.length >= 6 && !selectedTitles.has(candidate.titleFingerprint) &&
    candidate.imageFingerprint && !selectedImages.has(candidate.imageFingerprint) &&
    (shopCounts.get(candidate.shopId) ?? 0) < shopCap && (categoryCounts.get(candidate.categoryKey) ?? 0) < categoryCap;

  const add = (target, candidate, categoryCounts) => {
    target.push(candidate);
    selectedIds.add(candidate.id);
    selectedTitles.add(candidate.titleFingerprint);
    selectedImages.add(candidate.imageFingerprint);
    shopCounts.set(candidate.shopId, (shopCounts.get(candidate.shopId) ?? 0) + 1);
    categoryCounts.set(candidate.categoryKey, (categoryCounts.get(candidate.categoryKey) ?? 0) + 1);
  };

  const selectInto = (target, count, { quotas, shopCap, categoryCap }) => {
    const categoryCounts = new Map();
    if (quotas) {
      const declaredQuotaTotal = CATALOG_RULES.reduce((sum, category) => sum + category.quota, 0);
      const quotaScale = Math.min(1, count / declaredQuotaTotal);
      for (const category of CATALOG_RULES) {
        const pool = pools.get(category.key) ?? [];
        const scaledQuota = Math.max(1, Math.floor(category.quota * quotaScale));
        for (const candidate of pool) {
          if (target.length >= count || (categoryCounts.get(category.key) ?? 0) >= scaledQuota) break;
          if (canUse(candidate, shopCap, categoryCounts, scaledQuota)) add(target, candidate, categoryCounts);
        }
      }
    }
    const merged = [...pools.values()].flat().sort(candidateOrder);
    for (const candidate of merged) {
      if (target.length >= count) break;
      if (canUse(candidate, shopCap, categoryCounts, categoryCap)) add(target, candidate, categoryCounts);
    }
    return categoryCounts;
  };

  const ranked = [];
  selectInto(ranked, rankedCount, { quotas: true, shopCap: 6, categoryCap: Math.max(650, Math.ceil(rankedCount * 0.08)) });
  if (ranked.length !== rankedCount) throw new Error(`Could select only ${ranked.length} of ${rankedCount} ranked products`);
  ranked.sort(candidateOrder);
  const reserve = [];
  selectInto(reserve, reserveCount, { quotas: false, shopCap: 15, categoryCap: Math.max(150, Math.ceil(reserveCount * 0.12)) });
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
  const base = {
    id: 'featured-dkub-book', featured: true,
    categoryGroupKey: 'learning', categoryGroup: GROUPS.learning,
    categoryKey: 'physical-books', category: 'หนังสือเล่มและสื่อการเรียนรู้',
    subcategoryKey: 'physical-books', subcategory: 'หนังสือเล่มและสื่อการเรียนรู้',
    imageUrl: 'https://down-th.img.susercontent.com/file/th-11134207-81ztc-moxgell974lp5f',
    cleanName: 'หนังสือคว้าเงินล้านในอากาศ ด้วยคลิป AI ปักตะกร้า ฉบับนายหน้า TikTok',
    summary: 'หนังสือสอนสร้างคลิป AI สำหรับนายหน้า TikTok ตั้งแต่หาแนวคิด วางเนื้อหา ไปจนถึงทำคลิปปักตะกร้าเป็นขั้นตอน',
    priceMin: 345, priceMax: 345, priceType: 'fixed', checkedAt: '2026-08-17T15:26:00+07:00',
    productUrl: 'https://shopee.co.th/product/1032408641/48511491095',
    seasonTags: ['all-year'], monthTags: [], seasonalScore: 50,
    seasonReason: 'เหมาะนำเสนอและทำคอนเทนต์ได้ตลอดทั้งปี',
    shopName: 'DkubStore', shopId: '1032408641', itemId: '48511491095',
  };
  return { ...base, normalizedSearchText: makeSearchText(base) };
}

export function newRejectionCounts() {
  return {
    malformed: 0, riskRed: 0, outsideTaxonomy: 0, sourcePolicy: 0, categorySafety: 0,
    unsafeClaims: 0, controlledTitleNoise: 0, expiredOrNearExpiry: 0, unsupportedEvidenceClaim: 0, outOfStock: 0, holidayMode: 0,
    invalidIds: 0, invalidImage: 0, invalidPrice: 0, priceBait: 0, lowRating: 0,
    lowSignal: 0, controlledShopGate: 0, controlledReview: 0, invalidName: 0, invalidSummary: 0,
  };
}

export function toRuntimeModule(catalog, reserve) {
  const payload = JSON.stringify({ ...catalog, reserve: reserve.reserve });
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
  return SUMMARY_FORBIDDEN.test(String(value ?? '')) || ILLEGAL_OR_RED.test(String(value ?? ''));
}
