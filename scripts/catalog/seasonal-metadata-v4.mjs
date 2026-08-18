export const SEASONAL_METADATA_VERSION = 'seasonal-v4';

export const CLIMATE_SEASONS = Object.freeze(['hot', 'rainy', 'cool']);

export const CLIMATE_MONTH_PROFILES = Object.freeze({
  hot: Object.freeze({
    2: Object.freeze({ intensity: 0.58, reason: 'เริ่มเข้าสู่ช่วงอากาศร้อนในเดือนกุมภาพันธ์' }),
    3: Object.freeze({ intensity: 0.92, reason: 'อยู่ในช่วงอากาศร้อนเด่นของเดือนมีนาคม' }),
    4: Object.freeze({ intensity: 1, reason: 'อยู่ในช่วงอากาศร้อนสูงและกิจกรรมกลางแจ้งเดือนเมษายน' }),
    5: Object.freeze({ intensity: 0.62, reason: 'เป็นช่วงเปลี่ยนผ่านจากอากาศร้อนเข้าสู่ฤดูฝนในเดือนพฤษภาคม' }),
  }),
  rainy: Object.freeze({
    5: Object.freeze({ intensity: 0.58, reason: 'เริ่มเตรียมรับฤดูฝนในเดือนพฤษภาคม' }),
    6: Object.freeze({ intensity: 0.9, reason: 'เข้าสู่ช่วงฝนเด่นในเดือนมิถุนายน' }),
    7: Object.freeze({ intensity: 1, reason: 'อยู่ในช่วงฝนเด่นและต้องจัดการน้ำในเดือนกรกฎาคม' }),
    8: Object.freeze({ intensity: 1, reason: 'อยู่ในช่วงฝนเด่นของเดือนสิงหาคม' }),
    9: Object.freeze({ intensity: 0.92, reason: 'ยังอยู่ในช่วงฝนเด่นของเดือนกันยายน' }),
    10: Object.freeze({ intensity: 0.6, reason: 'เป็นช่วงเปลี่ยนผ่านจากฤดูฝนในเดือนตุลาคม' }),
  }),
  cool: Object.freeze({
    10: Object.freeze({ intensity: 0.55, reason: 'เริ่มเปลี่ยนเข้าสู่ช่วงอากาศเย็นและฤดูเดินทางในเดือนตุลาคม' }),
    11: Object.freeze({ intensity: 0.9, reason: 'เข้าสู่ช่วงอากาศเย็นและฤดูเดินทางในเดือนพฤศจิกายน' }),
    12: Object.freeze({ intensity: 1, reason: 'อยู่ในช่วงอากาศเย็นและท่องเที่ยวปลายปีในเดือนธันวาคม' }),
    1: Object.freeze({ intensity: 0.95, reason: 'อยู่ในช่วงอากาศเย็นและท่องเที่ยวต้นปีในเดือนมกราคม' }),
    2: Object.freeze({ intensity: 0.58, reason: 'เป็นช่วงเปลี่ยนผ่านปลายฤดูอากาศเย็นในเดือนกุมภาพันธ์' }),
  }),
});

