import { createReadStream } from 'node:fs';
import { basename } from 'node:path';

export const CATALOG_SCHEMA_VERSION = 1;

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
];

const BLOCKED_CATEGORY = /(?:food\s*&?\s*beverage|อาหารและเครื่องดื่ม|ticket|voucher|ตั๋ว|คูปอง|digital|บริการ|service|gaming\s+voucher|virtual|live\s*animal|สัตว์มีชีวิต)/iu;
const UNSUITABLE_CATEGORY = /(?:beauty|health|personal\s+care|mom|mother|baby|kids|toy|automotive|motorcycle|mobile|tablet|phone|computer|laptop|camera|home\s+appliance|audio|women(?:'s)?\s+(?:clothes|shoes)|men(?:'s)?\s+(?:clothes|shoes)|fashion\s+clothing|เครื่องใช้ไฟฟ้า|ความงาม|สุขภาพ|แม่และเด็ก|ของเล่น|รถยนต์|มอเตอร์ไซค์|โทรศัพท์|คอมพิวเตอร์|เสื้อผ้า|รองเท้า)/iu;
const BLOCKED_TEXT = /(?:บุหรี่|ยาสูบ|พอต(?:ไฟฟ้า)?|vape|กัญชา|กระท่อม|อาวุธ|ปืน|กระสุน|ระเบิด|มีด(?:พก|ตรง)|\bknife\b|เซ็กซ์ทอย|sex\s*toy|adult\s*toy|ยา(?:รักษา|ลดน้ำหนัก|เพิ่มสมรรถภาพ)|อาหารเสริม|วิตามิน|คอลลาเจน|ดีท็อกซ์|ลดความอ้วน|เพิ่มน้ำนม|นมผง|นมเด็ก|เวย์โปรตีน|โปรตีนผง|ยาฆ่าแมลง|สารกำจัดศัตรูพืช|กรดกัด|เคมีเกษตร|สล็อต|พนัน|บุหรี่ไฟฟ้า|prescription|supplement|weight\s*loss|detox|pesticide|weapon|ammunition|ซิม(?:การ์ด|ทรู|ดีแทค|เอไอเอส)?|\bsim\s*card\b|สินค้าสมนาคุณ|ของแถม(?:ห้ามขาย)?|not\s+for\s+sale)/iu;
const PROHIBITED_TITLE = /(?:หลุด\s*qc|สินค้า(?:มี)?(?:ตำหนิ|ตําหนิ)|ตำหนิ|ตําหนิ|ไฟฟ้า|แบต(?:เตอรี่)?|ถ่าน(?:ชาร์จ)?|ชาร์จ|ยูเอสบี|\busb\b|\bled\b|บลูทูธ|bluetooth|power\s*bank|พาวเวอร์แบงก์|ปลั๊ก|สายไฟ|อะแดปเตอร์|adapter|เครื่อง(?:ดูด|ปั่น|ชาร์จ|นวด|หนีบ|โกน|เป่า|ตัด|ซีล|พิมพ์|ปริ้น|ชง|อบ|อุ่น|ซัก)|พัดลม|หม้อหุง|กล้องวงจร|smart\s*(?:watch|camera)|หุ่นยนต์|เดินเอง|เคลื่อนไหวอัตโนมัติ|อัตโนมัติ|automatic|remote\s*control|รีโมต|ครีม|เซรั่ม|สบู่|แชมพู|โลชั่น|โทนเนอร์|ลิป(?:สติก)?|มาสคาร่า|เขียนคิ้ว|น้ำหอม|ระงับกลิ่น|รักแร้|บำรุงผิว|บำรุงผม|ยาสีฟัน|แปรงสีฟัน|makeup|cosmetic|skincare|กล่องยา|pill\s*(?:organizer|pod)|ทารก|ผ้าอ้อม|เด็ก(?:อ่อน|เล็ก)|baby\s|หมวกกันน็อค|เบรก|โช้ค|ปะเก็น|น้ำมันเครื่อง|ปั๊มน้ำมัน|ยางรถ|อะไหล่รถ|ม่านบังแดด[^\n]{0,20}รถ|ใช้ในรถ(?:ยนต์)?|มีด|คัตเตอร์|กรรไกร|ใบมีด|เลื่อย|เข็ม(?:เย็บ|หมุด)?|กาวร้อน|กาวช้าง|น้ำยา|สเปรย์|สารเคมี|ผงซัก|น้ำยาล้าง|กาแฟ|ขนม|ซอส|น้ำปลา|เครื่องปรุง|อาหาร(?:เสริม|สุนัข|แมว|สำเร็จรูป)|ข้าวสาร|เครื่องดื่ม|เวย์|coffee|snack|supplement|สายจูง|ปลอกคอ|สายรัด(?:อก|สัตว์)|ยางกัด|ขัดฟัน|ลดกลิ่นปาก|เหงือก|เบ็ด|ตกปลา|ตะขอ(?:เบ็ด|ตกปลา)|ตาเบ็ด|ตัวเบ็ด|fishing\s*hook|ต้นไม้จริง|ต้นไม้พร้อมกระถาง|ต้น(?:อ่อน|กล้า)|บอนไซ|ไม้ดอก|ไม้อวบน้ำ|แคคตัส|กระบองเพชร|เมล็ด(?:พันธุ์)?|หัวพันธุ์|ปุ๋ย|ดินปลูก|ไม้ปลูก|ชอบแดด|ออกดอก|มีราก|ต้นไม้มงคล|ลำต้น|ลําต้น|กิ่งชำ|กิ่งชํา|ไม้ด่าง|ต้นพร้อมกระถาง|กระถาง[^\n]{0,25}มี\s*\d*\s*ต้น|live\s*plant|seed|fertili[sz]er|soil|catnip|กัญชาแมว|ดัมเบล|บาร์เบล|ออกกําลังกาย|ออกกำลังกาย|ฟิตเนส|เสื่อโยคะ|\bgym\b|craftsmanship|กระดาษทราย|sandpaper|ผูกเชือก|ชุดว่ายน้ำ|บิกินี่|ช่องระบายอากาศ|ตะแกรงระบาย|ตุ๊กตาจิ๋ว|โมเดลจิ๋ว)/iu;
const HIGH_RISK_TITLE = /(?:รักษา(?:โรค|สิว|ฝ้า|ผื่น)|แก้(?:สิว|ฝ้า|ผิวแห้ง|ผิวลอก)|ลดสิว|ลดฝ้า|ขาวถาวร|ฆ่าเชื้อ|ป้องกันเชื้อ|เชื้อไวรัส|ทางการแพทย์|medical\s+(?:mask|device)|น้ำเกลือ|ล้างโพรงจมูก|ไม่ระคาย|ปลอดภัย\s*100\s*%|(?:ปลอดภัย|ไม่เป็นอันตราย|ต่อสัตว์เลี้ยง)[^.!?\n]{0,25}100\s*%|(?:กันน้ำ|กันฝุ่น|ป้องกัน)[^.!?\n]{0,30}100\s*%|ป้องกัน[^.!?\n]{0,30}pm\s*2[.]?5)/iu;
const POLICY_OR_PROMO_SENTENCE = /(?:ร้าน|ทักแชท|แชท|เงื่อนไข|การรับประกัน|รับประกัน|ไม่รับเปลี่ยน|ไม่สามารถเปลี่ยน|ไม่รับคืน|จัดส่ง|ขนส่ง|โปรโมชั่น|โปรดอ่าน|หมายเหตุ|กดติดตาม|ฝากรีวิว|สอบถาม|สต็อก|ลูกค้า|แอดไลน์|line\s*id|โทร\.?|facebook|instagram|tiktok|ราคาพิเศษ|ราคาที่|เก็บเงินปลายทาง|พร้อมส่ง|สินค้านำส่ง|ยินดีต้อนรับ|welcome|คำสั่งซื้อ|คําสั่งซื้อ|การชำระเงิน|รายงานรายการ|กิจกรรมที่น่าสงสัย|ตัดรอบ|ตัดส่ง|วันทำการ|วันหยุด|ของแท้อย่างเป็นทางการ|อย่าลืม|ติดตามเพื่อ|คูปอง|ส่วนลด|ทีมงานตอบ|แบรนด์ใหม่|ใหม่เอี่ยม|new\s+arrival|hot\s+sale|ใหม่ล่าสุด|คุณภาพดี|เชื่อถือ|หมดปัญหา|สบายที่สุด|สัญญา|บริการ|กำลังจะมีสินค้า|ออกใบกำกับ|ใบกํากับ|ลดเหลือ|ทำไมต้อง|เหตุใด|โรงงาน|ข้อสังเกต|ข้อควรระวัง|EMS|ไปรษณีย์|ลงทะเบียน|กดสั่ง|เคลม|คืนสินค้า|ถ่ายวิดีโอ|สี[^.!?\n]{0,35}อาจแตกต่าง|ภาพถ่าย|จอภาพ|รูปภาพ|ไม่แสดงขนาดจริง|การวัด(?:ด้วยตนเอง)?|ข้อผิดพลาด|ความคลาดเคลื่อน|Shopee|GPS|รับเอง|Standard\s*Delivery|หวังว่า|การันตี|ต้องชอบ|ติดใจ|ฟิน|จำหน่าย|จําหน่าย|ห้าง|คำเตือน|คําเตือน|เป็นมิตรกับสิ่งแวดล้อม)/iu;
const CLAIM_PHRASES = /(?:ดีที่สุด|ราคาถูกที่สุด|ถูกที่สุด|(?:อันดับ|เบอร์)\s*(?:1|หนึ่ง)|\bno\.?\s*1\b|เห็นผลทันที|รับประกันผล|ปลอดภัย(?:\s*100\s*%)?|ไม่เป็นอันตราย|ไม่ระคาย\w*|ไม่บาด\w*|อ่อนโยนต่อ[^.!?\n]{0,30}|(?:กันน้ำ|กันฝุ่น|กันแสง|กันทาก|ป้องกัน)[^.!?\n]{0,35}\d{2,3}(?:\.\d+)?\s*%|ลด(?:การ)?กรน|กระดูกสันหลัง|ลดเมื่อยล้า|ช่วยลดเครียด|ลดความเสียหาย|หายขาด|รักษา(?:โรค|สิว|ฝ้า)|ลดน้ำหนัก|ขาวถาวร|ฆ่าเชื้อ(?:แบคทีเรีย)?\s*\d*(?:\.\d+)?\s*%?|คุณภาพดี|คุณภาพสูง|ใหม่ล่าสุด|\S*ที่สุด|ชั้นยอด|ทนแดด|ทนความร้อน|สีไม่ซีด|ไม่ทิ้งคราบ|กักเก็บกลิ่น|สูตรใหม่|ลื่นไหล|สีสดชัด|คุ้มค่า|จุใจ|สุดว้าว|สุดคิ้วท์)/giu;
const OBJECTIVE_SIGNAL = /(?:วัสดุ|ผลิตจาก|ทำจาก|ทําจาก|เนื้อ(?:ผ้า|กระดาษ)|ขนาด|ความจุ|บรรจุ|ประกอบด้วย|ความ(?:ยาว|กว้าง|สูง)|ปรับ(?:ระดับ|ขนาด|ความยาว|ได้)|พับ(?:ได้|เก็บ)|จัดเก็บ|ทำความสะอาด|ทําความสะอาด|(?:มี|แบ่งเป็น)\s*\d+\s*(?:ช่อง|ชั้น)|ช่อง(?:ใส่|เก็บ|หลัก|ย่อย)|ชั้น(?:วาง|จัดเก็บ)|\d+(?:[.,/]\d+)?\s*(?:cm|mm|ml|l|kg|g|ซม\.?|มม\.?|มล\.?|ลิตร|กก\.?|กรัม|นิ้ว|ชิ้น|ใบ|แผ่น|รีม|ช่อง|ชั้น)|ใช้สำหรับ(?:จัดเก็บ|ใส่|วาง|แขวน|เช็ด)|ใช้สําหรับ(?:จัดเก็บ|ใส่|วาง|แขวน|เช็ด))/iu;

