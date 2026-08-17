import { createReadStream } from 'node:fs';
import { basename } from 'node:path';

export const CATALOG_SCHEMA_VERSION = 2;

export const DEFAULT_RANKED_TARGET = 2_000;
export const DEFAULT_RESERVE_TARGET = 300;
export const MINIMUM_RANKED_COUNT = 1_500;

export const REQUIRED_FEED_COLUMNS = Object.freeze([
  'global_category1',
  'global_category2',
  'global_category3',
  'stock',
  'item_sold',
  'title',
  'shopid',
  'itemid',
  'description',
  'model_prices',
  'sale_price',
  'price',
  'item_rating',
  'like',
  'image_link',
  'product_link',
]);

const IMAGE_COLUMNS = Object.freeze([
  'image_link',
  'additional_image_link',
  'image_link_3',
  'image_link_4',
  'image_link_5',
  'image_link_6',
  'image_link_7',
  'image_link_8',
  'image_link_9',
  'image_link_10',
]);

const PROMO_PHRASES = [
  /\bflash\s*sale\b/giu,
  /\bhot\s*sale\b/giu,
  /\bnew\s+collection\b/giu,
  /พร้อมส่ง(?:จากไทย|ในไทย|ส่งจากไทย)?/gu,
  /สินค้าส่งจากไทย/gu,
  /ส่งจากไทย/gu,
  /ส่งด่วน/gu,
  /ส่งเร็ว(?:ทันใจ)?/gu,
  /ส่งฟรี/gu,
  /เก็บเงินปลายทาง/gu,
  /\bcod\b/giu,
  /ของแท้\s*100\s*%/giu,
  /ราคาถูกที่สุด/gu,
  /ราคาถูก/gu,
  /ถูกที่สุด/gu,
  /ถูก\s*(?:และ)?\s*หนา/gu,
  /ถูกมาก+/gu,
  /(?<![\p{L}\p{N}])ถูก(?![\p{L}\p{N}])/gu,
  /ราคาส่ง/gu,
  /ราคาประหยัด/gu,
  /ราคาโรงงาน/gu,
  /โรงงาน[^,|;/]{0,30}ขายเอง/gu,
  /โรงงาน/gu,
  /ส่งเร็ว/gu,
  /สุดคุ้ม/gu,
  /คุ้ม(?:กว่า|ค่า|มาก|สุด)?/gu,
  /ขายดี/gu,
  /สลักชื่อฟรี/gu,
  /แจ้งในแชท/gu,
  /สินค้ามีคุณภาพ/gu,
  /ใช้ดีสุดในตอนนี้/gu,
  /ฮิตมากตอนนี้/gu,
  /\[?\s*official\s*\]?/giu,
  /\bnew\s+arrival\b/giu,
  /ของแท้(?:อย่างเป็นทางการ)?/gu,
  /สินค้าแท้/gu,
  /การันตีคุณภาพ(?:ด้วยยอดขาย[^.!?\n]*)?/gu,
  /ขายดีตลอดกาล/gu,
  /ยอดฮิต(?:\s*\d{4})?/gu,
  /สุดยอด/gu,
  /ที่สุดของ/gu,
  /(?:อันดับ|เบอร์)\s*(?:1|หนึ่ง)/gu,
  /\bno\.?\s*1\b/giu,
  /คุณภาพสูง/gu,
  /โปร(?:โมชั่น)?/giu,
  /ลด(?:ราคา)?\s*\d+\s*%/giu,
  /แถมฟรี/gu,
  /ซื้อ\s*\d+\s*แถม\s*\d+/gu,
  /\bspecial\s+promotion\b/giu,
  /\bupdate\b[!:\s-]*/giu,
  /\bsale\b[!:\s-]*/giu,
  /ร้านคนไทย!?/gu,
];

const BLOCKED_CATEGORY = /(?:food\s*&?\s*beverage|อาหารและเครื่องดื่ม|ticket|voucher|ตั๋ว|คูปอง|digital|บริการ|service|gaming\s+voucher|virtual|live\s*animal|สัตว์มีชีวิต)/iu;
// Broad high-risk top-level departments remain blocked. Newly supported vehicle,
// book, mobile, and computer products are admitted only by exact category paths
// plus a product-family allowlist below; they are never opened at department level.
const UNSUITABLE_CATEGORY = /(?:beauty|health|personal\s+care|mom|mother|baby|kids|toy|camera|home\s+appliance|audio|women(?:'s)?\s+(?:clothes|shoes)|men(?:'s)?\s+(?:clothes|shoes)|fashion\s+clothing|เครื่องใช้ไฟฟ้า|ความงาม|สุขภาพ|แม่และเด็ก|ของเล่น|เสื้อผ้า|รองเท้า)/iu;
const BLOCKED_TEXT = /(?:บุหรี่|ยาสูบ|พอต(?:ไฟฟ้า)?|vape|กัญชา|กระท่อม|อาวุธ|ปืน|กระสุน|ระเบิด|มีด(?:พก|ตรง)|\bknife\b|เซ็กซ์ทอย|sex\s*toy|adult\s*toy|ยา(?:รักษา|ลดน้ำหนัก|เพิ่มสมรรถภาพ)|อาหารเสริม|วิตามิน|คอลลาเจน|ดีท็อกซ์|ลดความอ้วน|เพิ่มน้ำนม|นมผง|นมเด็ก|เวย์โปรตีน|โปรตีนผง|ยาฆ่าแมลง|สารกำจัดศัตรูพืช|กรดกัด|เคมีเกษตร|สล็อต|พนัน|บุหรี่ไฟฟ้า|prescription|supplement|weight\s*loss|detox|pesticide|weapon|ammunition|ซิม(?:การ์ด|ทรู|ดีแทค|เอไอเอส)?|\bsim\s*card\b|สินค้าสมนาคุณ|ของแถม(?:ห้ามขาย)?|not\s+for\s+sale)/iu;
// Reject volatile seller metadata and unsafe/used inventory at source instead of
// trying to prettify it into an apparently objective catalog entry.
export const SOURCE_TITLE_POLICY = /(?:^\s*(?:>|\+{2,})|\+{2,}\s*$|จัดส่ง(?:ในระบบ\s*shopee|โดย|ที่รวดเร็ว|ในพื้นที่)|พร้อมจัดส่ง|เตรียมจัดส่ง|ส่งจาก(?:กทม\.?|กรุงเทพ(?:ฯ)?|ประเทศไทย)|สินค้า(?:อยู่|ใน)ไทย|(?:^|[/\s(\[【])(?:สินค้า\s*)?มีตัวเลือก(?:[\s)\]】]|$)|ทัก(?:แชท|ร้าน)|ติดต่อร้าน|ก่อนซื้อทุกครั้ง|สั่งผลิต|มีเล่มใหม่|เพจข่าว|ถูกสุด|ถุกสุด|(?:^|[\s(\[【])\d{1,5}(?:[.,]\d{1,2})?\s*บาท(?:[\s)\]】]|$)|(?:รอ|พรี\s*ออเดอร์|พรีออเดอร์|pre[-\s]?order)\s*\d*\s*(?:วัน|อาทิตย์|สัปดาห์)?|มือสอง|สภาพ\s*\d{1,3}\s*%|มีสนิม|สนิมๆ|\bused\b|ตะขอเกี่ยวเนื้อ|meat\s*hook|เครื่องมือตัด|อุปกรณ์ตัด|cutting\s*tool|vde\s*1000\s*v?|1000\s*v|กันไฟ|หุ้มฉนวน|(?:เซอร์ไพรส์|ของขวัญ|สินค้า)\s*(?:ปริศนา|แบบสุ่ม|สุ่ม)?[^\n]{0,45}(?:เมื่อซื้อ|เมื่อสั่งซื้อ|ซื้อครบ|สั่งซื้อครบ)[^\n]{0,35}(?:บาท|฿))/iu;
export const SOURCE_TITLE_ADDITIONAL = /(?:^\s*สินค้า\s|(?:\*+)?สินค้า\s*$|(?:สินค้า)?มีสต[๊็]อก|ลิขสิทธิ์แท้|ถูกกว่าปรินท์|เปลี่ยนหุ่น|ปรับฮอร์โมน|ไม่มึของปลอม|ของปลอม|มือ\s*2|(?:\/|\s)my\s*$|หนาขึ้น\s+หนาขึ้น)/iu;
const PASSIVE_AUTO_KEY_PATH = 'Automobiles > Automotive Keychains & Key Covers > ';
const PASSIVE_KEY_SHELL = /(?:เคส|ปลอก|ฝาครอบ|ซอง|กระเป๋าใส่|กล่อง|เปลือก)[^\n]{0,30}(?:กุญแจ|key)|key\s*(?:case|cover|holder|shell)/iu;
const ACTIVE_KEY_COMPONENT = /(?:ตัวรีโมต|ตัวรีโมท|กุญแจพับ|ชิป|วงจร|transponder|315\s*mhz|433\s*mhz|program(?:ming)?|copy\s*key|แบต|ถ่าน|ใบมีด|\bblade\b)/iu;
const PROHIBITED_TITLE = /(?:หลุด\s*qc|สินค้า(?:มี)?(?:ตำหนิ|ตําหนิ)|ตำหนิ|ตําหนิ|ไฟฟ้า|แบต(?:เตอรี่)?|ถ่าน(?:ชาร์จ)?|ชาร์จ|ยูเอสบี|\busb\b|\bled\b|บลูทูธ|bluetooth|power\s*bank|พาวเวอร์แบงก์|ปลั๊ก|สายไฟ|อะแดปเตอร์|adapter|เครื่อง(?:ดูด|ปั่น|ชาร์จ|นวด|หนีบ|โกน|เป่า|ตัด|ซีล|พิมพ์|ปริ้น|ชง|อบ|อุ่น|ซัก)|พัดลม|หม้อหุง|กล้องวงจร|smart\s*(?:watch|camera)|หุ่นยนต์|เดินเอง|เคลื่อนไหวอัตโนมัติ|อัตโนมัติ|automatic|remote\s*control|รีโมต|รีโมท|ครีม|เซรั่ม|แชมพู|โลชั่น|โทนเนอร์|ลิป(?:สติก)?|มาสคาร่า|เขียนคิ้ว|น้ำหอม|ระงับกลิ่น|รักแร้|บำรุงผิว|บำรุงผม|ยาสีฟัน|แปรงสีฟัน|makeup|cosmetic|skincare|กล่องยา|pill\s*(?:organizer|pod)|ทารก|ผ้าอ้อม|เด็ก(?:อ่อน|เล็ก)|baby\s|หมวกกันน็อค|เบรก|โช้ค|ปะเก็น|น้ำมันเครื่อง|ปั๊มน้ำมัน|ยางรถ|อะไหล่รถ|มีด|คัตเตอร์|กรรไกร|ใบมีด|เลื่อย|เข็ม(?:เย็บ|หมุด)?|กาวร้อน|กาวช้าง|น้ำยา|สเปรย์|สารเคมี|ผงซัก|น้ำยาล้าง|กาแฟ|ขนม|ซอส|น้ำปลา|เครื่องปรุง|อาหาร(?:เสริม|สุนัข|แมว|สำเร็จรูป)|ข้าวสาร|เครื่องดื่ม|เวย์|coffee|snack|supplement|สายจูง|ปลอกคอ|สายรัด(?:อก|สัตว์)|ยางกัด|ขัดฟัน|ลดกลิ่นปาก|เหงือก|เบ็ด|ตกปลา|ตะขอ(?:เบ็ด|ตกปลา)|ตาเบ็ด|ตัวเบ็ด|fishing\s*hook|ต้นไม้จริง|ต้นไม้พร้อมกระถาง|ต้น(?:อ่อน|กล้า)|บอนไซ|ไม้ดอก|ไม้อวบน้ำ|แคคตัส|กระบองเพชร|เมล็ด(?:พันธุ์)?|หัวพันธุ์|ปุ๋ย|ดินปลูก|ไม้ปลูก|ชอบแดด|ออกดอก|มีราก|ต้นไม้มงคล|ลำต้น|ลําต้น|กิ่งชำ|กิ่งชํา|ไม้ด่าง|ต้นพร้อมกระถาง|กระถาง[^\n]{0,25}มี\s*\d*\s*ต้น|live\s*plant|seed|fertili[sz]er|soil|catnip|กัญชาแมว|ดัมเบล|บาร์เบล|ออกกําลังกาย|ออกกำลังกาย|ฟิตเนส|เสื่อโยคะ|\bgym\b|craftsmanship|กระดาษทราย|sandpaper|ผูกเชือก|ชุดว่ายน้ำ|บิกินี่|ช่องระบายอากาศ|ตะแกรงระบาย|ตุ๊กตาจิ๋ว|โมเดลจิ๋ว)/iu;
export const PROHIBITED_SAFETY_ADDITIONAL = /(?:แคทนิป|มาทาทาบิ|matatabi|silvervine)/iu;
const HIGH_RISK_TITLE = /(?:รักษา(?:โรค|สิว|ฝ้า|ผื่น)|แก้(?:สิว|ฝ้า|ผิวแห้ง|ผิวลอก)|ลดสิว|ลดฝ้า|ขาวถาวร|ฆ่าเชื้อ|ป้องกันเชื้อ|เชื้อไวรัส|ทางการแพทย์|medical\s+(?:mask|device)|น้ำเกลือ|ล้างโพรงจมูก|ไม่ระคาย|ปลอดภัย\s*100\s*%|(?:ปลอดภัย|ไม่เป็นอันตราย|ต่อสัตว์เลี้ยง)[^.!?\n]{0,25}100\s*%|(?:กันน้ำ|กันฝุ่น|ป้องกัน)[^.!?\n]{0,30}100\s*%|ป้องกัน[^.!?\n]{0,30}pm\s*2[.]?5)/iu;
const POLICY_OR_PROMO_SENTENCE = /(?:ร้าน|ทักแชท|แชท|เงื่อนไข|การรับประกัน|รับประกัน|ไม่รับเปลี่ยน|ไม่สามารถเปลี่ยน|ไม่รับคืน|จัดส่ง|ขนส่ง|โปรโมชั่น|โปรดอ่าน|หมายเหตุ|กดติดตาม|ฝากรีวิว|สอบถาม|สต็อก|ลูกค้า|แอดไลน์|line\s*id|โทร\.?|facebook|instagram|tiktok|ราคาพิเศษ|ราคาที่|เก็บเงินปลายทาง|พร้อมส่ง|สินค้านำส่ง|ยินดีต้อนรับ|welcome|คำสั่งซื้อ|คําสั่งซื้อ|การชำระเงิน|รายงานรายการ|กิจกรรมที่น่าสงสัย|ตัดรอบ|ตัดส่ง|วันทำการ|วันหยุด|ของแท้อย่างเป็นทางการ|อย่าลืม|ติดตามเพื่อ|คูปอง|ส่วนลด|ทีมงานตอบ|แบรนด์ใหม่|ใหม่เอี่ยม|new\s+arrival|hot\s+sale|ใหม่ล่าสุด|คุณภาพดี|เชื่อถือ|หมดปัญหา|สบายที่สุด|สัญญา|บริการ|กำลังจะมีสินค้า|ออกใบกำกับ|ใบกํากับ|ลดเหลือ|ทำไมต้อง|เหตุใด|โรงงาน|ข้อสังเกต|ข้อควรระวัง|EMS|ไปรษณีย์|ลงทะเบียน|กดสั่ง|เคลม|คืนสินค้า|ถ่ายวิดีโอ|สี[^.!?\n]{0,35}อาจแตกต่าง|ภาพถ่าย|จอภาพ|รูปภาพ|ไม่แสดงขนาดจริง|การวัด(?:ด้วยตนเอง)?|ข้อผิดพลาด|ความคลาดเคลื่อน|Shopee|GPS|รับเอง|Standard\s*Delivery|หวังว่า|การันตี|ต้องชอบ|ติดใจ|ฟิน|จำหน่าย|จําหน่าย|ห้าง|คำเตือน|คําเตือน|เป็นมิตรกับสิ่งแวดล้อม)/iu;
const CLAIM_PHRASES = /(?:ดีที่สุด|ราคาถูกที่สุด|ถูกที่สุด|(?:อันดับ|เบอร์)\s*(?:1|หนึ่ง)|\bno\.?\s*1\b|เห็นผลทันที|รับประกันผล|ปลอดภัย(?:\s*100\s*%)?|ไม่เป็นอันตราย|ไม่ระคาย\w*|ไม่บาด\w*|อ่อนโยนต่อ[^.!?\n]{0,30}|(?:กันน้ำ|กันฝุ่น|กันแสง|กันทาก|ป้องกัน)[^.!?\n]{0,35}\d{2,3}(?:\.\d+)?\s*%|ลด(?:การ)?กรน|กระดูกสันหลัง|ลดเมื่อยล้า|ช่วยลดเครียด|ลดความเสียหาย|หายขาด|รักษา(?:โรค|สิว|ฝ้า)|ลดน้ำหนัก|ขาวถาวร|ฆ่าเชื้อ(?:แบคทีเรีย)?\s*\d*(?:\.\d+)?\s*%?|คุณภาพดี|คุณภาพสูง|ใหม่ล่าสุด|\S*ที่สุด|ชั้นยอด|ทนแดด|ทนความร้อน|สีไม่ซีด|ไม่ทิ้งคราบ|กักเก็บกลิ่น|สูตรใหม่|ลื่นไหล|สีสดชัด|คุ้มค่า|จุใจ|สุดว้าว|สุดคิ้วท์)/giu;
const OBJECTIVE_SIGNAL = /(?:วัสดุ|ผลิตจาก|ทำจาก|ทําจาก|เนื้อ(?:ผ้า|กระดาษ)|ขนาด|ความจุ|บรรจุ|ประกอบด้วย|ความ(?:ยาว|กว้าง|สูง)|ปรับ(?:ระดับ|ขนาด|ความยาว|ได้)|พับ(?:ได้|เก็บ)|จัดเก็บ|ทำความสะอาด|ทําความสะอาด|(?:มี|แบ่งเป็น)\s*\d+\s*(?:ช่อง|ชั้น)|ช่อง(?:ใส่|เก็บ|หลัก|ย่อย)|ชั้น(?:วาง|จัดเก็บ)|\d+(?:[.,/]\d+)?\s*(?:cm|mm|ml|l|kg|g|ซม\.?|มม\.?|มล\.?|ลิตร|กก\.?|กรัม|นิ้ว|ชิ้น|ใบ|แผ่น|รีม|ช่อง|ชั้น|หน้า)|ใช้สำหรับ(?:จัดเก็บ|ใส่|วาง|แขวน|เช็ด)|ใช้สําหรับ(?:จัดเก็บ|ใส่|วาง|แขวน|เช็ด)|จำนวนหน้า|จํานวนหน้า|ผู้เขียน|สำนักพิมพ์|สํานักพิมพ์|เลขมาตรฐานสากล|\bisbn\b|ปก(?:อ่อน|แข็ง)|ฉบับพิมพ์|พิมพ์ครั้ง|เนื้อหา(?:ภายใน|ในเล่ม)|ภายในเล่ม|แบบฝึกหัด|หนังสือเล่ม)/iu;