const englishToken = (source) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${source})(?![\\p{L}\\p{M}\\p{N}])`, 'iu');

const HOT_DRINKWARE = /(?:ขวดน้ำ|กระบอกน้ำ|แก้วน้ำ|กระติกน้ำ|เหยือกน้ำ|ถาดทำน้ำแข็ง|ขวดน้ํา|กระบอกน้ํา|แก้วน้ํา|กระติกน้ํา|เหยือกน้ํา|ถาดทําน้ําแข็ง|water\s*bottle|drink\s*bottle|tumbler|pitcher|ice\s*tray)/iu;
const DRINKWARE_ACCESSORY_ONLY = /(?:ฝา(?:ปิด)?(?:ขวด|แก้ว|กระติก)|(?:bottle|cup|tumbler)\s*(?:lid|cap)|(?:สายคล้อง|สายรัด|เชือก).{0,36}(?:ขวด|กระบอก|แก้ว|กระติก)|(?:กระเป๋า|ถุง|ซอง).{0,24}(?:ขวด|กระบอก|แก้ว|กระติก)|(?:ขวด|กระบอก|แก้ว|กระติก).{0,24}(?:สายคล้อง|สายรัด|เชือก).{0,48}(?:เหมาะกับ|ใช้กับ|สำหรับ|สําหรับ).{0,20}(?:ขวด|แก้ว|กระติก)|(?<![\p{L}\p{M}\p{N}])boot(?![\p{L}\p{M}\p{N}])|(?:เหมาะกับ|ใช้กับ|สำหรับ|สําหรับ).{0,24}(?:ขวด|แก้ว|กระติก).{0,16}(?:ส่วนใหญ่|เท่านั้น)|อะไหล่.{0,24}(?:ขวด|แก้ว|กระติก))/iu;
const HOT_SUNSHADE = /(?:ม่านบังแดด|แผ่นบังแดด|ที่บังแดด|บังแดดรถ|sun\s*(?:shade|shield))/iu;
const HOT_PERSONAL_SHADE = /(?:หมวกกันแดด|ปลอกแขนกันแดด|ร่มกันแดด|เสื้อกันยูวี|sun\s*hat|sun\s*umbrella|uv\s*(?:sleeve|shirt))/iu;
const HOT_OUTDOOR_SHADE = /(?:ร่มสนาม|ผ้าใบกันแดด|ฟลายชีทกันแดด|เต็นท์บังแดด|sun\s*shelter|shade\s*tarp)/iu;
const HOT_SUNSCREEN = /(?:ครีมกันแดด|เจลกันแดด|โลชั่นกันแดด|ผลิตภัณฑ์กันแดด|sun\s*screen|sunblock)/iu;

const RAIN_GEAR = /(?:เสื้อกันฝน|ชุดกันฝน|ร่มกันฝน|ร่มพับ|ร่มอัตโนมัติ|ร่มออโต้|ถุงกันน้ำ|กระเป๋ากันน้ำ|ซองกันน้ำ|ผ้าคลุมกันฝน|rain\s*coat|raincoat|rain\s*suit|umbrella|dry\s*bag|rain\s*cover|waterproof\s*pouch)/iu;
const RAIN_SHELTER = /(?:ฟลายชีท|ผ้าใบกันฝน|ผ้าใบคลุม|tarpaulin|flysheet|rain\s*tarp)/iu;
const RAIN_DRYING = /(?:ราวตากผ้า|เชือกตากผ้า|ที่ตากผ้า|ไม้แขวนตาก|ตากผ้า|clothesline|drying\s*rack|laundry\s*rack)/iu;
const RAIN_WATER_MANAGEMENT = /(?:ไม้ปาดน้ำ|ยางปาดน้ำ|ยางรีดน้ำ|ที่รีดน้ำ|ที่กั้นน้ำ|แผงกั้นน้ำ|ไม้ปาดน้ํา|ยางปาดน้ํา|ยางรีดน้ํา|ที่รีดน้ํา|ที่กั้นน้ํา|แผงกั้นน้ํา|squeegee|water\s*barrier|flood\s*barrier)/iu;
const RAIN_AUTO_MUD = /(?:กันโคลน|แผ่นกันโคลน|mud\s*flap|splash\s*guard)/iu;

const COOL_CAMPING = /(?:เต็นท์|เต้นท์|เต๊นท์|เสื่อปิกนิก|โต๊ะแคมป์|เก้าอี้แคมป์|เตียงแคมป์|tent|picnic\s*mat|camping\s*(?:table|chair|bed))/iu;
const CAMPING_LEISURE_EVIDENCE = /(?:แคมป์|แค้มป์|ปิกนิก|เดินป่า|ท่องเที่ยวกลางแจ้ง|กางนอน|ตั้งแคมป์|camping|picnic|hiking|outdoor\s*(?:camp|recreation)|backpacking)/iu;
const CAMPING_COMMERCIAL_OR_ACCESSORY = /(?:ขายของ|ตลาดนัด|ตลาด|ร้านค้า|จอดรถ|โรงรถ|ที่จอด|คลุมรถ|รถกระบะ|รถบรรทุก|โกดัง|งานช่าง|ซ่อม|ปะซ่อม|ชุดปะ|แผ่นปะ|อะไหล่|ขายึด|ข้อต่อ|ตัวต่อ|รางน้ำ|รางน้ํา|ตะขอ|replacement|repair|patch(?:es|ing)?|spare\s*part|accessor(?:y|ies)|carport|market\s*(?:tent|stall)|truck)/iu;
const COOL_HOME_TEXTILE = /(?:ผ้าห่ม|ผ้านวม|ผ้าคลุมไหล่|blanket|comforter|quilt|throw\s*blanket)/iu;
const COOL_APPAREL_STRONG = /(?:เสื้อกันหนาว|เสื้อฮู้ด|hoodie|sweater|winter\s*jacket|thermal\s*(?:top|shirt|wear)|เสื้อบุขน|เสื้อฟลีซ|fleece\s*(?:jacket|top))/iu;
const COOL_APPAREL_AMBIGUOUS = /(?:แจ็กเก็ต|แจ็คเก็ต|เสื้อไหมพรม|ไหมพรม|คาร์ดิแกน|ผ้าพันคอ|knit(?:ted)?|cardigan|scarf)/iu;
const COOL_WARMTH_EVIDENCE = /(?:กันหนาว|หน้าหนาว|ฤดูหนาว|อบอุ่น|ให้ความอุ่น|เก็บความอุ่น|ผ้าหนา|ไหมพรมหนา|แขนยาว|บุขน|ขนแกะ|ฟลีซ|winter|warm|thermal|thick|long\s*sleeve|fleece|wool)/iu;
const COOL_APPAREL_CONTRADICTION = /(?:กันแดด|แสงยูวี|ยูวี|หน้าร้อน|ฤดูร้อน|แขนสั้น|คลุมผม|ผ้าคลุมผม|กิ๊บ|ยางรัดผม|ชุดราตรี|evening\s*(?:wear|dress)|head\s*scarf|headscarf|hair|summer|short\s*sleeve|(?<![\p{L}\p{M}\p{N}])uv(?![\p{L}\p{M}\p{N}])|sun\s*(?:mask|protection|screen))/iu;

const ORGANIZE = /(?:จัดเก็บ|จัดระเบียบ|กล่องเก็บ|ตะกร้าเก็บ|ชั้นวาง|ลิ้นชัก|organizer|storage\s*(?:box|basket|rack)|drawer\s*organizer)/iu;
const PLANNER = /(?:แพลนเนอร์|สมุดวางแผน|ปฏิทิน|ไดอารี|planner|calendar|diary)/iu;
const PLANNER_OR_SCHOOL_ACCESSORY_ONLY = /(?:สติ๊กเกอร์|สติกเกอร์|สติ๊กเก้อ|sticker|ตกแต่ง.{0,24}(?:สมุด|ไดอารี|แพลนเนอร์|planner|diary)|(?:สำหรับ|สําหรับ|ใช้กับ).{0,24}(?:สมุด|ไดอารี|แพลนเนอร์|planner|diary)|ปก(?:สมุด|ไดอารี|แพลนเนอร์)|ปกแพลนเนอร์|แฟ้ม.{0,24}(?:เก็บการ์ด|การ์ด|photo\s*album|อัลบั้ม)|เฉพาะ(?:ปก|แฟ้ม)|อะไหล่|accessor(?:y|ies))/iu;
const TRAVEL = /(?:เดินทาง|ท่องเที่ยว|กระเป๋าจัดระเบียบ|กระเป๋าเดินทาง|กระเป๋าพาสปอร์ต|ถุงจัดระเบียบ|travel|luggage|passport|packing\s*cube|toiletry\s*bag)/iu;
const VALENTINE_GIFT = /(?:วาเลนไทน์|ของขวัญวาเลนไทน์|ของขวัญคนรัก|รูปหัวใจ|ลายหัวใจ|หัวใจ|valentine|heart|love\s*gift|romantic\s*gift|กุหลาบ|rose\s*gift)/iu;
const SONGKRAN = /(?:สงกรานต์|songkran|ซองกันน้ำ|กระเป๋ากันน้ำ|ถุงกันน้ำ|ซองมือถือกันน้ำ|dry\s*bag|waterproof\s*pouch|waterproof\s*phone\s*(?:case|pouch))/iu;
const EDUCATION_BOOK = /(?:แบบฝึกหัด|หนังสือเรียน|ตำราเรียน|ตําราเรียน|พจนานุกรม|ฝึกอ่าน|ฝึกเขียน|เตรียมสอบ|คณิตศาสตร์|วิทยาศาสตร์|ภาษาอังกฤษ|การศึกษา|workbook|textbook|dictionary|exam\s*prep|learning\s*book)/iu;
const WRITING_SCHOOL = /(?:ปากกา|ดินสอ|ยางลบ|ไม้บรรทัด|ไฮไลต์|มาร์กเกอร์|ดินสอกด|pen|pencil|eraser|ruler|marker|highlighter)/iu;
const PAPER_SCHOOL = /(?:สมุด|กระดาษเขียน|กระดาษวาด|แฟ้ม|ซองเอกสาร|โน้ต|notebook|writing\s*paper|drawing\s*paper|folder|memo)/iu;
const ART_SCHOOL = /(?:พู่กัน|สีไม้|สีชอล์ก|สีน้ำ|สีน้ํา|สมุดวาด|ผ้าใบวาด|brush|colored\s*pencil|crayon|watercolor|sketchbook|canvas)/iu;
const SCHOOL_BACKPACK = /(?:กระเป๋านักเรียน|กระเป๋าไปโรงเรียน|เป้นักเรียน|เป้โรงเรียน|school\s*(?:bag|backpack)|student\s*backpack)/iu;
// Thai does not use spaces consistently, so the right boundary is the safety
// critical side: แม่ must end there and must never consume แม่เหล็ก or another
// longer lexical item. Jasmine is evidence only when the same title also has
// an explicit Mother/Mother's-Day signal, which the alternatives below supply.
const MOTHERS_DAY = /(?:วันแม่|12\s*(?:ส\.?ค\.?|สิงหา(?:คม)?)|ของขวัญ.{0,20}(?:ให้|สำหรับ|สําหรับ)?\s*(?:คุณแม่|แม่)(?![\p{L}\p{M}\p{N}])|(?:คุณแม่|(?<![\p{L}\p{M}\p{N}])แม่)(?![\p{L}\p{M}\p{N}]).{0,20}ของขวัญ|mother(?:'s)?\s*day|gift\s*for\s*(?:mom|mother))/iu;
const YEAR_END_GIFT = /(?:ของขวัญ|ถุงของขวัญ|กล่องของขวัญ|กระดาษห่อของขวัญ|ริบบิ้น|การ์ดอวยพร|gift|ribbon|greeting\s*card|wrapping\s*paper)/iu;
const SHIPPING_LOGISTICS = /(?:กล่องพัสดุ|ซองพัสดุ|ซองไปรษณีย์|กล่องไปรษณีย์|โฟมกันกระแทก|ซองกันกระแทก|พลาสติกกันกระแทก|บับเบิ้ล|กล่องย้ายบ้าน|กล่องขนย้าย|ขนส่งสินค้า|โลจิสติกส์|parcel|postal|bubble\s*(?:wrap|mailer)|shipping\s*(?:box|mailer)|moving\s*box|protective\s*(?:foam|packaging)|courier\s*(?:bag|box))/iu;

const climateRule = (id, season, categoryKeys, pattern, score, reason, options = {}) => Object.freeze({
  id, season, categoryKeys: Object.freeze(categoryKeys), pattern, score, reason,
  requiredPattern: options.requiredPattern ?? null,
  excludePattern: options.excludePattern ?? null,
});

export const CLIMATE_RULES = Object.freeze([
  climateRule('hot-auto-sunshade', 'hot', ['auto-covers-mats'], HOT_SUNSHADE, 94, 'เป็นอุปกรณ์บังแดดรถที่มีความเกี่ยวข้องโดยตรงกับช่วงอากาศร้อน'),
  climateRule('hot-drinkware', 'hot', ['dining-drinkware'], HOT_DRINKWARE, 84, 'เป็นภาชนะสำหรับพกหรือเสิร์ฟเครื่องดื่มที่เหมาะนำเสนอช่วงอากาศร้อน', { excludePattern: DRINKWARE_ACCESSORY_ONLY }),
  climateRule('hot-personal-shade', 'hot', ['apparel-basics', 'fashion-accessories'], HOT_PERSONAL_SHADE, 82, 'เป็นของใช้สำหรับบังแดดที่เหมาะกับกิจกรรมช่วงอากาศร้อน'),
  climateRule('hot-outdoor-shade', 'hot', ['camping-rain'], HOT_OUTDOOR_SHADE, 82, 'เป็นอุปกรณ์สร้างร่มเงากลางแจ้งที่เหมาะกับช่วงอากาศร้อน'),
  climateRule('hot-sunscreen', 'hot', ['skincare-sunscreen'], HOT_SUNSCREEN, 88, 'เป็นผลิตภัณฑ์กันแดดที่มีความเกี่ยวข้องกับช่วงอากาศร้อน'),

  climateRule('rain-weather-gear', 'rainy', ['camping-rain', 'bags-wallets', 'travel-organizers'], RAIN_GEAR, 94, 'เป็นอุปกรณ์กันฝนหรือกันน้ำที่มีความเกี่ยวข้องโดยตรงกับฤดูฝน'),
  climateRule('rain-shelter', 'rainy', ['camping-rain'], RAIN_SHELTER, 88, 'เป็นอุปกรณ์คลุมพื้นที่หรือของใช้เพื่อรับมือฝน'),
  climateRule('rain-laundry-drying', 'rainy', ['bath-laundry'], RAIN_DRYING, 86, 'เป็นอุปกรณ์ตากผ้าที่เหมาะนำเสนอเมื่อการจัดการงานซักผ้าช่วงฝนสำคัญขึ้น'),
  climateRule('rain-water-management', 'rainy', ['cleaning-tools'], RAIN_WATER_MANAGEMENT, 90, 'เป็นอุปกรณ์จัดการน้ำบนพื้นหรือป้องกันน้ำเข้าพื้นที่ในช่วงฝน'),
  climateRule('rain-auto-mud', 'rainy', ['auto-key-style'], RAIN_AUTO_MUD, 78, 'เป็นอุปกรณ์กันโคลนรถที่เกี่ยวข้องกับการเดินทางในฤดูฝน'),

  climateRule('cool-camping', 'cool', ['camping-rain'], COOL_CAMPING, 90, 'เป็นอุปกรณ์แคมป์ที่เหมาะกับช่วงอากาศเย็นและฤดูท่องเที่ยวกลางแจ้ง', {
    requiredPattern: CAMPING_LEISURE_EVIDENCE,
    excludePattern: CAMPING_COMMERCIAL_OR_ACCESSORY,
  }),
  climateRule('cool-home-textile', 'cool', ['home-textiles'], COOL_HOME_TEXTILE, 90, 'เป็นเครื่องนอนหรือของใช้ให้ความอบอุ่นที่เหมาะกับช่วงอากาศเย็น'),
  climateRule('cool-apparel-strong', 'cool', ['apparel-basics', 'fashion-accessories'], COOL_APPAREL_STRONG, 88, 'เป็นเครื่องแต่งกายที่มีรูปแบบสำหรับอากาศเย็น', { excludePattern: COOL_APPAREL_CONTRADICTION }),
  climateRule('cool-apparel-warmth-evidence', 'cool', ['apparel-basics', 'fashion-accessories'], COOL_APPAREL_AMBIGUOUS, 86, 'เป็นเครื่องแต่งกายที่มีหลักฐานเรื่องความอบอุ่นหรือการใช้ในฤดูหนาว', {
    requiredPattern: COOL_WARMTH_EVIDENCE,
    excludePattern: COOL_APPAREL_CONTRADICTION,
  }),
]);

const monthEntry = (score, reason) => Object.freeze({ score, reason });
const campaignRule = (id, categoryKeys, pattern, months, reason, options = {}) => Object.freeze({
  id,
  categoryKeys: Object.freeze(categoryKeys),
  pattern,
  months: Object.freeze(months),
  reason,
  wholeCategory: options.wholeCategory === true,
  requiredPattern: options.requiredPattern ?? null,
  excludePattern: options.excludePattern ?? null,
});

const SCHOOL_MONTHS = Object.freeze({
  5: monthEntry(94, 'เหมาะกับช่วงเตรียมอุปกรณ์ก่อนเปิดภาคเรียนที่ 1 ในเดือนพฤษภาคม'),
  6: monthEntry(86, 'เหมาะกับช่วงเปิดภาคเรียนที่ 1 ในเดือนมิถุนายน'),
  10: monthEntry(92, 'เหมาะกับช่วงเตรียมอุปกรณ์ก่อนเปิดภาคเรียนที่ 2 ในเดือนตุลาคม'),
  11: monthEntry(84, 'เหมาะกับช่วงเปิดภาคเรียนที่ 2 ในเดือนพฤศจิกายน'),
});

const TRAVEL_MONTHS = Object.freeze({
  1: monthEntry(88, 'เหมาะกับการจัดกระเป๋าและเดินทางช่วงต้นปี'),
  2: monthEntry(68, 'เหมาะกับการเดินทางช่วงเปลี่ยนผ่านปลายฤดูอากาศเย็น'),
  3: monthEntry(76, 'เหมาะกับการเตรียมเดินทางก่อนช่วงฤดูร้อน'),
  4: monthEntry(90, 'เหมาะกับช่วงหยุดยาวและการเดินทางในเดือนเมษายน'),
  10: monthEntry(68, 'เหมาะกับช่วงเริ่มฤดูเดินทางปลายปี'),
  11: monthEntry(84, 'เหมาะกับฤดูเดินทางช่วงปลายปี'),
  12: monthEntry(92, 'เหมาะกับการเดินทางและวันหยุดปลายปี'),
});

export const CAMPAIGN_RULES = Object.freeze([
  campaignRule('new-year-organize', ['home-organizers'], ORGANIZE, {
    1: monthEntry(90, 'เหมาะกับการจัดบ้านและเริ่มต้นระบบใหม่ช่วงปีใหม่'),
    12: monthEntry(84, 'เหมาะกับการจัดบ้านเตรียมรับปีใหม่ในเดือนธันวาคม'),
  }, 'แคมเปญจัดบ้านรับปีใหม่'),
  campaignRule('new-year-planner', ['paper-notebooks'], PLANNER, {
    1: monthEntry(94, 'เหมาะกับการวางแผนและเริ่มต้นเป้าหมายใหม่ในเดือนมกราคม'),
    12: monthEntry(86, 'เหมาะกับการเตรียมแผนและปฏิทินสำหรับปีถัดไป'),
  }, 'แคมเปญวางแผนรับปีใหม่', { excludePattern: PLANNER_OR_SCHOOL_ACCESSORY_ONLY }),
  campaignRule('travel-organizing', ['travel-organizers'], TRAVEL, TRAVEL_MONTHS, 'แคมเปญจัดกระเป๋าและเดินทาง'),
  campaignRule('camping-travel', ['camping-rain'], COOL_CAMPING, TRAVEL_MONTHS, 'แคมเปญแคมป์และเดินทางตามฤดูกาล', {
    requiredPattern: CAMPING_LEISURE_EVIDENCE,
    excludePattern: CAMPING_COMMERCIAL_OR_ACCESSORY,
  }),
  campaignRule('valentine-explicit-gift', ['packing-gifts', 'home-decor', 'fashion-accessories'], VALENTINE_GIFT, {
    2: monthEntry(94, 'เหมาะกับของขวัญวาเลนไทน์ที่มีสัญญาณหัวใจหรือความรักชัดเจน'),
  }, 'แคมเปญวาเลนไทน์แบบมีสัญญาณชัดเจน'),
  campaignRule('songkran-waterproof', ['camping-rain', 'travel-organizers', 'bags-wallets', 'phone-cases', 'fashion-accessories'], SONGKRAN, {
    4: monthEntry(98, 'เหมาะกับกิจกรรมสงกรานต์และการปกป้องของใช้จากน้ำในเดือนเมษายน'),
  }, 'แคมเปญสงกรานต์และอุปกรณ์กันน้ำ'),
  campaignRule('school-education-books', ['physical-books'], EDUCATION_BOOK, SCHOOL_MONTHS, 'แคมเปญหนังสือเตรียมเปิดภาคเรียน'),
  campaignRule('school-writing', ['writing-supplies'], WRITING_SCHOOL, SCHOOL_MONTHS, 'แคมเปญอุปกรณ์เขียนเตรียมเปิดภาคเรียน'),
  campaignRule('school-paper-notebooks', ['paper-notebooks'], PAPER_SCHOOL, SCHOOL_MONTHS, 'แคมเปญสมุด กระดาษ และแฟ้มเตรียมเปิดภาคเรียน', { excludePattern: PLANNER_OR_SCHOOL_ACCESSORY_ONLY }),
  campaignRule('school-art', ['art-craft'], ART_SCHOOL, SCHOOL_MONTHS, 'แคมเปญอุปกรณ์ศิลปะเตรียมเปิดภาคเรียน'),
  campaignRule('school-backpack-explicit', ['bags-wallets'], SCHOOL_BACKPACK, SCHOOL_MONTHS, 'แคมเปญกระเป๋านักเรียนที่มีสัญญาณโรงเรียนชัดเจน'),
  campaignRule('rainy-season-prep', ['camping-rain', 'bags-wallets', 'travel-organizers', 'bath-laundry', 'cleaning-tools', 'auto-key-style'],
    new RegExp(`(?:${RAIN_GEAR.source}|${RAIN_SHELTER.source}|${RAIN_DRYING.source}|${RAIN_WATER_MANAGEMENT.source}|${RAIN_AUTO_MUD.source})`, 'iu'), {
      5: monthEntry(90, 'เหมาะกับการเตรียมอุปกรณ์รับฤดูฝนในเดือนพฤษภาคม'),
    }, 'แคมเปญเตรียมรับฤดูฝน'),
  campaignRule('rain-drying-water-management', ['camping-rain', 'bath-laundry', 'cleaning-tools'],
    new RegExp(`(?:${RAIN_GEAR.source}|${RAIN_SHELTER.source}|${RAIN_DRYING.source}|${RAIN_WATER_MANAGEMENT.source})`, 'iu'), {
      7: monthEntry(96, 'เหมาะกับการจัดการฝน งานตากผ้า และน้ำบนพื้นในเดือนกรกฎาคม'),
    }, 'แคมเปญจัดการฝนและน้ำ'),
  campaignRule('mothers-day-explicit', ['packing-gifts', 'home-decor', 'fashion-accessories', 'home-textiles', 'dining-drinkware'], MOTHERS_DAY, {
    8: monthEntry(94, 'เหมาะกับของขวัญวันแม่หรือของใช้ลายดอกไม้ที่มีสัญญาณชัดเจน'),
  }, 'แคมเปญวันแม่แบบมีสัญญาณชัดเจน'),
  campaignRule('indoor-organizing', ['home-organizers'], ORGANIZE, {
    9: monthEntry(86, 'เหมาะกับการจัดระเบียบพื้นที่ในบ้านช่วงฝนเดือนกันยายน'),
  }, 'แคมเปญจัดบ้านและพื้นที่ในร่ม'),
  campaignRule('year-end-gift-packing', ['packing-gifts'], YEAR_END_GIFT, {
    11: monthEntry(90, 'เหมาะกับการเตรียมบรรจุภัณฑ์ของขวัญปลายปีในเดือนพฤศจิกายน'),
    12: monthEntry(96, 'เหมาะกับการห่อและมอบของขวัญช่วงเทศกาลเดือนธันวาคม'),
  }, 'แคมเปญบรรจุภัณฑ์ของขวัญปลายปี', { excludePattern: SHIPPING_LOGISTICS }),
  campaignRule('year-end-explicit-gift', ['home-decor', 'fashion-accessories', 'dining-drinkware', 'home-textiles'], YEAR_END_GIFT, {
    11: monthEntry(86, 'เหมาะกับการเตรียมของขวัญช่วงปลายปีในเดือนพฤศจิกายน'),
    12: monthEntry(94, 'เหมาะกับการมอบของขวัญและเทศกาลปลายปีในเดือนธันวาคม'),
  }, 'แคมเปญของขวัญปลายปีแบบมีสัญญาณชัดเจน'),
]);

export const CAMPAIGN_TAGS = Object.freeze(CAMPAIGN_RULES.map((rule) => rule.id));
export const INTENTIONAL_WHOLE_CATEGORY_CAMPAIGN_RULE_IDS = Object.freeze(
  CAMPAIGN_RULES.filter((rule) => rule.wholeCategory).map((rule) => rule.id),
);

function normalizeSeasonalText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\u0e4d\u0e32/gu, 'ำ').toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{M}\p{N}\s'.,&+/-]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function uniqueReasons(values, maximum = 4) {
  const output = [];
  for (const value of values) {
    const reason = String(value ?? '').replace(/[\n\r\\#*`<>]+/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 120);
    if (reason && !output.includes(reason)) output.push(reason);
    if (output.length >= maximum) break;
  }
  return output;
}