export const FINAL_PROMO_POLICY = /(?:อยู่ระหว่างเปลี่ยนแพ็คเกจ|สินค้ามีคุณภาพ|คุณภาพ|พรีเมียม|พรีเมี่ยม|premium|เกรด\s*(?:a+|aaa|ส่งออก|โรงแรม)|ราค(?:า|าพิเศษ|าต่อ|าเริ่มต้น)|จัดส่ง(?:ภายใน|จาก|ไม่เกิน|รวดเร็ว)|\d+\s*วันจัดส่ง|ส่งจากประเทศไทย|ส่งไว|ส่งเร็ว|ส่งสินค้าเร็ว|พร้อมส่ง|ส่งทุกวันไม่หยุด|ขายยกลัง|\bhot\b|\blive\b|\bnew\b|มาใหม่|รุ่นใหม่|อัพเดต[^.!?]{0,30}ใหม่|อ่านรายละเอียดก่อนสั่งซื้อ|แจ้งข้อความก่อนกดสั่ง|ในสต็อก|จํากัดการสั่งซื้อ|จำกัดการสั่งซื้อ|ทางร้าน|ลูกค้า|สั่งไม่เกิน|กดสั่ง|กดดู|กดตรงชื่อสินค้า|ดูขนาดสินค้า|ตัวเลือกสินค้า|ภาพตัวเลือก|ข้อมูล[^.!?]{0,25}ด้านล่าง|หากต้องการ|ออเดอร์|สั่งตัด|ขายเป็นชุด|ขายแยก|จําหน่าย|จำหน่าย|ออกใบกํากับ|ออกใบกำกับ|รับประกัน|แอดมินตอบไว|ไม่สามารถมัดรวม|ปรึกษาฟรี|กรุณาตรวจสอบ[^.!?]{0,50}ก่อนตัดสินใจซื้อ|ราคาไม่เท่ากัน|จัดไปเลย|ในราคา\s*!|ซื้อ\s*2\s*เล่ม\s*แถม|ซื้อของที่ระลึก|แถม|\bfree\b|ฟรี|ผ่านการทดสอบ|ดึงดูดทุกสายตา|พร้อมใช้งานทันที|ฟรีป้ายชื่อ|(?:นะคะ|นะครับ|ค่ะ|ครับ)|เป็นมิตร(?:ต่อ|กับ)สิ่งแวดล้อม|รักษ์โลก|ฟีลกู้ด|สุดๆ|ตัวดัง|ต้องมี|ใช้แล้วต่างจริง|สุดหรู|สุดสมาร์ท|ตามใจคุณ|อย่างดี|เนื้อดี|คัดเกรด|ออกแบบพิเศษ|ดีไซน์สวย|ทันสมัย|มั่นใจ|บอกลา|สีสด|คมชัด)/iu;
export const FINAL_DEFECT = /(?:สีอาจแตกต่าง|ภาพถ่าย|จอภาพ|รูปภาพอาจ|ไม่แสดงขนาดจริง|การวัด(?:ด้วยตนเอง)?|ข้อผิดพลาด|คลาดเคลื่อน|ตามที่แสดงในภาพ|อาจแตกต่าง|โปรดทราบ|หมายเหตุ|ข้อควรระวัง|ขึ้นอยู่กับ\s*lot|จุดหรือฟองอากาศ|ขนาดจริงอาจ)/iu;
export const FINAL_HIGH_RISK_CLAIM = /(?:ป้องกัน(?:การสะสมของ)?แบคทีเรีย|แอนตี้แบคทีเรีย|ยับยั้งแบคทีเรีย|ต่อต้านแบคทีเรีย|(?:anti[-\s]?bacterial|antibacterial)|ไม่มีสารเรืองแสง|ปราศจากสารฟอกขาว|ปลอดสารพิษ|bpa[-\s]?free|ไร้สารก่อมะเร็ง|food\s*grade|เกรดอาหาร|กันไรฝุ่น|ลดเชื้อรา|ป้องกันเชื้อรา|ไม่เป็นอันตราย|ปลอดภัย(?:\s*100)?|ฆ่าเชื้อ|ถูกสุขอนามัย|ต่อสุขภาพ|ปวด(?:หลัง|คอ)|ซัพพอร์ตคอ|รองรับ(?:ต้น)?คอ|ตามสรีระ|หลับสบาย|ห้ามใช้|แอลกอฮอล์เช็ดแผล|ป้องกัน(?:การกัดกร่อน|สนิม)|กันสนิม|rfid|anti[-\s]?theft|ปกป้องข้อมูล|ทุกคราบ|ทุกชนิด|ไม่มีคราบตกค้าง|ไม่เป็นปัญหา|ไม่(?:รั่วซึม|ตกค้าง|แตกหัก|ฉีกขาด|เปราะแตก|ปริ|เป็นสนิม|มีกลิ่น)|หัวไม่แตก|สีไม่ตก|ทนแรงกระแทก|เก็บกลิ่นไม่ปน|อ่อนโยนในการใช้งาน|ย่อยสลายได้|ไร้สารปนเปื้อน|ทนทานกว่าถึง|ดีเยี่ยม|รับน้ําหนักได้\s*\d+|ถนอมสายตา)/iu;
export const BROKEN_THAI_TOKEN = /(?:^|\s)[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/u;
export const CLEAR_GIBBERISH = /(?:ทัพพีตักข้าว\s+ในโลก\s*$|ซื้อของที่ระลึกได้แล้ว|วัสดุที่\s+และปลอดสารพิษ\s+ไม่มี|ในราคา\s*!|ราคาแน่นอน\s+จัดไปเลยครับ|บรรจุในกระเป๋าอย่าง\s*$|คสาม|ซักแร้ว|ซ่องซิป|ภาวะเงินฝืด|มิติใหม่ของเครื่อง\s+คือ\s+ขนาดของเครื่อง|ตําแหน่งที่ยืดหยุ่น|ถาดทิ้งขยะสําหรับสัตว์เลี้ยง)/iu;
export const TRAILING_INCOMPLETE_NAME = /(?:(?:จํานวน|จำนวน|ติดใน)\s*\d[\d,]*|(?:มี|รุ่น|ขนาด|สี|แบบ|และ|พร้อม|พร้อมกับ|ภายใน|สําหรับ|สำหรับ|with|for|of|and)|[/×]|\bx|(?:^|\s)\d[\d,]*)\s*$/iu;
export const UNREADABLE_THAI_RUN = /[\u0E00-\u0E7F]{70,}/u;
export const FINAL_UNSUITABLE_BODY_PRODUCT = /(?:หมอน(?:รองคอ|เดินทาง|เป่าลม)|ผ้าปิดตา|ที่ปิดตา|sleep\s*mask|blindfold|airmask|ต่อขนตา)/iu;
export const FINAL_GARBLE_OR_RAW_HEADER = /(?:a\s*:\s*คุณจะได้รับ|งดดราม่า|รีวิวให้ดาวมั่ว|ดูขนาดสินค้า|ตัวเลือกสินค้า|คําอธิบายประกอบแบบเต็มภาพ|รายละเอียดสินค้า.*empty\s*storage|รายละเอียดสินค้า\s*:|รายละเอียด\s*:|วิธีการใช้งาน\s*:|การสกัดรูปปาก|ยาขี้ซี|พืัน|ทิชชู๋|พกพก|ออกแแบบ|ให้ลเลือก|ทําคาม|เจาะรูฟรี|แบริ่งที่|ไมโครเวฟไ|ขนาดจั้มโบ้ววว|คื่อ|มาตราฐาน|สเก็ตซ์|ซม่|ซานแม่เหล็ก|นัว|ขอขึ้น|และกา\s*$|ทึ่สุด|เส้นใยโพลีเอสเวัสดุ|ไม่แน่ใจเกี่ยวกับ|กล้องส่องทางไกล|แห้งไว้กว่า|กันน้า|>>|แพคเกจประกอบด้วย|สติกเกอร์กาวในตัววัสดุ|วัสดุไมโครไฟเบอร์การดูดซึม|กระเป๋าใส่เอกสารโฟลเดอร์แฟ้มกระเป๋า|อุปกรณ์เสริมหลักของ\s*abs|^ส่งปากกา|^cm\s*\(|^นิ้ว\s|ชื่อสินค้า\s*:|ข้อแนะนํา|อย่าง่าย|หูฟังอินเ|ในคร(?:\s|$)|ที่ปาดนํา|(?:ซม|มม)\d[.]|multi-functionalpartmentpartment|เรียบราบ|ไม่กลายเป็นรูป|วัสดุแบบดี|ติดตั้งได้อย่างสบาย|0[.]\d+\s*กรัม|\.{3,}|ถาดทิ้งขยะสําหรับสัตว์เลี้ยง|สกายบริดจ์ขั้นตอนแมว)/iu;
export const TRAILING_INCOMPLETE_SUMMARY = /(?:[×/:]|(?:และ|พร้อม|ขนาด|วัสดุ|with|for|of|จะมี)|(?:^|\s)กา)\s*$/iu;

const THAI_WORD_SEGMENTER = new Intl.Segmenter('th', { granularity: 'word' });

function uniqueContentTokens(value) {
  return [...new Set([...THAI_WORD_SEGMENTER.segment(String(value ?? '').toLocaleLowerCase('th-TH'))]
    .filter((part) => part.isWordLike && part.segment.length > 1)
    .map((part) => part.segment))];
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
  const phraseSize = 4;
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

const CATEGORY_RULES = Object.freeze([
  { key: 'pet-accessories', label: 'อุปกรณ์สัตว์เลี้ยง', pathPattern: /(?:(?:pet\s+accessories)\s*>\s*(?:bowls?\s*&?\s*feeders?|pet\s+furniture|toys?|travel\s+essentials)|(?:litter\s*&?\s*toilet)\s*>\s*(?:cat\s+litter\s*&?\s*boxes?|dog\s+training\s+pads?\s*&?\s*trays?|poop\s+bags?\s*&?\s*scoopers?))/iu, pattern: /(?:ชาม(?:อาหาร|น้ำ)(?:สุนัข|แมว|สัตว์)?|ของเล่น(?:แมว|สุนัข|สัตว์เลี้ยง)|กระบะทราย|ที่ตักทราย|แผ่นรองฉี่|ถุงเก็บมูล|แปรงขนสัตว์|ที่ลับเล็บ|เบาะสัตว์|pet\s*(?:bowl|toy|bed)|litter\s*(?:mat|scoop)|poop\s*bag|scratcher)/iu, quota: 45 },
  { key: 'travel', label: 'กระเป๋าและอุปกรณ์เดินทาง', pathPattern: /(?:travel\s+accessories|travel\s*&?\s*luggage|luggage)/iu, pattern: /(?:กระเป๋าจัดระเบียบ(?:เดินทาง)?|ถุงจัดกระเป๋า|ถุงแยกเสื้อผ้า|ถุงใส่รองเท้า|ป้ายกระเป๋า|ซองพาสปอร์ต|ขวดแบ่ง|ขวดพกพา|packing\s*cube|travel\s*(?:organizer|bottle|container)|luggage\s*tag|toiletry\s*(?:bag|pouch)|passport\s*(?:holder|cover)|shoe\s*bag)/iu, quota: 50 },
  { key: 'stationery', label: 'เครื่องเขียนและงานฝีมือ', pathPattern: /(?:stationery|school\s*&?\s*office\s+supplies|arts?\s*&?\s*crafts?)/iu, pattern: /(?:ปากกา|ดินสอ|สมุด|สติกเกอร์|เทป(?:ใส|กาว|กระดาษ|สองหน้า|นาโน)?|คลิปหนีบ|ซองเอกสาร|แฟ้ม|กระดาษ(?:A4|ถ่ายเอกสาร|โน้ต|สี|ห่อ|การ์ด)|พู่กัน|สีไม้|ยางลบ|ไม้บรรทัด|ตรายาง|ที่คั่นหนังสือ|ซองจดหมาย|label|notebook|memo\s*pad|pen\b|pencil|sticker|adhesive\s*tape|folder|envelope|paper\s*(?:clip|bag)|stamp|\bcraft\s*(?:paper|kit|supplies?)\b)/iu, quota: 70 },
  { key: 'kitchen', label: 'ครัวและโต๊ะอาหาร', pathPattern: /(?:kitchenware|dinnerware)/iu, pattern: /(?:กล่อง(?:ถนอม|เก็บ)?อาหาร|กล่องข้าว|ปิ่นโต|จาน|ชาม|แก้วน้ำ|ถ้วย|ช้อน|ส้อม|ตะเกียบ|ตะหลิว|ทัพพี|ที่คีบ|ถาด|ตะแกรง(?:ล้างผัก|นึ่ง|พัก|กรอง|วางจาน|ครัว)|กระชอน|ขวดน้ำ|เหยือก|ที่รองแก้ว|ที่เปิดขวด|แม่พิมพ์ซิลิโคน|ฝาครอบอาหาร|food\s*container|lunch\s*box|bowl\b|cup\b|tray\b|spoon|fork\b|chopstick|coaster|silicone\s*mold)/iu, quota: 80 },
  { key: 'cleaning', label: 'อุปกรณ์ทำความสะอาด', pathPattern: /(?:home\s+care\s+supplies|cleaning\s+supplies|household\s+supplies)/iu, pattern: /(?:ทิชชู|กระดาษชำระ|กระดาษชําระ|แปรง(?:ขัด|ล้าง|ทำความสะอาด)|ผ้าไมโครไฟเบอร์|ผ้าเช็ดทำความสะอาด|ไม้กวาด|ไม้ถูพื้น|ลูกกลิ้งเก็บฝุ่น|ฟองน้ำ|ที่โกยผง|ไม้ปาดน้ำ|ถุงขยะ|ถุงมือทำความสะอาด|แผ่นใยขัด|duster|cleaning\s*brush|scrub\s*brush|microfiber\s*cloth|mop\b|sponge|lint\s*roller|squeegee|dustpan|trash\s*bag)/iu, quota: 80 },
  { key: 'garden', label: 'สวนและกิจกรรมกลางแจ้ง', pathPattern: /(?:gardening\s*>\s*(?:garden\s+decorations?|pots?\s*&?\s*planters?))/iu, pattern: /(?:กระถาง|บัวรดน้ำ|ถุงมือทำสวน|เชือก(?:อเนกประสงค์|ปอ|ไนลอน|เต็นท์)|คลิปต้นไม้|ตาข่ายต้นไม้|ผ้าใบ|หมุดเต็นท์|plant\s*pot|watering\s*can|garden\s*glove|plant\s*clip|garden\s*net|tarpaulin|tent\s*(?:peg|rope))/iu, quota: 30 },
  { key: 'home-textile', label: 'ของใช้ในบ้านและสิ่งทอ', pathPattern: /(?:bedding|bathrooms?\s*>\s*(?:towels?|shower\s+curtains?)|decoration\s*>\s*(?:carpets?|floor\s+mats?|curtains?|table\s*cloths?))/iu, pattern: /(?:ผ้าขนหนู|ผ้าเช็ดมือ|พรม|เสื่อ|ปลอกหมอน|ผ้าปูโต๊ะ|ม่าน|ที่รองจาน|ผ้ากันเปื้อน|ไม้แขวนเสื้อ|ราวตากผ้า|towel|doormat|floor\s*mat|curtain|pillowcase|tablecloth|placemat|apron|clothes\s*hanger|drying\s*rack)/iu, quota: 45 },
  { key: 'organizing', label: 'อุปกรณ์จัดระเบียบและจัดเก็บ', pathPattern: /(?:home\s+organizers?|desk\s+organizers?|hangers?\s*&?\s*pegs?|hooks?|jewelry\s+organizers?|laundry\s+bags?\s*&?\s*baskets?|shoe\s+storage\s+boxes?|storage\s+boxes?\s*,?\s*bags?\s*&?\s*baskets?|tissue\s+holders?|wardrobe\s+organizers?)/iu, pattern: /(?:กล่อง(?:จัดเก็บ|เก็บของ|อเนกประสงค์|ลิ้นชัก|รองเท้า)|ตะกร้าจัดเก็บ|ชั้นวาง|ที่แขวน|ตะขอ|ที่ใส่(?:ของ|ทิชชู่|รีโมท|สายไฟ)|ถุงสูญญากาศ|ถุงซิป|กล่องแบ่งช่อง|ที่จัดระเบียบ|organizer|storage\s*(?:box|bag|basket)|drawer\s*(?:box|divider)|rack\b|hook\b|holder\b|vacuum\s*bag|zip\s*bag)/iu, quota: 100 },
]);

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
    .replace(/[•●▪◼◆►▶✓✔]+/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  const fragments = text
    .split(/(?:\n+|(?<=[.!?。])\s+|\s*[|]+\s*)/u)
    .map((part) => part.replace(/^[-–—*#:=\d.)\s]+/u, '').replace(/\s{2,}/g, ' ').trim())
    .filter((part) => part.length >= 18 && part.length <= 170)
    .filter((part) => !POLICY_OR_PROMO_SENTENCE.test(part) && !BLOCKED_TEXT.test(part))
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
  return summary.replace(/\s{2,}/g, ' ').trim();
}

export function classifyCategory(category1, category2, category3, title = '') {
  const titleText = sanitizeText(title);
  const categoryPath = `${sanitizeText(category1)} > ${sanitizeText(category2)} > ${sanitizeText(category3)}`;
  return CATEGORY_RULES.find((rule) => rule.pathPattern.test(categoryPath) && rule.pattern.test(titleText)) ?? null;
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
  if (PROHIBITED_TITLE.test(titleRaw)) {
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
  if (rating < 4.5) {
    rejectionCounts.lowRating += 1;
    return null;
  }
  if (itemSold < 20 && likes < 20) {
    rejectionCounts.lowSignal += 1;
    return null;
  }
  const summary = summarizeDescription(descriptionRaw, cleanName, category.label);
  if (!summary || HIGH_RISK_TITLE.test(summary) || PROHIBITED_TITLE.test(summary) || POLICY_OR_PROMO_SENTENCE.test(summary) || BLOCKED_TEXT.test(summary)) {
    rejectionCounts.invalidSummary += 1;
    return null;
  }
  const finalText = `${cleanName} ${summary}`;
  if (FINAL_PROMO_POLICY.test(finalText) || FINAL_DEFECT.test(finalText) || FINAL_HIGH_RISK_CLAIM.test(finalText) ||
      FINAL_UNSUITABLE_BODY_PRODUCT.test(finalText) || FINAL_GARBLE_OR_RAW_HEADER.test(cleanName) || FINAL_GARBLE_OR_RAW_HEADER.test(summary) ||
      BROKEN_THAI_TOKEN.test(finalText) || CLEAR_GIBBERISH.test(cleanName) || CLEAR_GIBBERISH.test(summary) || TRAILING_INCOMPLETE_SUMMARY.test(summary) ||
      TRAILING_INCOMPLETE_NAME.test(cleanName) || UNREADABLE_THAI_RUN.test(cleanName) ||
      summaryMostlyRestatesName(cleanName, summary) || hasRepeatedSummaryPhrase(summary) ||
      hasConflictingLayerCounts(cleanName, summary) || hasConflictingUnitCounts(cleanName, summary) ||
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
    titleFingerprint: makeTitleFingerprint(cleanName),
    imageFingerprint: new URL(imageUrl).pathname.split('/').filter(Boolean).at(-1),
  };
}

function publicProduct(candidate) {
  return {
    id: candidate.id,
    category: candidate.category,
    imageUrl: candidate.imageUrl,
    cleanName: candidate.cleanName,
    summary: candidate.summary,
    priceMin: candidate.priceMin,
    priceMax: candidate.priceMax,
    checkedAt: candidate.checkedAt,
    productUrl: candidate.productUrl,
    shopId: candidate.shopId,
    itemId: candidate.itemId,
  };
}

export function selectCatalog(candidatesByCategory, rankedCount = 500, reserveCount = 100) {
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
  pickInto(selected, rankedCount, { quotaMode: true, shopCap: 3, categoryCap: 130 });
  if (selected.length !== rankedCount) throw new Error(`Could select only ${selected.length} of ${rankedCount} ranked products`);
  selected.sort((a, b) => b.score - a.score || b.itemSold - a.itemSold || a.id.localeCompare(b.id, 'en'));
  const reserve = [];
  pickInto(reserve, reserveCount, { quotaMode: false, shopCap: 4, categoryCap: 35 });
  if (reserve.length !== reserveCount) throw new Error(`Could select only ${reserve.length} of ${reserveCount} reserve products`);
  reserve.sort((a, b) => b.score - a.score || b.itemSold - a.itemSold || a.id.localeCompare(b.id, 'en'));
  return {
    ranked: selected.map((candidate, index) => ({ rank: index + 1, ...publicProduct(candidate) })),
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
  return {
    id: 'featured-dkub-book',
    featured: true,
    category: 'หนังสือและสื่อการเรียนรู้',
    imageUrl: 'https://down-th.img.susercontent.com/file/th-11134207-81ztc-moxgell974lp5f',
    cleanName: 'หนังสือคว้าเงินล้านในอากาศ ด้วยคลิป AI ปักตะกร้า ฉบับนายหน้า TikTok',
    summary: 'หนังสือสอนสร้างคลิป AI สำหรับนายหน้า TikTok ตั้งแต่หาแนวคิด วางเนื้อหา ไปจนถึงทำคลิปปักตะกร้าเป็นขั้นตอน',
    priceMin: 345,
    priceMax: 345,
    checkedAt: '2026-08-17T15:26:00+07:00',
    productUrl: 'https://shopee.co.th/product/1032408641/48511491095',
    shopName: 'DkubStore',
    shopId: '1032408641',
    itemId: '48511491095',
  };
}

export function newRejectionCounts() {
  return { malformed: 0, blockedCategory: 0, unsuitableCategory: 0, blockedText: 0, prohibitedFormat: 0, highRiskTitle: 0, nonWarehouse: 0, outOfStock: 0, holidayMode: 0, invalidIds: 0, invalidImage: 0, invalidPrice: 0, baitPrice: 0, invalidName: 0, invalidSummary: 0, contentQuality: 0, lowRating: 0, lowSignal: 0 };
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
