export const GROUPS_V5 = Object.freeze({
  food: 'อาหารและเครื่องดื่ม',
  fashion: 'แฟชั่นและเครื่องแต่งกาย',
  beauty: 'เครื่องสำอางและของใช้ส่วนตัว',
  home: 'บ้าน ครัว และการจัดเก็บ',
  agriculture: 'เกษตรและสวน',
  pets: 'สัตว์เลี้ยง',
  tech: 'มือถือ คอมพิวเตอร์ และไอที',
  appliances: 'เครื่องใช้ไฟฟ้าขนาดเล็ก',
  tools: 'เครื่องมือช่างและ DIY',
  learning: 'หนังสือ เครื่องเขียน และงานสร้างสรรค์',
  outdoor: 'กีฬา กลางแจ้ง และเดินทาง',
  automotive: 'รถและมอเตอร์ไซค์',
  religious: 'พระเครื่องและศาสนวัตถุ',
  baby: 'แม่ เด็ก และครอบครัว',
  supplements: 'สุขภาพและอาหารเสริม',
  'shop-supplies': 'อุปกรณ์ร้านค้าและแพ็กสินค้า',
});

export const GROUP_QUOTAS_V5 = Object.freeze({
  food: 7_000,
  fashion: 11_000,
  beauty: 5_000,
  home: 7_500,
  agriculture: 3_500,
  pets: 4_000,
  tech: 3_500,
  appliances: 2_000,
  tools: 3_000,
  learning: 3_500,
  outdoor: 3_000,
  automotive: 1_500,
  religious: 1_500,
  baby: 1_500,
  supplements: 500,
  'shop-supplies': 2_000,
});

export const MERCHANDISING_TAG_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'fashion-sleepwear', label: 'ชุดนอน' }),
  Object.freeze({ key: 'fashion-plus-size', label: 'สาวพลัสไซส์' }),
  Object.freeze({ key: 'fashion-office', label: 'ชุดออฟฟิศ' }),
]);

const parent = (key, label) => Object.freeze({ key, label });
export const CATEGORY_PARENTS_V5 = Object.freeze({
  'auto-interior': parent('auto-interior', 'ของใช้และจัดระเบียบในรถ'),
  'auto-exterior': parent('auto-exterior', 'ของตกแต่งภายนอกรถ'),
  'auto-care': parent('auto-care', 'อุปกรณ์ดูแลรถแบบไม่ใช้สารเคมี'),
  'tools-manual': parent('tools-manual', 'เครื่องมือช่างแบบใช้มือ'),
  'tools-hardware': parent('tools-hardware', 'ฮาร์ดแวร์และงานติดตั้ง'),
  'tools-storage': parent('tools-storage', 'จัดเก็บเครื่องมือ'),
  books: parent('books', 'หนังสือและสื่อการเรียนรู้'),
  stationery: parent('stationery', 'เครื่องเขียนและกระดาษ'),
  creative: parent('creative', 'ศิลปะ งานฝีมือ และงานอดิเรก'),
  'home-kitchen': parent('home-kitchen', 'ครัวและโต๊ะอาหาร'),
  'home-cleaning': parent('home-cleaning', 'ทำความสะอาดและซักล้าง'),
  'home-organizing': parent('home-organizing', 'จัดเก็บและจัดระเบียบบ้าน'),
  'home-textiles': parent('home-textiles', 'สิ่งทอและเครื่องนอน'),
  'home-decor': parent('home-decor', 'ของแต่งบ้าน'),
  furniture: parent('furniture', 'เฟอร์นิเจอร์ขนาดเล็ก'),
  camping: parent('camping', 'แคมป์ปิงและกันฝน'),
  travel: parent('travel', 'กระเป๋าและอุปกรณ์เดินทาง'),
  sports: parent('sports', 'กีฬาและออกกำลังกาย'),
  'mobile-accessories': parent('mobile-accessories', 'อุปกรณ์มือถือ'),
  'computer-accessories': parent('computer-accessories', 'อุปกรณ์คอมพิวเตอร์'),
  'cable-organizing': parent('cable-organizing', 'จัดสายและอุปกรณ์ไอทีแบบไม่ใช้ไฟ'),
  'pet-feeding': parent('pet-feeding', 'อุปกรณ์ให้อาหารสัตว์'),
  'pet-living': parent('pet-living', 'ที่อยู่ ของเล่น และเดินทาง'),
  'pet-hygiene': parent('pet-hygiene', 'ห้องน้ำและกรูมมิ่งสัตว์'),
  'pet-food': parent('pet-food', 'อาหารและขนมสัตว์'),
  skincare: parent('skincare', 'สกินแคร์'),
  'hair-body': parent('hair-body', 'เส้นผมและผิวกาย'),
  makeup: parent('makeup', 'เครื่องสำอาง'),
  'beauty-tools': parent('beauty-tools', 'อุปกรณ์แต่งหน้า'),
  vitamins: parent('vitamins', 'วิตามินและแร่ธาตุ'),
  'sports-nutrition': parent('sports-nutrition', 'โภชนาการกีฬา'),
  'women-clothing': parent('women-clothing', 'เสื้อผ้าผู้หญิง'),
  'men-clothing': parent('men-clothing', 'เสื้อผ้าผู้ชาย'),
  sleepwear: parent('sleepwear', 'ชุดนอนและชุดอยู่บ้าน'),
  bags: parent('bags', 'กระเป๋าและกระเป๋าสตางค์'),
  wallets: parent('wallets', 'กระเป๋าสตางค์และซองใส่บัตร'),
  shoes: parent('shoes', 'รองเท้า'),
  'fashion-accessories': parent('fashion-accessories', 'เครื่องประดับแฟชั่น'),
  'agri-irrigation': parent('agri-irrigation', 'ระบบน้ำและให้น้ำ'),
  'agri-growing': parent('agri-growing', 'เพาะปลูกและรองรับต้นไม้'),
  'agri-tools': parent('agri-tools', 'เครื่องมือเกษตรแบบใช้มือ'),
  'religious-amulets': parent('religious-amulets', 'พระเครื่องและอุปกรณ์จัดเก็บ'),
  'religious-worship': parent('religious-worship', 'ของบูชาและพื้นที่สักการะ'),
  'religious-decor': parent('religious-decor', 'ศาสนวัตถุและของตกแต่ง'),
  'small-appliances': parent('small-appliances', 'เครื่องใช้ไฟฟ้าขนาดเล็ก'),
  'appliance-cleaning': parent('appliance-cleaning', 'เครื่องใช้ไฟฟ้าทำความสะอาด'),
  'appliance-accessories': parent('appliance-accessories', 'อุปกรณ์เสริมเครื่องใช้ไฟฟ้า'),
  'baby-clothing': parent('baby-clothing', 'เสื้อผ้าเด็กและทารก'),
  'kids-clothing': parent('kids-clothing', 'เสื้อผ้าเด็กโต'),
  'kids-accessories': parent('kids-accessories', 'เครื่องแต่งกายเสริมสำหรับเด็ก'),
  'kids-learning': parent('kids-learning', 'ของเล่นเพื่อการเรียนรู้'),
  packaging: parent('packaging', 'บรรจุภัณฑ์และส่งพัสดุ'),
  'retail-labels': parent('retail-labels', 'ป้าย สติกเกอร์ และอุปกรณ์หน้าร้าน'),
  'product-display': parent('product-display', 'จัดแสดงและถ่ายสินค้า'),
  coffee: parent('coffee', 'กาแฟและชา'),
  beverages: parent('beverages', 'เครื่องดื่มบรรจุแพ็ก'),
  snacks: parent('snacks', 'ขนมและของกินเล่น'),
  staples: parent('staples', 'อาหารแห้งและวัตถุดิบหลัก'),
  cooking: parent('cooking', 'เครื่องปรุงและวัตถุดิบทำอาหาร'),
  convenience: parent('convenience', 'อาหารกึ่งสำเร็จรูปและเบเกอรีแพ็ก'),
});

const exact = (value, expected) => value === expected;
const oneOf = (value, expected) => expected.includes(value);
const spec = (key, label, groupKey, categoryKey, quotaWeight, matcher, options = {}) => ({
  key, label, groupKey, categoryKey, quotaWeight, matcher,
  riskTier: options.riskTier ?? 'green',
  summaryKind: options.summaryKind ?? 'general',
  deny: options.deny ?? null,
  trustedShopOnly: options.trustedShopOnly ?? false,
  expiryGate: options.expiryGate ?? false,
});

const FOOD_DENY = /(?:ของสด|แช่แข็ง|แช่เย็น|ควบคุมอุณหภูมิ|โฮมเมด|ทำเอง|ทําเอง|แบ่งขาย|ตักแบ่ง|ไม่มีฉลาก|ไร้ฉลาก|เครื่องดื่มแอลกอฮอล์|เหล้า|เบียร์|ไวน์|fresh\s*(?:meat|food|fruit|vegetable|seafood)|frozen|chilled|homemade|unlabelled|unlabeled|bulk\s*repack|alcohol|beer|wine)/iu;
const PET_FOOD_DENY = /(?:แบ่งขาย|ตักแบ่ง|ไม่มีฉลาก|ไร้ฉลาก|สด|แช่แข็ง|ดิบ|รักษา|โรค|ไต|ตับ|นิ่ว|ภูมิแพ้|สัตวแพทย์|ยาสัตว์|ยา|bulk\s*repack|unlabelled|unlabeled|fresh|frozen|raw\s*(?:food|meat)|veterinary|prescription|disease|renal|kidney|liver)/iu;
const AGRICULTURE_DENY = /(?:ต้นไม้จริง|ต้นกล้า|เมล็ด|หัวพันธุ์|ปุ๋ย|ดิน|ยาฆ่า|สารเคมี|ฮอร์โมน(?:พืช)?|เพาะเลี้ยงเนื้อเยื่อ|สารควบคุมการเจริญเติบโต|มีด|กรรไกร|เลื่อย|เครื่องตัด|เครื่องพ่น|เครื่องยนต์|แบตเตอรี่|live\s*plant|(?<![\p{L}\p{M}\p{N}])seeds?(?![\p{L}\p{M}\p{N}])|bulb|fertili|soil|pesticide|herbicide|chemical|growth\s*regulator|tissue\s*culture|knife|scissors|saw|mower|sprayer|engine|battery)/iu;
export const RELIGIOUS_DENY = /(?:รับประกัน(?:แท้|พุทธคุณ)|การันตี(?:แท้|พุทธคุณ)|แท้\s*100|เสริมดวง|เสริมสิริมงคล|เรียกทรัพย์|โชคลาภ|น(?:ำ|ํา)โชค|สมหวัง|ปางร(?:่ำ|่ํา)รวย|เทพแห่งความส(?:ำ|ํา)เร็จ|ชุดเจริญรุ่งเรือง|กันภัย|คงกระพัน|เมตตามหานิยม|รักษา|หายป่วย|ชนะพนัน|หวย|guaranteed\s*authentic|supernatural|luck|lottery)/iu;
const COSMETICS_DENY = /(?:รักษา|แก้สิว|ลดสิว|ลดฝ้า|ฝ้าหาย|สิวหาย|ขาวถาวร|ขาวใน\s*\d+|ผิวขาวไว|การันตี|ปลอดภัย\s*100|ไม่แพ้|ไม่ระคายเคือง|hypoallergenic|clinically\s*proven|รับรองโดยแพทย์|แพทย์แนะนำ|treat|cure|acne|melasma|permanent\s*white|guaranteed|doctor)/iu;
const BABY_DENY = /(?:แม่เหล็กแรงสูง|ลูกปัดจิ๋ว|ชิ้นส่วนเล็ก|สไลม์|สารเคมี|ของเล่นปืน|กระสุน|เลเซอร์|มีด|sharp|high\s*power\s*magnet|small\s*parts?|slime|chemical|toy\s*gun|bullet|laser|knife)/iu;
const ELECTRICAL_DENY = /(?:แก๊ส|ก๊าซ|เชื้อเพลิง|ฮีตเตอร์|เตา|หม้อทอด|หม้อแรงดัน|เตารีด|เครื่องทำน้ำอุ่น|เครื่องทําน้ำอุ่น|เครื่องปั่น|ใบมีด|ซ่อม|อะไหล่วงจร|แผงวงจร|แบตเตอรี่เปล่า|gas|fuel|heater|stove|fryer|pressure\s*cooker|iron|water\s*heater|blade|repair|circuit\s*board|bare\s*battery)/iu;
export const PASSIVE_MOBILE_ACCESSORY_DENY_V5 = /(?:แบต|ชาร์จ|สายไฟ|ยูเอสบี|\busb\b|หลอดไฟ|พัดลม|battery|charger|cable|power\s*bank|\bled\b)/iu;
export const TABLET_CASE_IDENTITY_V5 = /(?:ไอแพด|แท็บเล็ต|(?<![\p{L}\p{M}\p{N}])(?:ipad(?:pro|air|mini)?\d*|tablet\d*|(?:galaxy|samsung)[\s-]*tab(?:[sa]\d[\p{L}\p{M}\p{N}+.-]*)?|mate[\s-]*pad(?:pro\d*|\d+)?|redmi[\s-]*pad(?:se\d*|\d+)?|xiaomi[\s-]*pad\d*|lenovo[\s-]*tab(?:m\d[\p{L}\p{M}\p{N}+.-]*)?)(?![\p{L}\p{M}\p{N}]))/iu;
export const TABLET_CASE_IDENTITY_V5_GOLDEN_FIXTURES = Object.freeze({
  positive: Object.freeze([
    Object.freeze({ name: 'concatenated iPad Pro', title: 'เคส iPadPro' }),
    Object.freeze({ name: 'concatenated iPad number', title: 'เคส iPad10' }),
    Object.freeze({ name: 'concatenated Galaxy Tab model', title: 'เคส Galaxy TabS9' }),
    Object.freeze({ name: 'Samsung Tab model', title: 'เคส Samsung Tab S9 FE' }),
    Object.freeze({ name: 'concatenated MatePad model', title: 'เคส MatePad11' }),
    Object.freeze({ name: 'concatenated Redmi Pad model', title: 'เคส Redmi PadSE' }),
    Object.freeze({ name: 'concatenated Xiaomi Pad model', title: 'เคส Xiaomi Pad6' }),
    Object.freeze({ name: 'concatenated Lenovo Tab model', title: 'เคส Lenovo TabM10' }),
  ]),
  negative: Object.freeze([
    Object.freeze({ name: 'iPhone model is not iPad', title: 'เคส iPhone16 Pro Max' }),
    Object.freeze({ name: 'Galaxy phone without Tab', title: 'เคส Galaxy S24 Ultra' }),
    Object.freeze({ name: 'Redmi phone without Pad', title: 'เคส Redmi Note14' }),
    Object.freeze({ name: 'Xiaomi phone without Pad', title: 'เคส Xiaomi 15' }),
    Object.freeze({ name: 'Lenovo phone without Tab', title: 'เคส Lenovo Legion Phone' }),
    Object.freeze({ name: 'iPad prefix inside another word', title: 'เคส iPadapter Phone' }),
  ]),
});
const RUGGED_PHONE_CASE_FORM = /(?:กันกระแทก|ป้องกันกระแทก|กันตก|shock[-\s]*proof|anti[-\s]*(?:drop|shock)|armor|armour|rugged|heavy[-\s]*duty)/iu;
const PHONE_HANDSET_IDENTITY = /(?:โทรศัพท์|มือถือ|ไอโฟน|ซัมซุง|iphone|samsung|galaxy|oppo|realme|redmi(?!\s*pad)|xiaomi(?!\s*pad)|poco|vivo|huawei|honor|tecno|infinix|oneplus|iqoo|google\s*pixel|motorola|moto\s*[ge]|nothing\s*phone|asus\s*rog|nubia|red\s*magic|redmagic|zte|(?<![\p{L}\p{M}\p{N}])phone(?![\p{L}\p{M}\p{N}]))/iu;
const NON_HANDSET_CASE_IDENTITY = /(?:airpods?|แอร์พอด|earbuds?|หูฟัง|freeclip|galaxy\s*buds?|liberty\s*\d|watch|นาฬิกา|imoo|ไอมู่|pencil|ปากกา|ipad|ไอแพด|แท็บเล็ต|tablet|(?:galaxy|samsung)\s*tab|matepad|redmi\s*pad|xiaomi\s*pad|lenovo\s*tab|ลำโพง|ลําโพง|speaker|jbl|gopro|กล้องแอ็กชัน|กล้องแอคชั่น|airtag|รีโมท|remote|กุญแจ|key\s*fob|nintendo|playstation|steam\s*deck|xbox|changan|deepal|หน้าจอรถ|จอรถ)/iu;