function maxObjectValue(record) {
  return Math.max(0, ...Object.values(record));
}

function matchesExactRule(rule, categoryKey, text) {
  return rule.categoryKeys.includes(categoryKey) && rule.pattern.test(text) &&
    (!rule.requiredPattern || rule.requiredPattern.test(text)) &&
    (!rule.excludePattern || !rule.excludePattern.test(text));
}

export function makeSeasonalMetadataV4(categoryOrKey, cleanName, summary = '') {
  const categoryKey = typeof categoryOrKey === 'string' ? categoryOrKey : categoryOrKey?.key;
  // Match only the readable product name. Generated summaries intentionally
  // contain the category label, so using them as evidence would turn an exact
  // category+token rule back into accidental whole-category tagging.
  const text = normalizeSeasonalText(cleanName);
  const climateMatches = CLIMATE_RULES.filter((rule) => matchesExactRule(rule, categoryKey, text));
  const campaignMatches = CAMPAIGN_RULES.filter((rule) => matchesExactRule(rule, categoryKey, text));

  const seasonScores = { hot: 0, rainy: 0, cool: 0 };
  const seasonReasonLists = { hot: [], rainy: [], cool: [] };
  const monthScores = {};
  const monthReasonLists = {};
  const primaryCandidates = [];

  for (const rule of climateMatches) {
    seasonScores[rule.season] = Math.max(seasonScores[rule.season], rule.score);
    seasonReasonLists[rule.season].push(rule.reason);
    primaryCandidates.push({ score: rule.score, id: rule.id, reason: rule.reason });
    for (const [month, profile] of Object.entries(CLIMATE_MONTH_PROFILES[rule.season])) {
      const periodScore = Math.max(1, Math.round(rule.score * profile.intensity));
      monthScores[month] = Math.max(monthScores[month] ?? 0, periodScore);
      (monthReasonLists[month] ??= []).push(profile.reason, rule.reason);
    }
  }

  for (const rule of campaignMatches) {
    for (const [month, entry] of Object.entries(rule.months)) {
      monthScores[month] = Math.max(monthScores[month] ?? 0, entry.score);
      (monthReasonLists[month] ??= []).push(entry.reason, rule.reason);
      primaryCandidates.push({ score: entry.score, id: `${rule.id}-${month}`, reason: entry.reason });
    }
  }

  const evergreen = climateMatches.length === 0;
  const seasonTags = evergreen
    ? ['all-year']
    : CLIMATE_SEASONS.filter((season) => seasonScores[season] > 0);
  const monthTags = Object.keys(monthScores).map(Number).filter((month) => monthScores[String(month)] > 0).sort((a, b) => a - b);
  const seasonReasons = Object.fromEntries(CLIMATE_SEASONS
    .filter((season) => seasonScores[season] > 0)
    .map((season) => [season, uniqueReasons(seasonReasonLists[season])]));
  const monthReasons = Object.fromEntries(monthTags.map((month) => [String(month), uniqueReasons(monthReasonLists[String(month)])]));
  const orderedMonthScores = Object.fromEntries(monthTags.map((month) => [String(month), monthScores[String(month)]]));
  const orderedPrimary = primaryCandidates.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id, 'en'));
  const seasonalScore = Math.max(50, maxObjectValue(seasonScores), maxObjectValue(orderedMonthScores));
  const seasonReason = orderedPrimary[0]?.reason ?? 'เหมาะนำเสนอได้ตลอดทั้งปี และมีช่วงพีคตามแคมเปญเมื่อมีสัญญาณสินค้าที่ชัดเจน';

  return {
    metadataVersion: SEASONAL_METADATA_VERSION,
    evergreen,
    seasonTags,
    seasonScores,
    seasonReasons,
    monthTags,
    monthScores: orderedMonthScores,
    monthReasons,
    campaignTags: campaignMatches.map((rule) => rule.id),
    seasonalScore,
    seasonReason,
  };
}