export const FINAL_PROMO_POLICY = /(?:อยู่ระหว่างเปลี่ยนแพ็คเกจ|สินค้ามีคุณภาพ|คุณภาพ|พรีเมียม|พรีเมี่ยม|premium|เกรด\s*(?:a+|aaa|ส่งออก|โรงแรม)|ราค(?:า|าพิเศษ|าต่อ|าเริ่มต้น)|จัดส่ง(?:ภายใน|จาก|โดย|ในระบบ\s*shopee|ที่รวดเร็ว|ไม่เกิน|รวดเร็ว)|\d+\s*วันจัดส่ง|ส่งจาก(?:ประเทศไทย|กทม\.?|กรุงเทพ(?:ฯ)?)|สินค้าอยู่ไทย|ส่งไว|ส่งเร็ว|ส่งสินค้าเร็ว|พร้อม(?:ส่ง|จัดส่ง)|เตรียมจัดส่ง|ส่งทุกวันไม่หยุด|ขายยกลัง|\bhot\b|\blive\b|\bnew\b|มาใหม่|รุ่นใหม่|อัพเดต[^.!?]{0,30}ใหม่|อ่านรายละเอียดก่อนสั่งซื้อ|แจ้งข้อความก่อนกดสั่ง|ในสต็อก|จํากัดการสั่งซื้อ|จำกัดการสั่งซื้อ|ทางร้าน|ลูกค้า|สั่งไม่เกิน|กดสั่ง|กดดู|กดตรงชื่อสินค้า|ดูขนาดสินค้า|ตัวเลือกสินค้า|ภาพตัวเลือก|ข้อมูล[^.!?]{0,25}ด้านล่าง|หากต้องการ|ออเดอร์|สั่งตัด|ขายเป็นชุด|ขายแยก|จําหน่าย|จำหน่าย|ออกใบกํากับ|ออกใบกำกับ|รับประกัน|แอดมินตอบไว|ไม่สามารถมัดรวม|ปรึกษาฟรี|กรุณาตรวจสอบ[^.!?]{0,50}ก่อนตัดสินใจซื้อ|ราคาไม่เท่ากัน|จัดไปเลย|ในราคา\s*!|ซื้อ\s*2\s*เล่ม\s*แถม|ซื้อของที่ระลึก|แถม|\bfree\b|ฟรี|ผ่านการทดสอบ|ดึงดูดทุกสายตา|พร้อมใช้งานทันที|ฟรีป้ายชื่อ|(?:นะคะ|นะครับ|ค่ะ|ครับ)|เป็นมิตร(?:ต่อ|กับ)สิ่งแวดล้อม|รักษ์โลก|ฟีลกู้ด|สุดๆ|ตัวดัง|ต้องมี|ใช้แล้วต่างจริง|สุดหรู|สุดสมาร์ท|ตามใจคุณ|อย่างดี|เนื้อดี|คัดเกรด|ออกแบบพิเศษ|ดีไซน์สวย|ทันสมัย|มั่นใจ|บอกลา|สีสด|คมชัด)/iu;
export const FINAL_DEFECT = /(?:สีอาจแตกต่าง|ภาพถ่าย|จอภาพ|รูปภาพอาจ|ไม่แสดงขนาดจริง|การวัด(?:ด้วยตนเอง)?|ข้อผิดพลาด|คลาดเคลื่อน|ตามที่แสดงในภาพ|อาจแตกต่าง|โปรดทราบ|หมายเหตุ|ข้อควรระวัง|ขึ้นอยู่กับ\s*lot|จุดหรือฟองอากาศ|ขนาดจริงอาจ)/iu;
export const FINAL_HIGH_RISK_CLAIM = /(?:ป้องกัน(?:การสะสมของ)?แบคทีเรีย|แอนตี้แบคทีเรีย|ยับยั้งแบคทีเรีย|ต่อต้านแบคทีเรีย|(?:anti[-\s]?bacterial|antibacterial)|ไม่มีสารเรืองแสง|ปราศจากสารฟอกขาว|ปลอดสารพิษ|bpa[-\s]?free|ไร้สารก่อมะเร็ง|food\s*grade|เกรดอาหาร|กันไรฝุ่น|ลดเชื้อรา|ป้องกันเชื้อรา|กันเชื้อรา|ไม่เป็นอันตราย|ปลอดภัย(?:\s*100)?|ฆ่าเชื้อ|ถูกสุขอนามัย|ต่อสุขภาพ|เป็นมิตรกับผิวหนัง|ไม่(?:ทํา|ทำ)ให้เกิดรอยขีดข่วน|ไม่ซีดจาง|ไม่หดตัว|ปวด(?:หลัง|คอ)|ซัพพอร์ตคอ|รองรับ(?:ต้น)?คอ|ตามสรีระ|หลับสบาย|ห้ามใช้|แอลกอฮอล์เช็ดแผล|ป้องกัน(?:การกัดกร่อน|สนิม)|กันสนิม|rfid|anti[-\s]?theft|ปกป้องข้อมูล|ทุกคราบ|ทุกชนิด|ไม่มีสารตกค้าง|ไม่มีคราบตกค้าง|ไม่เป็นปัญหา|ไม่(?:รั่วซึม|ตกค้าง|แตกหัก|ฉีกขาด|เปราะแตก|ปริ|เป็นสนิม|มีกลิ่น)|หัวไม่แตก|สีไม่ตก|ทนแรงกระแทก|เก็บกลิ่นไม่ปน|อ่อนโยนในการใช้งาน|ย่อยสลายได้|ไร้สารปนเปื้อน|ทนทานกว่าถึง|ดีเยี่ยม|รับน้ําหนักได้\s*\d+|ถนอมสายตา)/iu;
export const BROKEN_THAI_TOKEN = /(?:^|\s)[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/u;
export const CLEAR_GIBBERISH = /(?:ทัพพีตักข้าว\s+ในโลก\s*$|ซื้อของที่ระลึกได้แล้ว|วัสดุที่\s+และปลอดสารพิษ\s+ไม่มี|ในราคา\s*!|ราคาแน่นอน\s+จัดไปเลยครับ|บรรจุในกระเป๋าอย่าง\s*$|คสาม|ซักแร้ว|ซ่องซิป|ภาวะเงินฝืด|มิติใหม่ของเครื่อง\s+คือ\s+ขนาดของเครื่อง|ตําแหน่งที่ยืดหยุ่น|ถาดทิ้งขยะสําหรับสัตว์เลี้ยง|เน้ือ|ทําโบว|ทำโบว|เนื้อผ้าดี|สามารถ\s+ได้สูง|ใต้หวัน|ปะแจ|\S+\s+ที่\s+และ\s+\S+)/iu;
export const TRAILING_INCOMPLETE_NAME = /(?:(?:จํานวน|จำนวน|ติดใน|ขนาด)\s*\d[\d,]*|(?:มี|มีของ|มีสินค้า|รุ่น|ขนาด|กว้าง|ยาว|สูง|สี|แบบ|และ|พร้อม|พร้อมกับ|ภายใน|สําหรับ|สำหรับ|การ|จาก|ทํา|ทำ|สินค้า|with|for|of|and)|[/×&+]|\bx|(?:^|[\s,])\d[\d,]*)\s*$/iu;
export const UNREADABLE_THAI_RUN = /[\u0E00-\u0E7F]{70,}/u;
export const FINAL_UNSUITABLE_BODY_PRODUCT = /(?:หมอน(?:รองคอ|เดินทาง|เป่าลม)|ผ้าปิดตา|ที่ปิดตา|sleep\s*mask|blindfold|airmask|ต่อขนตา)/iu;
export const FINAL_GARBLE_OR_RAW_HEADER = /(?:a\s*:\s*คุณจะได้รับ|งดดราม่า|รีวิวให้ดาวมั่ว|ดูขนาดสินค้า|ตัวเลือกสินค้า|คําอธิบายประกอบแบบเต็มภาพ|รายละเอียดสินค้า.*empty\s*storage|รายละเอียดสินค้า\s*:|รายละเอียด\s*:|วิธีการใช้งาน\s*:|การสกัดรูปปาก|ยาขี้ซี|พืัน|ทิชชู๋|พกพก|ออกแแบบ|ให้ลเลือก|ทําคาม|เจาะรูฟรี|แบริ่งที่|ไมโครเวฟไ|ขนาดจั้มโบ้ววว|คื่อ|มาตราฐาน|สเก็ตซ์|ซม่|ซานแม่เหล็ก|นัว|ขอขึ้น|และกา\s*$|ทึ่สุด|เส้นใยโพลีเอสเวัสดุ|ไม่แน่ใจเกี่ยวกับ|กล้องส่องทางไกล|แห้งไว้กว่า|กันน้า|>>|แพคเกจประกอบด้วย|สติกเกอร์กาวในตัววัสดุ|วัสดุไมโครไฟเบอร์การดูดซึม|กระเป๋าใส่เอกสารโฟลเดอร์แฟ้มกระเป๋า|อุปกรณ์เสริมหลักของ\s*abs|^ส่งปากกา|^cm\s*\(|^นิ้ว\s|ชื่อสินค้า\s*:|ข้อแนะนํา|อย่าง่าย|หูฟังอินเ|ในคร(?:\s|$)|ที่ปาดนํา|(?:ซม|มม)\d[.]|multi-functionalpartmentpartment|เรียบราบ|ไม่กลายเป็นรูป|วัสดุแบบดี|ติดตั้งได้อย่างสบาย|0[.]\d+\s*กรัม|\.{3,}|ถาดทิ้งขยะสําหรับสัตว์เลี้ยง|สกายบริดจ์ขั้นตอนแมว)/iu;
export const TRAILING_INCOMPLETE_SUMMARY = /(?:[×/:]|--|(?:และ|และ\s*!|พร้อม|ขนาด|วัสดุ|with|for|of|ใน|จะมี|แนวข้อสอบเข้า|วิธีการใช้สินค้า)|(?:^|\s)กา)\s*$/iu;
export const FINAL_ADDITIONAL_POLICY = /(?:ก่อนสั่ง|ก่อนการสั่งซื้อ|การสั่งซื้อ|กรณีต้องการสั่ง|ตอนสั่งซื้อ|เลือกขนาดตอนสั่ง|เลือกตัวเลือก[^.!?\n]{0,45}ตาม(?:จํานวน|จำนวน)|กรุณาสั่งซื้อ|หากคุณสั่งซื้อ|เมื่อ(?:ซื้อ|สั่งซื้อ)(?:สินค้า)?ครบ|เช็ค(?:ที่อยู่|เบอร์|ชื่อ|จํานวน|จำนวน)|ตรวจสอบ[^.!?\n]{0,70}ก่อน(?:ทําการ|ทำการ)?สั่งซื้อ|ตรวจสอบ[^.!?\n]{0,55}ก่อน(?:ที่จะ)?ส่ง|ตรวจสอบ[^.!?\n]{0,55}ก่อนบรรจุ|ทําความสะอาด[^.!?\n]{0,35}ก่อนส่ง|ทำความสะอาด[^.!?\n]{0,35}ก่อนส่ง|อย่า(?:สั่งซื้อ|ซื้อร่วม)|ซื้อร่วม|บรรจุภัณฑ์[^.!?\n]{0,45}(?:ไม่มีกล่อง|ไม่ได้มาพร้อม)|เนื่องจาก(?:สินค้า|กล่องสินค้า)มีขนาดใหญ่|เกิน\s*\d+(?:[.,]\d+)?\s*กก|เราสนับสนุนการขายส่งและขายปลีก|ฝากข้อความ(?:ถึงเรา)?|ดูจากรายละเอียดสินค้าเท่านั้น|ดูภาพสินค้าเพิ่มเติม|เปรียบเทียบขนาด|ลดล้างสต๊อก|สภาพ\s*\d{1,3}\s*%(?:\s*[-–]\s*\d{1,3}\s*%)?|\bpre[-\s]?order\b|พรี\s*ออเดอร์|พรีออเดอร์|รอ\s*\d+\s*(?:วัน|อาทิตย์|สัปดาห์)|ไม่ได้เป็นหนังสือ[^.!?\n]{0,70}(?:ทางการ|สำนักพิมพ์|สํานักพิมพ์)|ไม่(?:ใช่|มี)ลิขสิทธิ์|\bunofficial\b|\bupdate\b|\bsale\b|\bspecial\s+promotion\b|มาถึงภายใน\s*\d+\s*ชั่วโมง|เพิ่ม\s*\d+\s*หน้า|แบบใหม่ๆ|แน่นๆ|ทําไมควร|ทำไมควร|พลาดไม่ได้|ชอบก็รีบ|สมบูรณ์แบบ|ให้เป็นเรื่องง่าย|ดีกว่างานทั่วไปแน่นอน|ไม่มีใครเทียบ|เน้นสไตล์และบุคลิก|ประสบการณ์[^.!?\n]{0,35}ดีขึ้น|ภาพเปรียบเทียบ|รูปถ่ายสินค้า|ไม่รวม(?:คีย์|รายการอื่น)|ภาพ(?:ประกอบ)?โฆษณาเท่านั้น|ขนาดของสินค้าจริงอาจ\s*\+\s*\/-|มาตรฐานของตลาด|ประหยัดเวลา[^.!?\n]{0,40}\d+\s*%|ภูมิใจ[^.!?\n]{0,50}(?:จัดพิมพ์|หนังสือ)|หนังสือดี|(?:เซอร์ไพรส์|ของขวัญ|สินค้า)\s*(?:ปริศนา|แบบสุ่ม|สุ่ม)?[^.!?\n]{0,45}(?:เมื่อซื้อ|เมื่อสั่งซื้อ|ซื้อครบ|สั่งซื้อครบ)|ศาสตร์แห่งการบําบัด|ศาสตร์แห่งการบำบัด|\beco[-\s]?friendly\b|ไม่ทําลายสิ่งแวดล้อม|ไม่ทำลายสิ่งแวดล้อม)/iu;
export const FINAL_SELLER_VOICE = /(?:สั่งซื้อ|ทีมผู้เชี่ยวชาญของเรา|ของเรา(?:ทํา|ทำ|มี|พัฒนา|ผลิต|เหมาะ)|ผู้ซื้อ|ผู้ขาย|ฝ่ายบริการลูกค้า)/iu;
export const FINAL_NONOBJECTIVE_TEXT = /(?:ขาดไม่ได้|ลดการสูญหาย[^.!?\n]{0,45}(?:การ)?สูญเสีย|รีวิวหนังสือ\s*:|เพจ[^/|.!?\n]{0,50}รีวิว)/iu;
const CERTIFICATION_CLAIM = /(?:(?:ได้รับ)?การรับรองมาตรฐาน|ผ่านมาตรฐาน|\bcertified\b)/iu;
const CERTIFICATION_ID = /(?:มอก\.?\s*\d|\btis\s*\d|\biso\s*\d+)/iu;
export function hasUnsupportedCertification(value) {
  return CERTIFICATION_CLAIM.test(value) && !CERTIFICATION_ID.test(value);
}
export const FINAL_ADDITIONAL_GARBLE = /(?:^\s*(?:>|\+{2,}|x\s+|q\d+\s*:)|\+{2,}\s*$|ดตรวจสอบ|ดเปรียบเทียบ|ดอย่า|ดสั่งซื้อ|ดดู|ดทํา|ดทำ|สินค้ามึ|สินค้าเปฺ็น|วัสดถ|วัสุด|ยืดยุ่น|ร้านนค้า|ดด้วยได้ไหม|ผลิตผลการพิมพ์ภายในเล่ม|หรือย่าง|หรือตะแกรง|หกระเป๋า|ตะขอเครื|ชุดกันฝัน|โสตนแวร์|precsion|หยดกาว|อัลลอยด์หล่น|ผลกระทบต่อภาพที่แข็งแกร่ง|ในลิงค์|ส่วนต่างๆของร่างกาย|วัสดุ\s+และ|ผ้า\s+มาก|ให้ความ\s+กับ|รากฐานความหมายของ\s+สิ่งที่|เมื่อไหร่ที่หนังสือเล่มนี้ถูกเปิดอ่าน|ในรายการรวมด้วย|สิ่งที่มาในชุด|วัสดุปล่อยความร้อน|แทงก์น้ํา|แทงก์น้ำ|lower\s*อุณหภูมิ|แผ่นรองเมาส์ที่\s+สําหรับเมาส์|ติดตั้งง่ายและ\s*\)|โมงค์เล่น|,\s*,และ|ชั้น\s*สุง|ความสุง|คีมล๊อใช้|แบบกระกระดาษ|เรียกว่า\s+เชิญชวน|(?:บังแดด[^.!?\n]{0,35}){3}|(?:^|[/\s])รายละเอียดสินค้า(?:\s|[:(])|จากประเทศเหล็กหล่อ|ทําความสะอาดที่ได้|ทำความสะอาดที่ได้|featuring\s+and\s+phillips,\s+and\s+phillips|screwdriver\s+bit\s+85mm\s+incl|สินค้า(?:ทุกชิ้น)?[^.!?\n]{0,30}เหล็ก\s+สุด\s*$|^\s*x\d)/iu;

// Feed-wide final gate for seller actions, untranslated headers, malformed
// fragments and subjective copy that may survive sentence selection. Keep this
// generic so a later feed refresh is held to the same standard as today's rows.
export const FINAL_FEED_NOISE = /(?:กดตัวเลือก|ใส่ตะกร้า|ทัก(?:แชท|ร้าน)|ติดต่อร้าน|ก่อนซื้อทุกครั้ง|น้ําหนักสินค้าพร้อมแพ็?[คก]เกจ|น้ำหนักสินค้าพร้อมแพ็?[คก]เกจ|ดูแผนภาพ[^.!?\n]{0,50}(?:ข้อกําหนด|ข้อกำหนด)|ผู้ช่วย(?:ชั้นดี|ครัวที่ดี)|เรื่องง่ายดาย|ตอบโจทย์ทุกความต้องการ|สวยงามยิ่งขึ้น|สะดุดตา|วัสดุลย|(?:จ้า|จ้ะ|จ๊ะ)(?:\s|$)|ไม่มีหลุดลอก|ไม่มึของปลอม|ของปลอม|iso\s*9001[^.!?\n]{0,20}xด้าม|\bxด้าม|เฟรมโหลด[^.!?\n]{0,110}วางท่อค้อน|ขนาดหัวโรมัน|ขนาด\s*\d+(?:x\d+)+\s*สําหรับ\s*cm|ขนาด\s*:\s*ประมาณ\s*[.!]?|(?:\d+\s*ชิ้น\s*x\s*){2,}|[\u20E3]|นี้ื์|การคีนดี|อาหารน่าแทน|ผ่านขบวนการผลิตและ\s*qc|กลิ่นไม่เหม็น|คาดเคลื่อน|ใต้หวัน|ปะแจ|วัสด(?:\s|$)|โมเด็ล|สานาเดียม|เพิ่มความ\s+ในการ|กรณีที่ยากลําบากของพีซี|กรณีที่ยากลำบากของพีซี|ประเภทสินค้า\s*:|ใช้เป็นในชุดมี|(?:^|\s)please\s+note|yuval\s+noah\s+harar\b)/iu;

export const FINAL_FEED_NOISE_ADDITIONAL = /(?:(?:รายการแพ็?[คก]เกจ|แพ็?[คก]เกจ(?:รวม|ประกอบด้วย)?)\s*:|มาแล้วว+|น้อน+|น่าร๊าก|(?:ค่า|ค้า)(?:\s|$)|วิธีการใช้สินค้า\s*:?|วิธีใช้งาน\s*:|รีวิวโดยส(?:ํา|ำ)นักพิมพ์\s*:|(?:ขนาดสินค้า\s*:\s*){2}|\b\dxx\s*หน้า|สินค้าต้องอยู่ในสภาพเดิม|พร้อมบรรจุภัณฑ์ครบถ้วน|รวมไฟล์แนบทั้งหมด|มาตรฐานการผลิต\s*\+-|มาตรฐานเยอรมันแท้|teapot\s+carnation|เครื่องพริ้นความร้อนแบบไม่\s+พกพา|คู่ใจ|ไม่ต้องห่วง|สุดคิวท์|เยี่ยม|ยอดนิยม|ใช้ดี|สินค้าใหม่|ลิขสิทธิ์แท้|ภาพจริง|ตามรูป|ป้องกันตัวเอง|มอบสัมผัส[^.!?\n]{0,45}อ่อนโยน|ให้ความรู้สึกสามมิติ|พบกับ[^.!?\n]{0,80}(?:สุดคิวท์|ของคุณ)|คือทางออกที่[^.!?\n]{0,40}ต้องการ|ทุกบ้านควรมี|เปลี่ยนกิจวัตร|ดระวัง|การเลียนแบบ|สอยแอพ|มากก{3,}|ภาพต่อไปนี้|ปฏิเสธที่จะเปลี่ยนรูป|(?:ไม่ต้องงม|ยอดเยี่ยม|เพลิดเพลิน)[!！]|เลือกหนังสือเล่ม\s+ดของลูกน้อย|ปรับฮอร์โมน|เปลี่ยนหุ่น)/iu;

export const FINAL_HEALTH_CLAIM_ADDITIONAL = /(?:อ่อนโยน|ทุกสภาพผิว|ไม่(?:ทํา|ทำ)ให้ระคาย|ลดการสะสมของไรฝุ่น|ลดไรฝุ่น|block\s*mite)/iu;
export const FINAL_FEED_NOISE_THIRD = /(?:เย็นทันที่|ไม่ต้องกลัวผิวเสีย|(?:^|\s)ต่อสัตว์เลี้ยง|มีโอกาสลอก|จากที่ลองใช้งาน|ไม่(?:ทํา|ทำ)ให้[^.!?\n]{0,35}เป็นรอย|ไม่(?:ทํา|ทำ)ลายสีรถ|คุณสมบัติพิเศษ\s*\(ถ้ามี\)|ประหยัดพื้นที่[^.!?\n]{0,30}\d+(?:[.,]\d+)?\s*เท่า|ตําแหน่งผ่น|ตำแหน่งผ่น|หยิกไม่ถึง|มากๆๆ|ตะข้อ|ถุงล่ะ|ลดความเม|สะดวกสุด\s*p\b|หนังสือเล่มนี้มีคําตอบ|หนังสือเล่มนี้มีคำตอบ|ง่ายดาย|อาจมีปริมาณบวกหรือลบ|สินค้าจัดใหม่|เข้ากับทุกสไตล์|สีสันสดใส|พิเศษสุด|ตอบสนองต่อความต้องการ|ถาดถาด|สไตล์\s*:\s*สไตล์\s*:|น่ารักสวยงาม|\(\s*\))/iu;
export const FINAL_LOCKED_BLOCKER_TEXT = /(?:ผลิตภัณฑ์นม|ideal\s+as\s+a\s+small\s+present\s+for\s+your\s+customers|มากกว่าทั่วไปถึง\s*\d+(?:[.,]\d+)?\s*%|ชุดนี้แนะนําเลย|ชุดนี้แนะนำเลย|เพียงอ่าน[^.!?\n]{0,50}ก็จะ[^.!?\n]{0,50}ได้|please\s+note|อย่างน้อยก็ตอนที่คุณอ่าน|เคยแนะนําให้ผู้ปกครอง|เคยแนะนำให้ผู้ปกครอง|ขี้ผึ้งเฟอร์รี่|ด้านในร่ม\s*$|ตรงปก|^\s*cm\s*\d|การออกแบบการออกแบบ|แข็งแรง\s+ต่อน้องแมว|ที่แมว\s*$|จํานวน\s+หน้า|จำนวน\s+หน้า|แนะนําโดย\s+boss\s+lady|แนะนำโดย\s+boss\s+lady|แจ้ง[^.!?\n]{0,45}ข้อความ[^.!?\n]{0,45}ตรายาง|วัสดสแตนเลส|ขัดได้ทุกซอกท\s*$|ภาพที่่\s*\d|ดหลีกเลี่ยง|ถุงกระดาษแบรนด์\s*louis\s*vuitton|สิ่งที่คุณจะได้รับ\s*:|ฉากที่เกี่ยวข้อง\s*:|จะเหมาะถ้าประตูของคุณแตก|ยางลบยางลบ|ลอกออก\s+กาว\s+จัดๆได้นาน|lapis\s+de\s*$|วาดอุปกรณ์ดินสอสี[^.!?\n]{0,35}art\s+school|ไม่แตกลายงา|ฟู๊ดเกรด|1\s*ชิ้น\s+1\s*ชิ้น|การปกป้องสิ่งแวดล้อม|มุม\s+ดของคุณ)/iu;

export function containsLockedBlockerText(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (FINAL_LOCKED_BLOCKER_TEXT.test(text)) return true;
  return text
    .split(/(?:\n+|(?<=[.!?。])\s+|\s*[|]+\s*)/u)
    .some((fragment) => FINAL_LOCKED_BLOCKER_TEXT.test(fragment.trim()));
}

const AUTHENTICITY_MATERIAL = /(?:ไม้(?:สัก|ยางพารา|เนื้อแข็ง)?|ผ้าฝ้าย|สแตนเลส|เงิน|เมลามีน|cotton|คอตตอน|ธรรมชาติ)\s*แท้/giu;
export function hasAuthenticityClaim(value) {
  const withoutMaterialClaims = String(value ?? '').replace(AUTHENTICITY_MATERIAL, ' ');
  return /(?:แท้(?!จริง)|ตรงปก)/iu.test(withoutMaterialClaims);
}

export function hasDescriptionBrandAuthenticityClaim(value) {
  const withoutLatinMaterials = String(value ?? '')
    .replace(/\b(?:cotton|wood|stainless(?:\s+steel)?|silver|melamine)\s*แท้(?=$|[^\p{L}\p{N}])/giu, ' ');
  return /\b[a-z0-9][a-z0-9.&+_-]{1,24}(?:\s+[a-z0-9][a-z0-9.&+_-]{1,24}){0,2}\s*แท้(?=$|[^\p{L}\p{N}])/iu.test(withoutLatinMaterials);
}

function numericValuesBeforeUnit(value, unitPattern) {
  const values = [];
  const pattern = new RegExp(`(\\d+(?:[.]\\d+)?)\\s*(?:${unitPattern})`, 'giu');
  for (const match of String(value ?? '').matchAll(pattern)) values.push(Number(match[1]));
  return values.filter(Number.isFinite);
}

function millimeterRanges(value) {
  const ranges = [];
  const pattern = /(\d+(?:[.]\d+)?)\s*[-–]\s*(\d+(?:[.]\d+)?)\s*(?:mm|มม\.?)/giu;
  for (const match of String(value ?? '').matchAll(pattern)) ranges.push([Number(match[1]), Number(match[2])]);
  return ranges;
}

export function hasConflictingDimensions(cleanName, summary) {
  const nameInches = numericValuesBeforeUnit(cleanName, 'นิ้ว|inch(?:es)?');
  const summaryInches = numericValuesBeforeUnit(summary, 'นิ้ว|inch(?:es)?');
  if (nameInches.length && summaryInches.length && !nameInches.some((nameValue) => summaryInches.some((summaryValue) => Math.abs(nameValue - summaryValue) < 0.05))) return true;
  const nameRanges = millimeterRanges(cleanName);
  const summaryRanges = millimeterRanges(summary);
  return nameRanges.some(([nameMin, nameMax]) => nameMin > 0 && summaryRanges.some(([summaryMin, summaryMax]) => summaryMin === 0 && Math.abs(summaryMax - nameMax) < 0.05));
}

export const RAW_TEXT_BOUNDARY = /^\s*[+<>{}\[\]【】■□◆►▶●•~]|(?:\.{3,}|…)\s*$/u;
export const RAW_NAME_BOUNDARY = /^\s*[+<>{}■□◆►▶●•~]|(?:\.{3,}|…)\s*$/u;

const PASSIVE_METER_CASE_TITLE = /(?:(?:กระเป๋า|เคส|ซอง|กล่อง)[^\n]{0,35}(?:มิเตอร์|meter)|(?:มิเตอร์|meter)[^\n]{0,35}(?:กระเป๋า|เคส|ซอง|กล่อง|bag|case))/iu;
const PASSIVE_METER_CASE_SUMMARY = /(?:กระเป๋า|เคส|ซอง|กล่อง|bag|case)/iu;
const ACTIVE_METER_SUMMARY = /(?:วัด|แอมป์|ความจุ|ความถี่|แรงดัน|กระแส|voltage|current|ampere|frequency|capacitance)/iu;
export function hasPassiveMeterCaseMismatch(categoryKey, cleanName, summary) {
  return categoryKey === 'manual-tools' && PASSIVE_METER_CASE_TITLE.test(cleanName) &&
    (!PASSIVE_METER_CASE_SUMMARY.test(summary) || ACTIVE_METER_SUMMARY.test(summary));
}

const THAI_WORD_SEGMENTER = new Intl.Segmenter('th', { granularity: 'word' });

function contentTokens(value) {
  return [...THAI_WORD_SEGMENTER.segment(String(value ?? '').toLocaleLowerCase('th-TH'))]
    .filter((part) => part.isWordLike && part.segment.length > 1)
    .map((part) => part.segment);
}

function uniqueContentTokens(value) {
  return [...new Set(contentTokens(value))];
}

export function summaryMostlyRestatesName(cleanName, summary) {
  const nameTokens = new Set(uniqueContentTokens(cleanName));
  const summaryTokens = uniqueContentTokens(summary);
  if (summaryTokens.length < 4) return false;
  const repeated = summaryTokens.filter((token) => nameTokens.has(token)).length;
  return repeated / summaryTokens.length >= 0.8;
}

export function hasRepeatedSummaryPhrase(summary) {
  const tokens = [...THAI_WORD_SEGMENTER.segment(String(summary ?? '').toLocaleLowerCase('th-TH'))]
    .filter((part) => part.isWordLike && part.segment.length > 1)
    .map((part) => part.segment);
  const seen = new Map();
  const phraseSize = 3;
  for (let index = 0; index <= tokens.length - phraseSize; index += 1) {
    const phrase = tokens.slice(index, index + phraseSize).join('|');
    const previous = seen.get(phrase);
    if (previous !== undefined && index - previous >= phraseSize) return true;
    if (previous === undefined) seen.set(phrase, index);
  }
  return false;
}

export function hasConflictingLayerCounts(cleanName, summary) {
  const getCounts = (value) => new Set([...String(value ?? '').matchAll(/(\d+)\s*ชั้น/giu)].map((match) => Number(match[1])));
  const nameCounts = getCounts(cleanName);
  const summaryCounts = getCounts(summary);
  return nameCounts.size > 0 && summaryCounts.size > 0 && ![...nameCounts].some((value) => summaryCounts.has(value));
}

export function hasConflictingUnitCounts(cleanName, summary) {
  const normalizeUnit = (unit) => /แพ/u.test(unit) ? 'แพ็ค' : unit.toLocaleLowerCase('en-US').replaceAll('.', '');
  const getCounts = (value) => {
    const counts = new Map();
    for (const match of String(value ?? '').matchAll(/(\d[\d,]*)\s*(แพ็ค|แพ็ก|แพค|ห่อ|ม้วน|ใบ|ชิ้น|ชุด|ด้าม|กล่อง|ลัง|คู่|mm|cm|มม\.?|ซม\.?)/giu)) {
      const unit = normalizeUnit(match[2]);
      if (!counts.has(unit)) counts.set(unit, new Set());
      counts.get(unit).add(Number(match[1].replaceAll(',', '')));
    }
    return counts;
  };
  const nameCounts = getCounts(cleanName);
  const summaryCounts = getCounts(summary);
  for (const [unit, values] of nameCounts) {
    const compared = summaryCounts.get(unit);
    if (compared?.size && ![...values].some((value) => compared.has(value))) return true;
  }
  return false;
}

export function hasBalancedPairs(value) {
  const expectedClosers = new Map([['(', ')'], ['[', ']'], ['【', '】']]);
  const openers = new Set(expectedClosers.keys());
  const closers = new Set(expectedClosers.values());
  const stack = [];
  for (const character of String(value ?? '')) {
    if (openers.has(character)) stack.push(expectedClosers.get(character));
    else if (closers.has(character) && stack.pop() !== character) return false;
  }
  return stack.length === 0;
}

const exactPathSet = (...paths) => new Set(paths);

const CATEGORY_RULES = Object.freeze([
  {
    key: 'automotive-accessories', label: 'รถและอุปกรณ์ดูแลรถ', quota: 75,
    exactPaths: exactPathSet(
      'Automobiles > Automotive Keychains & Key Covers > ',
      'Automobiles > Automobile Interior Accessories > Organizers & Compartments',
      'Automobiles > Automobile Interior Accessories > Carpets & Mats',
      'Automobiles > Automobile Interior Accessories > Phone Holders',
      'Automobiles > Automobile Interior Accessories > Sun Shields & Dash Covers',
      'Automobiles > Automotive Care > Wash & Waxes',
      'Automobiles > Automobile Exterior Accessories > Stickers, Logos & Emblems',
      'Motorcycles > Motorcycle Accessories > Stickers, Logos & Emblems',
    ),
    pattern: /(?:กุญแจ(?:รถ|ยนต์)|ฝาครอบกุญแจ|กล่องกุญแจ|ซองกุญแจ|เปลือกกุญแจ|เคสกุญแจ|พวงกุญแจ(?:รถ|ยนต์)?|กล่องจัดเก็บ[^\n]{0,30}รถ|กล่องเก็บ[^\n]{0,30}(?:รถ|ที่นั่ง)|ที่เก็บของ[^\n]{0,30}(?:รถ|ในรถ)|จัดระเบียบ[^\n]{0,30}รถ|ช่องว่างเบาะ|ช่องว่างที่นั่ง|seat\s*gap|กล่องทิชชู่[^\n]{0,30}รถ|ถังขยะ[^\n]{0,30}รถ|ที่แขวน[^\n]{0,30}รถ|ตะขอ[^\n]{0,30}รถ|พรม(?:ปูพื้น)?รถ|พรม[^\n]{0,20}eva|ที่วางโทรศัพท์[^\n]{0,30}รถ|ที่ยึด(?:โทรศัพท์|มือถือ)[^\n]{0,30}รถ|ม่านบังแดด|แผ่นบังแดด|ที่บังแดด|ผ้า(?:ไมโครไฟเบอร์|ชามัวร์|เช็ดรถ|ล้างรถ|ซับน้ำ|ซับน้ํา|นาโน)|ไมโครไฟเบอร์|ฟองน้ำล้างรถ|ฟองน้ําล้างรถ|ไม้ปัดฝุ่นรถ|microfib(?:er|re)|wash\s*mitt|car\s*(?:wash\s*(?:sponge|cloth|towel)|drying\s*towel)|สติ[ก๊]เกอร์(?:รถ|ติดรถ)?|โลโก้ติดรถ|ตราสัญลักษณ์[^\n]{0,20}รถ|car\s*(?:key|organizer|storage|mat|phone\s*holder|sun\s*shield|sunshade|sticker|tissue|trash)|key\s*(?:cover|case|holder|shell|chain)|(?:car|auto|automobile|motorcycle)[^\n]{0,50}(?:sticker|decal|emblem|badge)|(?:sticker|decal|emblem|badge)[^\n]{0,50}(?:car|auto|automobile|motorcycle))/iu,
    denyPattern: /(?:หมวกกันน็อค|เบรก|ยางรถ|แบต|ถ่าน|เครื่องยนต์|อะไหล่|ถุงลม|เข็มขัดนิรภัย|กระจกมอง|ไฟหน้า|ไฟท้าย|ท่อไอเสีย|ป้องกันการชน|น้ำมัน|น้ํามัน|เคมี|ล็อกกันขโมย|ตัวรีโมต|ตัวรีโมท|ชิป|วงจร|transponder|315\s*mhz|433\s*mhz|program(?:ming)?|copy\s*key|ใบมีด|\bblade\b|wireless|เครื่องดูด|vacuum|brake|tire|battery|engine|airbag|seat\s*belt|exhaust|collision)/iu,
    denySummaryPattern: /(?:สมุดบันทึก|ชั้นวางและชั้นวาง|แทงก์น้ํา|แทงก์น้ำ|วัสดุปล่อยความร้อน|ผลิตภัณฑ์นม|เหงื่อ|lower\s*อุณหภูมิ|ไขควง|screwdriver)/iu,
  },
  {
    key: 'manual-tools', label: 'เครื่องมือช่างและ DIY', quota: 120,
    exactPaths: exactPathSet('Home & Living > Tools & Home Improvement > Tools'),
    pattern: /(?:ไขควง|ประแจ|คีม|ค้อน|ตลับเมตร|สายวัด|ระดับน้ำ|ระดับน้ํา|แคลมป์|ปากกาจับชิ้นงาน|หกเหลี่ยม|ประแจแอล|ลูกบล็อก|กล่องเครื่องมือ|กระเป๋าเครื่องมือ|เกรียง|ชะแลง|เหล็กฉาก|screwdriver|wrench|pliers?|hammer|measuring\s*tape|spirit\s*level|clamp|hex\s*key|tool\s*(?:box|bag)|socket\s*set)/iu,
    denyPattern: /(?:สว่าน|เครื่องเจียร|เลื่อย|เครื่องมือตัด|อุปกรณ์ตัด|คีม[^\n]{0,18}ตัด|ปากตัด|ตัด(?:เซรามิ[คก]|กระจก|แก้ว|โมเสค)|ไร้สาย|นิวเมติก|เชื่อม|หัวแร้ง|เลเซอร์|ปืน|ไฟฉาย|ลองไฟ|วัดไฟ|ทดสอบไฟ|จับงู|คีมจับงู|ทุบเนื้อ|ทุบสเต็ก|ค้อนทุบเนื้อ|วัตต์|โวลต์|กันไฟ|หุ้มฉนวน|หางปลา|mc4|solar\s*cell|คีมย้ํา|คีมย้ำ|crimping|vde\s*1000\s*v?|1000\s*v|drill|grinder|rotary|chainsaw|weld|solder|laser|pneumatic|voltage|test\s*pen|cutting\s*tool|snake|meat\s*(?:hammer|tenderizer)|\bvolt\b|\bwatt\b)/iu,
    denySummaryPattern: /(?:หมวก|เสื้อ|กางเกง|รองเท้า|ถุงเท้า|ไหมพรม|\bsfera\b|จับงู|คีมจับงู|สัตว์เลี้ยง)/iu,
  },
  {
    key: 'books', label: 'หนังสือและสื่อการเรียนรู้', quota: 100,
    exactPaths: exactPathSet(
      'Books & Magazines > Books > Education & School',
      'Books & Magazines > Books > Comics & Manga',
      "Books & Magazines > Books > Children's Books",
      'Books & Magazines > Books > Careers, Self Help & Personal Development',
      'Books & Magazines > Books > Language Learning & Dictionaries',
      'Books & Magazines > Books > Romance',
      'Books & Magazines > Books > Religion & Philosophy',
      'Books & Magazines > Books > Politics, Law & Social Sciences',
      'Books & Magazines > Books > LGBTQ+ Literature',
      'Books & Magazines > Books > Business & Investment',
      'Books & Magazines > Books > Classic Literature',
      'Books & Magazines > Books > Sticker & Colouring Books',
      'Books & Magazines > Books > Fantasy',
      'Books & Magazines > Books > History & Cultures',
      'Books & Magazines > Books > Science & Maths',
      'Books & Magazines > Books > Action, Crime & Thrillers',
      'Books & Magazines > Books > Light Novels',
      'Books & Magazines > Books > Psychology & Relationships',
      'Books & Magazines > Books > Computers & Technology',
      'Books & Magazines > Books > Hobbies',
      'Books & Magazines > Books > Arts, Design & Photography',
      'Books & Magazines > Books > Recipes & Cooking',
      'Books & Magazines > Books > Biography & Memoirs',
      'Books & Magazines > Books > Travel & Tourism',
    ),
    pattern: /(?:หนังสือ|แบบฝึกหัด|คู่มือ|พจนานุกรม|นิยาย|การ์ตูน|มังงะ|สมุดระบายสี|workbook|textbook|dictionary|novel|manga|\bbook\b)/iu,
    denyPattern: /(?:e[-\s]?book|อีบุ๊ก|อีบุ๊ค|\bpdf\b|ไฟล์(?:หนังสือ|ดิจิทัล)?|ดาวน์โหลด|download|คอร์สออนไลน์|หนังสือเสียง|audiobook|สแกน(?:ไฟล์|เล่ม)|ลงทุน|การเงิน|เงินปันผล|หุ้น|ตลาดทุน|ตลาดหลักทรัพย์|พอร์ต|ความมั่งคั่ง|คริปโต|คริปโท|บิตคอยน์|เทรด|\bforex\b|\btrading\b|\binvestment\b|\bfinance\b|\bstock\s*market\b|\bdividend\b|\bwealth\b|psychology\s+of\s+money|\bbitcoin\b)/iu,
    denySummaryPattern: /(?:บําบัด|บำบัด|ลงทุน|การเงิน|เงินปันผล|หุ้น|ตลาดทุน|ตลาดหลักทรัพย์|พอร์ต|ความมั่งคั่ง|ไม่(?:ใช่|มี)ลิขสิทธิ์|ไม่ได้เป็นหนังสือ[^.!?\n]{0,70}(?:ทางการ|สำนักพิมพ์|สํานักพิมพ์)|\bunofficial\b|\bfinance\b|\binvestment\b|\bdividend\b|\bwealth\b)/iu,
  },
  {
    key: 'packaging-party', label: 'แพ็กสินค้าและงานปาร์ตี้', quota: 100,
    exactPaths: exactPathSet(
      'Stationery > Gift & Wrapping > Ribbons',
      'Stationery > Gift & Wrapping > Carton Boxes',
      'Stationery > Gift & Wrapping > Gift Bags',
      'Stationery > Gift & Wrapping > Gift Wrappers',
      'Stationery > Gift & Wrapping > Gift Boxes',
      'Stationery > Gift & Wrapping > Bubble Wraps',
      'Home & Living > Party Supplies > Backdrops & Banners',
      'Home & Living > Party Supplies > Disposable Tableware',
      'Home & Living > Party Supplies > Cards',
      'Home & Living > Party Supplies > Wooden Clips',
    ),
    pattern: /(?:ริบบิ้น|กล่อง(?:พัสดุ|ไปรษณีย์|ของขวัญ)|ถุงของขวัญ|กระดาษห่อ|บับเบิ้ล|บับเบิล|กันกระแทก|ฉากหลัง|ป้าย(?:งาน|ปาร์ตี้)|ธงราว|จานกระดาษ|แก้วกระดาษ|ช้อนส้อมพลาสติก|การ์ด(?:อวยพร|เชิญ)|ไม้หนีบ|ribbon|carton\s*box|gift\s*(?:bag|box|wrap)|bubble\s*wrap|backdrop|banner|paper\s*(?:plate|cup)|party\s*card|wooden\s*clip)/iu,
    denyPattern: /(?:ดอกไม้ไฟ|พลุ|ประทัด|เทียน|เปลวไฟ|แก๊ส|ก๊าซ|หลอดไฟ|firework|firecracker|candle|gas\b)/iu,
  },
  {
    key: 'bathroom-laundry', label: 'ห้องน้ำและซักล้าง', quota: 60,
    exactPaths: exactPathSet(
      'Home & Living > Bathrooms > Bathroom Racks & Cabinets',
      'Home & Living > Bathrooms > Soap Dispensers, Holders & Boxes',
      'Home & Living > Bathrooms > Shower Curtains',
      'Home & Living > Home Care Supplies > Clotheslines & Drying Racks',
      'Home & Living > Home Care Supplies > Basins, Buckets & Water Dippers',
    ),
    pattern: /(?:ชั้นวาง[^\n]{0,25}ห้องน้ำ|ตู้[^\n]{0,20}ห้องน้ำ|ที่วางสบู่|กล่องสบู่|ขวดปั๊ม|ที่กดสบู่|ม่านห้องน้ำ|ม่านอาบน้ำ|ราวตากผ้า|เชือกตากผ้า|กะละมัง|ถังน้ำ|ขันน้ำ|bathroom\s*(?:rack|cabinet)|soap\s*(?:dispenser|holder|box)|shower\s*curtain|clothesline|drying\s*rack|basin|bucket|water\s*dipper)/iu,
    denyPattern: /(?:น้ำย|น้ําย|ผงซัก|ฟอกขาว|ฆ่าเชื้อ|เคมี|detergent|bleach|chemical)/iu,
    denySummaryPattern: /(?:ห้องครัว|ใส่อาหาร|ผสมแป้ง|เตรียมอาหาร|food\s*(?:mix|prep)|\bkitchen\b)/iu,
  },
  {
    key: 'camping-outdoor', label: 'แคมป์ปิงและกลางแจ้ง', quota: 60,
    exactPaths: exactPathSet(
      'Sports & Outdoors > Sports & Outdoor Recreation Equipments > Camping & Hiking',
      'Sports & Outdoors > Sports & Outdoor Accessories > Umbrellas',
      'Sports & Outdoors > Sports & Outdoor Accessories > Rain Coats',
      'Sports & Outdoors > Sports & Outdoor Accessories > Dry Bags',
      'Home & Living > Tools & Home Improvement > Shades, Awnings & Tarpaulins',
    ),
    pattern: /(?:เต็นท์|ฟลายชีท|ผ้าใบ|เสื่อปิกนิก|โต๊ะแคมป์|เก้าอี้แคมป์|กระเป๋ากันน้ำ|ถุงกันน้ำ|ร่ม(?:พับ|สนาม|กันฝน)?|เสื้อกันฝน|สมอบก|หมุดเต็นท์|เชือกเต็นท์|tent\b|flysheet|tarpaulin|picnic\s*mat|camping\s*(?:table|chair)|dry\s*bag|umbrella|rain\s*coat|tent\s*(?:peg|rope))/iu,
    denyPattern: /(?:เตา|แก๊ส|ก๊าซ|เชื้อเพลิง|มีด|ขวาน|เลื่อย|ไฟฉาย|ตะเกียง|หัวพ่นไฟ|stove|gas\b|fuel|knife|axe|saw\b|torch|lantern)/iu,
  },
  {
    key: 'home-decor', label: 'ของแต่งบ้าน', quota: 90,
    exactPaths: exactPathSet(
      'Home & Living > Decoration > Flowers',
      'Home & Living > Decoration > Photo Frames & Wall Decoration',
      'Home & Living > Decoration > Wallpapers & Wall Stickers',
      'Home & Living > Decoration > Vases & Vessels',
      'Home & Living > Decoration > Mirrors',
    ),
    pattern: /(?:ดอกไม้(?:ประดิษฐ์|ปลอม)|กรอบรูป|ของแต่งผนัง|ตกแต่งผนัง|วอลล์เปเปอร์|สติกเกอร์(?:ติด)?ผนัง|แจกัน|กระจกแต่งบ้าน|artificial\s*flower|photo\s*frame|wall\s*(?:decor|sticker|paper)|wallpaper|vase|decorative\s*mirror)/iu,
    denyPattern: /(?:ต้นไม้จริง|ดอกไม้สด|มีราก|เมล็ด|เทียน|น้ำหอม|น้ําหอม|หลอดไฟ|ไฟตกแต่ง|live\s*plant|fresh\s*flower|candle|fragrance|lamp|\bled\b)/iu,
  },
  {
    key: 'device-accessories', label: 'อุปกรณ์มือถือและคอมพิวเตอร์แบบไม่ใช้ไฟ', quota: 70,
    exactPaths: exactPathSet(
      'Mobile & Gadgets > Accessories > Cases, Covers, & Skins',
      'Mobile & Gadgets > Accessories > Phone Straps & Keychains',
      'Mobile & Gadgets > Accessories > Phone Grips',
      'Mobile & Gadgets > Accessories > Mobile Pouches',
      'Mobile & Gadgets > Accessories > Stylus',
      'Computers & Accessories > Peripherals & Accessories > Mouse Pads',
      'Computers & Accessories > Peripherals & Accessories > Laptop Stands & Foldable Laptop Desks',
      'Computers & Accessories > Peripherals & Accessories > Laptop Skins & Covers',
      'Computers & Accessories > Peripherals & Accessories > Keyboard & Trackpad Covers',
    ),
    pattern: /(?:เคส(?:มือถือ|โทรศัพท์|แท็บเล็ต|ไอแพด|iphone|ipad)|ซอง(?:มือถือ|โทรศัพท์|โน้ตบุ๊ก|แล็ปท็อป)|สายคล้อง(?:มือถือ|โทรศัพท์)|พวงกุญแจโทรศัพท์|ที่จับโทรศัพท์|กริ๊ปโทรศัพท์|ปากกา(?:ทัชสกรีน|สไตลัส)|เมาส์แพด|แผ่นรองเมาส์|แท่นวาง(?:โน้ตบุ๊ก|แล็ปท็อป)|โต๊ะวางโน้ตบุ๊ก|สกินโน้ตบุ๊ก|แผ่นคลุมคีย์บอร์ด|phone\s*(?:case|cover|strap|grip|pouch)|mobile\s*(?:case|pouch)|stylus|mouse\s*pad|laptop\s*(?:stand|desk|skin|cover|sleeve)|keyboard\s*cover)/iu,
    denyPattern: /(?:แบต|ชาร์จ|สายชาร์จ|สายไฟ|ปลั๊ก|ยูเอสบี|\busb\b|หลอดไฟ|พัดลม|ลำโพง|ลําโพง|หูฟัง|บลูทูธ|bluetooth|battery|charger|cable|adapter|power\s*bank|speaker|earphone|headphone)/iu,
  },
  { key: 'pet-accessories', label: 'อุปกรณ์สัตว์เลี้ยง', pathPattern: /(?:(?:pet\s+accessories)\s*>\s*(?:bowls?\s*&?\s*feeders?|pet\s+furniture|toys?|travel\s+essentials)|(?:litter\s*&?\s*toilet)\s*>\s*(?:cat\s+litter\s*&?\s*boxes?|dog\s+training\s+pads?\s*&?\s*trays?|poop\s+bags?\s*&?\s*scoopers?))/iu, pattern: /(?:ชาม(?:อาหาร|น้ำ)(?:สุนัข|แมว|สัตว์)?|ของเล่น(?:แมว|สุนัข|สัตว์เลี้ยง)|กระบะทราย|ที่ตักทราย|แผ่นรองฉี่|ถุงเก็บมูล|แปรงขนสัตว์|ที่ลับเล็บ|เบาะสัตว์|pet\s*(?:bowl|toy|bed)|litter\s*(?:mat|scoop)|poop\s*bag|scratcher)/iu, quota: 50 },
  {
    key: 'travel', label: 'กระเป๋าและอุปกรณ์เดินทาง', quota: 50,
    exactPaths: exactPathSet(
      'Travel & Luggage > Travel Accessories > Travel Organizers',
      'Travel & Luggage > Travel Accessories > Luggage Tags',
      'Travel & Luggage > Travel Accessories > Passport Holders & Covers',
    ),
    pattern: /(?:กระเป๋าจัดระเบียบ(?:เดินทาง)?|ถุงจัดกระเป๋า|ถุงแยกเสื้อผ้า|ถุงใส่รองเท้า|กระเป๋าใส่อุปกรณ์อาบน้ำ|กระเป๋าใส่อุปกรณ์อาบน้ํา|ป้ายกระเป๋า|ป้ายชื่อกระเป๋า|ซองพาสปอร์ต|ซองหนังสือเดินทาง|packing\s*cube|travel\s*organizer|luggage\s*tag|toiletry\s*(?:bag|pouch)|wash\s*bag|dopp\s*kit|passport\s*(?:holder|cover)|shoe\s*bag)/iu,
    denyPattern: /(?:ขวด|ของเหลว|liquid|bottle|อิเล็กทรอนิกส์|สายเคเบิล|electronics?|cable|charger|rfid)/iu,
  },
  { key: 'stationery', label: 'เครื่องเขียนและงานฝีมือ', pathPattern: /(?:stationery|school\s*&?\s*office\s+supplies|arts?\s*&?\s*crafts?)/iu, pattern: /(?:ปากกา|ดินสอ|สมุด|สติกเกอร์|เทป(?:ใส|กาว|กระดาษ|สองหน้า|นาโน)?|คลิปหนีบ|ซองเอกสาร|แฟ้ม|กระดาษ(?:A4|ถ่ายเอกสาร|โน้ต|สี|ห่อ|การ์ด)|พู่กัน|สีไม้|ยางลบ|ไม้บรรทัด|ตรายาง|ที่คั่นหนังสือ|ซองจดหมาย|label|notebook|memo\s*pad|pen\b|pencil|sticker|adhesive\s*tape|folder|envelope|paper\s*(?:clip|bag)|stamp|\bcraft\s*(?:paper|kit|supplies?)\b)/iu, quota: 100 },
  { key: 'kitchen', label: 'ครัวและโต๊ะอาหาร', pathPattern: /(?:kitchenware|dinnerware)/iu, pattern: /(?:กล่อง(?:ถนอม|เก็บ)?อาหาร|กล่องข้าว|ปิ่นโต|จาน|ชาม|แก้วน้ำ|ถ้วย|ช้อน|ส้อม|ตะเกียบ|ตะหลิว|ทัพพี|ที่คีบ|ถาด|ตะแกรง(?:ล้างผัก|นึ่ง|พัก|กรอง|วางจาน|ครัว)|กระชอน|ขวดน้ำ|เหยือก|ที่รองแก้ว|ที่เปิดขวด|แม่พิมพ์ซิลิโคน|ฝาครอบอาหาร|food\s*container|lunch\s*box|bowl\b|cup\b|tray\b|spoon|fork\b|chopstick|coaster|silicone\s*mold)/iu, denyPattern: /(?:แก้วตวงสี|ถ้วยตวงสี|ผสมสี|พ่นสี|paint\s*mix|เรซิ่น|resin|ทําเทียน|ทำเทียน|ทําสบู่|ทำสบู่|แฮนด์เมด|handmade|เบ้าหลอม|หลอมโลหะ|โลหะหลอม|crucible|molten\s*metal)/iu, quota: 140 },
  { key: 'cleaning', label: 'อุปกรณ์ทำความสะอาด', pathPattern: /(?:home\s+care\s+supplies|cleaning\s+supplies|household\s+supplies)/iu, pattern: /(?:ทิชชู|กระดาษชำระ|กระดาษชําระ|แปรง(?:ขัด|ล้าง|ทำความสะอาด)|ผ้าไมโครไฟเบอร์|ผ้าเช็ดทำความสะอาด|ไม้กวาด|ไม้ถูพื้น|ลูกกลิ้งเก็บฝุ่น|ฟองน้ำ|ที่โกยผง|ไม้ปาดน้ำ|ถุงขยะ|ถุงมือทำความสะอาด|แผ่นใยขัด|duster|cleaning\s*brush|scrub\s*brush|microfiber\s*cloth|mop\b|sponge|lint\s*roller|squeegee|dustpan|trash\s*bag)/iu, denyPattern: /(?:decoupage|party\s*decor|งานปาร์ตี้|งานฝีมือ)/iu, quota: 140 },
  { key: 'garden', label: 'สวนและกิจกรรมกลางแจ้ง', pathPattern: /(?:gardening\s*>\s*(?:garden\s+decorations?|pots?\s*&?\s*planters?))/iu, pattern: /(?:กระถาง|บัวรดน้ำ|ถุงมือทำสวน|เชือก(?:อเนกประสงค์|ปอ|ไนลอน|เต็นท์)|คลิปต้นไม้|ตาข่ายต้นไม้|ผ้าใบ|หมุดเต็นท์|plant\s*pot|watering\s*can|garden\s*glove|plant\s*clip|garden\s*net|tarpaulin|tent\s*(?:peg|rope))/iu, denyPattern: /(?:ต้นบัว|ต้นไม้จริง|ต้นดอก|ต้นกุหลาบ|พร้อมต้น|หัวพันธุ์|มากกว่า\s*\d+\s*หัว|อาหารพืช|ปุ๋ย|fertili[sz]er)/iu, quota: 35 },
  { key: 'home-textile', label: 'ของใช้ในบ้านและสิ่งทอ', pathPattern: /(?:bedding|bathrooms?\s*>\s*(?:towels?|shower\s+curtains?)|decoration\s*>\s*(?:carpets?|floor\s*mats?|curtains?|table\s*cloths?))/iu, pattern: /(?:ผ้าขนหนู|ผ้าเช็ดมือ|พรม|เสื่อ|ปลอกหมอน|ผ้าปูโต๊ะ|ม่าน|ที่รองจาน|ผ้ากันเปื้อน|ไม้แขวนเสื้อ|ราวตากผ้า|towel|doormat|floor\s*mat|curtain|pillowcase|tablecloth|placemat|apron|clothes\s*hanger|drying\s*rack)/iu, denyPattern: /(?:หมอนเพื่?อสุขภาพ|ช่วยให้เด็ก[^.!?\n]{0,25}นอนหลับ|เสื้อคลุม(?:อาบน้ำ|อาบน้ํา)|bath\s*robe|bathrobe|ผ้าเย็น|cold\s*towel|\bbiore\b)/iu, quota: 90 },
  { key: 'organizing', label: 'อุปกรณ์จัดระเบียบและจัดเก็บ', pathPattern: /(?:home\s+organizers?|desk\s+organizers?|hangers?\s*&?\s*pegs?|hooks?|jewelry\s+organizers?|laundry\s+bags?\s*&?\s*baskets?|shoe\s+storage\s+boxes?|storage\s+boxes?\s*,?\s*bags?\s*&?\s*baskets?|tissue\s+holders?|wardrobe\s+organizers?)/iu, pattern: /(?:กล่อง(?:จัดเก็บ|เก็บของ|อเนกประสงค์|ลิ้นชัก|รองเท้า)|ตะกร้าจัดเก็บ|ชั้นวาง|ที่แขวน|ตะขอ|ที่ใส่(?:ของ|ทิชชู่|รีโมท|สายไฟ)|ถุงสูญญากาศ|ถุงซิป|กล่องแบ่งช่อง|ที่จัดระเบียบ|organizer|storage\s*(?:box|bag|basket)|drawer\s*(?:box|divider)|rack\b|hook\b|holder\b|vacuum\s*bag|zip\s*bag)/iu, quota: 160 },
]);

export const CATALOG_CATEGORY_DEFINITIONS = Object.freeze(CATEGORY_RULES.map(({ key, label, quota }) => Object.freeze({ key, label, quota })));

const PRODUCT_FAMILY_PATTERNS = Object.freeze({
  'automotive-accessories': /(?:กุญแจ|พวงกุญแจ|key(?:less|chain|\s*(?:cover|case|holder|shell))?|จัดระเบียบ[^\n]{0,25}รถ|ที่เก็บของ[^\n]{0,25}รถ|กล่องเก็บ[^\n]{0,25}(?:รถ|ที่นั่ง)|ช่องว่าง(?:เบาะ|ที่นั่ง)|seat\s*gap|กล่องทิชชู่|ถังขยะ|ที่แขวน|ตะขอ|พรม(?:ปูพื้น)?รถ|eva\s*mat|ผ้า(?:ไมโครไฟเบอร์|ชามัวร์|เช็ดรถ|ล้างรถ|ซับน้ำ|ซับน้ํา|นาโน)|ไมโครไฟเบอร์|microfib(?:er|re)|wash\s*mitt|ฟองน้ำล้างรถ|ฟองน้ําล้างรถ|ไม้ปัดฝุ่นรถ|car\s*(?:organizer|storage|mat|tissue|trash|wash|drying\s*towel)|ที่วาง(?:โทรศัพท์|มือถือ)|ที่ยึด(?:โทรศัพท์|มือถือ)|phone\s*holder|บังแดด|sun(?:shade|\s*shield)|สติ[ก๊]เกอร์|โลโก้|ตราสัญลักษณ์|sticker|decal|badge|logo|emblem|รถยนต์|รถจักรยานยนต์|automobile|motorcycle)/iu,
  'manual-tools': /(?:ไขควง|screwdriver|ประแจ|wrench|คีม|plier|ค้อน|hammer|ตลับเมตร|สายวัด|measuring\s*tape|ระดับน้ำ|ระดับน้ํา|spirit\s*level|แคลมป์|clamp|ปากกาจับชิ้นงาน|หกเหลี่ยม|hex|ลูกบล็อก|socket|กล่องเครื่องมือ|กระเป๋าเครื่องมือ|tool\s*(?:box|bag)|เกรียง|ชะแลง|เหล็ก|steel|chrome\s*vanadium|fiberglass)/iu,
  books: /(?:หนังสือ|book|เล่ม|หน้า|ผู้เขียน|สำนักพิมพ์|สํานักพิมพ์|\bisbn\b|ปก(?:อ่อน|แข็ง)|แบบฝึกหัด|workbook|textbook|นิยาย|novel|การ์ตูน|manga|พจนานุกรม|dictionary|เนื้อหาในเล่ม)/iu,
  'packaging-party': /(?:กล่อง(?:พัสดุ|ไปรษณีย์|ของขวัญ)|carton\s*box|gift\s*box|ถุงของขวัญ|gift\s*bag|ริบบิ้น|ribbon|กระดาษห่อ|gift\s*wrap|บับเบิ้ล|บับเบิล|bubble\s*wrap|กันกระแทก|ฉากหลัง|backdrop|ป้าย(?:งาน|ปาร์ตี้)|banner|จานกระดาษ|แก้วกระดาษ|paper\s*(?:plate|cup)|การ์ด(?:อวยพร|เชิญ)|greeting\s*card|ไม้หนีบ|wooden\s*clip|บรรจุภัณฑ์|แพ็ก|แพ็ค)/iu,
  'bathroom-laundry': /(?:ห้องน้ำ|ห้องน้ํา|bathroom|ชั้นวาง|ตู้|rack|cabinet|สบู่|soap|ม่าน(?:ห้องน้ำ|ห้องน้ํา|อาบน้ำ|อาบน้ํา)|shower\s*curtain|ราวตากผ้า|เชือกตากผ้า|clothesline|drying\s*rack|กะละมัง|basin|ถังน้ำ|ถังน้ํา|bucket|ขันน้ำ|ขันน้ํา|water\s*dipper)/iu,
  'camping-outdoor': /(?:เต็นท์|tent|ฟลายชีท|flysheet|ผ้าใบ|tarpaulin|ปิกนิก|picnic|แคมป์|camping|กระเป๋ากันน้ำ|กระเป๋ากันน้ํา|ถุงกันน้ำ|ถุงกันน้ํา|dry\s*bag|ร่ม|umbrella|เสื้อกันฝน|rain\s*coat|สมอบก|หมุดเต็นท์|เชือกเต็นท์)/iu,
  'home-decor': /(?:ดอกไม้ประดิษฐ์|ดอกไม้ปลอม|artificial\s*flower|กรอบรูป|photo\s*frame|แต่งผนัง|ตกแต่งผนัง|wall\s*decor|วอลล์เปเปอร์|wallpaper|สติ[ก๊]เกอร์ผนัง|wall\s*sticker|แจกัน|vase|กระจกแต่งบ้าน|decorative\s*mirror|ของแต่งบ้าน)/iu,
  'device-accessories': /(?:เคส|case|cover|ซอง|pouch|sleeve|สายคล้อง|strap|ที่จับโทรศัพท์|กริ๊ปโทรศัพท์|phone\s*grip|ปากกา(?:ทัชสกรีน|สไตลัส)|stylus|เมาส์แพด|แผ่นรองเมาส์|mouse\s*pad|แท่นวาง(?:โน้ตบุ๊ก|แล็ปท็อป)|laptop\s*(?:stand|desk|skin|cover)|สกินโน้ตบุ๊ก|แผ่นคลุมคีย์บอร์ด|keyboard\s*cover|โทรศัพท์|phone|iphone|ipad|แท็บเล็ต|tablet|โน้ตบุ๊ก|laptop)/iu,
  'pet-accessories': /(?:สัตว์เลี้ยง|pet|แมว|cat|สุนัข|dog|ชาม(?:อาหาร|น้ำ|น้ํา)|bowl|ของเล่น|toy|กระบะทราย|litter|ที่ตักทราย|scoop|แผ่นรองฉี่|training\s*pad|ถุงเก็บมูล|poop\s*bag|แปรงขน|ที่ลับเล็บ|scratcher|เบาะสัตว์)/iu,
  travel: /(?:เดินทาง|travel|กระเป๋าจัดระเบียบ|organizer|packing\s*cube|ถุงจัดกระเป๋า|ถุงแยกเสื้อผ้า|ถุงใส่รองเท้า|shoe\s*bag|กระเป๋าใส่อุปกรณ์อาบน้ำ|กระเป๋าใส่อุปกรณ์อาบน้ํา|toiletry\s*(?:bag|pouch)|wash\s*bag|dopp\s*kit|ป้ายกระเป๋า|ป้ายชื่อ|luggage\s*tag|พาสปอร์ต|หนังสือเดินทาง|passport|สัมภาระ|luggage|กระเป๋า|bag|pouch|ช่อง|ซิป|เอกสาร|บัตร)/iu,
  stationery: /(?:ปากกา|pen\b|ดินสอ|pencil|สมุด|notebook|memo|สติ[ก๊]เกอร์|sticker|label|เทป|tape|คลิปหนีบ|paper\s*clip|ซองเอกสาร|ซองจดหมาย|envelope|แฟ้ม|folder|กระดาษ|paper|พู่กัน|paint\s*brush|สีไม้|color\s*pencil|ยางลบ|eraser|ไม้บรรทัด|ruler|ตรายาง|stamp|เครื่องเขียน|stationery)/iu,
  kitchen: /(?:กล่อง(?:ถนอม|เก็บ)?อาหาร|food\s*container|กล่องข้าว|lunch\s*box|ปิ่นโต|จาน|plate|ชาม|bowl|แก้ว|cup|ถ้วย|ช้อน|spoon|ส้อม|fork|ตะเกียบ|chopstick|ตะหลิว|spatula|ทัพพี|ที่คีบ|tongs?|ถาด|tray|ตะแกรง|กระชอน|strainer|ขวดน้ำ|ขวดน้ํา|water\s*bottle|เหยือก|pitcher|ที่รองแก้ว|coaster|แม่พิมพ์|mold|ฝาครอบอาหาร|food\s*cover|ครัว|kitchen)/iu,
  cleaning: /(?:ทิชชู|กระดาษชำระ|กระดาษชําระ|tissue|paper\s*towel|แปรง(?:ขัด|ล้าง|ทำความสะอาด)|cleaning\s*brush|scrub\s*brush|ไมโครไฟเบอร์|microfiber|ผ้าเช็ด|cleaning\s*cloth|ไม้กวาด|broom|ไม้ถูพื้น|ม็อบ|ม๊อบ|mop\b|ลูกกลิ้งเก็บฝุ่น|lint\s*roller|ฟองน้ำ|ฟองน้ํา|sponge|ที่โกยผง|dustpan|ไม้ปาดน้ำ|ไม้ปาดน้ํา|squeegee|ถุงขยะ|trash\s*bag|ทำความสะอาด|ทําความสะอาด|cleaning)/iu,
  garden: /(?:กระถาง|plant\s*pot|planter|บัวรดน้ำ|บัวรดน้ํา|watering\s*can|ถุงมือทำสวน|ถุงมือทําสวน|garden\s*glove|คลิปต้นไม้|plant\s*clip|ตาข่ายต้นไม้|garden\s*net|สวน|garden)/iu,
  'home-textile': /(?:ผ้าขนหนู|towel|ผ้าเช็ดมือ|พรม|rug|carpet|doormat|เสื่อ|mat\b|ปลอกหมอน|pillowcase|ผ้าปู|bedsheet|tablecloth|ม่าน|curtain|ที่รองจาน|placemat|ผ้ากันเปื้อน|apron|ไม้แขวนเสื้อ|clothes\s*hanger|ราวตากผ้า|drying\s*rack|ผ้า|fabric|textile)/iu,
  organizing: /(?:จัดระเบียบ|organizer|จัดเก็บ|storage|กล่อง(?:เก็บของ|จัดเก็บ|อเนกประสงค์|ลิ้นชัก|รองเท้า)|box|ตะกร้า|basket|ชั้นวาง|rack|ที่แขวน|ตะขอ|hook|holder|ถุงสูญญากาศ|vacuum\s*bag|ถุงซิป|zip\s*bag|กล่องแบ่งช่อง|drawer\s*divider)/iu,
});

// Category-level matching alone cannot distinguish a phone case from a phone
// strap. When both title and summary name a concrete device subfamily, require
// them to name the same one; material-only summaries still use the shared-token
// fallback below.
const DEVICE_SUBFAMILY_PATTERNS = Object.freeze([
  /(?:เคส|case|cover|skin)/iu,
  /(?:สายคล้อง|strap|crossbody|strapcard|พวงกุญแจ|keychain)/iu,
  /(?:ที่จับโทรศัพท์|กริ๊ปโทรศัพท์|phone\s*grip)/iu,
  /(?:ปากกา(?:ทัชสกรีน|สไตลัส)|stylus)/iu,
  /(?:เมาส์แพด|แผ่นรองเมาส์|mouse\s*pad)/iu,
  /(?:แท่นวาง|โต๊ะวาง|laptop\s*(?:stand|desk))/iu,
  /(?:แผ่นคลุมคีย์บอร์ด|keyboard\s*cover)/iu,
]);

// A broad "book" token is not enough to prove that a summary belongs to the
// same physical title. If both sides contain a strong subject-domain signal,
// require at least one shared domain (for example art cannot summarize recipes).
const BOOK_DOMAIN_PATTERNS = Object.freeze([
  /(?:สูตรอาหาร|ทําอาหาร|ทำอาหาร|ทําขนม|ทำขนม|อาหาร|ครัว|recipe|cooking|cookbook)/iu,
  /(?:ศิลปะ|จิตรกรรม|เครื่องถ้วย|วาดภาพ|ออกแบบ|art\b|design|photograph)/iu,
  /(?:ภาษา(?:อังกฤษ|จีน|ญี่ปุ่น|เกาหลี|ไทย)|english|chinese|japanese|grammar|reading|hsk|toeic|ielts)/iu,
  /(?:กฎหมาย|รัฐศาสตร์|การเมือง|ท้องถิ่น|ราชการ|\blaw\b|politic)/iu,
  /(?:วิทยาศาสตร์|คณิตศาสตร์|ฟิสิกส์|เคมี|ชีววิทยา|science|math)/iu,
  /(?:นิยาย|การ์ตูน|มังงะ|วรรณกรรม|manga|novel|comic)/iu,
  /(?:นิทาน|หนังสือเด็ก|แบบฝึกหัดเด็ก|children|storybook|jigsaw)/iu,
  /(?:ศาสนา|พุทธ|ธรรมะ|พระไตรปิฎก|religion|buddh)/iu,
  /(?:พัฒนาตน|จิตวิทยา|ความสัมพันธ์|self[-\s]?help|psychology|relationship)/iu,
  /(?:ประวัติศาสตร์|ชีวประวัติ|history|biograph|memoir)/iu,
]);

const AUTO_SUBFAMILY_RULES = Object.freeze([
  {
    title: /(?:(?:เคส|ปลอก|ฝาครอบ|ซอง|กระเป๋าใส่|กล่อง|เปลือก)[^\n]{0,30}(?:กุญแจ|key)|(?:พวงกุญแจ|keychain)|key\s*(?:case|cover|holder|shell))/iu,
    summary: /(?:(?:เคส|ปลอก|ฝาครอบ|ซอง|กระเป๋าใส่|กล่อง|เปลือก)[^\n]{0,30}(?:กุญแจ|key)|(?:พวงกุญแจ|keychain)|key\s*(?:case|cover|holder|shell))/iu,
  },
  {
    title: /(?:พรม(?:ปูพื้น)?รถ|ผ้ายางปูพื้น|car\s*mat)/iu,
    summary: /(?:พรม|mat|eva|tpe|ยาง|หนัง|ฟองน้ำ|ฟองน้ํา|เข้ารูป|พื้นรถ|ห้องโดยสาร|ล้าง|ทําความสะอาด|ทำความสะอาด)/iu,
  },
  {
    title: /(?:จัดระเบียบ|ที่เก็บ|กล่องเก็บ|กระเป๋าเก็บ|ถังขยะ|กล่องทิชชู่|ตะขอ|ที่แขวน|organizer|storage|seat\s*gap)/iu,
    summary: /(?:จัดเก็บ|หลายช่อง|เบาะ|ท้ายรถ|คอนโซล|ในรถ|รถยนต์|ยานพาหนะ|ตะขอ|แขวน|ถังขยะ|ทิชชู่|ช่องว่างที่นั่ง|organizer|storage)/iu,
  },
  {
    title: /(?:ที่วาง(?:โทรศัพท์|มือถือ)|ที่ยึด(?:โทรศัพท์|มือถือ)|phone\s*holder|mount)/iu,
    summary: /(?:ที่วาง|ที่ยึด|holder|mount|360|dashboard|แผงหน้าปัด|กระจก|ซิลิโคน|โทรศัพท์|มือถือ)/iu,
  },
  {
    title: /(?:บังแดด|sunshade|sun\s*shield)/iu,
    summary: /(?:บังแดด|sunshade|sun\s*shield|อลูมิเนียมฟอยล์|oxford|กระจกหน้า|พับ)/iu,
  },
  {
    title: /(?:สติ[ก๊]เกอร์|sticker|decal|logo|emblem|badge|ตราสัญลักษณ์)/iu,
    summary: /(?:สติ[ก๊]เกอร์|sticker|decal|logo|emblem|badge|ตราสัญลักษณ์|รูปลอก|กาว)/iu,
  },
  {
    title: /(?:ผ้า(?:ไมโครไฟเบอร์|ชามัวร์|เช็ดรถ|ล้างรถ|ซับน้ำ|ซับน้ํา|นาโน)|ไมโครไฟเบอร์|microfib(?:er|re)|wash\s*mitt|ฟองน้ำล้างรถ|ฟองน้ําล้างรถ|ไม้ปัดฝุ่นรถ|car\s*(?:wash|drying\s*towel))/iu,
    summary: /(?:ผ้า|ไมโครไฟเบอร์|microfib(?:er|re)|ชามัวร์|wash\s*mitt|ฟองน้ำ|ฟองน้ํา|sponge|ไม้ปัดฝุ่น|duster|เช็ด|ล้างรถ|ซับน้ำ|ซับน้ํา)/iu,
  },
]);

const SUMMARY_BAD_START = /^(?:[+<>■□◆►▶●•~>"'/]|\d+\s*\/|และ|หรือ|แต่|ซึ่ง|โดย|เพราะ|หาก|ถ้า|เรา|ร้าน(?:ค้า)?|ให้คุณ|นอกจากนี้|อีกทั้ง|ประการที่(?:หนึ่ง|สอง|สาม|สี่|\d+))/iu;
const SUMMARY_BAD_END = /(?:และ|และ\s*!|ใน|แม้คุณ|พ\.ศ\.|ส่วนที่ติด|ตัวอย่างเช่น|จะได้เรียนรู้|เหมาะ(?:สําหรับ|สำหรับ)|ช่วยให้(?:เด็กๆ|คุณ|ผู้ใช้|ผู้อ่าน)|ให้คุณ|แก่คุณ|สูง\s+ได้|การเรียก|การเก็บรักษา|วิธีใช้|คุณสมบัติ|คู่มือการ|(?:กล่องเก็บ|จำนวน|จํานวน)\s*\d+|ของ|ที่|โดย|เพื่อ|จาก|กับ|คือ|เรียกว่า|สุด|ฯลฯ|[/×:&+;,\-]|\.{2,})\s*[.!]?$/iu;
const SEMANTIC_STOPWORDS = new Set(['และ', 'หรือ', 'ของ', 'ที่', 'ใน', 'จาก', 'กับ', 'โดย', 'เพื่อ', 'เป็น', 'มี', 'ได้', 'ให้', 'ใช้', 'ใส่', 'แบบ', 'ขนาด', 'วัสดุ', 'ผลิต', 'สินค้า', 'สำหรับ', 'สําหรับ', 'สามารถ', 'เหมาะ', 'ทั่วไป', 'อเนกประสงค์', 'ออกแบบ', 'ความ', 'คุณ', 'ผู้ใช้']);
const DOMINANT_TOKEN_STOPWORDS = new Set([...SEMANTIC_STOPWORDS, 'ผลิตภัณฑ์', 'หนังสือ', 'กระเป๋า', 'กล่อง', 'ชิ้น', 'ชุด', 'รุ่น']);

export function hasDominantSummaryToken(summary) {
  const tokens = contentTokens(summary)
    .filter((token) => token.length >= 3 && !/^\d+(?:[.,]\d+)*$/u.test(token) && !DOMINANT_TOKEN_STOPWORDS.has(token));
  if (tokens.length < 8) return false;
  const counts = tokens.reduce((map, token) => map.set(token, (map.get(token) ?? 0) + 1), new Map());
  const maximum = Math.max(0, ...counts.values());
  return maximum >= 4 && maximum / tokens.length >= 0.25;
}

export function summaryMatchesProductFamily(categoryKey, cleanName, summary) {
  const assignedPattern = PRODUCT_FAMILY_PATTERNS[categoryKey];
  if (!assignedPattern || SUMMARY_BAD_START.test(summary) || SUMMARY_BAD_END.test(summary)) return false;
  if (!assignedPattern.test(cleanName)) return false;
  let matchedConcreteFamily = false;
  if (categoryKey === 'automotive-accessories') {
    const titleRules = AUTO_SUBFAMILY_RULES.filter((rule) => rule.title.test(cleanName));
    if (!titleRules.length || !titleRules.some((rule) => rule.summary.test(summary))) return false;
    matchedConcreteFamily = true;
  }
  if (categoryKey === 'device-accessories') {
    const nameFamilies = DEVICE_SUBFAMILY_PATTERNS.map((pattern, index) => pattern.test(cleanName) ? index : -1).filter((index) => index >= 0);
    const summaryFamilies = DEVICE_SUBFAMILY_PATTERNS.map((pattern, index) => pattern.test(summary) ? index : -1).filter((index) => index >= 0);
    if (nameFamilies.length && summaryFamilies.length && !nameFamilies.some((index) => summaryFamilies.includes(index))) return false;
  }
  if (categoryKey === 'books') {
    const nameDomains = BOOK_DOMAIN_PATTERNS.map((pattern, index) => pattern.test(cleanName) ? index : -1).filter((index) => index >= 0);
    const summaryDomains = BOOK_DOMAIN_PATTERNS.map((pattern, index) => pattern.test(summary) ? index : -1).filter((index) => index >= 0);
    if (nameDomains.length && summaryDomains.length && !nameDomains.some((index) => summaryDomains.includes(index))) return false;
  }
  if (categoryKey === 'bathroom-laundry' && /(?:ห้องครัว|ใส่อาหาร|ผสมแป้ง|เตรียมอาหาร|food\s*(?:mix|prep)|\bkitchen\b)/iu.test(summary)) return false;
  const nameTokens = new Set(uniqueContentTokens(cleanName).filter((token) => token.length >= 3 && !SEMANTIC_STOPWORDS.has(token)));
  const sharedInformative = uniqueContentTokens(summary).filter((token) => token.length >= 3 && !SEMANTIC_STOPWORDS.has(token) && nameTokens.has(token));
  return matchedConcreteFamily || assignedPattern.test(summary) || sharedInformative.length >= 2;
}

export class MinHeap {
  constructor(capacity, compare = (a, b) => a.score - b.score) {
    this.capacity = capacity;
    this.compare = compare;
    this.values = [];
  }

  push(value) {
    if (this.values.length < this.capacity) {
      this.values.push(value);
      this.#bubbleUp(this.values.length - 1);
      return true;
    }
    if (this.compare(value, this.values[0]) <= 0) return false;
    this.values[0] = value;
    this.#sinkDown(0);
    return true;
  }

  toSortedDescending() {
    return [...this.values].sort((a, b) => b.score - a.score || b.itemSold - a.itemSold || a.id.localeCompare(b.id, 'en'));
  }

  #bubbleUp(index) {
    const value = this.values[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.values[parentIndex];
      if (this.compare(value, parent) < 0) {
        this.values[parentIndex] = value;
        this.values[index] = parent;
        index = parentIndex;
      } else break;
    }
  }

  #sinkDown(index) {
    const length = this.values.length;
    const value = this.values[index];
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      let smallest = index;
      if (leftIndex < length && this.compare(this.values[leftIndex], this.values[smallest]) < 0) smallest = leftIndex;
      if (rightIndex < length && this.compare(this.values[rightIndex], this.values[smallest]) < 0) smallest = rightIndex;
      if (smallest === index) break;
      this.values[index] = this.values[smallest];
      this.values[smallest] = value;
      index = smallest;
    }
  }
}

function decodeField(buffers, nulCounter) {
  if (!buffers.length) return '';
  const joined = buffers.length === 1 ? buffers[0] : Buffer.concat(buffers);
  let nulMatches = 0;
  for (const byte of joined) if (byte === 0) nulMatches += 1;
  if (nulMatches) nulCounter.count += nulMatches;
  return joined.toString('utf8').replaceAll('\0', '');
}

/** Stream an RFC-4180 CSV one logical row at a time, including multiline quoted fields. */
export async function streamCsvRows(filePath, onRow, { maxRows = Infinity, progressEvery = 100_000 } = {}) {
  const stream = createReadStream(filePath, { highWaterMark: 4 * 1024 * 1024 });
  const nulCounter = { count: 0 };
  let row = [];
  let fieldParts = [];
  let inQuotes = false;
  let pendingQuote = false;
  let rowCount = 0;
  let header = null;
  let stopped = false;

  const finishField = () => {
    row.push(decodeField(fieldParts, nulCounter));
    fieldParts = [];
  };
  const finishRow = () => {
    finishField();
    if (!header) {
      if (row.length && row[0].charCodeAt(0) === 0xfeff) row[0] = row[0].slice(1);
      header = row;
    } else if (row.length > 1 || row[0] !== '') {
      rowCount += 1;
      onRow(row, header, rowCount);
      if (progressEvery && rowCount % progressEvery === 0) process.stdout.write(`[catalog] scanned ${rowCount.toLocaleString('en-US')} rows\n`);
      if (rowCount >= maxRows) stopped = true;
    }
    row = [];
  };

  for await (const chunk of stream) {
    if (stopped) {
      stream.destroy();
      break;
    }
    let segmentStart = 0;
    for (let index = 0; index < chunk.length; index += 1) {
      const byte = chunk[index];
      if (pendingQuote) {
        if (byte === 0x22) {
          if (index > segmentStart) fieldParts.push(chunk.subarray(segmentStart, index));
          fieldParts.push(Buffer.from([0x22]));
          segmentStart = index + 1;
          pendingQuote = false;
          continue;
        }
        pendingQuote = false;
        inQuotes = false;
      }
      if (inQuotes) {
        if (byte === 0x22) {
          if (index > segmentStart) fieldParts.push(chunk.subarray(segmentStart, index));
          segmentStart = index + 1;
          pendingQuote = true;
        }
        continue;
      }
      if (byte === 0x22 && fieldParts.length === 0 && index === segmentStart) {
        segmentStart = index + 1;
        inQuotes = true;
      } else if (byte === 0x2c || byte === 0x0a) {
        if (index > segmentStart) fieldParts.push(chunk.subarray(segmentStart, index));
        segmentStart = index + 1;
        if (byte === 0x2c) finishField();
        else {
          if (fieldParts.length && fieldParts.at(-1).at(-1) === 0x0d) {
            const last = fieldParts.pop();
            fieldParts.push(last.subarray(0, -1));
          }
          finishRow();
          if (stopped) break;
        }
      }
    }
    if (!stopped && segmentStart < chunk.length) fieldParts.push(chunk.subarray(segmentStart));
  }

  if (!stopped) {
    if (pendingQuote) inQuotes = false;
    if (inQuotes) throw new Error('Unclosed quoted field at end of CSV');
    if (fieldParts.length || row.length) finishRow();
  }
  return { header, rowCount, nulBytesRemoved: nulCounter.count };
}

export function makeColumnIndex(header) {
  const index = new Map(header.map((name, position) => [name.trim(), position]));
  const missing = REQUIRED_FEED_COLUMNS.filter((name) => !index.has(name));
  if (missing.length) throw new Error(`Feed is missing required columns: ${missing.join(', ')}`);
  return index;
}

export function field(row, index, name) {
  const position = index.get(name);
  return position === undefined ? '' : row[position] ?? '';
}

export function sanitizeText(value) {
  return String(value ?? '')
    .replaceAll('\0', '')
    .replace(/[\uFE0E\uFE0F]/gu, '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .normalize('NFKC');
}

export function toFiniteNumber(value, fallback = 0) {
  const normalized = sanitizeText(value).replaceAll(',', '').trim();
  if (!normalized) return fallback;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePriceUnit(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 100_000 ? value / 100_000 : value;
}

export function parsePriceRange(row, index) {
  const salePrice = normalizePriceUnit(toFiniteNumber(field(row, index, 'sale_price')));
  const basePrice = normalizePriceUnit(toFiniteNumber(field(row, index, 'price')));
  const modelPrices = sanitizeText(field(row, index, 'model_prices'))
    .split('|')
    .map((segment) => segment.trim().replaceAll(',', ''))
    .filter((segment) => /^\d+(?:\.\d+)?$/u.test(segment))
    .map(Number)
    .map(normalizePriceUnit)
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 100_000);
  const modelMin = modelPrices.length ? Math.min(...modelPrices) : 0;
  const suspiciousDeepSale = salePrice > 0 && modelMin > 0 && salePrice < modelMin * 0.5;
  const values = modelPrices.length
    ? [...modelPrices, ...(salePrice > 0 ? [salePrice] : [])]
    : salePrice > 0 ? [salePrice]
      : basePrice > 0 ? [basePrice]
        : [];
  if (!values.length) return null;
  const min = Math.round(Math.min(...values) * 100) / 100;
  const max = Math.round(Math.max(...values) * 100) / 100;
  if (min < 1 || max > 100_000 || max < min) return null;
  return { priceMin: min, priceMax: max, suspiciousDeepSale };
}

export function normalizeImageUrl(value) {
  let text = sanitizeText(value).trim().replace(/^['"]|['"]$/g, '');
  if (!text) return '';
  if (/^[a-z0-9][a-z0-9-]{20,}$/iu.test(text) && !text.includes('.')) text = `https://down-th.img.susercontent.com/file/${text}`;
  else if (text.startsWith('//')) text = `https:${text}`;
  else if (text.startsWith('http://')) text = `https://${text.slice(7)}`;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || !/(?:^|\.)(?:susercontent\.com|shopee\.co\.th)$/iu.test(url.hostname)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function findImageUrl(row, index) {
  for (const name of IMAGE_COLUMNS) {
    const url = normalizeImageUrl(field(row, index, name));
    if (url) return url;
  }
  return '';
}

export function canonicalProductUrl(shopId, itemId) {
  if (!/^\d+$/.test(String(shopId)) || !/^\d+$/.test(String(itemId))) return '';
  return `https://shopee.co.th/product/${shopId}/${itemId}`;
}

function stripBracketedPromos(text) {
  return text.replace(/[\[(【][^\])】]{0,55}(?:ส่งฟรี|พร้อมส่ง|ส่งเร็ว|ลด|โปร|แถม|ของแท้|ถูก|คุ้ม|โรงงาน|ขายดี|cod|official|ทันที|ฮิต|ยอดขาย|hot|new)[^\])】]{0,55}[\])】]/giu, ' ');
}

export function cleanProductName(value) {
  let text = sanitizeText(value).replace(/<[^>]*>/g, ' ').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ');
  text = stripBracketedPromos(text);
  for (const pattern of PROMO_PHRASES) text = text.replace(pattern, ' ');
  text = text.replace(CLAIM_PHRASES, ' ');
  text = text.replace(/100\s*%/gu, ' ');
  text = text.replace(/^[\s|:;,_\-–—*#~.]+|[\s|:;,_\-–—*#~.]+$/g, '').replace(/[|]{2,}/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (text.length > 90) {
    const shortened = text.slice(0, 90);
    text = shortened.replace(/\s+\S*$/u, '').trim() || shortened.trim();
  }
  return text.replace(/^[\s|:;,_\-–—*#~.!?]+|[\s|:;,_\-–—*#~.!?]+$/g, '').trim();
}

function trimAtWord(text, maxLength) {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength + 1).replace(/\s+\S*$/u, '').trim();
  return cut || text.slice(0, maxLength).trim();
}

function normalizeObjectiveFragment(value) {
  let fragment = value
    .replace(/^\s*[+<>{}■□◆►▶●•~]+\s*/u, '')
    .replace(/^[\[【]\s*([^\]】]{3,80})\s*[\]】]\s*/u, '$1 ')
    .replace(/^คุณสมบัติ(?:พิเศษ\s*\(ถ้ามี\))?\s*[:：]\s*/iu, '')
    .replace(/(?:รายการแพ็?[คก]เกจ|แพ็?[คก]เกจ(?:รวม|ประกอบด้วย)|แพ็?[คก]เกจ(?=\s*[:：])|สิ่งที่มาในชุด)\s*[:：]?\s*/giu, 'ในชุดมี ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (/^ในชุดมี\s*$/u.test(fragment)) fragment = '';
  return fragment;
}

export function summarizeDescription(description, cleanName, category) {
  const text = sanitizeText(description.slice(0, 5_000))
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/giu, ' ')
    .replace(/(?:^|\s)[@#][\p{L}\p{N}_-]+/gu, ' ')
    .replace(CLAIM_PHRASES, ' ')
    .replace(/[*_]{1,3}/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[•●▪◼◆►▶✓✔■□]+/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  const fragments = text
    .split(/(?:\n+|(?<=[.!?。])\s+|\s*[|]+\s*)/u)
    .map((part) => normalizeObjectiveFragment(part.replace(/^[-–—*#:=\d.)\s]+/u, '')))
    .filter((part) => part.length >= 18 && part.length <= 170)
    .filter((part) => !POLICY_OR_PROMO_SENTENCE.test(part) && !FINAL_ADDITIONAL_POLICY.test(part) && !FINAL_SELLER_VOICE.test(part) && !FINAL_NONOBJECTIVE_TEXT.test(part) && !FINAL_FEED_NOISE.test(part) && !FINAL_FEED_NOISE_ADDITIONAL.test(part) && !FINAL_FEED_NOISE_THIRD.test(part) && !FINAL_LOCKED_BLOCKER_TEXT.test(part) && !FINAL_HEALTH_CLAIM_ADDITIONAL.test(part) && !hasUnsupportedCertification(part) && !FINAL_ADDITIONAL_GARBLE.test(part) && !BLOCKED_TEXT.test(part) && !PROHIBITED_SAFETY_ADDITIONAL.test(part))
    .filter((part) => OBJECTIVE_SIGNAL.test(part))
    .filter((part) => !/(?:มันคือ|ได้แก่|ประกอบด้วย|รายละเอียดสินค้า|คุณสมบัติสินค้า|ข้อมูลสินค้า)\s*[:：]?\s*$/iu.test(part));
  const unique = [];
  for (const fragment of fragments) {
    let cleaned = fragment.replace(CLAIM_PHRASES, ' ');
    for (const pattern of PROMO_PHRASES) cleaned = cleaned.replace(pattern, ' ');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    if (cleaned.length < 35 || !OBJECTIVE_SIGNAL.test(cleaned) || cleanName.includes(cleaned) || unique.some((value) => value.includes(cleaned) || cleaned.includes(value))) continue;
    if ([...unique, cleaned].join(' ').length > 170) continue;
    unique.push(cleaned);
    if (unique.join(' ').length >= 120 || unique.length === 2) break;
  }
  let summary = unique.join(' ').trim();
  if (summary.length < 35) return '';
  return normalizeObjectiveFragment(summary.replace(/\s{2,}/g, ' '));
}

export function classifyCategory(category1, category2, category3, title = '') {
  const titleText = sanitizeText(title);
  const categoryPath = [category1, category2, category3].map((part) => sanitizeText(part).trim()).join(' > ');
  return CATEGORY_RULES.find((rule) => {
    const pathAllowed = rule.exactPaths ? rule.exactPaths.has(categoryPath) : rule.pathPattern.test(categoryPath);
    return pathAllowed && rule.pattern.test(titleText) && !(rule.denyPattern?.test(titleText));
  }) ?? null;
}

const SEASON_TAG_ORDER = Object.freeze(['all-year', 'hot', 'rainy', 'cool']);
const SEASONAL_RULES = Object.freeze([
  {
    id: 'rain-gear', categoryKeys: ['camping-outdoor'],
    pattern: /(?:ร่ม|เสื้อกันฝน|กระเป๋ากันน้ำ|ถุงกันน้ำ|ผ้าใบ|ฟลายชีท|umbrella|rain\s*coat|dry\s*bag|tarpaulin|flysheet)/iu,
    seasonTags: ['rainy'], monthTags: [6, 7, 8, 9, 10], score: 94,
    reason: 'เหมาะนำเสนอช่วงเตรียมรับฝนและฤดูฝน',
  },
  {
    id: 'rain-laundry-drying', categoryKeys: ['bathroom-laundry'],
    pattern: /(?:ราวตากผ้า|เชือกตากผ้า|ตากผ้า|clothesline|drying\s*rack)/iu,
    seasonTags: ['rainy'], monthTags: [6, 7, 8, 9, 10], score: 88,
    reason: 'เหมาะทำคอนเทนต์เรื่องจัดการงานซักและตากผ้าในช่วงฝน',
  },
  {
    id: 'rain-garden', categoryKeys: ['garden'],
    pattern: /(?:กระถาง|บัวรดน้ำ|ถุงมือทำสวน|คลิปต้นไม้|ตาข่ายต้นไม้|plant\s*pot|watering\s*can|garden\s*glove|plant\s*clip|garden\s*net)/iu,
    seasonTags: ['rainy'], monthTags: [6, 7, 8, 9, 10], score: 78,
    reason: 'เหมาะนำเสนอช่วงฤดูฝนที่คนดูแลพื้นที่สีเขียวมากขึ้น',
  },
  {
    id: 'rain-cleaning', categoryKeys: ['cleaning'],
    pattern: /(?:ไม้ปาดน้ำ|ยางรีดน้ำ|ยางรีดน้ํา|ไม้ถูพื้น|squeegee|mop\b)/iu,
    seasonTags: ['rainy'], monthTags: [6, 7, 8, 9, 10], score: 76,
    reason: 'เหมาะทำคอนเทนต์ดูแลพื้นและความเปียกชื้นในฤดูฝน',
  },
  {
    id: 'hot-car-sunshade', categoryKeys: ['automotive-accessories'],
    pattern: /(?:ม่านบังแดด|แผ่นบังแดด|ที่บังแดด|sun\s*shield|sunshade)/iu,
    seasonTags: ['hot'], monthTags: [3, 4, 5], score: 94,
    reason: 'เหมาะนำเสนอช่วงอากาศร้อนและการเดินทางกลางแดด',
  },
  {
    id: 'hot-kitchen-drinkware', categoryKeys: ['kitchen'],
    pattern: /(?:ขวดน้ำ|ขวดน้ํา|เหยือก|แก้วน้ำ|แก้วน้ํา|ถาดทำน้ำแข็ง|ถาดทําน้ําแข็ง|water\s*bottle|pitcher|tumbler|ice\s*tray)/iu,
    seasonTags: ['hot'], monthTags: [3, 4, 5], score: 84,
    reason: 'เหมาะทำคอนเทนต์เครื่องดื่มและการใช้งานในช่วงหน้าร้อน',
  },
  {
    id: 'hot-songkran', categoryKeys: ['camping-outdoor', 'travel', 'device-accessories'],
    pattern: /(?:สงกรานต์|songkran|ซองกันน้ำ|ซองกันน้ํา|กระเป๋ากันน้ำ|กระเป๋ากันน้ํา|dry\s*bag|waterproof\s*pouch)/iu,
    seasonTags: ['hot'], monthTags: [4], score: 96,
    reason: 'เหมาะนำเสนอช่วงสงกรานต์และกิจกรรมหน้าร้อนในเดือนเมษายน',
  },
  {
    id: 'cool-camping', categoryKeys: ['camping-outdoor'],
    pattern: /(?:เต็นท์|เสื่อปิกนิก|โต๊ะแคมป์|เก้าอี้แคมป์|สมอบก|หมุดเต็นท์|เชือกเต็นท์|tent\b|picnic\s*mat|camping\s*(?:table|chair)|tent\s*(?:peg|rope))/iu,
    seasonTags: ['cool'], monthTags: [1, 2, 11, 12], score: 90,
    reason: 'เหมาะนำเสนอช่วงอากาศเย็นและฤดูกาลท่องเที่ยวกลางแจ้ง',
  },
  {
    id: 'cool-home-textile', categoryKeys: ['home-textile'],
    pattern: /(?:ผ้าห่ม|ผ้านวม|blanket|comforter|quilt)/iu,
    seasonTags: ['cool'], monthTags: [1, 2, 11, 12], score: 86,
    reason: 'เหมาะทำคอนเทนต์ของใช้ในบ้านช่วงอากาศเย็น',
  },
  {
    id: 'travel-holiday', categoryKeys: ['travel'],
    pattern: /./u,
    seasonTags: ['hot', 'cool'], monthTags: [1, 2, 4, 11, 12], score: 80,
    reason: 'เหมาะนำเสนอในช่วงหยุดยาวและฤดูกาลเดินทาง',
  },
  {
    id: 'gift-season', categoryKeys: ['packaging-party', 'home-decor'],
    pattern: /(?:ของขวัญ|ริบบิ้น|กระดาษห่อ|ถุงของขวัญ|กล่องของขวัญ|การ์ดอวยพร|gift|ribbon|greeting\s*card)/iu,
    seasonTags: ['cool'], monthTags: [1, 2, 11, 12], score: 82,
    reason: 'เหมาะทำคอนเทนต์ช่วงเทศกาล ของขวัญ และปลายปี',
  },
  {
    id: 'school-opening-books', categoryKeys: ['books'],
    pattern: /(?:การศึกษา|แบบฝึกหัด|ภาษา|พจนานุกรม|คณิต|วิทยา|ตำรา|ตํารา|เรียน|education|school|workbook|textbook|dictionary|language|math|science)/iu,
    seasonTags: [], monthTags: [1, 5, 6], score: 84,
    reason: 'เหมาะนำเสนอช่วงเริ่มปีและช่วงเตรียมเปิดภาคเรียน',
  },
  {
    id: 'school-opening-stationery', categoryKeys: ['stationery'],
    pattern: /(?:ปากกา|ดินสอ|สมุด|แฟ้ม|กระดาษ|ยางลบ|ไม้บรรทัด|pen\b|pencil|notebook|folder|paper|eraser|ruler)/iu,
    seasonTags: [], monthTags: [1, 5, 6], score: 78,
    reason: 'เหมาะทำคอนเทนต์ช่วงเริ่มปีและเตรียมอุปกรณ์เปิดภาคเรียน',
  },
]);

export function makeSeasonalMetadata(categoryKey, cleanName, summary) {
  const text = `${cleanName} ${summary}`;
  const matches = SEASONAL_RULES.filter((rule) => rule.categoryKeys.includes(categoryKey) && rule.pattern.test(text));
  if (!matches.length) {
    return {
      seasonTags: ['all-year'],
      monthTags: [],
      seasonalScore: 50,
      seasonReason: 'เหมาะนำเสนอและทำคอนเทนต์ได้ตลอดทั้งปี',
      seasonRuleIds: ['all-year-default'],
    };
  }
  const seasonTags = [...new Set(matches.flatMap((rule) => rule.seasonTags))]
    .sort((left, right) => SEASON_TAG_ORDER.indexOf(left) - SEASON_TAG_ORDER.indexOf(right));
  const monthTags = [...new Set(matches.flatMap((rule) => rule.monthTags))].sort((left, right) => left - right);
  const primary = [...matches].sort((left, right) => right.score - left.score || left.id.localeCompare(right.id, 'en'))[0];
  return {
    seasonTags,
    monthTags,
    seasonalScore: primary.score,
    seasonReason: primary.reason,
    seasonRuleIds: matches.map((rule) => rule.id).sort((left, right) => left.localeCompare(right, 'en')),
  };
}

function suitabilityScore(categoryKey, title, description) {
  let score = 16;
  const text = `${title} ${description.slice(0, 600)}`;
  if (/(?:จัดระเบียบ|ทำความสะอาด|อเนกประสงค์|พกพา|ติดตั้ง|ปรับระดับ|ประหยัดพื้นที่|ใช้งานง่าย|storage|organizer|cleaning|portable|adjustable|tool|accessor)/iu.test(text)) score += 4;
  if (/(?:เซ็ต|ชุด|แพ็ก|กล่อง|ชั้น|เครื่อง|อุปกรณ์|แปรง|ผ้า|กระเป๋า|rack|set|kit|box|case)/iu.test(text)) score += 3;
  return Math.min(20, score);
}

function makeTitleFingerprint(cleanName) {
  const normalized = sanitizeText(cleanName)
    .toLocaleLowerCase('th-TH')
    .replace(/(?:รุ่น|model|size|ขนาด|สี)\s*[\p{L}\p{N}./+-]+/giu, ' ')
    .replace(/\b[a-z]{1,6}[-_]?\d+[a-z0-9-]*\b/giu, ' ')
    .replace(/\d+(?:[.,/]\d+)*(?:\s*(?:cm|mm|ml|l|kg|g|ชิ้น|ใบ|อัน|แพ็ค|เซต|ชุด))?/giu, ' ')
    .replace(/(?:ใหม่|อเนกประสงค์|พกพา|มินิ|แบบ|ชนิด|สไตล์|คุณภาพ|เกรด|premium|new)/giu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return normalized.split(' ').slice(0, 14).join('').slice(0, 65);
}

function priceScore(priceMin) {
  if (priceMin >= 29 && priceMin <= 1_500) return 5;
  if (priceMin >= 10 && priceMin <= 3_000) return 4;
  if (priceMin <= 8_000) return 2;
  return 0;
}

export function evaluateFeedRow(row, index, checkedAt, rejectionCounts) {
  if (row.length !== index.size) {
    rejectionCounts.malformed += 1;
    return null;
  }
  const category1 = field(row, index, 'global_category1');
  const category2 = field(row, index, 'global_category2');
  const category3 = field(row, index, 'global_category3');
  if (BLOCKED_CATEGORY.test(`${category1} ${category2} ${category3}`)) {
    rejectionCounts.blockedCategory += 1;
    return null;
  }
  if (UNSUITABLE_CATEGORY.test(category1)) {
    rejectionCounts.unsuitableCategory += 1;
    return null;
  }
  const titleRaw = field(row, index, 'title');
  const descriptionRaw = field(row, index, 'description');
  const rawCategoryPath = [category1, category2, category3].map((part) => sanitizeText(part).trim()).join(' > ');
  const passiveKeyShell = rawCategoryPath === PASSIVE_AUTO_KEY_PATH && PASSIVE_KEY_SHELL.test(titleRaw) && !ACTIVE_KEY_COMPONENT.test(titleRaw);
  const titleForProhibitedCheck = passiveKeyShell
    ? titleRaw.replace(/(?:remote\s*control|remote|รีโมต|รีโมท)/giu, ' ')
    : titleRaw;
  if (SOURCE_TITLE_POLICY.test(titleRaw) || SOURCE_TITLE_ADDITIONAL.test(titleRaw) || hasAuthenticityClaim(titleRaw) ||
      PROHIBITED_TITLE.test(titleForProhibitedCheck) || PROHIBITED_SAFETY_ADDITIONAL.test(`${titleRaw} ${descriptionRaw.slice(0, 1_500)}`)) {
    rejectionCounts.prohibitedFormat += 1;
    return null;
  }
  if (HIGH_RISK_TITLE.test(`${titleRaw} ${descriptionRaw.slice(0, 1_500)}`)) {
    rejectionCounts.highRiskTitle += 1;
    return null;
  }
  if (BLOCKED_TEXT.test(`${titleRaw} ${descriptionRaw.slice(0, 1_500)}`)) {
    rejectionCounts.blockedText += 1;
    return null;
  }
  const category = classifyCategory(category1, category2, category3, titleRaw);
  if (!category) {
    rejectionCounts.nonWarehouse += 1;
    return null;
  }
  if (toFiniteNumber(field(row, index, 'stock')) <= 0) {
    rejectionCounts.outOfStock += 1;
    return null;
  }
  if (/^(?:true|1|yes)$/iu.test(field(row, index, 'holiday_mode_on').trim())) {
    rejectionCounts.holidayMode += 1;
    return null;
  }
  const shopId = field(row, index, 'shopid').trim();
  const itemId = field(row, index, 'itemid').trim();
  const productUrl = canonicalProductUrl(shopId, itemId);
  if (!productUrl) {
    rejectionCounts.invalidIds += 1;
    return null;
  }
  const imageUrl = findImageUrl(row, index);
  if (!imageUrl) {
    rejectionCounts.invalidImage += 1;
    return null;
  }
  const prices = parsePriceRange(row, index);
  if (!prices) {
    rejectionCounts.invalidPrice += 1;
    return null;
  }
  if (prices.suspiciousDeepSale || prices.priceMin < 20 || prices.priceMax > 5_000 || prices.priceMax / prices.priceMin > 3) {
    rejectionCounts.baitPrice += 1;
    return null;
  }
  const cleanName = cleanProductName(titleRaw);
  if (cleanName.length < 8 || cleanName.length > 90 || !category.pattern.test(cleanName)) {
    rejectionCounts.invalidName += 1;
    return null;
  }
  const itemSold = Math.max(0, toFiniteNumber(field(row, index, 'item_sold')));
  const likes = Math.max(0, toFiniteNumber(field(row, index, 'like')));
  const rating = Math.min(5, Math.max(0, toFiniteNumber(field(row, index, 'item_rating'))));
  const sparseExactCategory = category.key === 'automotive-accessories' || category.key === 'travel';
  if (rating < (sparseExactCategory ? 4.75 : 4.5)) {
    rejectionCounts.lowRating += 1;
    return null;
  }
  if (sparseExactCategory ? itemSold + likes < 5 : itemSold < 20 && likes < 20) {
    rejectionCounts.lowSignal += 1;
    return null;
  }
  if (containsLockedBlockerText(titleRaw) || containsLockedBlockerText(descriptionRaw.slice(0, 5_000)) ||
      hasDescriptionBrandAuthenticityClaim(descriptionRaw.slice(0, 5_000))) {
    rejectionCounts.invalidSummary += 1;
    return null;
  }
  const summary = summarizeDescription(descriptionRaw, cleanName, category.label);
  if (!summary || HIGH_RISK_TITLE.test(summary) || PROHIBITED_TITLE.test(summary) || POLICY_OR_PROMO_SENTENCE.test(summary) ||
      FINAL_ADDITIONAL_POLICY.test(summary) || FINAL_SELLER_VOICE.test(summary) || FINAL_NONOBJECTIVE_TEXT.test(summary) ||
      FINAL_FEED_NOISE.test(summary) || FINAL_FEED_NOISE_ADDITIONAL.test(summary) || FINAL_FEED_NOISE_THIRD.test(summary) || FINAL_LOCKED_BLOCKER_TEXT.test(summary) ||
      FINAL_HEALTH_CLAIM_ADDITIONAL.test(summary) || RAW_TEXT_BOUNDARY.test(summary) || PROHIBITED_SAFETY_ADDITIONAL.test(summary) ||
      hasUnsupportedCertification(summary) || FINAL_ADDITIONAL_GARBLE.test(summary) || BLOCKED_TEXT.test(summary)) {
    rejectionCounts.invalidSummary += 1;
    return null;
  }
  const finalText = `${cleanName} ${summary}`;
  if (!summaryMatchesProductFamily(category.key, cleanName, summary)) {
    rejectionCounts.semanticMismatch += 1;
    return null;
  }
  if (category.denyPattern?.test(finalText) || category.denySummaryPattern?.test(summary) || hasPassiveMeterCaseMismatch(category.key, cleanName, summary)) {
    rejectionCounts.categorySafety += 1;
    return null;
  }
  if (FINAL_PROMO_POLICY.test(finalText) || FINAL_DEFECT.test(finalText) || FINAL_HIGH_RISK_CLAIM.test(finalText) ||
      FINAL_ADDITIONAL_POLICY.test(finalText) || FINAL_SELLER_VOICE.test(finalText) || FINAL_NONOBJECTIVE_TEXT.test(finalText) ||
      FINAL_FEED_NOISE.test(finalText) || FINAL_FEED_NOISE_ADDITIONAL.test(finalText) || FINAL_FEED_NOISE_THIRD.test(finalText) || FINAL_LOCKED_BLOCKER_TEXT.test(cleanName) || FINAL_LOCKED_BLOCKER_TEXT.test(summary) ||
      FINAL_HEALTH_CLAIM_ADDITIONAL.test(finalText) || PROHIBITED_SAFETY_ADDITIONAL.test(finalText) || hasAuthenticityClaim(finalText) ||
      hasUnsupportedCertification(finalText) || FINAL_ADDITIONAL_GARBLE.test(finalText) ||
      FINAL_UNSUITABLE_BODY_PRODUCT.test(finalText) || FINAL_GARBLE_OR_RAW_HEADER.test(cleanName) || FINAL_GARBLE_OR_RAW_HEADER.test(summary) ||
      RAW_NAME_BOUNDARY.test(cleanName) || RAW_TEXT_BOUNDARY.test(summary) ||
      BROKEN_THAI_TOKEN.test(finalText) || CLEAR_GIBBERISH.test(cleanName) || CLEAR_GIBBERISH.test(summary) || TRAILING_INCOMPLETE_SUMMARY.test(summary) ||
      SOURCE_TITLE_ADDITIONAL.test(cleanName) || TRAILING_INCOMPLETE_NAME.test(cleanName) || UNREADABLE_THAI_RUN.test(cleanName) ||
      summaryMostlyRestatesName(cleanName, summary) || hasRepeatedSummaryPhrase(summary) || hasDominantSummaryToken(summary) ||
      hasConflictingLayerCounts(cleanName, summary) || hasConflictingUnitCounts(cleanName, summary) || hasConflictingDimensions(cleanName, summary) ||
      !hasBalancedPairs(cleanName) || !hasBalancedPairs(summary)) {
    rejectionCounts.contentQuality += 1;
    return null;
  }
  const popularity = Math.min(1, Math.log10(itemSold + 1) / 5) * 40;
  const ratingQuality = rating ? Math.max(0, rating - 4) * 12 : 0;
  const socialProof = Math.min(1, Math.log10(likes + 1) / 4) * 8;
  const completeness = 5 + (descriptionRaw.trim().length >= 120 ? 5 : 2) +
    (/^(?:true|1|yes)$/iu.test(field(row, index, 'is_official_shop').trim()) ? 3 : 0) +
    (/^(?:true|1|yes)$/iu.test(field(row, index, 'is_preferred_shop').trim()) ? 2 : 0);
  const suitability = suitabilityScore(category.key, cleanName, descriptionRaw);
  const penalty = Math.min(10, Math.max(0, toFiniteNumber(field(row, index, 'seller_penalty_score'))));
  const score = Math.round((popularity + ratingQuality + socialProof + completeness + suitability + priceScore(prices.priceMin) - penalty) * 1_000) / 1_000;
  const seasonal = makeSeasonalMetadata(category.key, cleanName, summary);
  return {
    id: `${shopId}-${itemId}`,
    categoryKey: category.key,
    category: category.label,
    imageUrl,
    cleanName,
    summary,
    priceMin: prices.priceMin,
    priceMax: prices.priceMax,
    checkedAt,
    productUrl,
    shopId,
    itemId,
    score,
    itemSold,
    rating,
    ...seasonal,
    titleFingerprint: makeTitleFingerprint(cleanName),
    imageFingerprint: new URL(imageUrl).pathname.split('/').filter(Boolean).at(-1),
  };
}

function publicProduct(candidate) {
  return {
    id: candidate.id,
    categoryKey: candidate.categoryKey,
    category: candidate.category,
    imageUrl: candidate.imageUrl,
    cleanName: candidate.cleanName,
    summary: candidate.summary,
    priceMin: candidate.priceMin,
    priceMax: candidate.priceMax,
    checkedAt: candidate.checkedAt,
    productUrl: candidate.productUrl,
    seasonTags: candidate.seasonTags,
    monthTags: candidate.monthTags,
    seasonalScore: candidate.seasonalScore,
    seasonReason: candidate.seasonReason,
    shopId: candidate.shopId,
    itemId: candidate.itemId,
  };
}

export function selectCatalog(candidatesByCategory, rankedCount = DEFAULT_RANKED_TARGET, reserveCount = DEFAULT_RESERVE_TARGET) {
  const pools = new Map([...candidatesByCategory].map(([key, heap]) => [key, heap.toSortedDescending()]));
  const categoryRuleByKey = new Map(CATEGORY_RULES.map((rule) => [rule.key, rule]));
  const selectedIds = new Set();
  const titleFingerprints = new Set();
  const imageFingerprints = new Set();
  const shopCounts = new Map();

  const pickInto = (target, targetCount, { quotaMode, shopCap, categoryCap }) => {
    const categoryCounts = new Map();
    const add = (candidate) => {
      target.push(candidate);
      selectedIds.add(candidate.id);
      titleFingerprints.add(candidate.titleFingerprint);
      imageFingerprints.add(candidate.imageFingerprint);
      shopCounts.set(candidate.shopId, (shopCounts.get(candidate.shopId) ?? 0) + 1);
      categoryCounts.set(candidate.categoryKey, (categoryCounts.get(candidate.categoryKey) ?? 0) + 1);
    };
    const canSelect = (candidate, cap) => !selectedIds.has(candidate.id) && !titleFingerprints.has(candidate.titleFingerprint) && !imageFingerprints.has(candidate.imageFingerprint) &&
      (shopCounts.get(candidate.shopId) ?? 0) < shopCap && (categoryCounts.get(candidate.categoryKey) ?? 0) < cap;
    if (quotaMode) {
      const orderedKeys = CATEGORY_RULES.map((rule) => rule.key);
      for (const categoryKey of orderedKeys) {
        const pool = pools.get(categoryKey) ?? [];
        const quota = categoryRuleByKey.get(categoryKey)?.quota ?? 0;
        for (const candidate of pool) {
          if (target.length >= targetCount || (categoryCounts.get(categoryKey) ?? 0) >= quota) break;
          if (canSelect(candidate, quota)) add(candidate);
        }
      }
    }
    const merged = [...pools.values()].flat().sort((a, b) => b.score - a.score || b.itemSold - a.itemSold || a.id.localeCompare(b.id, 'en'));
    for (const candidate of merged) {
      if (target.length >= targetCount) break;
      if (canSelect(candidate, categoryCap)) add(candidate);
    }
  };

  const selected = [];
  const rankedCategoryCap = Math.max(150, Math.ceil(rankedCount * 0.12));
  pickInto(selected, rankedCount, { quotaMode: true, shopCap: 3, categoryCap: rankedCategoryCap });
  if (selected.length !== rankedCount) throw new Error(`Could select only ${selected.length} of ${rankedCount} ranked products`);
  selected.sort((a, b) => b.score - a.score || b.itemSold - a.itemSold || a.id.localeCompare(b.id, 'en'));
  const reserve = [];
  // Sparse exact-path categories can exhaust their unused candidates after the
  // ranked pass. A 30% reserve cap leaves enough room for the remaining safe
  // high-volume categories while still limiting any one category to 90/300;
  // row quality and the stricter ranked-category diversity remain unchanged.
  const reserveCategoryCap = Math.max(60, Math.ceil(reserveCount * 0.30));
  // Ranked diversity stays strict at three products per shop. Reserves may keep
  // up to seven additional distinct products from the same shop so the 300-row
  // recovery pool remains full after content gates; IDs, titles and images are
  // still globally deduplicated and every quality/safety gate remains intact.
  pickInto(reserve, reserveCount, { quotaMode: false, shopCap: 10, categoryCap: reserveCategoryCap });
  if (reserve.length !== reserveCount) throw new Error(`Could select only ${reserve.length} of ${reserveCount} reserve products`);
  reserve.sort((a, b) => b.score - a.score || b.itemSold - a.itemSold || a.id.localeCompare(b.id, 'en'));
  return {
    ranked: selected.map((candidate, index) => ({ rank: index + 1, ...publicProduct(candidate) })),
    reserve: reserve.map((candidate, index) => ({ reserveOrder: index + 1, ...publicProduct(candidate) })),
    seasonRuleTrace: [...selected, ...reserve].map((candidate) => ({ id: candidate.id, ruleIds: candidate.seasonRuleIds })),
  };
}

export function parseCheckedAtFromFilename(inputPath) {
  const match = basename(inputPath).match(/_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:_|\.)/u);
  if (!match) throw new Error('Could not derive checked time from feed filename; pass --checked-at explicitly');
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`;
}

export function makeFeaturedBook() {
  return {
    id: 'featured-dkub-book',
    featured: true,
    categoryKey: 'books',
    category: 'หนังสือและสื่อการเรียนรู้',
    imageUrl: 'https://down-th.img.susercontent.com/file/th-11134207-81ztc-moxgell974lp5f',
    cleanName: 'หนังสือคว้าเงินล้านในอากาศ ด้วยคลิป AI ปักตะกร้า ฉบับนายหน้า TikTok',
    summary: 'หนังสือสอนสร้างคลิป AI สำหรับนายหน้า TikTok ตั้งแต่หาแนวคิด วางเนื้อหา ไปจนถึงทำคลิปปักตะกร้าเป็นขั้นตอน',
    priceMin: 345,
    priceMax: 345,
    checkedAt: '2026-08-17T15:26:00+07:00',
    productUrl: 'https://shopee.co.th/product/1032408641/48511491095',
    seasonTags: ['all-year'],
    monthTags: [],
    seasonalScore: 50,
    seasonReason: 'เหมาะนำเสนอและทำคอนเทนต์ได้ตลอดทั้งปี',
    shopName: 'DkubStore',
    shopId: '1032408641',
    itemId: '48511491095',
  };
}

export function newRejectionCounts() {
  return { malformed: 0, blockedCategory: 0, unsuitableCategory: 0, blockedText: 0, prohibitedFormat: 0, highRiskTitle: 0, nonWarehouse: 0, outOfStock: 0, holidayMode: 0, invalidIds: 0, invalidImage: 0, invalidPrice: 0, baitPrice: 0, invalidName: 0, invalidSummary: 0, semanticMismatch: 0, categorySafety: 0, contentQuality: 0, lowRating: 0, lowSignal: 0 };
}

export function toRuntimeModule(catalog, reserve) {
  return [
    "'use strict';",
    '',
    '// Generated by scripts/catalog/build-product-catalog.mjs. Do not edit directly.',
    `module.exports = Object.freeze(${JSON.stringify({ ...catalog, reserve: reserve.reserve })});`,
    '',
  ].join('\n');
}