export function isRuggedPhoneCaseV5(title) {
  const value = String(title ?? '').normalize('NFC');
  return RUGGED_PHONE_CASE_FORM.test(value) &&
    PHONE_HANDSET_IDENTITY.test(value) &&
    !TABLET_CASE_IDENTITY_V5.test(value) &&
    !NON_HANDSET_CASE_IDENTITY.test(value);
}

const ruggedPhoneCaseFixture = (id, title) => Object.freeze({
  id,
  c1: 'Mobile & Gadgets',
  c2: 'Accessories',
  c3: 'Cases, Covers, & Skins',
  title,
});

export const PHONE_RUGGED_CASE_V5_GOLDEN_FIXTURES = Object.freeze({
  positive: Object.freeze([
    ruggedPhoneCaseFixture('70543617-18493266920', 'เคสคิงคอง เคสใสกันกระแทก KINGKONG For SAMSUNG S26Ultra/A37/A57/A17/A07/A56/A36/A26/S25FE/S25Ultra/S24FE/A06/A16/A55/A23'),
    ruggedPhoneCaseFixture('778583632-55760565315', 'เคสโทรศัพท์กันกระแทกโปร่งใส 3-in-1 Anti-Yellowing ใช้งานร่วมกับ Samsung Galaxy S26 Ultra S25 S24 Ultra S23 Ultra A57 A16'),
    ruggedPhoneCaseFixture('799283289-25843932503', 'Armor Magnetic Bracket เคส For iPhone 11 13 16 17 15 14 Pro Max Air 12 13promax 17promax 16promax เคสโทรศัพท์มือถือ'),
    ruggedPhoneCaseFixture('428968658-26237961733', 'Diamond Studded Kitty Mirror เหมาะสําหรับ iPhone 17Promax เคสโทรศัพท์ Apple 16/15/14/13/12/11 Anti Drop'),
    ruggedPhoneCaseFixture('254037888-25422213071', 'เคสกันกระแทก กันรอยกล้อง ตั้งได้ สำหรับ Samsung A57 A17 A56 A36 A26 A16 A06 A55 A35 A25 A15 A05S A54 A34 A24 A14 A53 A73'),
  ]),
  negative: Object.freeze([
    ruggedPhoneCaseFixture('43959742-20191207747', 'Zugu Case The Alpha เคสหนังกันกระแทกเกรดพรีเมี่ยม เคสสำหรับ iPadGen7/8/9/Pro11/Pro12.9/Air4/5/Gen10/11/Air6/7 11/13M2/M3'),
    ruggedPhoneCaseFixture('132158480-29335018798', 'Samsung Tab S9 FE เคส NILLKIN หนัง PU กันกระแทกกล้อง แบบสไลด์ได้ สําหรับSamsung Tab S7 S8 S9 S7FE S9FE PLUS FE S10 S10Fe'),
    ruggedPhoneCaseFixture('301786571-40258533776', 'FOX เคสสำหรับ AirPods 4 / AirPods Pro 3 ดีไซน์บางเบา กันกระแทก ของแท้ 100% by Studio 7'),
    ruggedPhoneCaseFixture('190815827-45105702581', 'Auto Pop-Up โปร่งใส 2025 สําหรับ Huawei FreeClip 2/FreeClip หูฟังพร้อมพวงกุญแจกันกระแทก Protector Case พร้อมตะขอสําหรับ FreeClip 2'),
    ruggedPhoneCaseFixture('36768870-24011938854', '9Gadget - เคสกันรอย JBL Go 3 พร้อมห่วงคล้อง เคส เคสกันกระแทก ลำโพงบลูทูธ - Anti-Chock Case JBL GO3'),
    ruggedPhoneCaseFixture('9955187-24230773731', 'พร้อมส่ง เคสกันกระแทกหน้าจอ Changan Deepal S07 S05 Q05 ป้องกันขอบบิ่นกันกระแทกอย่างดี กันฝุ่น ไม่ฉีกขาดง่าย เหนียว'),
    ruggedPhoneCaseFixture('1201483326-27784930950', 'AirPods 4 Ear Tips Cover ซิลิโคนครอบแอร์พอด กันลื่น กันตก ใส่กระซับลดการเจ็บหู'),
  ]),
  nearMiss: Object.freeze([
    ruggedPhoneCaseFixture('ordinary-phone-case', 'เคสใสโทรศัพท์ iPhone 17 แบบบาง'),
    ruggedPhoneCaseFixture('rugged-tablet-case', 'เคส Samsung Galaxy Tab S10 กันกระแทก Rugged Case'),
  ]),
});
const ELECTRICAL_EVIDENCE = /(?:220\s*v|230\s*v|240\s*v|5\s*v|12\s*v|usb|type\s*c|ปลั๊ก|มอก\.|มอก\s*\d|voltage|watt|\d+\s*w\b)/iu;
export const APPLIANCE_FAN_CONSUMER_IDENTITY_V5 = /(?:พัดลม(?:ตั้งโต๊ะ|ตั้งพื้น|สไลด์|ไร้สาย|ชาร์จไฟ|พกพา|มือถือ|คล้องคอ|หนีบ|เป่าควัน|ดูดควัน|ระบายอากาศ)|handy\s*fan|(?:table(?:top)?|desk|standing|stand|floor|pedestal|portable|rechargeable|handheld|neck|clip(?:-on)?|ventilation|exhaust)\s*fan)/iu;
const APPLIANCE_FAN_PRIMARY_PART_IDENTITY = /(?:สาย(?:ไฟ|พัดลม)|fan\s*cable|สวิ(?:ตช์|ทช์|ทซ์)|switch|มอเตอร์(?:ส่าย)?(?:พัดลม)?|พัดลมมอเตอร์|fan\s*motor|motor\s*(?:for\s*)?fan|อะแดปเตอร์|อแดปเตอร์|adapter|ปั๊ม|pump|replacement\s*(?:part|motor)|อะไหล่)/iu;
const APPLIANCE_FAN_HARD_OUT_OF_SCOPE = /(?:ตู้(?:แช่|เย็น)|freezer|refrigerat(?:or|ion)|โคมไฟพัดลม|พัดลมเพดาน|ceiling\s*(?:lamp\s*)?fan|พัดลมอุโมงค์|พัดลมอุตสาหกรรม|tunnel\s*(?:fan|blower)|industrial\s*(?:fan|blower)|เครื่องเป่าลม|ท่อ(?:ส่ง)?ลม|พัดลม\s*2\s*นิ้ว[\s\S]{0,120}(?:\d{2,3}\s*mm|vdc|\d+\s*ma|\d+\s*สาย)|(?:component|brushless\s*dc|computer\s*cooling)\s*fan)/iu;

export function isConsumerApplianceFanV5(c1, c2, c3, title) {
  const value = String(title ?? '').normalize('NFC');
  const supportedPath =
    (c2 === 'Large Household Appliances' && c3 === 'Cooling') ||
    (c2 === 'Small Household Appliances' && c3 === 'Others');
  if (c1 !== 'Home Appliances' || !supportedPath || !ELECTRICAL_EVIDENCE.test(value)) return false;

  const consumerIndex = firstPatternIndex(APPLIANCE_FAN_CONSUMER_IDENTITY_V5, value);
  if (consumerIndex < 0 || APPLIANCE_FAN_HARD_OUT_OF_SCOPE.test(value)) return false;
  const partIndex = firstPatternIndex(APPLIANCE_FAN_PRIMARY_PART_IDENTITY, value);
  return partIndex < 0 || consumerIndex < partIndex;
}

const PASSIVE_REPLACEMENT_FILTER_IDENTITY = /(?:ไส้กรอง|แผ่นกรอง|ถุงกรอง|ผ้ากรอง|ผ้าฝ้ายไฟฟ้าสถิต|replacement\s*filter|filter\s*(?:cartridge|element|sheet|media|cotton)|(?:hepa|carbon)\s*filter)/iu;
const TEA_OR_COFFEE_BREWING_FILTER_BAG = /(?:(?:ถุง|ผ้า)กรอง(?:ชา|กาแฟ)|ถุง(?:ชง|กรอง)(?:ชา|กาแฟ)|tea\s*(?:filter|brewing)\s*bag|coffee\s*(?:filter|brewing)\s*(?:bag|cloth))/iu;
const AGRICULTURAL_IRRIGATION_FILTER_CONTEXT = /(?:(?:กรองน[้ำํา]|ไส้กรอง|filter)[\s\S]{0,100}(?:เกษตร|ชลประทาน|สปริงเกอร์|irrigation)|(?:เกษตร|ชลประทาน|สปริงเกอร์|irrigation)[\s\S]{0,100}(?:กรองน[้ำํา]|ไส้กรอง|filter))/iu;
const AIR_COMPRESSOR_INTAKE_FILTER_CONTEXT = /(?:(?:กรองอากาศ|ไส้กรอง|air\s*filter)[\s\S]{0,90}(?:ปั้มลม|ปั๊มลม|air\s*compressor|compressor\s*intake)|(?:ปั้มลม|ปั๊มลม|air\s*compressor|compressor\s*intake)[\s\S]{0,90}(?:กรองอากาศ|ไส้กรอง|air\s*filter))/iu;
const MIXED_POWERED_UV_FILTER_KIT = /(?:(?:ชุด\s*ไส้กรอง|ไส้กรอง[\s\S]{0,90}(?:และ|พร้อม|\+))[\s\S]{0,140}(?:หลอด\s*(?:อุลตร้าไวโอเล็ท|อัลตราไวโอเลต|ยูวี)|(?:ultra\s*violet|ultraviolet|uv)\s*(?:lamp|bulb))|(?:หลอด\s*(?:อุลตร้าไวโอเล็ท|อัลตราไวโอเลต|ยูวี)|(?:ultra\s*violet|ultraviolet|uv)\s*(?:lamp|bulb))[\s\S]{0,140}(?:ชุด\s*ไส้กรอง|ไส้กรอง))/iu;
const PORTABLE_OUTDOOR_WATER_FILTER_BAG = /(?:(?:ถุงกรองน[้ำํา]|water\s*(?:filter|filtration)\s*(?:bag|pouch))[\s\S]{0,100}(?:water\s*container|\d+\s*(?:มล\.?|ml)\b|กีฬา|ตั้งแคมป์|เดินป่า|ขี่จักรยาน|กลางแจ้ง|outdoor|camp(?:ing)?|hiking|cycling)|(?:water\s*container|กีฬา|ตั้งแคมป์|เดินป่า|ขี่จักรยาน|กลางแจ้ง|outdoor|camp(?:ing)?|hiking|cycling)[\s\S]{0,100}(?:ถุงกรองน[้ำํา]|water\s*(?:filter|filtration)\s*(?:bag|pouch)))/iu;
const FULL_AIR_CONDITIONER_DEVICE_EVIDENCE = /(?:(?:เครื่องปรับอากาศ|แอร์ติดผนัง|air\s*conditioner|wall[-\s]*mounted\s*aircon)[\s\S]{0,140}(?:\d{1,3}(?:,\d{3})?\s*btu|inverter|คอยล์ทองแดง|ท่อทองแดง)|(?:\d{1,3}(?:,\d{3})?\s*btu|inverter)[\s\S]{0,140}(?:เครื่องปรับอากาศ|แอร์ติดผนัง|air\s*conditioner|aircon))/iu;
const POWERED_DIY_AIR_PURIFIER_EVIDENCE = /(?:(?:เครื่องฟอกอากาศ|เครื่องกรองอากาศ|air\s*purifier)[\s\S]{0,160}(?:\bdiy\b|อแดปเตอร์|adapter|พัดลม|\bfan\b|ปรับ(?:ความเร็วลม|ระดับแรงลม|แรงลม|รอบ))|(?:\bdiy\b|อแดปเตอร์|adapter|พัดลม|\bfan\b|ปรับ(?:ความเร็วลม|ระดับแรงลม|แรงลม|รอบ))[\s\S]{0,160}(?:เครื่องฟอกอากาศ|เครื่องกรองอากาศ|air\s*purifier)|\bdiy\b[\s\S]{0,100}(?:อแดปเตอร์|adapter|พัดลม|\bfan\b))/iu;
const WHOLE_FILTERING_APPLIANCE = /(?:เครื่องกรองน[้ำํา](?:ดื่ม)?|แท่งกรองน[้ำํา]|ฟิลเตอร์กรองน[้ำํา]|กรองน[้ำํา](?:ฝักบัว|อาบ)|water\s*(?:filter|purifier)|เครื่องฟอก(?:และ\s*หมุนเวียน)?อากาศ(?:ในรถ(?:ยนต์)?)?|เครื่องกรองอากาศ|(?:car\s*)?air\s*purifier|เครื่องดูดควัน|range\s*hood|cooker\s*hood)/iu;
const INCIDENTAL_FILTER_CONTEXT = /(?:แจ้งเตือน|สะดวกต่อการเปลี่ยน|ไม่(?:ต้อง)?ใช้|ฟรี|แถม|พร้อม)\s*(?:เปลี่ยน\s*)?(?:ไส้กรอง|แผ่นกรอง|(?:hepa|carbon)\s*filter)/iu;
const FILTER_HOUSING_CLIP_OR_MIXED_WATER_SPARES = /(?:กระบอกกรองน[้ำํา]|filter\s*housing|\bhousing\s*\d|คลิ?ปยึด(?:กระบอก)?ไส้กรอง|ตัวจับกระบอกกรอง|(?:อะไหล่เครื่องกรองน[้ำํา]|water\s*purifier\s*spare)[\s\S]{0,220}(?:ก๊อก|ถังเก็บ|ภาชนะเก็บ|faucet|tank))/iu;
const MIXED_VACUUM_ACCESSORY_OPTIONS = /(?:(?:แปรงหลัก|ลูกกลิ้งหลัก|แปรงลูกกลิ้ง|main\s*(?:brush|roller))[\s\S]{0,240}(?:แปรงด้านข้าง|side\s*brush|ผ้าม็อบ|ไม้ถูพื้น|mop|ล้อ|wheel|brush\s*cover)|(?:แปรงด้านข้าง|side\s*brush|ผ้าม็อบ|ไม้ถูพื้น|mop|ล้อ|wheel)[\s\S]{0,240}(?:แปรงหลัก|ลูกกลิ้งหลัก|แปรงลูกกลิ้ง|main\s*(?:brush|roller))|spare\s*parts[\s\S]{0,200}(?:main|side)\s*(?:brush|roller)[\s\S]{0,200}(?:hepa\s*)?filter|ไส้กรอง[\s\S]{0,160}(?:หัวดูด|ท่อดูด)|(?:หัวดูด|ท่อดูด)[\s\S]{0,160}ไส้กรอง|แปรง(?:อเนกประสงค์|ท[ำํา]ความสะอาด)[\s\S]{0,120}ไส้กรอง)/iu;
const FILTER_HOUSING_OR_FAUCET_ATTACHMENT = /(?:กระบอก(?:กรอง|กรอก|รอง)(?:น[้ำํา])?|กระบอก\s*เฮ้าส์ซิ่ง|เฮ้าส์ซิ่ง(?:\s*ใส่)?\s*ไส้กรอง|filter\s*housing|\bhousing\s*\d|(?:ชุด\s*กรอง|หัวต่อ)\s*ก๊อก(?:กรอง)?น[้ำํา])/iu;
const FAUCET_OR_SHOWER_FILTER_ATTACHMENT = /(?:กรอง\s*ก๊อกน[้ำํา]|กรองน[้ำํา]\s*ก๊อก|กรองน[้ำํา]\s*ฝักบัว|faucet\s*(?:mount(?:ed)?\s*)?(?:water\s*)?filter|shower\s*filter)/iu;
const MIXED_INLET_FILTER_APPLICATIONS = /(?:เครื่องท(?:ำ|ํา)น(?:้ำ|้ํา|ำ|ํา)อุ่น[\s\S]{0,160}เครื่องซักผ้า|เครื่องซักผ้า[\s\S]{0,160}เครื่องท(?:ำ|ํา)น(?:้ำ|้ํา|ำ|ํา)อุ่น)[\s\S]{0,160}(?:ไส้กรอง|แผ่นกรอง|filter)/iu;
const AUTOMOTIVE_FILTER_EVIDENCE = /(?:ส[ำํา]หรับรถยนต์|ไส้กรอง(?:แอร์|อากาศ)(?:รถ|ห้องโดยสาร)|cabin\s*(?:air\s*)?filter)/iu;
const FILTER_UNSUPPORTED_HEALTH_CLAIM = /(?:(?:ลด|แก้|ป้องกัน).{0,24}(?:อาการ)?แพ้|แพ้น[้ำํา]|(?:กรอง|ดัก).{0,64}(?:ได้\s*ถึง\s*)?99(?:[.,]\d+)?\s*%)/iu;
const VACUUM_KIT_MARKER = /(?:อุปกรณ์เสริม|อะไหล่|ชุด\s*(?:อะไหล่|แปรง)|accessor(?:y|ies)|spare\s*parts|\bkit\b)/iu;
const VACUUM_NON_FILTER_ACCESSORY_FAMILIES = Object.freeze([
  /(?:แปรง|brush|ลูกกลิ้ง|roller)/iu,
  /(?:ถุง(?:เก็บ|ดัก)ฝุ่น|dust\s*bag)/iu,
  /(?:ผ้าม็อบ|ผ้า\s*mop|ไม้ถูพื้น|mop)/iu,
  /(?:ล้อ|wheel|หัวดูด|ท่อดูด|nozzle|brush\s*cover|ฝาครอบแปรง)/iu,
]);
const FILTER_TOOL_OR_SUPPORT_ACCESSORY = /(?:ประแจ.{0,48}(?:กระบอก)?ไส้กรอง|(?:ข้อต่อ|ฟิตติ้ง).{0,100}ไส้กรอง|(?:ตัว|แหวน)\s*ประคอง\s*ไส้กรอง)/iu;
const MIXED_WEARABLE_PURIFIER_ACCESSORIES = /(?:(?:inner\s*cover|face\s*guard|ear\s*band)[\s\S]{0,160}(?:hepa\s*)?filter|(?:hepa\s*)?filter[\s\S]{0,160}(?:inner\s*cover|face\s*guard|ear\s*band))/iu;
const NON_REPLACEABLE_FILTER_DEVICE = /(?:เปลี่ยน\s*ไส้กรอง\s*ไม่ได้|non[-\s]?replaceable\s*filter)/iu;
const FILTER_HOUSING_OR_COMPLETE_KIT = /(?:(?:กระบอก|เฮ้าส์ซิ่ง).{0,100}(?:พร้อม|คู่กับ).{0,80}ไส้กรอง|ไส้กรอง.{0,100}พร้อม.{0,80}(?:กระบอก|เฮ้าส์ซิ่ง|ข้องอ).{0,40}(?:ครบ\s*ชุด)?|กระบอก\s*เมมเบรน.{0,120}(?:ไส้กรอง|เลือก\s*เฉพาะ\s*ไส้กรอง))/iu;

