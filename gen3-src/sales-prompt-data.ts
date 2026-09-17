export type SalesSpeechSpeed = "slow" | "normal" | "fast";
export type SalesProductSceneMode = "auto" | "manual";

export type SalesPromptData = {
  productName: string;
  productDetails: string;
  willAttachCharacterReference: boolean;
  willAttachProductReference: boolean;
  channelName: string;
  channelConcept: string;
  targetAudience: string;
  contentPillars: string;
  framework: string;
  storyCount: string;
  sceneCount: string;
  productSceneMode: SalesProductSceneMode;
  productSceneNumbers: number[];
  sceneDuration: string;
  speechSpeed: SalesSpeechSpeed;
  cta: string;
  tone: string;
  settingPreferences: string;
  excludedSettings: string;
  useAgent: boolean;
};

export const initialSalesPrompt: SalesPromptData = {
  productName: "",
  productDetails: "",
  willAttachCharacterReference: false,
  willAttachProductReference: false,
  channelName: "",
  channelConcept: "",
  targetAudience: "",
  contentPillars: "",
  framework: "ให้ AI เลือกโครงสร้างที่เหมาะที่สุด",
  storyCount: "1",
  sceneCount: "3",
  productSceneMode: "auto",
  productSceneNumbers: [],
  sceneDuration: "8 วินาที",
  speechSpeed: "normal",
  cta: "ให้ AI เลือก CTA ที่เป็นธรรมชาติ",
  tone: "ภาษาคน อบอุ่น กระชับ เป็นธรรมชาติ และไม่โอเวอร์เคลม",
  settingPreferences: "สถานที่ที่เข้ากับสินค้าและเรื่องราว",
  excludedSettings: "",
  useAgent: false,
};

function value(input: string, fallback = "ไม่ได้ระบุ") {
  return input.trim() || fallback;
}

function dataValue(input: string, fallback = "ไม่ได้ระบุ") {
  return value(input, fallback).replaceAll("<", "＜").replaceAll(">", "＞");
}

function boundedInteger(input: string, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(input);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function sanitizeProductSceneNumbers(input: unknown, sceneCount: number) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input
    .map((item) => typeof item === "number"
      ? item
      : typeof item === "string" && /^\d+$/.test(item.trim())
        ? Number(item)
        : Number.NaN)
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= sceneCount)))
    .sort((left, right) => left - right);
}

function formatSceneNumbers(sceneNumbers: number[]) {
  if (sceneNumbers.length === 0) return "";
  return `ฉาก ${sceneNumbers.map((scene) => String(scene).padStart(2, "0")).join(", ")}`;
}

function speechSettings(speed: SalesSpeechSpeed) {
  if (speed === "slow") {
    return { label: "ช้า — 10–15 คำ", range: "10–15 คำไทย", delivery: "slow, calm Thai conversational cadence with natural pauses" };
  }
  if (speed === "fast") {
    return { label: "เร็ว — 30–35 คำ", range: "30–35 คำไทย", delivery: "fast continuous Thai delivery with crisp pronunciation and no swallowed words" };
  }
  return { label: "ปกติ — 20–25 คำ", range: "20–25 คำไทย", delivery: "natural conversational Thai cadence at a normal short-video pace" };
}