export const SEASONAL_V4_GOLDEN_FIXTURES = Object.freeze({
  positive: Object.freeze([
    Object.freeze({ name: 'car sunshade is hot', categoryKey: 'auto-covers-mats', cleanName: 'ม่านบังแดดรถแบบพับได้', seasons: ['hot'], months: [2, 3, 4, 5] }),
    Object.freeze({ name: 'raincoat is rainy', categoryKey: 'camping-rain', cleanName: 'เสื้อกันฝนผู้ใหญ่แบบพกพา', seasons: ['rainy'], months: [5, 6, 7, 8, 9, 10] }),
    Object.freeze({ name: 'camping tent is cool and travel peak', categoryKey: 'camping-rain', cleanName: 'เต็นท์แคมป์สำหรับสองคน', seasons: ['cool'], months: [1, 2, 3, 4, 10, 11, 12], campaigns: ['camping-travel'] }),
    Object.freeze({ name: 'blanket is cool', categoryKey: 'home-textiles', cleanName: 'ผ้าห่มเนื้อนุ่มสำหรับห้องนอน', seasons: ['cool'], months: [1, 2, 10, 11, 12] }),
    Object.freeze({ name: 'education workbook has both term peaks', categoryKey: 'physical-books', cleanName: 'แบบฝึกหัดคณิตศาสตร์สำหรับนักเรียน', months: [5, 6, 10, 11], campaigns: ['school-education-books'] }),
    Object.freeze({ name: 'songkran waterproof pouch peaks in April', categoryKey: 'phone-cases', cleanName: 'ซองมือถือกันน้ำสำหรับสงกรานต์', months: [4], campaigns: ['songkran-waterproof'] }),
    Object.freeze({ name: 'home organizer has January September December peaks', categoryKey: 'home-organizers', cleanName: 'กล่องจัดระเบียบลิ้นชักในบ้าน', months: [1, 9, 12], campaigns: ['new-year-organize', 'indoor-organizing'] }),
    Object.freeze({ name: 'explicit gift ribbon qualifies at year end', categoryKey: 'packing-gifts', cleanName: 'ริบบิ้นผ้าซาตินสำหรับห่อของขวัญ', months: [11, 12], campaigns: ['year-end-gift-packing'] }),
    Object.freeze({ name: 'explicit Mothers Day gift qualifies', categoryKey: 'fashion-accessories', cleanName: 'ผ้าพันคอของขวัญวันแม่เนื้อผ้านุ่ม', months: [8], campaigns: ['mothers-day-explicit'] }),
    Object.freeze({ name: 'jasmine Mothers Day signal qualifies', categoryKey: 'home-decor', cleanName: 'พวงมาลัยดอกมะลิสำหรับวันแม่', months: [8], campaigns: ['mothers-day-explicit'] }),
    Object.freeze({ name: 'locked Mothers Day scarf positive remains', categoryKey: 'fashion-accessories', cleanName: 'พวงมาลัยผ้าพันคอ ผ้าแพชมีน่า คละลาย ของขวัญวันแม่', months: [8], campaigns: ['mothers-day-explicit'] }),
    Object.freeze({ name: 'locked jasmine garland positive has explicit day', categoryKey: 'home-decor', cleanName: 'พวงมาลัยดอกมะลิ ดอกไม้ประดิษฐ์ มาลัยวันแม่ วันพ่อ ไหว้พระ', months: [8], campaigns: ['mothers-day-explicit'] }),
    Object.freeze({ name: 'warm long sleeve cardigan is cool', categoryKey: 'apparel-basics', cleanName: 'คาร์ดิแกนไหมพรมหนาแขนยาวให้ความอบอุ่น', seasons: ['cool'], months: [1, 2, 10, 11, 12] }),
    Object.freeze({ name: 'actual notebook qualifies for school', categoryKey: 'paper-notebooks', cleanName: 'สมุดโน้ตสำหรับจดวิชาเรียน 80 แผ่น', months: [5, 6, 10, 11], campaigns: ['school-paper-notebooks'] }),
    Object.freeze({ name: 'actual water bottle is hot', categoryKey: 'dining-drinkware', cleanName: 'ขวดน้ำสแตนเลสเก็บอุณหภูมิ 750 มล.', seasons: ['hot'], months: [2, 3, 4, 5] }),
    Object.freeze({ name: 'actual water bottle with included strap remains hot', categoryKey: 'dining-drinkware', cleanName: 'ขวดน้ำสแตนเลส 750 มล. พร้อมสายคล้องพกพา', seasons: ['hot'], months: [2, 3, 4, 5] }),
  ]),
  negative: Object.freeze([
    Object.freeze({ name: 'Samsung is not sun', categoryKey: 'phone-cases', cleanName: 'เคสใสสำหรับ Samsung Galaxy S26', excludedSeasons: ['hot'], excludedMonths: [2, 3, 4, 5] }),
    Object.freeze({ name: 'household paper is not school', categoryKey: 'household-paper-bags', cleanName: 'กระดาษทิชชูแบบแขวนผนัง 12 ห่อ', excludedCampaignPrefixes: ['school-'], excludedMonths: [5, 6, 10, 11] }),
    Object.freeze({ name: 'generic cleaning brush is not rainy', categoryKey: 'cleaning-tools', cleanName: 'แปรงเก็บฝุ่นพร้อมด้ามจับ', excludedSeasons: ['rainy'], excludedMonths: [5, 6, 7, 8, 9, 10] }),
    Object.freeze({ name: 'generic fashion is not a gift campaign', categoryKey: 'fashion-accessories', cleanName: 'กำไลข้อมือสแตนเลสแบบเรียบ', excludedCampaignPrefixes: ['valentine-', 'mothers-day-', 'year-end-'] }),
    Object.freeze({ name: 'general novel is not school campaign', categoryKey: 'physical-books', cleanName: 'หนังสือนิยายสืบสวนฉบับพิมพ์ใหม่', excludedCampaignPrefixes: ['school-'], excludedMonths: [5, 6, 10, 11] }),
    Object.freeze({ name: 'generic laundry basket is not rainy', categoryKey: 'bath-laundry', cleanName: 'ตะกร้าผ้าแบบมีหูจับ', excludedSeasons: ['rainy'], excludedMonths: [5, 6, 7, 8, 9, 10] }),
    Object.freeze({ name: 'parcel box is not a year-end gift', categoryKey: 'packing-gifts', cleanName: 'กล่องพัสดุไปรษณีย์พิมพ์ลาย Thank you', excludedCampaignPrefixes: ['year-end-'], excludedMonths: [11, 12] }),
    Object.freeze({ name: 'bubble mailer is not a year-end gift', categoryKey: 'packing-gifts', cleanName: 'ซองบับเบิ้ลกันกระแทกสำหรับส่งพัสดุ', excludedCampaignPrefixes: ['year-end-'], excludedMonths: [11, 12] }),
    Object.freeze({ name: 'generic floral decor is not Mothers Day', categoryKey: 'home-decor', cleanName: 'วอลเปเปอร์ลายดอกไม้สำหรับตกแต่งผนัง', excludedCampaignPrefixes: ['mothers-day-'], excludedMonths: [8] }),
    Object.freeze({ name: 'locked jasmine hair tie is not Mothers Day', categoryKey: 'fashion-accessories', cleanName: 'ยางรัดผมดอกมะลิ ดอกไม้ประดับผมนางรำ', excludedCampaignPrefixes: ['mothers-day-'], excludedMonths: [8] }),
    Object.freeze({ name: 'locked magnetic gift box is not mother token', categoryKey: 'packing-gifts', cleanName: 'กล่องของขวัญ กล่องฝาพับแม่เหล็ก', excludedCampaignPrefixes: ['mothers-day-'], excludedMonths: [8] }),
    Object.freeze({ name: 'short sleeve knit is not cool', categoryKey: 'apparel-basics', cleanName: 'เสื้อไหมพรมแขนสั้น Candy Cardigan', excludedSeasons: ['cool'], excludedMonths: [1, 2, 10, 11, 12] }),
    Object.freeze({ name: 'UV head scarf is not cool', categoryKey: 'fashion-accessories', cleanName: 'ผ้าพันคอคลุมผมกันแดด UV สำหรับหน้าร้อน', excludedSeasons: ['cool'], excludedMonths: [1, 2, 10, 11, 12] }),
    Object.freeze({ name: 'market carport tent is not cool travel', categoryKey: 'camping-rain', cleanName: 'เต็นท์ขายของตลาดนัดและเต็นท์จอดรถ', excludedSeasons: ['cool'], excludedCampaignPrefixes: ['camping-travel'], excludedMonths: [1, 2, 3, 4, 11, 12] }),
    Object.freeze({ name: 'tent repair patch is not cool travel', categoryKey: 'camping-rain', cleanName: 'แผ่นปะซ่อมเต็นท์และอะไหล่ขายึด', excludedSeasons: ['cool'], excludedCampaignPrefixes: ['camping-travel'], excludedMonths: [1, 2, 3, 4, 11, 12] }),
    Object.freeze({ name: 'planner sticker is not planner or school', categoryKey: 'paper-notebooks', cleanName: 'สติกเกอร์ตกแต่งแพลนเนอร์และไดอารี่', excludedCampaignPrefixes: ['new-year-planner', 'school-'], excludedMonths: [1, 5, 6, 10, 11, 12] }),
    Object.freeze({ name: 'bottle lid is not hot drinkware', categoryKey: 'dining-drinkware', cleanName: 'ฝาปิดขวดน้ำอะไหล่สำหรับขวด 1200 มล.', excludedSeasons: ['hot'], excludedMonths: [2, 3, 4, 5] }),
    Object.freeze({ name: 'bottle strap is not hot drinkware', categoryKey: 'dining-drinkware', cleanName: 'สายคล้องขวดน้ำปรับระดับสำหรับใช้กับขวดน้ำส่วนใหญ่', excludedSeasons: ['hot'], excludedMonths: [2, 3, 4, 5] }),
  ]),
});

// Exported for golden tests that specifically guard Unicode-aware English token
// boundaries. It must not match "Samsung" or any other larger word.
export const STRICT_SUN_TOKEN = englishToken('sun');