function firstPatternIndex(pattern, value) {
  const match = pattern.exec(value);
  return match?.index ?? -1;
}

function hasWholeApplianceAsPrimaryProduct(value) {
  const filterIndex = firstPatternIndex(PASSIVE_REPLACEMENT_FILTER_IDENTITY, value);
  const applianceIndex = firstPatternIndex(WHOLE_FILTERING_APPLIANCE, value);
  return applianceIndex >= 0 && filterIndex >= 0 &&
    (applianceIndex < filterIndex || INCIDENTAL_FILTER_CONTEXT.test(value));
}

function hasFilterHousingOrFaucetAsPrimaryProduct(value) {
  const filterIndex = firstPatternIndex(PASSIVE_REPLACEMENT_FILTER_IDENTITY, value);
  const attachmentIndex = Math.min(
    ...[FILTER_HOUSING_OR_FAUCET_ATTACHMENT, FAUCET_OR_SHOWER_FILTER_ATTACHMENT]
      .map((pattern) => firstPatternIndex(pattern, value))
      .filter((index) => index >= 0),
  );
  return attachmentIndex >= 0 && filterIndex >= 0 && attachmentIndex < filterIndex;
}

function hasMixedVacuumAccessoryKit(value) {
  const familyCount = VACUUM_NON_FILTER_ACCESSORY_FAMILIES.reduce((count, pattern) => count + Number(pattern.test(value)), 0);
  return familyCount >= 2 || (familyCount >= 1 && VACUUM_KIT_MARKER.test(value));
}

export function isPassiveReplacementFilterTitleV5(title) {
  const value = String(title ?? '').normalize('NFC')
    .replace(/\u0E4D\u0E32/gu, '\u0E33')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, ' ')
    .replace(/\s+([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])/gu, '$1')
    .replace(/([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])\s+/gu, '$1');
  return PASSIVE_REPLACEMENT_FILTER_IDENTITY.test(value) &&
    !TEA_OR_COFFEE_BREWING_FILTER_BAG.test(value) &&
    !AGRICULTURAL_IRRIGATION_FILTER_CONTEXT.test(value) &&
    !AIR_COMPRESSOR_INTAKE_FILTER_CONTEXT.test(value) &&
    !MIXED_POWERED_UV_FILTER_KIT.test(value) &&
    !PORTABLE_OUTDOOR_WATER_FILTER_BAG.test(value) &&
    !FULL_AIR_CONDITIONER_DEVICE_EVIDENCE.test(value) &&
    !POWERED_DIY_AIR_PURIFIER_EVIDENCE.test(value) &&
    !hasWholeApplianceAsPrimaryProduct(value) &&
    !hasFilterHousingOrFaucetAsPrimaryProduct(value) &&
    !FILTER_HOUSING_CLIP_OR_MIXED_WATER_SPARES.test(value) &&
    !MIXED_VACUUM_ACCESSORY_OPTIONS.test(value) &&
    !hasMixedVacuumAccessoryKit(value) &&
    !MIXED_INLET_FILTER_APPLICATIONS.test(value) &&
    !AUTOMOTIVE_FILTER_EVIDENCE.test(value) &&
    !FILTER_UNSUPPORTED_HEALTH_CLAIM.test(value) &&
    !FILTER_TOOL_OR_SUPPORT_ACCESSORY.test(value) &&
    !MIXED_WEARABLE_PURIFIER_ACCESSORIES.test(value) &&
    !NON_REPLACEABLE_FILTER_DEVICE.test(value) &&
    !FILTER_HOUSING_OR_COMPLETE_KIT.test(value);
}

const foodPath = (key, label, categoryKey, c2, c3, weight = 1) => spec(
  key, label, 'food', categoryKey, weight,
  (source1, source2, source3) => exact(source1, 'Food & Beverages') && exact(source2, c2) && oneOf(source3, Array.isArray(c3) ? c3 : [c3]),
  { riskTier: 'amber', summaryKind: 'food', trustedShopOnly: true, expiryGate: true, deny: FOOD_DENY },
);

const fashionPath = (key, label, categoryKey, c1, c2, c3, weight = 1) => spec(
  key, label, 'fashion', categoryKey, weight,
  (source1, source2, source3) => exact(source1, c1) && exact(source2, c2) && (c3 === null || oneOf(source3, Array.isArray(c3) ? c3 : [c3])),
);

const COSMETIC_TITLE_FAMILIES = Object.freeze([
  Object.freeze({ key: 'makeup-concealer', pattern: /(?:คอนซีล|concealer|corrector)/iu }),
  Object.freeze({ key: 'makeup-blush-highlight', pattern: /(?:บลัช|ปัดแก้ม|ไฮไล[ตท]|บรอนเซอร์|คอนทัวร์|blush|highlighter|bronzer|contour|(?<![\p{L}\p{M}\p{N}])cheek(?![\p{L}\p{M}\p{N}]))/iu }),
  Object.freeze({ key: 'makeup-foundation', pattern: /(?:รองพื้น|คุชชั่น|ไพรเมอร์|เมคอัพเบส|โทนอัพ|foundation|cushion|primer|makeup\s*base|tone\s*up|(?<![\p{L}\p{M}\p{N}])(?:bb|cc)\s*cream(?![\p{L}\p{M}\p{N}]))/iu }),
  Object.freeze({ key: 'makeup-powder', pattern: /(?:แป้ง(?!สลัดโรล)|เพาเดอร์|setting\s*powder|face\s*powder|loose\s*powder|pressed\s*powder|compact(?:\s*powder)?|(?<![\p{L}\p{M}\p{N}])(?:powder|talc)(?![\p{L}\p{M}\p{N}]))/iu }),
  Object.freeze({ key: 'makeup-eyebrow', pattern: /(?:เขียนคิ้ว|ดินสอคิ้ว|มาสคาร่าคิ้ว|มาสคาราคิ้ว|เจลคิ้ว|ที่ปัดคิ้ว|อายโบรว์|บราว(?:เจล|พาวเดอร์|แชโดว์|คารา)|eyebrow|browcara|(?<![\p{L}\p{M}\p{N}])brow\s*(?:pencil|gel|powder|shadow|mascara|pen)(?![\p{L}\p{M}\p{N}]))/iu }),
  Object.freeze({ key: 'makeup-eyeliner-mascara', pattern: /(?:อายไลเนอร์|อายไลน์เนอร์|ไลเนอร์|ไลน์เนอร์|มาสคาร่า|มาสคารา|eyeliner|eye\s*liner|(?<![\p{L}\p{M}\p{N}])(?:liner|mascara)(?![\p{L}\p{M}\p{N}]))/iu }),
  Object.freeze({ key: 'makeup-eyeshadow', pattern: /(?:อายแชโดว์|อายชาโดว์|พาเล[ตท](?:ต์)?(?:สี)?ตา|eyeshadow|eye\s*(?:color\s*)?(?:shadow|palette)|shadow\s*palette|multi\s*eye\s*color)/iu }),
  Object.freeze({ key: 'beauty-brushes-sponges', pattern: /(?:แปรง(?:แต่งหน้า|เกลี่ย|ปัดแป้ง|ปัดแก้ม|ลิป)|ฟองน้(?:ำ|ํา)(?:แต่งหน้า|เกลี่ย)|พัฟ(?:แต่งหน้า|รองพื้น|แป้ง)|makeup\s*brush|cosmetic\s*brush|beauty\s*(?:sponge|blender)|makeup\s*(?:sponge|puff)|powder\s*puff|(?<![\p{L}\p{M}\p{N}])brush(?![\p{L}\p{M}\p{N}]))/iu }),
  Object.freeze({ key: 'beauty-makeup-organizers', pattern: /(?:กล่อง(?:เก็บ)?เครื่องส(?:ำ|ํา)อาง|กระเป๋าเครื่องส(?:ำ|ํา)อาง|ที่จัดเครื่องส(?:ำ|ํา)อาง|makeup\s*(?:bag|case|box|organizer)|cosmetic\s*(?:bag|case|box|organizer))/iu }),
  Object.freeze({ key: 'beauty-eyelash-curlers', pattern: /(?:ที่ดัดขนตา|ดัดขนตา|eyelash\s*curler|lash\s*curler)/iu }),
]);

const STRONG_COSMETIC_ORGANIZER_IDENTITY = /(?:ออแกไนเซอร์|ออร์แกไนเซอร์|(?<![\p{L}\p{M}\p{N}])organizer(?![\p{L}\p{M}\p{N}])|กล่อง(?:เก็บ|ใส่)[\s\S]{0,90}(?:เครื่องส(?:ำ|ํา)อาง|แปรงแต่งหน้า|ดินสอเขียนคิ้ว|อุปกรณ์แต่งหน้า)|(?:makeup|cosmetic|beauty|brush)\s*(?:storage|organizer|holder|case|box)|(?:storage|organizer|holder)\s*(?:case|box)?\s*(?:for\s*)?(?:makeup|cosmetic|beauty|brush))/iu;