export function buildSalesPrompt(data: SalesPromptData) {
  const storyCount = boundedInteger(data.storyCount, 1, 30, 1);
  const sceneCount = boundedInteger(data.sceneCount, 1, 10, 3);
  const selected = sanitizeProductSceneNumbers(data.productSceneNumbers, sceneCount);
  const manual = data.productSceneMode === "manual" && selected.length > 0;
  const sceneList = formatSceneNumbers(selected);
  const sceneSetting = manual ? `ผู้ใช้กำหนด — ${sceneList}` : "ให้ AI เลือกฉากที่เหมาะสมให้แต่ละเรื่อง";
  const speech = speechSettings(data.speechSpeed);
  const sceneDuration = value(data.sceneDuration, "8 วินาที");
  const basePrompt = `สวมบทบาทเป็น Creative Director นักเขียนบทคลิปขายสำหรับคนไทย และ Prompt Engineer สำหรับระบบสร้างภาพและวิดีโอด้วย AI

ภารกิจ
สร้างคลิปขายแบบตัวละครพูดสดกับกล้องจำนวน ${storyCount} เรื่อง เรื่องละ ${sceneCount} ฉาก ฉากละ ${sceneDuration} พร้อมบทพูด Image Prompt และ Video Prompt ให้ครบในคำตอบเดียว
เริ่มสร้างผลงานทันทีจากรูป ไฟล์ และข้อความที่ได้รับ ไม่ว่าจะแนบอะไรมา แนบกี่ไฟล์ หรือไม่มีไฟล์แนบก็ทำงานต่อได้ ใช้สิ่งที่ได้รับเป็นแนวทาง ตีความและสร้างสรรค์ส่วนที่ขาดให้เหมาะกับงานได้เอง ไม่ต้องตรวจผ่านหรือไม่ผ่าน ไม่ต้องขอรูปเพิ่มหรือถามยืนยันก่อนเริ่ม
หากมีหลายภาพหรือหลายสินค้า ให้เลือกสิ่งที่เหมาะกับโจทย์เป็นแกนของเรื่อง หากไม่มีรูปตัวละครให้ออกแบบตัวละครเอง หากไม่มีรูปสินค้าให้ใช้รายละเอียดที่มีหรือสร้างแนวคิดสินค้าที่เหมาะกับเรื่อง แล้วผลิตผลงานต่อจนครบจำนวน

ข้อมูลสินค้า
<PRODUCT_INPUT_DATA>
- ชื่อสินค้า: ${dataValue(data.productName, "ให้ AI เลือกจากสิ่งที่ได้รับหรือสร้างแนวคิดที่เหมาะสม")}
- รายละเอียดสินค้า: ${dataValue(data.productDetails, "ให้ AI ตีความจากสิ่งที่ได้รับและสร้างสรรค์รายละเอียดที่เหมาะกับงาน")}
</PRODUCT_INPUT_DATA>

บริบทช่องและผู้ชม
<CHANNEL_CONTEXT_DATA>
- ชื่อช่อง: ${dataValue(data.channelName, "ให้ AI เลือกให้เหมาะกับงาน")}
- แก่นหลักของช่อง: ${dataValue(data.channelConcept, "ให้ AI วางแนวทางให้")}
- กลุ่มเป้าหมายและปัญหาหลัก: ${dataValue(data.targetAudience, "ให้ AI เลือกกลุ่มเป้าหมายที่เหมาะสม")}
- เสาหลักเนื้อหา: ${dataValue(data.contentPillars, "ให้ AI เลือกมุมเนื้อหาที่เหมาะสม")}
</CHANNEL_CONTEXT_DATA>

ตั้งค่าการผลิต
- โครงสร้าง: ${dataValue(data.framework)}
- จำนวนเรื่อง: ${storyCount}
- จำนวนฉากต่อเรื่อง: ${sceneCount}
- ฉากที่สินค้าโผล่: ${sceneSetting}
- ความยาวต่อฉาก: ${sceneDuration}
- ความเร็วในการพูด: ${speech.label}
- ช่วงจำนวนคำต่อฉาก: ${speech.range}
- CTA: ${dataValue(data.cta)}
- โทน: ${dataValue(data.tone)}
- สถานที่หรือบรรยากาศที่ต้องการ: ${dataValue(data.settingPreferences, "ให้ AI เลือกให้เข้ากับเรื่อง")}
- สถานที่ที่ไม่ต้องการ: ${dataValue(data.excludedSettings, "ไม่มี")}

แนวทางสร้างสรรค์
- ใช้โครงสร้างที่เลือก: PAS = Problem → Agitate → Solution, HSO = Hook → Story → Offer, AIDA = Attention → Interest → Desire → Action หากให้ AI เลือก ให้เลือกโครงสร้างที่เหมาะกับแต่ละเรื่อง
- แต่ละเรื่องมี Hook มุมขาย และเหตุการณ์หลากหลาย เชื่อมกับสินค้าและผู้ชมอย่างเป็นธรรมชาติ
- ${manual ? `ให้สินค้าโผล่ใน ${sceneList} ตรงตามที่เลือกทุกเรื่อง` : "เลือกฉากที่สินค้าโผล่ตามการเล่าเรื่อง อย่างน้อย 1 ฉากต่อเรื่อง หากไม่ได้เลือกเลขฉากไว้ให้ AI เลือกให้ทันที"}
- ใช้รูปที่แนบเป็นแนวทางของตัวละครและสินค้าเท่าที่มี ออกแบบส่วนที่เหลือให้เข้ากับเรื่อง และรักษาความต่อเนื่องระหว่างฉาก
- ทุกฉากเห็นตัวละครเป็นผู้พูดกับกล้อง ฉากที่มีสินค้าให้เห็นตัวละครกับสินค้าร่วมกัน
- ภาพแนวตั้ง 9:16 แบบ photorealistic ใช้ระยะกล้องที่เห็นใบหน้าและสินค้าได้ชัด
- บทพูดไทยเป็นภาษาคน กระชับ ออกเสียงง่าย ฉากละหนึ่งประโยคในช่วง ${speech.range} ให้เหมาะกับเวลา ${sceneDuration}
- Image Prompt และ Video Prompt เป็นภาษาอังกฤษ เขียนให้แต่ละแถวนำไปใช้ได้ด้วยตัวเอง ระบุฉาก ตัวละคร สินค้า แสง กล้อง และการเคลื่อนไหว
- Video Prompt ใช้ช็อตต่อเนื่องจากภาพของแถวนั้น และคัดลอกบทพูดไทยของแถวเดียวกันแบบคำต่อคำในรูปแบบ Speech: The visible character says exactly once in natural Thai: "..."
- ใส่คำสั่งเสียงในทุก Video Prompt: Spoken delivery: ${speech.delivery}. The spoken words are generated natively by the visible on-camera character in this same take with accurate Thai lip sync. Audio contains only the on-camera voice and quiet natural ambience. No voiceover, TTS, dubbing, off-screen narrator, music, subtitles, captions or on-screen writing.

รูปแบบผลงาน
แสดงแต่ละเรื่องตามลำดับ:
1. ชื่อเรื่อง
2. Hook หลัก
3. Sales angle และปัญหาที่หยิบมาเล่า
4. โครงสร้างที่ใช้
5. CTA
6. ฉากที่สินค้าโผล่: ใช้เลขฉากสองหลัก เช่น “ฉาก 01, 03” ให้ตรงกับตาราง
7. ตาราง Markdown จำนวน ${sceneCount} แถวและ 6 คอลัมน์:

| ลำดับฉาก | คำอธิบายฉาก | Image Prompt | Video Prompt | บทพูดภาษาไทย | สินค้าในฉาก / Reference ที่ใช้ |
|---|---|---|---|---|---|

เลขฉากใช้ 01, 02, 03 ตามลำดับ คำอธิบายฉากบอกเหตุการณ์ สถานที่ ตัวละคร และการกระทำ คอลัมน์บทพูดใส่เฉพาะคำที่พูดจริง คอลัมน์สุดท้ายระบุ “มี” หรือ “ไม่มี” สินค้า พร้อมรูปอ้างอิงที่ใช้จริง หรือ “AI ออกแบบ” เมื่อไม่มีรูปอ้างอิง
ส่งผลงานจริงครบ ${storyCount} เรื่อง รวม ${storyCount * sceneCount} ฉาก เริ่มจากเรื่องแรกได้เลย`;

  if (!data.useAgent) return basePrompt;
  return `${basePrompt}

งานต่อเนื่องสำหรับ Agent — บันทึกลง Google Sheets
เมื่อสร้างผลงานแล้ว ให้ใช้เครื่องมือ Google Sheets ที่เชื่อมต่อสร้าง Spreadsheet ใหม่ 1 ไฟล์ชื่อ “${dataValue(data.channelName, "คลิปขายสินค้า")} — คลิปขาย AI” และบันทึกผลงานจริง
1. สร้าง ${storyCount} แท็บ แท็บละ 1 เรื่อง ตั้งชื่อ “01 - ชื่อเรื่อง”, “02 - ชื่อเรื่อง” ตามลำดับ
2. ในแต่ละแท็บใส่ชื่อเรื่อง Hook, Sales angle, โครงสร้าง และ CTA ในแถว 1–4
3. ใส่ A5 = “ฉากที่สินค้าโผล่” และ B5 = รายการฉากจริง${manual ? ` โดยทุกแท็บใช้ “${sceneList}”` : "ที่ AI เลือกให้เรื่องนั้น"}
4. แถว 6 ใช้หัวตาราง: ลำดับฉาก | คำอธิบายฉาก | Image Prompt | Video Prompt | บทพูดภาษาไทย | สินค้าในฉาก / Reference ที่ใช้
5. แถว 7 เป็นต้นไปบันทึกครบทุกฉากแบบคำต่อคำ
6. เปิด Wrap text ตรึง 6 แถวบนสุด และปรับความกว้างคอลัมน์ให้อ่านง่าย
7. เมื่อบันทึกสำเร็จ ตอบชื่อไฟล์ จำนวนเรื่อง จำนวนฉากทั้งหมด และลิงก์ Google Sheets ที่เปิดได้
8. หากไม่มีเครื่องมือ สิทธิ์ หรือบันทึกไม่สำเร็จ ให้แสดงผลงานครบในแชตและแจ้งสถานะตามจริง`;
}