export function cosmeticTitleFamilyV5(title) {
  if (STRONG_COSMETIC_ORGANIZER_IDENTITY.test(String(title ?? ''))) return 'beauty-makeup-organizers';
  const matches = COSMETIC_TITLE_FAMILIES
    .map(({ key, pattern }, priority) => {
      const match = pattern.exec(title);
      return match ? { key, index: match.index, priority } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.index - right.index || left.priority - right.priority);
  return matches[0]?.key ?? '';
}

const cosmeticPath = (key, label, categoryKey, c2, c3, weight = 1, titleFamily = '') => spec(
  key, label, 'beauty', categoryKey, weight,
  (source1, source2, source3, title) => exact(source1, 'Beauty') && exact(source2, c2) &&
    (c3 === null || oneOf(source3, Array.isArray(c3) ? c3 : [c3])) && (!titleFamily || cosmeticTitleFamilyV5(title) === titleFamily),
  { riskTier: 'amber', summaryKind: 'cosmetics', trustedShopOnly: true, expiryGate: true, deny: COSMETICS_DENY },
);

export const NEW_RULE_SPECS_V5 = Object.freeze([
  foodPath('food-coffee', 'กาแฟบรรจุแพ็ก', 'coffee', 'Beverages', 'Coffee', 2),
  foodPath('food-tea', 'ชาและถุงชา', 'coffee', 'Beverages', 'Tea & Tea Bags', 1.5),
  foodPath('food-powdered-drinks', 'เครื่องดื่มชนิดผง', 'beverages', 'Beverages', ['Powdered Drink Mixes', 'Chocolate Drinks'], 1),
  foodPath('food-juice', 'น้ำผลไม้บรรจุแพ็ก', 'beverages', 'Beverages', 'Juice & Juice Vinegar', 1),
  foodPath('food-water', 'น้ำดื่มบรรจุแพ็ก', 'beverages', 'Beverages', 'Water', 0.7),
  foodPath('food-nondairy-milk', 'นมจากพืชแบบเก็บได้นาน', 'beverages', 'Beverages', 'Non-dairy Milk', 1),
  foodPath('food-carbonated', 'เครื่องดื่มอัดลมและโทนิก', 'beverages', 'Beverages', 'Carbonated Drinks & Tonics', 0.8),
  foodPath('food-dried-snacks', 'ขนมอบแห้งและผลไม้อบ', 'snacks', 'Snacks', 'Dried Snacks', 2),
  foodPath('food-biscuits', 'บิสกิต คุกกี้ และเวเฟอร์', 'snacks', 'Snacks', 'Biscuits, Cookies & Wafers', 1.5),
  foodPath('food-chips', 'มันฝรั่งทอดและขนมกรอบ', 'snacks', 'Snacks', 'Chips & Crisps', 1),
  foodPath('food-nuts', 'ถั่วและเมล็ดอบ', 'snacks', 'Snacks', 'Nuts', 1),
  foodPath('food-sweets', 'ลูกอม ช็อกโกแลต และเยลลี', 'snacks', 'Snacks', ['Sweets & Candy', 'Chocolate', 'Pudding, Jellies & Marshmallow'], 1.5),
  foodPath('food-dried-staples', 'ของแห้งและธัญพืช', 'staples', 'Food Staples', 'Dried Goods', 1.5),
  foodPath('food-rice', 'ข้าวบรรจุแพ็ก', 'staples', 'Food Staples', 'Rice', 1),
  foodPath('food-noodles', 'เส้นแห้งบรรจุแพ็ก', 'staples', 'Food Staples', 'Noodles', 0.8),
  foodPath('food-canned', 'อาหารกระป๋อง', 'staples', 'Food Staples', ['Canned Food', 'Preserved Vegetables'], 1),
  foodPath('food-seasonings', 'เครื่องปรุงและซอส', 'cooking', 'Cooking Essentials', 'Seasonings & Condiments', 2),
  foodPath('food-soup-stock', 'ซุปและน้ำสต็อกกึ่งสำเร็จรูป', 'cooking', 'Cooking Essentials', 'Stock, Gravy & Instant Soup', 0.8),
  foodPath('food-baking', 'แป้งและวัตถุดิบเบเกอรี', 'cooking', 'Baking Needs', ['Flour', 'Baking Decoration', 'Others'], 1),
  foodPath('food-instant-noodles', 'บะหมี่และอาหารกึ่งสำเร็จรูป', 'convenience', 'Convenience / Ready-to-eat', 'Instant Noodles', 1.5),

  fashionPath('women-tshirts', 'เสื้อยืดผู้หญิง', 'women-clothing', 'Women Clothes', 'Tops', 'T-shirts', 2),
  fashionPath('women-shirts-blouses', 'เสื้อเชิ้ตและเสื้อเบลาส์ผู้หญิง', 'women-clothing', 'Women Clothes', 'Tops', 'Shirts & Blouses', 1.5),
  fashionPath('women-tanks-camisoles', 'เสื้อกล้ามและเสื้อสายเดี่ยวผู้หญิง', 'women-clothing', 'Women Clothes', 'Tops', 'Tanks & Camisoles', 1),
  fashionPath('women-dresses', 'เดรสผู้หญิง', 'women-clothing', 'Women Clothes', 'Dresses', null, 1.7),
  fashionPath('women-pants', 'กางเกงขายาวผู้หญิง', 'women-clothing', 'Women Clothes', 'Pants & Leggings', 'Pants', 1.3),
  fashionPath('women-skirts', 'กระโปรงผู้หญิง', 'women-clothing', 'Women Clothes', 'Skirts', null, 1),
  fashionPath('women-shorts', 'กางเกงขาสั้นผู้หญิง', 'women-clothing', 'Women Clothes', 'Shorts', null, 0.8),
  fashionPath('women-sets', 'ชุดเซตผู้หญิง', 'women-clothing', 'Women Clothes', 'Sets', null, 1.2),
  fashionPath('women-jeans', 'ยีนส์ผู้หญิง', 'women-clothing', 'Women Clothes', 'Jeans', null, 1),
  fashionPath('women-sweaters-cardigans', 'เสื้อกันหนาวและคาร์ดิแกนผู้หญิง', 'women-clothing', 'Women Clothes', 'Sweaters & Cardigans', null, 0.8),
  fashionPath('women-sleepwear-pajamas', 'ชุดนอนผู้หญิง', 'sleepwear', 'Women Clothes', 'Sleepwear & Pajamas', 'Pajamas', 1),
  fashionPath('women-night-dresses', 'ชุดนอนเดรสผู้หญิง', 'sleepwear', 'Women Clothes', 'Sleepwear & Pajamas', 'Night Dresses', 0.7),
  fashionPath('men-tshirts', 'เสื้อยืดผู้ชาย', 'men-clothing', 'Men Clothes', 'Tops', 'T-Shirts', 1.8),
  fashionPath('men-shirts', 'เสื้อเชิ้ตผู้ชาย', 'men-clothing', 'Men Clothes', 'Tops', 'Shirts', 1),
  fashionPath('men-polos', 'เสื้อโปโลผู้ชาย', 'men-clothing', 'Men Clothes', 'Tops', 'Polo Shirts', 1),
  fashionPath('men-pants', 'กางเกงขายาวผู้ชาย', 'men-clothing', 'Men Clothes', 'Pants', null, 1),
  fashionPath('men-shorts', 'กางเกงขาสั้นผู้ชาย', 'men-clothing', 'Men Clothes', 'Shorts', null, 0.9),
  fashionPath('men-jeans', 'ยีนส์ผู้ชาย', 'men-clothing', 'Men Clothes', 'Jeans', null, 0.8),
  fashionPath('men-jackets', 'แจ็กเก็ตผู้ชาย', 'men-clothing', 'Men Clothes', 'Jackets, Coats & Vests', null, 0.6),
  fashionPath('men-occupational', 'ชุดทำงานผู้ชาย', 'men-clothing', 'Men Clothes', 'Occupational Attire', null, 0.6),
  spec('women-crossbody-bags', 'กระเป๋าสะพายผู้หญิง', 'fashion', 'bags', 1.2, (c1, c2) => c1 === 'Women Bags' && /Crossbody|Shoulder/iu.test(c2)),
  spec('women-tote-bags', 'กระเป๋าโท้ตผู้หญิง', 'fashion', 'bags', 0.8, (c1, c2) => c1 === 'Women Bags' && /Tote/iu.test(c2)),
  spec('fashion-wallets-cardholders', 'กระเป๋าสตางค์และซองใส่บัตร', 'fashion', 'wallets', 0.8, (c1, c2, c3, title) => /^(?:Women Bags|Men Bags)$/u.test(c1) && /wallet|card\s*holder|กระเป๋าสตางค์|ซองใส่บัตร/iu.test(`${c2} ${c3} ${title}`)),
  spec('women-flat-shoes', 'รองเท้าส้นแบนผู้หญิง', 'fashion', 'shoes', 0.8, (c1, c2) => c1 === 'Women Shoes' && /Flats|Flat Sandals|Flip Flops/iu.test(c2), { deny: /รองเท้านิรภัย|หัวเหล็ก|safety\s*shoe|steel\s*toe/iu }),
  spec('fashion-hair-accessories', 'เครื่องประดับผม', 'fashion', 'fashion-accessories', 1, (c1, c2) => c1 === 'Fashion Accessories' && c2 === 'Hair Accessories'),
  spec('fashion-hats', 'หมวกแฟชั่น', 'fashion', 'fashion-accessories', 0.8, (c1, c2) => c1 === 'Fashion Accessories' && c2 === 'Hats & Caps'),
  spec('fashion-belts-scarves', 'เข็มขัดและผ้าพันคอ', 'fashion', 'fashion-accessories', 0.8, (c1, c2) => c1 === 'Fashion Accessories' && /Belts|Scarves & Shawls/iu.test(c2)),

  spec('agri-irrigation-connectors', 'ข้อต่อและวาล์วระบบน้ำ', 'agriculture', 'agri-irrigation', 2, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Gardening' && c3 === 'Irrigation Systems' && /ข้อต่อ|วาล์ว|หัวต่อ|connector|valve|adapter/iu.test(title), { deny: AGRICULTURE_DENY }),
  spec('agri-drip-watering', 'หัวน้ำหยดและสายไมโคร', 'agriculture', 'agri-irrigation', 2, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Gardening' && c3 === 'Irrigation Systems' && /น้ำหยด|น้ําหยด|สายไมโคร|drip|micro\s*tube/iu.test(title), { deny: AGRICULTURE_DENY }),
  spec('agri-pots-planters', 'กระถางและภาชนะปลูก', 'agriculture', 'agri-growing', 2, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Gardening' && c3 === 'Pots & Planters' && !/ถาดเพาะ|กระถางเพาะ|seedling\s*tray|nursery\s*pot/iu.test(title), { deny: AGRICULTURE_DENY }),
  spec('agri-seedling-trays', 'ถาดเพาะและกระถางเพาะ', 'agriculture', 'agri-growing', 1, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Gardening' && /ถาดเพาะ|กระถางเพาะ|seedling\s*tray|nursery\s*pot/iu.test(title), { deny: AGRICULTURE_DENY }),
  spec('agri-plant-supports', 'หลักค้ำ คลิป และเชือกพยุงต้นไม้', 'agriculture', 'agri-growing', 1.5, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Gardening' && /ค้ำต้น|คํ้าต้น|คลิปต้นไม้|เชือกพยุง|plant\s*(?:support|clip|stake|tie)/iu.test(title), { deny: AGRICULTURE_DENY }),
  spec('agri-nets-labels', 'ตาข่ายและป้ายต้นไม้', 'agriculture', 'agri-growing', 1.5, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Gardening' && /ตาข่าย|ป้ายต้นไม้|plant\s*(?:net|label|tag)|garden\s*net/iu.test(title), { deny: AGRICULTURE_DENY }),
  spec('agri-hand-tools', 'อุปกรณ์สวนแบบใช้มือเสี่ยงต่ำ', 'agriculture', 'agri-tools', 1, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Gardening' && c3 === 'Gardening Tools' && /ถุงมือ|บัวรดน้ำ|บัวรดน้ํา|ที่พรวนมือ|ช้อนปลูก|glove|watering\s*can|hand\s*(?:rake|trowel)/iu.test(title), { deny: AGRICULTURE_DENY }),

  spec('religious-amulet-frames', 'กรอบพระและตลับพระ', 'religious', 'religious-amulets', 2, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Fengshui & Religious Supplies' && /กรอบพระ|ตลับพระ|กรอบเหรียญ|amulet\s*(?:frame|case|holder)/iu.test(title), { deny: RELIGIOUS_DENY }),
  spec('religious-amulet-necklaces', 'สร้อยและสายคล้องพระ', 'religious', 'religious-amulets', 1.5, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Fengshui & Religious Supplies' && /สร้อยพระ|สายคล้องพระ|เชือกคล้องพระ|amulet\s*(?:necklace|cord|chain)/iu.test(title), { deny: RELIGIOUS_DENY }),
  spec('religious-amulet-storage', 'กล่องและถาดเก็บพระเครื่อง', 'religious', 'religious-amulets', 1, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Fengshui & Religious Supplies' && /กล่องเก็บพระ|ถาดพระ|ตู้พระ|amulet\s*(?:box|tray|display|storage)/iu.test(title), { deny: RELIGIOUS_DENY }),
  spec('religious-amulets', 'พระเครื่องและเหรียญบูชา', 'religious', 'religious-amulets', 0.5, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Fengshui & Religious Supplies' && /พระเครื่อง|เหรียญพระ|พระผง|amulet/iu.test(title) && !/กรอบ|ตลับ|สร้อย|กล่อง|ถาด|frame|case|necklace|box|tray/iu.test(title), { riskTier: 'amber', summaryKind: 'religious', trustedShopOnly: true, deny: RELIGIOUS_DENY }),
  spec('religious-altar-supplies', 'ฐานวางและอุปกรณ์โต๊ะหมู่บูชา', 'religious', 'religious-worship', 1.5, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Fengshui & Religious Supplies' && /ฐานวางพระ|โต๊ะหมู่|หิ้งพระ|แท่นบูชา|altar|buddha\s*(?:stand|shelf)/iu.test(title), { deny: RELIGIOUS_DENY }),
  spec('religious-offering-decor', 'พวงมาลัยและดอกไม้บูชาประดิษฐ์', 'religious', 'religious-worship', 1, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Fengshui & Religious Supplies' && /พวงมาลัย|ดอกไม้บูชา|ดอกบัวประดิษฐ์|garland|artificial\s*lotus/iu.test(title), { deny: /สด|fresh|ต้นจริง|live|รับประกันพุทธคุณ|เสริมดวง/iu }),
  spec('religious-statues-decor', 'พระพุทธรูปและศาสนวัตถุตกแต่ง', 'religious', 'religious-decor', 1.5, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Fengshui & Religious Supplies' && /พระพุทธรูป|รูปหล่อ|องค์พระ|buddha\s*(?:statue|figure)|religious\s*statue/iu.test(title), { deny: RELIGIOUS_DENY }),

  cosmeticPath('makeup-foundation', 'รองพื้น คุชชั่น และเบสเมคอัพ', 'makeup', 'Makeup', 'Face', 2, 'makeup-foundation'),
  cosmeticPath('makeup-powder', 'แป้งแต่งหน้า', 'makeup', 'Makeup', 'Face', 1.5, 'makeup-powder'),
  cosmeticPath('makeup-concealer', 'คอนซีลเลอร์', 'makeup', 'Makeup', 'Face', 1, 'makeup-concealer'),
  cosmeticPath('makeup-blush-highlight', 'บลัชและไฮไลต์', 'makeup', 'Makeup', 'Face', 1, 'makeup-blush-highlight'),
  cosmeticPath('makeup-lipstick', 'ลิปสติกและลิปทินต์', 'makeup', 'Makeup', 'Lips', 2),
  cosmeticPath('makeup-eyebrow', 'ผลิตภัณฑ์เขียนคิ้ว', 'makeup', 'Makeup', 'Eyes', 1, 'makeup-eyebrow'),
  cosmeticPath('makeup-eyeliner-mascara', 'อายไลเนอร์และมาสคารา', 'makeup', 'Makeup', 'Eyes', 1.5, 'makeup-eyeliner-mascara'),
  cosmeticPath('makeup-eyeshadow', 'อายแชโดว์', 'makeup', 'Makeup', 'Eyes', 1.5, 'makeup-eyeshadow'),
  cosmeticPath('makeup-remover', 'ผลิตภัณฑ์ล้างเครื่องสำอาง', 'makeup', 'Makeup', 'Makeup Removers', 1),
  cosmeticPath('beauty-brushes-sponges', 'แปรงและฟองน้ำแต่งหน้า', 'beauty-tools', 'Beauty Tools', 'Makeup Accessories', 2, 'beauty-brushes-sponges'),
  cosmeticPath('beauty-makeup-organizers', 'กล่องและกระเป๋าอุปกรณ์แต่งหน้า', 'beauty-tools', 'Beauty Tools', 'Makeup Accessories', 1, 'beauty-makeup-organizers'),
  cosmeticPath('beauty-eyelash-curlers', 'ที่ดัดขนตา', 'beauty-tools', 'Beauty Tools', 'Makeup Accessories', 1, 'beauty-eyelash-curlers'),

  ...[
    ['pet-food-cat', 'อาหารแมว', 'Cat Food', 2],
    ['pet-food-dog', 'อาหารสุนัข', 'Dog Food', 2],
    ['pet-treat-cat', 'ขนมแมว', 'Cat Treats', 1.2],
    ['pet-treat-dog', 'ขนมสุนัข', 'Dog Treats', 1.2],
    ['pet-food-small', 'อาหารสัตว์เล็ก', 'Small Pet Food', 1],
    ['pet-treat-small', 'ขนมสัตว์เล็ก', 'Small Pet Treats', 0.7],
    ['pet-food-bird', 'อาหารนก', 'Bird Feed', 1],
    ['pet-food-aquarium', 'อาหารปลาและสัตว์น้ำ', 'Aquarium Pet Food', 1],
  ].map(([key, label, c3, weight]) => spec(key, label, 'pets', 'pet-food', weight, (c1, c2, source3) => c1 === 'Pets' && c2 === 'Pet Food' && source3 === c3, { riskTier: 'amber', summaryKind: 'pet-food', trustedShopOnly: true, expiryGate: true, deny: PET_FOOD_DENY })),
  spec('pet-grooming-tools', 'หวี แปรง และกรรไกรตัดเล็บสัตว์', 'pets', 'pet-hygiene', 1, (c1, c2, c3, title) => c1 === 'Pets' && /Grooming|Pet Accessories/iu.test(c2) && /หวี|แปรง|ที่ตัดเล็บ|comb|brush|nail\s*clipper/iu.test(title), { deny: /ไฟฟ้า|แบต|ชาร์จ|ยา|สเปรย์|น้ำยา|electric|battery|charger|medicine|spray|liquid/iu }),
  spec('pet-collars-leashes', 'ปลอกคอและสายจูงสัตว์', 'pets', 'pet-living', 1, (c1, c2, c3, title) => c1 === 'Pets' && c2 === 'Pet Accessories' && /ปลอกคอ|สายจูง|สายรัดอก|collar|leash|harness/iu.test(title), { deny: /ช็อตไฟฟ้า|ไฟฟ้า|shock|electric|battery|gps/iu }),

  spec('appliance-fans', 'พัดลมขนาดเล็ก', 'appliances', 'small-appliances', 2, isConsumerApplianceFanV5, { riskTier: 'amber', summaryKind: 'electrical', trustedShopOnly: true, deny: ELECTRICAL_DENY }),
  spec('appliance-air-treatment', 'เครื่องฟอกอากาศขนาดเล็ก', 'appliances', 'small-appliances', 1, (c1, c2, c3, title) => c1 === 'Home Appliances' && c2 === 'Small Household Appliances' && c3 === 'Air Treatment' && /ฟอกอากาศ|air\s*purifier/iu.test(title) && ELECTRICAL_EVIDENCE.test(title), { riskTier: 'amber', summaryKind: 'electrical', trustedShopOnly: true, deny: ELECTRICAL_DENY }),
  spec('appliance-vacuum', 'เครื่องดูดฝุ่นขนาดเล็ก', 'appliances', 'appliance-cleaning', 2, (c1, c2, c3, title) => c1 === 'Home Appliances' && c2 === 'Small Household Appliances' && c3 === 'Vacuum Cleaners & Floor Care Appliances' && /เครื่องดูดฝุ่น|vacuum/iu.test(title) && ELECTRICAL_EVIDENCE.test(title), { riskTier: 'amber', summaryKind: 'electrical', trustedShopOnly: true, deny: ELECTRICAL_DENY }),
  spec('appliance-sewing', 'จักรเย็บผ้าขนาดเล็ก', 'appliances', 'small-appliances', 1, (c1, c2, c3, title) => c1 === 'Home Appliances' && c2 === 'Small Household Appliances' && c3 === 'Sewing Machines & Accessories' && /จักรเย็บผ้า|sewing\s*machine/iu.test(title) && ELECTRICAL_EVIDENCE.test(title), { riskTier: 'amber', summaryKind: 'electrical', trustedShopOnly: true, deny: ELECTRICAL_DENY }),
  spec('appliance-sewing-accessories', 'อุปกรณ์เสริมจักรเย็บผ้า', 'appliances', 'appliance-accessories', 1, (c1, c2, c3, title) => c1 === 'Home Appliances' && c2 === 'Small Household Appliances' && c3 === 'Sewing Machines & Accessories' && /ตีนผี|กระสวย|แกนด้าย|presser\s*foot|bobbin|spool/iu.test(title), { deny: /มอเตอร์|ไฟฟ้า|วงจร|motor|electric|circuit/iu }),
  spec('appliance-coffee-accessories', 'อุปกรณ์เสริมเครื่องชงกาแฟ', 'appliances', 'appliance-accessories', 1, (c1, c2, c3, title) => c1 === 'Home Appliances' && c2 === 'Kitchen Appliances' && c3 === 'Coffee Machines & Accessories' && /ฟิลเตอร์|ด้ามชง|แทมเปอร์|แปรง|filter|portafilter|tamper|brush/iu.test(title), { deny: /เครื่องชง|ไฟฟ้า|ฮีตเตอร์|machine|electric|heater/iu }),
  spec('appliance-replacement-filters', 'แผ่นกรองเครื่องใช้ไฟฟ้า', 'appliances', 'appliance-accessories', 1, (c1, c2, c3, title) => c1 === 'Home Appliances' && isPassiveReplacementFilterTitleV5(title), { deny: /น้ำยา|สารเคมี|liquid|chemical/iu }),

  ...[
    ['baby-bodysuits', 'บอดี้สูททารก', 'Baby Clothes', 'Bodysuits & Jumpsuits', 'baby-clothing', 1.5],
    ['baby-sets', 'ชุดเซตทารก', 'Baby Clothes', 'Sets', 'baby-clothing', 1.2],
    ['girls-tops', 'เสื้อเด็กผู้หญิง', 'Girl Clothes', 'Tops', 'kids-clothing', 1],
    ['girls-bottoms', 'กางเกงและกระโปรงเด็กผู้หญิง', 'Girl Clothes', 'Bottoms', 'kids-clothing', 1],
    ['girls-dresses', 'เดรสเด็กผู้หญิง', 'Girl Clothes', 'Dresses', 'kids-clothing', 1],
    ['girls-sets', 'ชุดเซตเด็กผู้หญิง', 'Girl Clothes', 'Suits & Sets', 'kids-clothing', 1],
    ['boys-tops', 'เสื้อเด็กผู้ชาย', 'Boy Clothes', 'Tops', 'kids-clothing', 1],
    ['boys-bottoms', 'กางเกงเด็กผู้ชาย', 'Boy Clothes', 'Bottoms', 'kids-clothing', 1],
    ['boys-sets', 'ชุดเซตเด็กผู้ชาย', 'Boy Clothes', 'Suits & Sets', 'kids-clothing', 1],
  ].map(([key, label, c2, c3, categoryKey, weight]) => spec(key, label, 'baby', categoryKey, weight, (c1, source2, source3) => c1 === 'Baby & Kids Fashion' && source2 === c2 && source3 === c3, { deny: BABY_DENY })),
  spec('kids-educational-toys', 'ของเล่นเสริมการเรียนรู้', 'baby', 'kids-learning', 1.5, (c1, c2, c3) => c1 === 'Mom & Baby' && c2 === 'Toys' && c3 === 'Educational Toys', { riskTier: 'amber', summaryKind: 'baby', trustedShopOnly: true, deny: BABY_DENY }),
  spec('kids-block-toys', 'บล็อกตัวต่อสำหรับเด็ก', 'baby', 'kids-learning', 1, (c1, c2, c3) => c1 === 'Mom & Baby' && c2 === 'Toys' && c3 === 'Block Toys', { riskTier: 'amber', summaryKind: 'baby', trustedShopOnly: true, deny: BABY_DENY }),
  spec('kids-plush-toys', 'ตุ๊กตาผ้าและของเล่นนุ่ม', 'baby', 'kids-learning', 1, (c1, c2, c3) => c1 === 'Mom & Baby' && c2 === 'Toys' && c3 === 'Dolls & Stuffed Toys', { riskTier: 'amber', summaryKind: 'baby', trustedShopOnly: true, deny: BABY_DENY }),
  spec('kids-socks-hats', 'ถุงเท้าและหมวกเด็ก', 'baby', 'kids-accessories', 1, (c1, c2, c3) => c1 === 'Baby & Kids Fashion' && c2 === 'Baby & Kids Accessories' && /Socks|Hats & Caps/iu.test(c3), { deny: BABY_DENY }),

  spec('shop-carton-boxes', 'กล่องพัสดุ', 'shop-supplies', 'packaging', 2, (c1, c2, c3, title) => c1 === 'Stationery' && c2 === 'Gift & Wrapping' && c3 === 'Carton Boxes' && /กล่อง|carton|box/iu.test(title)),
  spec('shop-mailers', 'ซองพัสดุและซองกันกระแทก', 'shop-supplies', 'packaging', 1.5, (c1, c2, c3, title) => /ซองพัสดุ|ซองไปรษณีย์|ซองกันกระแทก|mailer|shipping\s*envelope|bubble\s*envelope/iu.test(title)),
  spec('shop-packing-tape', 'เทปแพ็กสินค้า', 'shop-supplies', 'packaging', 1, (c1, c2, c3, title) => c1 === 'Stationery' && /เทปแพ็ค|เทปแพ็ก|เทปปิดกล่อง|packing\s*tape|carton\s*sealing\s*tape/iu.test(title)),
  spec('shop-label-stickers', 'สติกเกอร์และฉลากสินค้า', 'shop-supplies', 'retail-labels', 1.5, (c1, c2, c3, title) => c1 === 'Stationery' && /สติกเกอร์ขอบคุณ|ฉลากสินค้า|ป้ายราคา|price\s*tag|product\s*label|thank\s*you\s*sticker/iu.test(title)),
  spec('shop-gift-bags', 'ถุงและกระดาษห่อสินค้า', 'shop-supplies', 'packaging', 1, (c1, c2, c3) => c1 === 'Stationery' && c2 === 'Gift & Wrapping' && /Gift Bags|Gift Wrappers/iu.test(c3)),
  spec('shop-display-racks', 'ชั้นและแท่นวางสินค้า', 'shop-supplies', 'product-display', 1, (c1, c2, c3, title) => /ชั้นวางสินค้า|แท่นวางสินค้า|ชั้นโชว์|display\s*(?:rack|stand|shelf)/iu.test(title), { deny: /ไฟฟ้า|หลอดไฟ|led|electric|light/iu }),
  spec('shop-photo-props', 'พื้นหลังและพร็อพถ่ายสินค้า', 'shop-supplies', 'product-display', 1, (c1, c2, c3, title) => /พร็อพถ่ายสินค้า|ฉากถ่ายสินค้า|พื้นหลังถ่ายสินค้า|product\s*photo\s*prop|photo\s*backdrop/iu.test(title), { deny: /ไฟ|หลอด|led|light/iu }),

  spec('mobile-pouches', 'ซองใส่มือถือ', 'tech', 'mobile-accessories', 1,
    (c1, c2, c3) => exact(c1, 'Mobile & Gadgets') && exact(c2, 'Accessories') && exact(c3, 'Mobile Pouches'),
    { deny: PASSIVE_MOBILE_ACCESSORY_DENY_V5 }),
  spec('tablet-cases', 'เคสแท็บเล็ตและไอแพด', 'tech', 'mobile-accessories', 1.5,
    (c1, c2, c3, title) => exact(c1, 'Mobile & Gadgets') && exact(c2, 'Accessories') && exact(c3, 'Cases, Covers, & Skins') && TABLET_CASE_IDENTITY_V5.test(title),
    { deny: PASSIVE_MOBILE_ACCESSORY_DENY_V5 }),
  spec('phone-rugged-cases', 'เคสมือถือกันกระแทก', 'tech', 'mobile-accessories', 1.5,
    (c1, c2, c3, title) => exact(c1, 'Mobile & Gadgets') && exact(c2, 'Accessories') && exact(c3, 'Cases, Covers, & Skins') && isRuggedPhoneCaseV5(title),
    { deny: PASSIVE_MOBILE_ACCESSORY_DENY_V5 }),
  spec('phone-grips-straps', 'ที่จับและสายคล้องมือถือ', 'tech', 'mobile-accessories', 1.5,
    (c1, c2, c3) => exact(c1, 'Mobile & Gadgets') && exact(c2, 'Accessories') && oneOf(c3, ['Phone Straps & Keychains', 'Phone Grips']),
    { deny: PASSIVE_MOBILE_ACCESSORY_DENY_V5 }),
  spec('phone-screen-protectors', 'ฟิล์มและกระจกกันรอยมือถือ', 'tech', 'mobile-accessories', 2, (c1, c2, c3, title) => c1 === 'Mobile & Gadgets' && c2 === 'Accessories' && /ฟิล์ม|กระจกกันรอย|screen\s*protector|tempered\s*glass/iu.test(title), { deny: /น้ำยา|กาวเหลว|liquid|glue/iu }),
  spec('phone-stands-passive', 'ขาตั้งมือถือแบบไม่ใช้ไฟ', 'tech', 'mobile-accessories', 1.5, (c1, c2, c3, title) => c1 === 'Mobile & Gadgets' && c2 === 'Accessories' && /ขาตั้ง|ที่วาง|stand|holder/iu.test(title), { deny: /ชาร์จ|แม่เหล็กไฟฟ้า|แบต|ไฟ|charger|charging|battery|electric|light/iu }),
  spec('laptop-sleeves', 'ซองและเคสโน้ตบุ๊ก', 'tech', 'computer-accessories', 1.5, (c1, c2, c3, title) => c1 === 'Computers & Accessories' && /ซองโน้ตบุ๊ก|กระเป๋าโน้ตบุ๊ก|เคสโน้ตบุ๊ก|laptop\s*(?:sleeve|case|pouch)/iu.test(title), { deny: /ชาร์จ|แบต|ไฟ|charger|battery|electric/iu }),
  spec('cable-organizers', 'คลิปและกล่องจัดสาย', 'tech', 'cable-organizing', 1, (c1, c2, c3, title) => /คลิปจัดสาย|กล่องเก็บสาย|ที่รัดสาย|cable\s*(?:clip|organizer|holder|tie)/iu.test(title), { deny: /สายชาร์จ|สายไฟ|cable\s*(?:charger|usb)|power/iu }),

  spec('small-furniture-racks', 'ชั้นและโต๊ะขนาดเล็ก', 'home', 'furniture', 1, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Furniture' && /ชั้น|โต๊ะข้าง|สตูล|rack|side\s*table|stool/iu.test(title), { deny: /ไฟฟ้า|มอเตอร์|electric|motor/iu }),
  spec('bedding-blankets', 'ผ้าห่มและเครื่องนอน', 'home', 'home-textiles', 1, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Bedding' && /ผ้าห่ม|ผ้าปู|ปลอกหมอน|blanket|bedsheet|pillowcase/iu.test(title), { deny: /ไฟฟ้า|รักษา|บำบัด|electric|therapy|medical/iu }),
  spec('home-curtains', 'ม่านและอุปกรณ์ม่าน', 'home', 'home-decor', 1, (c1, c2, c3, title) => c1 === 'Home & Living' && /ม่าน|curtain/iu.test(title), { deny: /มอเตอร์|ไฟฟ้า|motor|electric/iu }),

  spec('sports-yoga-mats', 'เสื่อโยคะและออกกำลังกาย', 'outdoor', 'sports', 1, (c1, c2, c3, title) => c1 === 'Sports & Outdoors' && /เสื่อโยคะ|เสื่อออกกำลัง|yoga\s*mat|exercise\s*mat/iu.test(title)),
  spec('sports-resistance-bands', 'ยางยืดออกกำลังกาย', 'outdoor', 'sports', 1, (c1, c2, c3, title) => c1 === 'Sports & Outdoors' && /ยางยืด|resistance\s*band|exercise\s*band/iu.test(title), { deny: /กายภาพ|รักษา|บำบัด|therapy|medical|rehab/iu }),
  spec('sports-balls', 'ลูกบอลกีฬา', 'outdoor', 'sports', 1, (c1, c2, c3, title) => c1 === 'Sports & Outdoors' && /ลูกฟุตบอล|ลูกบาส|ลูกวอลเลย์|soccer\s*ball|basketball|volleyball/iu.test(title)),

  spec('tool-measuring', 'อุปกรณ์วัดระยะแบบไม่ใช้ไฟ', 'tools', 'tools-manual', 1, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Tools & Home Improvement' && /ตลับเมตร|สายวัด|ฉากวัด|ระดับน้ำ|ระดับน้ํา|measuring\s*tape|ruler|spirit\s*level/iu.test(title), { deny: /เลเซอร์|ดิจิทัล|ไฟฟ้า|แบต|laser|digital|electric|battery/iu }),
  spec('tool-storage', 'กล่องและกระเป๋าเครื่องมือ', 'tools', 'tools-storage', 1, (c1, c2, c3, title) => c1 === 'Home & Living' && c2 === 'Tools & Home Improvement' && /กล่องเครื่องมือ|กระเป๋าเครื่องมือ|tool\s*(?:box|bag|organizer)/iu.test(title), { deny: /พร้อมเครื่องมือไฟฟ้า|power\s*tool\s*set/iu }),

  spec('creative-stickers-scrapbook', 'สติกเกอร์และอุปกรณ์สแครปบุ๊ก', 'learning', 'creative', 1, (c1, c2, c3, title) => c1 === 'Stationery' && /สติกเกอร์ตกแต่ง|สแครปบุ๊ก|decorative\s*sticker|scrapbook/iu.test(title)),
]);

export function classifyNewRuleV5(c1, c2, c3, title) {
  return NEW_RULE_SPECS_V5.find((category) => category.matcher(c1, c2, c3, title)) ?? null;
}

const policyFixture = (name, c1, c2, c3, title, expectedKey, denied = false) => Object.freeze({
  name, c1, c2, c3, title, expectedKey, denied,
});

const applianceFanFixture = (id, c2, c3, title) => Object.freeze({
  id, c1: 'Home Appliances', c2, c3, title,
});

export const APPLIANCE_FAN_V5_GOLDEN_FIXTURES = Object.freeze({
  rejected: Object.freeze([
    applianceFanFixture('165079909-49259871418', 'Large Household Appliances', 'Cooling', 'โคมไฟพัดลม LED แสงขาว 160W พร้อมรีโมทควบคุม โคมไฟเพดาน พัดลมเพดาน พัดลม โคมไฟ รุ่น TSM-F160'),
    applianceFanFixture('202550289-45605686762', 'Electrical Circuitry & Parts', 'Lightning Protection', 'สายไฟ VKF ไทยยูเนี่ยน สีดำ สีเทา สายแบน สายพัดลม ทองแดงเต็ม มาตรฐาน มอก. 2x0.5 2x0.75 2x1 Sq.mm 10 เมตร'),
    applianceFanFixture('791596514-20712940448', 'Large Household Appliances', 'Others', 'ELCO ขนาด10W 16W[เเท้] มอเตอร์พัดลมตู้แช่ 230V.'),
    applianceFanFixture('808938342-14290226484', 'Others', '', 'สวิตซ์ พร้อมฝากันน้ำ KCD4  สวิตซ์เรือ กันน้ำ สวิตช์พัดลมไฟฟ้า สี่ขา 4ขา สีแดง สีเขียว สีดำ 220v ตัวและขา ครบชุด'),
    applianceFanFixture('63031411-3188197770', 'Kitchen Appliances', 'Freezers', 'มอเตอร์พัดลมตู้แช่ KULTHORN (กุลธร) 9W (ขาด้านข้าง) (ออกใบกำกับภาษีได้)'),
    applianceFanFixture('1094153868-44207011061', 'Electrical Circuitry & Parts', 'Electric Sockets & Extension Cords', 'NPV สวิทช์พัดลมรุ่นหมุน สวิทซ์พัดลมเพดาน3จังหวะ ปรับความเร็วได้ 3 ระดับ ใช้ได้กับทุกรุ่น ทุกยี่ห้อ มีมอก.*เปลี่ยนแพคเกจ*'),
    applianceFanFixture('48503976-14185851424', 'Kitchen Appliances', 'Freezers', 'ชุดมอเตอร์พัดลมตู้เย็น ชุดมอเตอร์พัดลมตู้แช่ ครบชุดพร้อมติดตั้ง มอเตอร์ตู้เย็น มอเตอร์ตู้แช่เค็ก มอเตอร์10W พัดลมดูด'),
    applianceFanFixture('182095584-6645090551', 'Large Household Appliances', 'Cooling', 'มอเตอร์พัดลมตู้แช่ 90W/34W รุ่น N34-30 220/230V 0.58A 1300/1550PRM อะไหล่ตู้เย็น ตู้แช่'),
    applianceFanFixture('546172073-24796188807', 'Large Household Appliances', 'Cooling', '【รับประกัน 30 ปี】โคมไฟพัดลมเพดาน 26cm 30Wพัดลมติดเพดาน พร้อมหลอดไฟ หลอดไฟในบ้าน ห้อง 3ใน1 มัลติฟังก์ชั่น พัดลม'),
    applianceFanFixture('165813870-22557638839', 'Large Household Appliances', 'Cooling', 'พัดลม2นิ้ว​ รุ่น MF50F-12LA​ ​ขนาด​ 50mm​​ 12VDC​ 20mA ยี่ห้อ​ NIPPON แท้100% 3สาย​​ ​(ต่อแบบแดง+ ดำ-อีกเส้นไม่ต้องต่อ)'),
    applianceFanFixture('182095584-4515523633', 'Large Household Appliances', 'Cooling', 'มอเตอร์พัดลมตู้แช่ 75W รุ่น N25-30 220-230V 0.45A 1300/1550RPM (ทองแดง) อะไหล่ตู้เย็น'),
    applianceFanFixture('1292111636-44300319487', 'Kitchen Appliances', 'Freezers', 'มอเตอร์พัดลมตู้แช่ 35W/25W AC 220V 1300/1550 RPM รุ่น N10-20 (สามารถใช้ได้กับตู้แช่ทั่วไป) อะไหล่ตู้เย็น'),
    applianceFanFixture('122075674-10512632235', 'Large Household Appliances', 'Cooling', 'Power Shopping มอเตอร์ส่ายพัดลม 16,18นิ้ว 5และ12รอบ/นาที  4W 220VAC ใส่มอเตอร์พัดลม ฮาตาริ ได้'),
    applianceFanFixture('457068306-17904080344', 'Small Household Appliances', 'Others', 'อะแดปเตอร์ 12V 2A สำหรับต่อพัดลม DC เข้าไฟบ้าน เฉพาะอะแดปเตอร์ ไม่มีพัดลม อุปกรณ์แหล่งจ่ายไฟ อแดปเตอร์ชาร์จ'),
    applianceFanFixture('1077392696-41950032750', 'Large Household Appliances', 'Cooling', 'RS755 12V/24V DC พัดลมมอเตอร์เปลี่ยน 220V AC สำหรับพัดลมไฟฟ้าพัดลมเสียงรบกวนต่ำเริ่มต้นตัวเก็บประจุ'),
    applianceFanFixture('1077392696-27486352208', 'Large Household Appliances', 'Cooling', 'MOIQIQI DC 12V RS755 มอเตอร์พัดลม 4.5V - 35V พัดลมไฟฟ้า ปรับ 12000 มอเตอร์สำหรับเครื่องใช้ไฟฟ้าเครื่องมือ'),
    applianceFanFixture('387385391-9576571957', 'Small Household Appliances', 'Air Treatment', '900286 ปั๊มดูดน้ำแอร์เคลื่อนที่ ปั๊มไฟ 220 โวลท์ AC 3W  ปั๊มดูดน้ำพัดลมไอเย็น'),
    applianceFanFixture('57000479-12666200353', 'Large Household Appliances', 'Cooling', 'พัดลมอุโมงค์ พัดลมดูดเป่า Hero ขนาด 20 นิ้ว 750W ท่อลมระบายอากาศ ท่อส่งลม เครื่องเป่าลม สายลมอุโมงค์ 20 นิ้ว'),
  ]),
  allowed: Object.freeze([
    applianceFanFixture('1764623742-52507162168', 'Large Household Appliances', 'Cooling', 'Windio พัดลมตั้งโต๊ะ 12 นิ้ว รุ่น WD-T12E1 รับประกัน 1 ปี มี มอก.'),
    applianceFanFixture('1764623742-51107165857', 'Large Household Appliances', 'Cooling', 'Windio พัดลมตั้งโต๊ะ 16 นิ้ว รุ่น WD-T16E1 รับประกัน 1 ปี มี มอก.'),
    applianceFanFixture('1764623742-54107157375', 'Large Household Appliances', 'Cooling', 'Windio พัดลมตั้งโต๊ะ 16 นิ้ว รุ่น WD-T16E1 รับประกัน 1 ปี มี มอก. รองรับ'),
    applianceFanFixture('34672890-54856430318', 'Large Household Appliances', 'Cooling', 'Anitech พัดลมตั้งพื้น 10 นิ้ว รุ่น SF400 กำลังไฟ 40W ปรับแรงลมได้ 3 ระดับ  ดีไซน์สวย กะทัดรัด ประหยัดพื้นที่'),
    applianceFanFixture('1272413833-29184902605', 'Large Household Appliances', 'Cooling', '9 นิ้ว พัดลมเต่าทอง พัดลมตั้งโต๊ะ พัดลมไฟฟ้า เสียบปลั๊ก พกพา โต๊ะ ไฟฟ้า เงียบ ลมแรง ปรับ แกว่ง'),
    applianceFanFixture('49970008-46604420578', 'Large Household Appliances', 'Cooling', 'ROWEL พัดลมไร้สาย รุ่น ADFA750 RXseries ล่าสุด2026 ไฟ Led พร้อมช่อง USB Type A/C เสียบไฟบ้านได้ ตั้งเวลาได้ ประกัน 2 ปี'),
    applianceFanFixture('16464711-25120384144', 'Large Household Appliances', 'Cooling', 'พัดลมตั้งโต๊ะ ใบใส ขนาด 16 นิ้ว Otto รุ่น FT-516 / Imarflex รุ่น IF-966 มี มอก.934-2558'),
    applianceFanFixture('771462547-45812673168', 'Large Household Appliances', 'Cooling', 'F22B พัดลมตั้งโต๊ะ ไร้สาย 10000mAh ปรับลมได้ 5 ระดับ ลมแรงเงียบ จอ LED แสดงแบตเตอรี่ ชาร์จ USB-C'),
    applianceFanFixture('175056502-24935894390', 'Small Household Appliances', 'Others', 'AIKO KN-L2834 สีนู้ด พัดลมชาร์จไฟ ใบพัด 4 นิ้ว ชาร์จด้วย USB พัดลมพกพา พัดลมใช้แบตเตอรี่ HANDY FAN'),
    applianceFanFixture('175056502-4787698750', 'Small Household Appliances', 'Others', 'AIKO KN-2825 สีชมพู พัดลมชาร์จไฟ ใบพัด 5 นิ้ว ชาร์จด้วย USB พัดลมพกพา พัดลมโคมไฟในตัว ไฟฉายในตัว'),
    applianceFanFixture('7926325-8504012312', 'Large Household Appliances', 'Cooling', 'พัดลมเป่าควัน ดูดควัน พัดลม 12 โวลต์ ขนาด 14 นิ้ว 10 ใบพัด 12V ระบายอากาศ พัดลมต่อแบตเตอรี่  พัดลมทั่วไป [052016]'),
    applianceFanFixture('1009059476-46456177778', 'Large Household Appliances', 'Cooling', 'New TELEFUNKEN  พัดลมสไลด์ TK-1669 16นิ้ว / TK-1449 14นิ้ว  | รีโมทคอนโทรล | ปุ่มใหญ่ | ปลอดภัยสำหรับเด็ก | มี มอก.'),
    applianceFanFixture('135677119-53752036802', 'Large Household Appliances', 'Cooling', 'OSUKA พัดลมไร้สาย 9 นิ้ว ใช้ได้นานถึง 12 ชั่วโมง ชาร์จแบต TYPE C, A ได้ ประกัน 1 ปี OCF762, OCF763'),
  ]),
  nearMiss: Object.freeze([
    applianceFanFixture('near-miss-motor', 'Large Household Appliances', 'Cooling', 'พัดลมตั้งโต๊ะ 16 นิ้ว มอเตอร์ทองแดง 50W'),
    applianceFanFixture('near-miss-adapter', 'Small Household Appliances', 'Others', 'พัดลมพกพา USB 5V พร้อมอะแดปเตอร์สำหรับใช้ในบ้าน'),
    applianceFanFixture('near-miss-switch', 'Large Household Appliances', 'Cooling', 'พัดลมตั้งพื้น 45W พร้อมสวิตช์ปรับแรงลม 3 ระดับ'),
  ]),
});

const religiousGoldenFixture = (id, title, expectedKey = '') => Object.freeze({
  id, c1: 'Home & Living', c2: 'Fengshui & Religious Supplies', c3: '', title, expectedKey,
});

export const RELIGIOUS_DENY_V5_GOLDEN_FIXTURES = Object.freeze({
  denied: Object.freeze([
    religiousGoldenFixture('59295317-22765066064', 'ชุดตั้งหิ้งพระ โต๊ะหมู่บูชา ศาลพระภูมิ ชุดสุขใจ 10 เสริมสิริมงคล (ฉัตรไหมเงินทอง 9 ชั้น+โพธิ์กะไหล่เงินทองเบอร์ 7)', 'religious-altar-supplies'),
    religiousGoldenFixture('82721835-22483414059', 'องค์พระพิฆเนศ ปางประทานพร สมหวัง รุ่งเรือง พระพิฆเนศวร์ปางเศรษฐี ปางร่ำรวย เทพแห่งความสำเร็จ', 'religious-statues-decor'),
    religiousGoldenFixture('237250578-18307156183', 'FASTTECT หิ้งพระติดผนัง มินิมอล 2 ชิ้น ชุดเจริญรุ่งเรือง - หิ้งพระดีไซน์จัดเต็ม เพิ่มพื้นที่ศรัทธาบนผนังบ้านคุณ', 'religious-altar-supplies'),
    religiousGoldenFixture('243251067-21457199587', 'พระพรหมเนื้อทองเหลืองแท้รูปหล่อ ประทานพร นำโชค ราคาส่ง', 'religious-statues-decor'),
  ]),
  allowed: Object.freeze([
    religiousGoldenFixture('1038516350-25115447881', 'พวงมาลัย 7 สี พวงมาลัยแก้บน พวงมาลัยพลาสติก พวงมาลัยริบบิ้น พวงมาลัยจิ๋ว พวงมาลัยดาวเรือง พวงมาลัยแดง [พวงมาลัยทุกแบบ]'),
    religiousGoldenFixture('888375472-24939210275', 'พานดอกบัวโมเดิร์น 🌷 บูชาพระพุทธรูปและสิ่งศักดิ์สิทธิ์ ดอกบัวขาว-ชมพู PT01'),
    religiousGoldenFixture('10965642-24055702856', 'พวงมาลัยดินปั้นจิ๋วมะลิ/กลีบกุหลาบแดงขนาด 1 นิ้ว ใช้บูชาพระ หรือประดับตกแต่ง บูชาสิ่งศักดิ์สิทธิ์'),
    religiousGoldenFixture('795554504-22760367322', 'ยกลัง100ตลับพระพุทธเมตตาพระมหาเจดีย์พุทธคยาประเทศอินเดีย100องค์บรรจุในกล่องกำมะหยี่สีแดงสวยงามพระพุทธเมตตา100ตลับราคาส่ง'),
    religiousGoldenFixture('near-miss-ceremony', 'พระพุทธรูปสำหรับงานมงคล'),
    religiousGoldenFixture('near-miss-blessing-pose', 'องค์พระปางประทานพร'),
    religiousGoldenFixture('near-miss-gold-leaf', 'โพธิ์เงินทองสำหรับตั้งโต๊ะหมู่บูชา'),
  ]),
});

export const TAXONOMY_V5_POLICY_GOLDEN_FIXTURES = Object.freeze([
  policyFixture('exact mobile pouches path', 'Mobile & Gadgets', 'Accessories', 'Mobile Pouches', 'ซองอุปกรณ์มือถือรุ่น A', 'mobile-pouches'),
  policyFixture('powered mobile pouch remains denied', 'Mobile & Gadgets', 'Accessories', 'Mobile Pouches', 'Mobile pouch power bank battery', 'mobile-pouches', true),
  policyFixture('iPad case identity', 'Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', 'เคส iPad Air 11 นิ้ว', 'tablet-cases'),
  policyFixture('Galaxy Tab case identity', 'Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', 'Case for Galaxy Tab S10', 'tablet-cases'),
  policyFixture('powered tablet case remains denied', 'Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', 'iPad case with power bank battery', 'tablet-cases', true),
  ...TABLET_CASE_IDENTITY_V5_GOLDEN_FIXTURES.positive.map(({ name, title }) =>
    policyFixture(name, 'Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', title, 'tablet-cases')),
  policyFixture('rugged handset case identity', 'Mobile & Gadgets', 'Accessories', 'Cases, Covers, & Skins', 'เคสโทรศัพท์กันกระแทกสำหรับ Samsung S26 Ultra', 'phone-rugged-cases'),
  policyFixture('exact phone straps and keychains path', 'Mobile & Gadgets', 'Accessories', 'Phone Straps & Keychains', 'อุปกรณ์มือถือรุ่น A', 'phone-grips-straps'),
  policyFixture('exact phone grips path', 'Mobile & Gadgets', 'Accessories', 'Phone Grips', 'อุปกรณ์มือถือรุ่น B', 'phone-grips-straps'),
  policyFixture('powered phone grip remains denied', 'Mobile & Gadgets', 'Accessories', 'Phone Grips', 'Phone grip power bank battery', 'phone-grips-straps', true),
  policyFixture('foundation title family', 'Beauty', 'Makeup', 'Face', 'รองพื้นเนื้อลิควิด 30 ml', 'makeup-foundation'),
  policyFixture('cushion title family', 'Beauty', 'Makeup', 'Face', 'คุชชั่นเมคอัพเฉด 02', 'makeup-foundation'),
  policyFixture('primary BB cream outranks bundled concealer', 'Beauty', 'Makeup', 'Face', 'Baby Bright Matte BB Cream 30g มาพร้อมคอนซีลเลอร์', 'makeup-foundation'),
  policyFixture('primary concealer outranks bundled BB cream', 'Beauty', 'Makeup', 'Face', 'คอนซีลเลอร์ปกปิด 5g ใช้คู่กับ BB Cream', 'makeup-concealer'),
  policyFixture('powder title family', 'Beauty', 'Makeup', 'Face', 'แป้งฝุ่นแต่งหน้า 10 กรัม', 'makeup-powder'),
  policyFixture('concealer title family', 'Beauty', 'Makeup', 'Face', 'คอนซีลเลอร์ปกปิดเฉด 01', 'makeup-concealer'),
  policyFixture('blush title family', 'Beauty', 'Makeup', 'Face', 'บลัชปัดแก้มสีพีช', 'makeup-blush-highlight'),
  policyFixture('highlight title family', 'Beauty', 'Makeup', 'Face', 'ไฮไลท์แต่งหน้าแบบแท่ง', 'makeup-blush-highlight'),
  policyFixture('eyebrow title family', 'Beauty', 'Makeup', 'Eyes', 'ดินสอเขียนคิ้วสีน้ำตาล', 'makeup-eyebrow'),
  policyFixture('eyeliner title family', 'Beauty', 'Makeup', 'Eyes', 'อายไลเนอร์ชนิดปากกา', 'makeup-eyeliner-mascara'),
  policyFixture('mascara title family', 'Beauty', 'Makeup', 'Eyes', 'มาสคาร่าสีดำ 7 ml', 'makeup-eyeliner-mascara'),
  policyFixture('eyeshadow title family', 'Beauty', 'Makeup', 'Eyes', 'อายแชโดว์พาเลตตา 9 สี', 'makeup-eyeshadow'),
  policyFixture('makeup brush title family', 'Beauty', 'Beauty Tools', 'Makeup Accessories', 'แปรงแต่งหน้า 8 ชิ้น', 'beauty-brushes-sponges'),
  policyFixture('makeup sponge title family', 'Beauty', 'Beauty Tools', 'Makeup Accessories', 'ฟองน้ำแต่งหน้าทรงหยดน้ำ', 'beauty-brushes-sponges'),
  policyFixture('makeup organizer title family', 'Beauty', 'Beauty Tools', 'Makeup Accessories', 'กล่องเก็บเครื่องสำอางแบบลิ้นชัก', 'beauty-makeup-organizers'),
  policyFixture('makeup bag title family', 'Beauty', 'Beauty Tools', 'Makeup Accessories', 'กระเป๋าเครื่องสําอางสำหรับเดินทาง', 'beauty-makeup-organizers'),
  policyFixture('makeup organizer outranks incidental brushes', 'Beauty', 'Beauty Tools', 'Makeup Accessories', '[เมย์บิวตี้] 1ชิ้นแบบพกพาใสแปรงแต่งหน้ากล่องเก็บที่มีฝาปิดดินสอเขียนคิ้วแปรงแต่งหน้าออแกไนเซอร์กรณีตะเกียบเครื่องมือความงาม {ไทย}', 'beauty-makeup-organizers'),
  policyFixture('eyelash curler title family', 'Beauty', 'Beauty Tools', 'Makeup Accessories', 'ที่ดัดขนตาด้ามจับถนัดมือ', 'beauty-eyelash-curlers'),
  policyFixture('passive replacement air filter', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'แผ่นกรองอากาศ SHARP FZ-F30HFE สำหรับเครื่องฟอกอากาศ SHARP รุ่น FP-F30TA', 'appliance-replacement-filters'),
  policyFixture('passive purifier filter cotton', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', '15 ชิ้นหนาผ้าฝ้ายไฟฟ้าสถิตสําหรับ Xiaomi Mi เครื่องฟอกอากาศ Pro / 1 / 2 Universal เครื่องฟอกอากาศกรอง Hepa Filter', 'appliance-replacement-filters'),
  policyFixture('passive washing-machine lint filter', 'Home Appliances', 'Large Household Appliances', 'Washing Machines & Dryers', 'ถุงกรองเศษผ้า เครื่องซักผ้า LG รุ่น2ถัง ถุงกรองรุ่นยาว แผ่นกรอง ผ้ากรอง', 'appliance-replacement-filters'),
  policyFixture('passive nail-dust filter sheets', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', '(ราคาต่อ10แผ่น)เครื่องดูดฝุ่นเล็บ แผ่นกระดาษกรองฝุ่น แบบเปลี่ยน เพื่อแผ่นกรองยืดอายุการใช้งาน', 'appliance-replacement-filters'),
  policyFixture('passive Acerpure replacement filter', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'ไส้กรอง HEPA Replacement Filter สำหรับ Acerpure COOL C3', 'appliance-replacement-filters'),
  policyFixture('replaceable faucet filter cartridge', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ไส้กรองน้ำก๊อก ไส้กรองไมครอน เปลี่ยนได้ สำหรับน้ำประปา', 'appliance-replacement-filters'),
  policyFixture('filter allow car vacuum 1407420901-26218849748', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'เครื่องดูดฝุ่นในรถยนต์ไส้กรอง Haipa สำหรับเปลี่ยนไส้กรองทั่วไปชุดอุปกรณ์เสริมเครื่องกำจัดไรแบบล้างทำความสะอาดได้ตัวกรอง50มม.', 'appliance-replacement-filters'),
  policyFixture('filter allow soy milk machine cloth 1414457952-27222957782', 'Home Appliances', 'Kitchen Appliances', 'Juicers, Blenders & Soya Bean Machines', 'ผ้ากรองเครื่องคั้นน้ำเต้าหู้ สำหรับ รุ่น ET-05 ,06 , SY-SJ-MJ-100 A-B', 'appliance-replacement-filters'),
  policyFixture('filter allow car air purifier 142005929-7949619054', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'Gmax ไส้กรอง เครื่องฟอกอากาศในรถยนต์ รุ่น AP-001-A01', 'appliance-replacement-filters'),
  policyFixture('seedling tray is passive agriculture', 'Home & Living', 'Gardening', 'Pots & Planters', 'seedling tray 50 cells reusable', 'agri-seedling-trays'),
  policyFixture('singular seed is denied', 'Home & Living', 'Gardening', 'Pots & Planters', 'seedling tray with vegetable seed', 'agri-seedling-trays', true),
  policyFixture('plural seeds are denied', 'Home & Living', 'Gardening', 'Pots & Planters', 'seedling tray with flower seeds', 'agri-seedling-trays', true),
  policyFixture('neutral actual amulet is admitted', 'Home & Living', 'Fengshui & Religious Supplies', 'Buddhist Supplies', 'พระเครื่องเหรียญพระสำหรับสะสม', 'religious-amulets'),
  policyFixture('amulet authenticity claim is denied', 'Home & Living', 'Fengshui & Religious Supplies', 'Buddhist Supplies', 'พระเครื่องรับประกันแท้ 100%', 'religious-amulets', true),
  policyFixture('amulet supernatural claim is denied', 'Home & Living', 'Fengshui & Religious Supplies', 'Buddhist Supplies', 'พระเครื่องคงกระพัน', 'religious-amulets', true),
  policyFixture('amulet luck claim is denied', 'Home & Living', 'Fengshui & Religious Supplies', 'Buddhist Supplies', 'พระเครื่องเสริมดวงโชคลาภ', 'religious-amulets', true),
  policyFixture('amulet lottery claim is denied', 'Home & Living', 'Fengshui & Religious Supplies', 'Buddhist Supplies', 'พระเครื่องช่วยเรื่องหวย lottery', 'religious-amulets', true),
]);

const rejectionFixture = (name, c1, c2, c3, title, excludedKey) => Object.freeze({
  name, c1, c2, c3, title, excludedKey,
});

export const TAXONOMY_V5_REJECTION_GOLDEN_FIXTURES = Object.freeze([
  rejectionFixture('tea brewing filter bag 66426364-2040000521', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ถุงกรองชา สำหรับชงขาย หรือหัดชงที่บ้านทานเอง สนใจทักได้จ้า', 'appliance-replacement-filters'),
  rejectionFixture('filter8 agricultural Y-disc 226046056-23359530328', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'กรองน้ำเกษตร รูปทรงตัว Y ไส้กรองแผนดิสก์ ขนาด 3/4" และ 1" Y Disc filter ระบบน้ำ กรองเกษตร', 'appliance-replacement-filters'),
  rejectionFixture('filter8 agricultural screen-disc 365114116-23768131831', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'Super Product ไส้กรองน้ำเกษตร แบบตะแกรงและแบบดิสก์ มี 3ขนาด 3/4นิ้ว 1.1/2นิ้ว 2นิ้ว ระบบน้ำ ไส้กรองน้ำ ระบบกรองน้ำ', 'appliance-replacement-filters'),
  rejectionFixture('filter8 compressor intake 60800676-29617247102', 'Home Appliances', 'Large Household Appliances', 'Others', 'กรองอากาศปั้มลม puma, กรองอากาศและไส้กรอง สำหรับปั้มลมทั่วไป #N-01', 'appliance-replacement-filters'),
  rejectionFixture('filter8 mixed UV kit 439033153-22283289024', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ชุดไส้กรองคาร์บอนกัมมันต์และหลอดอุลตร้าไวโอเล็ท มีกรองหยาบในตัว', 'appliance-replacement-filters'),
  rejectionFixture('filter8 eSpring mixed UV kit 1182526243-22063853400', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ไส้กรองน้ำแอมเวย์ อีสปริงรุ่นเดิม (ของแท้💯 ช้อปไทย)  espring ชุดไส้กรองคาร์บอนกัมมันต์และหลอดอุลตร้าไวโอเล็ท', 'appliance-replacement-filters'),
  rejectionFixture('filter8 eSpring mixed UV kit 2187718-5455702950', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', '🌈🇹🇭 eSpring ชุดไส้กรองคาร์บอนกัมมันต์และหลอดอุลตร้าไวโอเล็ทและชุดไส้กรองคาร์บอน e3 ของแท้จากชอปไทยค่ะ', 'appliance-replacement-filters'),
  rejectionFixture('filter8 portable Vecto bag 60776298-14651763545', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ถุงกรองน้ำ VECTO WATER CONTAINER, 28MM', 'appliance-replacement-filters'),
  rejectionFixture('filter8 outdoor 500ml bag 129722567-15784323539', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ถุงกรองน้ํา 500 มล. สําหรับกีฬา ตั้งแคมป์ เดินป่า ขี่จักรยาน', 'appliance-replacement-filters'),
  rejectionFixture('powered DIY purifier with adapter', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'เครื่องฟอกอากาศ DIY ใช้แทนเครื่องฟอกอากาศMI พร้อมอแดปเตอร์ ปรับความเร็วลมได้ ไส้กรองอากาศ ไส้กรอง', 'appliance-replacement-filters'),
  rejectionFixture('powered DIY purifier with fan', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'เครื่องกรองอากาศ PM2.5 DIY พัดลมความเร็วสูง ปรับรอบได้AIR Purifier ใช้กับไส้กรอง Xiaomi สําหรับรุ่น 2C', 'appliance-replacement-filters'),
  rejectionFixture('full Carrier air conditioner', 'Home Appliances', 'Large Household Appliances', 'Air Conditioners', 'CARRIER เครื่องปรับอากาศ TECH V ขนาด 12,000 BTU รุ่น NVAA013 ระบบ INVERTER คอยล์ทองแดง รุ่น NVAA', 'appliance-replacement-filters'),
  rejectionFixture('full Central Air conditioner with incidental filter', 'Home Appliances', 'Large Household Appliances', 'Air Conditioners', 'Central Air แอร์ติดผนัง ขนาด 18,400 BTU รุ่น IVM18 ท่อทองแดง ระบบ INVERTER DC มีแผ่นกรองฝุ่น PM2.5', 'appliance-replacement-filters'),
  rejectionFixture('hood and stove bundle with free filter', 'Home Appliances', 'Kitchen Appliances', 'Hoods', '(Eve) เครื่องดูดควันสีดำแบบฝังรางเลื่อน + เตาไฟฟ้าเซรามิค 2 หัว ฟรี แผ่นกรองคาร์บอน', 'appliance-replacement-filters'),
  rejectionFixture('complete powered RO water purifier', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'STIEBEL ELTRON เครื่องกรองน้ำดื่ม รุ่น SNOW ระบบ RO กรองได้ 5 ขั้นตอน พร้อมไฟ LED แจ้งเตือนเปลี่ยนไส้กรอง', 'appliance-replacement-filters'),
  rejectionFixture('complete UF water purifier', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'เครื่องกรองน้ำระบบ UF Membrane 1500 ถึง 10000 ลิตร ต่อ ชม. ไม่ใช้ไฟฟ้า สะดวกต่อการเปลี่ยนไส้กรอง', 'appliance-replacement-filters'),
  rejectionFixture('complete car air purifier', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'Commy เครื่องฟอกอากาศในรถขนาดใหญ่ Car Air Purifier ไส้กรอง HEPA รุ่น AP006', 'appliance-replacement-filters'),
  rejectionFixture('filter-free car air purifier', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'Newactive เครื่องฟอกอากาศในรถยนต์ ไม่ใช้ไฟฟ้า ใช้ได้ 2ปี ไม่ใช้ไส้กรอง', 'appliance-replacement-filters'),
  rejectionFixture('mixed Xiaomi vacuum accessories', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'Xiaomi Robot Vacuum X10 อุปกรณ์เสริม แปรงหลัก แปรงด้านข้าง แผ่นกรอง Hepa ผ้าม็อบ ถุงเก็บฝุ่น', 'appliance-replacement-filters'),
  rejectionFixture('mixed Roborock vacuum accessories', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'Roborock S5 S6 อุปกรณ์เสริม แปรงด้านข้าง แปรงหลัก แผ่นกรอง Hepa ผ้าขี้ริ้ว ไม้ถูพื้น ฝาครอบแปรงหลัก ล้อ', 'appliance-replacement-filters'),
  rejectionFixture('mixed Roborock roller accessories', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'Roborock QR 798 Qrevo S Pro เครื่องดูดฝุ่นหุ่นยนต์อุปกรณ์เสริมลูกกลิ้งหลักแปรงด้านข้าง HEPA Filter Mop', 'appliance-replacement-filters'),
  rejectionFixture('mixed vacuum side brush filter mop kit', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'สำหรับ Xiaomi Robot Vacuum E5 อะไหล่แปรงด้านข้าง Hepa Filter Mop ผ้าอุปกรณ์เสริม', 'appliance-replacement-filters'),
  rejectionFixture('spacing-obfuscated brush and mop filter kit', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'แปรงลูกกลิ ้ งฝาครอบแปรงด ้ านข ้ าง Hepa Filter Mop ผ ้ าสําหรับ AutoBot', 'appliance-replacement-filters'),
  rejectionFixture('mixed scrubber rotating brush and filter kit', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'TIXX ชุดแปรงหมุนและไส้กรอง HEPA แปรงไนลอนทนทาน ไส้กรองล้างได้ เครื่องล้างพื้น', 'appliance-replacement-filters'),
  rejectionFixture('faucet filter attachment set', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ชุด กรองก๊อกน้ำ กรองน้ำก๊อก ติดตั้งง่าย เปลี่ยนไส้กรองได้ ละเอียด 5 ไมครอน', 'appliance-replacement-filters'),
  rejectionFixture('faucet connector with filter', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'หัวต่อก๊อกกรองน้ำ ไส้กรองก๊อกน้ำทำจากใยฝ้าย', 'appliance-replacement-filters'),
  rejectionFixture('filter housing bundle without water suffix', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'กรองหยาบ กระบอกกรอง 20 นิ้ว ไส้กรองเรซิ่น กรองหินปูน', 'appliance-replacement-filters'),
  rejectionFixture('whole faucet and shower filter with health claim', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'กรองก๊อกน้ำ กรองน้ำฝักบัว กรองน้ำลดอาการแพ้น้ำ ไส้กรองน้ำประปา', 'appliance-replacement-filters'),
  rejectionFixture('mixed water-heater washing-machine inlet options', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'เครื่องทำน้ำอุ่น เครื่องซักผ้า ไส้กรองน้ำประปา เครื่องกรองน้ำ ฝักบัว ไส้กรอง PP cotton', 'appliance-replacement-filters'),
  rejectionFixture('automotive cabin filter outside automotive taxonomy', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'Neta X ไส้กรองเครื่องปรับอากาศ คาร์บอน PM2.5 อุปกรณ์เสริม สำหรับรถยนต์', 'appliance-replacement-filters'),
  rejectionFixture('mixed English vacuum spare parts', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'FOR Xiaomi Mi Robot Vacuum Spare Parts of Main Side Brush Hepa Filter Brush Cover', 'appliance-replacement-filters'),
  rejectionFixture('mixed vacuum nozzle and filter options', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'อะไหล่เครื่องดูดฝุ่น ไส้กรองฝุ่น หัวดูดฝุ่น ท่อดูดฝุ่น', 'appliance-replacement-filters'),
  rejectionFixture('filter-cleaning brush is not a filter', 'Home Appliances', 'Small Household Appliances', 'Vacuum Cleaners & Floor Care Appliances', 'แปรงอเนกประสงค์ ทำความสะอาดฟิวเตอร์ ไส้กรอง HEPA', 'appliance-replacement-filters'),
  rejectionFixture('water filter housing kit', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ชุดกระบอกกรองน้ำ Housing 10 นิ้ว พร้อมไส้กรองกรองหยาบ PP10', 'appliance-replacement-filters'),
  rejectionFixture('water filter mounting clip', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'คลิปยึด ไส้กรองน้ำ ตัวจับกระบอกกรองน้ำ สำหรับยึดไส้กรองแบบ INLINE', 'appliance-replacement-filters'),
  rejectionFixture('mixed water-purifier spare parts', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'อะไหล่เครื่องกรองน้ำ ก๊อกน้ำ ถังเก็บน้ำตัวบน ถังเก็บน้ำตัวล่าง ชุดไส้กรอง', 'appliance-replacement-filters'),
  rejectionFixture('filter housing wrench only', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ประแจขันกระบอกไส้กรองน้ำ ใช้กับกระบอก 10 และ 20 นิ้ว', 'appliance-replacement-filters'),
  rejectionFixture('water filter fittings only', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'อุปกรณ์ข้อต่อฟิตติ้ง แบบเกลียว ใช้กับสายน้ำและไส้กรองเครื่องกรองน้ำ', 'appliance-replacement-filters'),
  rejectionFixture('transparent filter housing only', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'กระบอกเฮ้าส์ซิ่งใส่ไส้กรอง 10 นิ้ว 2 โอริง', 'appliance-replacement-filters'),
  rejectionFixture('whole Acerpure air purifier', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'Acerpure COOL C3 เครื่องฟอกและหมุนเวียนอากาศ 3-in-1 HEPA Filter มีไฟ Night Light', 'appliance-replacement-filters'),
  rejectionFixture('nonreplaceable shower filter device', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'กรองน้ำอาบ กรองตะกอน ใช้ได้กับก๊อกทุกประเภท เปลี่ยนไส้กรองไม่ได้', 'appliance-replacement-filters'),
  rejectionFixture('filter support ring only', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ตัวประคองไส้กรอง แหวนประคองไส้กรอง สำหรับเฮ้าส์ซิ่ง 10 และ 20 นิ้ว', 'appliance-replacement-filters'),
  rejectionFixture('mixed wearable purifier accessories', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'LG PuriCare Inner Cover Hepa Filter Face Guard Ear Band', 'appliance-replacement-filters'),
  rejectionFixture('misspelled housing with stainless filter', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'กระบอกกรอก20นิ้ว พร้อมไส้กรองสแตนเลสและอุปกรณ์เข้าออก', 'appliance-replacement-filters'),
  rejectionFixture('housing and filter mounting set', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'กระบอกรองน้ำ 10 นิ้ว คู่กับไส้กรองสแตนเลส พร้อมอุปกรณ์ติดตั้ง', 'appliance-replacement-filters'),
  rejectionFixture('whole shower filter Agate', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ฟิลเตอร์กรองน้ำ ถอดเปลี่ยนไส้กรองได้ กรองน้ำฝักบัว', 'appliance-replacement-filters'),
  rejectionFixture('whole shower filter rod', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'แท่งกรองน้ำ กรองฝักบัว ฟิลเตอร์กรองน้ำ เปลี่ยนไส้กรองได้', 'appliance-replacement-filters'),
  rejectionFixture('whole inline ProudMe filter device', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'แท่งกรองน้ำ ProudMe เปลี่ยนไส้กรองได้ ไส้กรอง PP 5 ไมครอน', 'appliance-replacement-filters'),
  rejectionFixture('whole inline filter with separate cartridge', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'แท่งกรองน้ำ ProudMe ฟิลเตอร์กรองน้ำ เปลี่ยนไส้กรองได้', 'appliance-replacement-filters'),
  rejectionFixture('membrane housing or cartridge options', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'กระบอกเมมเบรน พร้อมไส้กรอง RO เลือกเฉพาะไส้กรองหรือกระบอก', 'appliance-replacement-filters'),
  rejectionFixture('whole shower head or refill options', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ฟิลเตอร์กรองน้ำฝักบัว ติดตั้งง่าย พร้อมไส้กรอง RE15', 'appliance-replacement-filters'),
  rejectionFixture('complete membrane housing elbow kit', 'Home Appliances', 'Kitchen Appliances', 'Water Filters, Coolers & Dispensers', 'ไส้กรองเมมเบรน UF 0.01 Micron พร้อมกระบอกและข้องอ ครบชุด', 'appliance-replacement-filters'),
  rejectionFixture('unsupported filter performance percentage', 'Home Appliances', 'Small Household Appliances', 'Air Treatment', 'แผ่นกรองอากาศ HEPA14 carbon กรองฝุ่น PM2.5 และกลิ่นได้ถึง 99.99%', 'appliance-replacement-filters'),
]);

export const LEGACY_HIERARCHY_V5 = Object.freeze({
  'auto-organizers': ['automotive', 'auto-interior'],
  'auto-covers-mats': ['automotive', 'auto-interior'],
  'auto-key-style': ['automotive', 'auto-exterior'],
  'auto-cleaning': ['automotive', 'auto-care'],
  'hand-tools': ['tools', 'tools-manual'],
  'diy-hardware': ['tools', 'tools-hardware'],
  'physical-books': ['learning', 'books'],
  'writing-supplies': ['learning', 'stationery'],
  'paper-notebooks': ['learning', 'stationery'],
  'art-craft': ['learning', 'creative'],
  'packing-gifts': ['shop-supplies', 'packaging'],
  'food-storage': ['home', 'home-kitchen'],
  'dining-drinkware': ['home', 'home-kitchen'],
  'kitchen-utensils': ['home', 'home-kitchen'],
  'cleaning-tools': ['home', 'home-cleaning'],
  'household-paper-bags': ['home', 'home-cleaning'],
  'home-organizers': ['home', 'home-organizing'],
  'bath-laundry': ['home', 'home-cleaning'],
  'home-textiles': ['home', 'home-textiles'],
  'home-decor': ['home', 'home-decor'],
  'garden-supplies': ['agriculture', 'agri-growing'],
  'camping-rain': ['outdoor', 'camping'],
  'travel-organizers': ['outdoor', 'travel'],
  'phone-cases': ['tech', 'mobile-accessories'],
  'passive-tech': ['tech', 'computer-accessories'],
  'pet-feeding': ['pets', 'pet-feeding'],
  'pet-home-toys': ['pets', 'pet-living'],
  'pet-hygiene': ['pets', 'pet-hygiene'],
  'skincare-cleanser': ['beauty', 'skincare'],
  'skincare-moisturizer': ['beauty', 'skincare'],
  'skincare-sunscreen': ['beauty', 'skincare'],
  'skincare-mask-lip': ['beauty', 'skincare'],
  'hair-body-care': ['beauty', 'hair-body'],
  'supplements-wellbeing': ['supplements', 'vitamins'],
  'supplements-beauty': ['supplements', 'vitamins'],
  'supplements-sports': ['supplements', 'sports-nutrition'],
  'apparel-basics': ['fashion', 'women-clothing'],
  'bags-wallets': ['fashion', 'bags'],
  'fashion-accessories': ['fashion', 'fashion-accessories'],
  'hobby-learning': ['learning', 'creative'],
});

const PLUS_SIZE = /(?:พลัสไซส์|พลัสไซ|สาวอวบ|บิ๊กไซส์|big\s*size|plus\s*size|(?:2|3|4|5|6|7|8)\s*xl|x{2,8}l|อก\s*(?:4[4-9]|[5-9]\d)\s*(?:นิ้ว)?)/iu;
const OFFICE = /(?:ออฟฟิศ|ชุดทำงาน|ชุดทํางาน|ทำงานผู้หญิง|ทํางานผู้หญิง|working\s*(?:woman|women)|office|business\s*(?:wear|attire)|formal\s*(?:wear|dress)|สูท|เบลเซอร์|blazer)/iu;
const SLEEPWEAR_KEYS = new Set(['women-sleepwear-pajamas', 'women-night-dresses']);

export function merchandisingTagsV5(category, cleanName, rawTitle = '') {
  if (category.groupKey !== 'fashion') return [];
  const tags = [];
  const text = `${cleanName} ${rawTitle}`;
  if (SLEEPWEAR_KEYS.has(category.key) || category.categoryKey === 'sleepwear') tags.push('fashion-sleepwear');
  if (['women-clothing', 'sleepwear'].includes(category.categoryKey) && PLUS_SIZE.test(text)) tags.push('fashion-plus-size');
  if (['women-clothing', 'sleepwear'].includes(category.categoryKey) && OFFICE.test(text)) tags.push('fashion-office');
  return tags;
}

export const MERCHANDISING_TAG_V5_GOLDEN_FIXTURES = Object.freeze([
  Object.freeze({ name: 'women XXL is plus size', category: Object.freeze({ key: 'women-tshirts', groupKey: 'fashion', categoryKey: 'women-clothing' }), cleanName: 'เสื้อยืดผู้หญิงไซส์ XXL', includes: Object.freeze(['fashion-plus-size']) }),
  Object.freeze({ name: 'women XXXXL is plus size', category: Object.freeze({ key: 'women-dresses', groupKey: 'fashion', categoryKey: 'women-clothing' }), cleanName: 'เดรสผู้หญิงไซส์ XXXXL', includes: Object.freeze(['fashion-plus-size']) }),
  Object.freeze({ name: 'office dress is office', category: Object.freeze({ key: 'women-dresses', groupKey: 'fashion', categoryKey: 'women-clothing' }), cleanName: 'เดรสออฟฟิศผู้หญิงทรงสุภาพ', includes: Object.freeze(['fashion-office']) }),
  Object.freeze({ name: 'sleepwear leaf is sleepwear', category: Object.freeze({ key: 'women-sleepwear-pajamas', groupKey: 'fashion', categoryKey: 'sleepwear' }), cleanName: 'ชุดนอนผู้หญิงผ้าฝ้าย', includes: Object.freeze(['fashion-sleepwear']) }),
  Object.freeze({ name: 'men XXL is not women plus size', category: Object.freeze({ key: 'men-tshirts', groupKey: 'fashion', categoryKey: 'men-clothing' }), cleanName: 'เสื้อยืดผู้ชายไซส์ XXL', excludes: Object.freeze(['fashion-plus-size']) }),
  Object.freeze({ name: 'oversize without size evidence is not plus size', category: Object.freeze({ key: 'women-tshirts', groupKey: 'fashion', categoryKey: 'women-clothing' }), cleanName: 'เสื้อยืดผู้หญิงทรงโอเวอร์ไซซ์', excludes: Object.freeze(['fashion-plus-size']) }),
  Object.freeze({ name: 'office bag is not office clothing', category: Object.freeze({ key: 'women-crossbody-bags', groupKey: 'fashion', categoryKey: 'bags' }), cleanName: 'กระเป๋าสำหรับสาวออฟฟิศ', excludes: Object.freeze(['fashion-office']) }),
]);
