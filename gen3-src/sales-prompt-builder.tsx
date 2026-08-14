"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  buildSalesStepOnePrompt,
  buildSalesStepTwoPrompt,
  initialSalesStepOne,
  initialSalesStepTwo,
  type SalesStepOneData,
  type SalesStepTwoData,
} from "./sales-prompt-data";

type SalesStepId = 1 | 2;

type SavedSalesState = {
  activeStep: SalesStepId;
  stepOne: SalesStepOneData;
  stepTwo: SalesStepTwoData;
};

const STORAGE_KEY = "businessboy-gen3-sales-v1";
const IDENTITY_STORAGE_KEY = "businessboy-gen3-identity-v1";
const STORY_COUNTS = Array.from({ length: 30 }, (_, index) => String(index + 1));
const SCENE_COUNTS = Array.from({ length: 10 }, (_, index) => String(index + 1));
const FRAMEWORKS = [
  "ให้ AI เลือกโครงสร้างที่เหมาะที่สุด",
  "PAS — Problem, Agitate, Solution",
  "HSO — Hook, Story, Offer",
  "AIDA — Attention, Interest, Desire, Action",
];
const DURATIONS = ["8 วินาที", "10 วินาที", "15 วินาที"];
const CTAS = [
  "ให้ AI เลือก CTA ที่เป็นธรรมชาติ",
  "ดูรายละเอียดสินค้าที่ลิงก์",
  "กดตะกร้าเพื่อดูรายละเอียด",
  "คอมเมนต์หรือส่งข้อความเพื่อสอบถาม",
];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(source: Record<string, unknown>, key: string, fallback = "") {
  return typeof source[key] === "string" ? source[key] as string : fallback;
}

function oneOf(source: Record<string, unknown>, key: string, allowed: string[], fallback: string) {
  const candidate = text(source, key);
  return allowed.includes(candidate) ? candidate : fallback;
}

function sanitizeStepOne(input: unknown): SalesStepOneData {
  const source = record(input);
  return {
    productName: text(source, "productName", initialSalesStepOne.productName),
    productDetails: text(source, "productDetails", initialSalesStepOne.productDetails),
    willAttachProductImages: source.willAttachProductImages === true,
  };
}

function sanitizeStepTwo(input: unknown): SalesStepTwoData {
  const source = record(input);
  return {
    productName: text(source, "productName", initialSalesStepTwo.productName),
    sourceFingerprint: text(source, "sourceFingerprint", initialSalesStepTwo.sourceFingerprint),
    channelName: text(source, "channelName", initialSalesStepTwo.channelName),
    channelConcept: text(source, "channelConcept", initialSalesStepTwo.channelConcept),
    targetAudience: text(source, "targetAudience", initialSalesStepTwo.targetAudience),
    contentPillars: text(source, "contentPillars", initialSalesStepTwo.contentPillars),
    productLock: text(source, "productLock", initialSalesStepTwo.productLock),
    referencesConfirmed: source.referencesConfirmed === true,
    characterDescription: text(source, "characterDescription", initialSalesStepTwo.characterDescription),
    framework: oneOf(source, "framework", FRAMEWORKS, initialSalesStepTwo.framework),
    storyCount: oneOf(source, "storyCount", STORY_COUNTS, initialSalesStepTwo.storyCount),
    sceneCount: oneOf(source, "sceneCount", SCENE_COUNTS, initialSalesStepTwo.sceneCount),
    sceneDuration: oneOf(source, "sceneDuration", DURATIONS, initialSalesStepTwo.sceneDuration),
    cta: oneOf(source, "cta", CTAS, initialSalesStepTwo.cta),
    tone: text(source, "tone", initialSalesStepTwo.tone),
    settingPreferences: text(source, "settingPreferences", initialSalesStepTwo.settingPreferences),
    excludedSettings: text(source, "excludedSettings", initialSalesStepTwo.excludedSettings),
    useAgent: source.useAgent === true,
  };
}

function loadSavedState(): SavedSalesState {
  const defaults: SavedSalesState = {
    activeStep: 1,
    stepOne: initialSalesStepOne,
    stepTwo: initialSalesStepTwo,
  };
  if (typeof window === "undefined") return defaults;
  try {
    const source = localStorage.getItem(STORAGE_KEY);
    if (!source) return defaults;
    const parsed = record(JSON.parse(source));
    const stepOne = sanitizeStepOne(parsed.stepOne);
    const savedStepTwo = sanitizeStepTwo(parsed.stepTwo);
    const sourceFingerprint = productSourceFingerprint(stepOne);
    const staleProductContext = savedStepTwo.sourceFingerprint !== sourceFingerprint;
    const discardedOldLock = staleProductContext && (Boolean(savedStepTwo.productLock.trim()) || savedStepTwo.referencesConfirmed);
    const stepTwo = staleProductContext
      ? {
          ...savedStepTwo,
          productName: stepOne.productName,
          sourceFingerprint,
          productLock: "",
          referencesConfirmed: false,
        }
      : savedStepTwo;
    return {
      activeStep: parsed.activeStep === 2 && !discardedOldLock ? 2 : 1,
      stepOne,
      stepTwo,
    };
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage is unavailable. */ }
    return defaults;
  }
}

function readIdentityCharacter() {
  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return "";
    const parsed = record(JSON.parse(raw));
    const stepThree = record(parsed.stepThree);
    const stepTwo = record(parsed.stepTwo);
    return text(stepThree, "characterDescription") || text(stepTwo, "characterDescription");
  } catch {
    return "";
  }
}

function productSourceFingerprint(data: SalesStepOneData) {
  return JSON.stringify({
    productName: data.productName.trim().replace(/\s+/g, " "),
    productDetails: data.productDetails.trim().replace(/\s+/g, " "),
  });
}

function normalizeProductName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");
}

function hasContent(value: unknown) {
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

function validateProductLock(value: string, expectedProductName: string) {
  if (!value.trim()) return { ok: false, message: "วาง PRODUCT LOCK จาก STEP 1 ก่อน" };

  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced || value).trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return { ok: false, message: "ยังไม่พบ PRODUCT LOCK แบบ JSON ที่สมบูรณ์" };
  }

  try {
    const lock = record(JSON.parse(candidate.slice(firstBrace, lastBrace + 1)));
    if (lock.lockVersion !== "SALES_PRODUCT_LOCK_V1") {
      return { ok: false, message: "PRODUCT LOCK คนละเวอร์ชันหรือไม่มี lockVersion" };
    }
    if (lock.status !== "PASS") {
      return { ok: false, message: "PRODUCT LOCK ต้องมี status เป็น PASS" };
    }
    if (lock.sheetMode !== "FULL_ISOLATED") {
      return { ok: false, message: "Product Sheet ยังเป็นมุมจำกัด กรุณากลับ STEP 1 และเพิ่มรูปสินค้าเต็มชิ้นก่อนผลิตคลิป" };
    }
    if (normalizeProductName(text(lock, "productName")) !== normalizeProductName(expectedProductName)) {
      return { ok: false, message: "ชื่อสินค้าใน PRODUCT LOCK ไม่ตรงกับสินค้าใน STEP 1" };
    }
    if (!Array.isArray(lock.conflicts) || lock.conflicts.length > 0) {
      return { ok: false, message: "conflicts ต้องเป็นรายการว่างก่อนนำไปผลิต" };
    }
    if (!Array.isArray(lock.questions) || lock.questions.length > 0) {
      return { ok: false, message: "questions ต้องเป็นรายการว่างก่อนนำไปผลิต" };
    }
    if (!lock.visualFingerprint || typeof lock.visualFingerprint !== "object") {
      return { ok: false, message: "PRODUCT LOCK ยังไม่มี visualFingerprint" };
    }
    const fingerprint = record(lock.visualFingerprint);
    if (!["packageType", "shapeAndProportions", "primaryColors"].every((key) => hasContent(fingerprint[key]))) {
      return { ok: false, message: "visualFingerprint ยังขาดประเภทแพ็กเกจ รูปทรง หรือสีหลัก" };
    }
    if (!Array.isArray(lock.supportedSheetViews) || lock.supportedSheetViews.length === 0) {
      return { ok: false, message: "PRODUCT LOCK ยังไม่มีมุม Product Sheet ที่รองรับ" };
    }
    if (!Array.isArray(lock.verifiedFacts) || lock.verifiedFacts.length === 0) {
      return { ok: false, message: "PRODUCT LOCK ยังไม่มี verifiedFacts ที่มีหลักฐาน" };
    }
    if (!lock.verifiedFacts.every((item) => {
      const fact = record(item);
      return hasContent(fact.fact) && hasContent(fact.source);
    })) {
      return { ok: false, message: "verifiedFacts ทุกข้อต้องมี fact และ source" };
    }
    if (!Array.isArray(lock.allowedActions) || lock.allowedActions.length === 0) {
      return { ok: false, message: "PRODUCT LOCK ยังไม่มี allowedActions ที่ปลอดภัย" };
    }
    if (!lock.allowedActions.every((item) => {
      const action = record(item);
      return hasContent(action.action) && hasContent(action.source);
    })) {
      return { ok: false, message: "allowedActions ทุกข้อต้องมี action และ source" };
    }
    if (!Array.isArray(lock.authoritativeInputs) || lock.authoritativeInputs.length === 0) {
      return { ok: false, message: "PRODUCT LOCK ยังไม่มี authoritativeInputs" };
    }
    for (const key of ["verifiedClaims", "forbiddenOrUnknownActions", "unverifiedOrForbiddenClaims", "unknowns"]) {
      if (!Array.isArray(lock[key])) {
        return { ok: false, message: `PRODUCT LOCK ยังขาดรายการ ${key}` };
      }
    }
    if (!(lock.verifiedClaims as unknown[]).every((item) => {
      const claim = record(item);
      return hasContent(claim.claim) && hasContent(claim.source);
    })) {
      return { ok: false, message: "verifiedClaims ทุกข้อต้องมี claim และ source" };
    }
    return { ok: true, message: "PRODUCT LOCK ตรงกับสินค้าและพร้อมใช้" };
  } catch {
    return { ok: false, message: "อ่าน PRODUCT LOCK ไม่ได้ กรุณาคัดลอก JSON จาก Gemini มาให้ครบ" };
  }
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the selection-based clipboard fallback.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
}

const steps = [
  { id: 1 as const, title: "สร้าง Product Sheet", short: "ล็อกหน้าตาและข้อมูลสินค้า" },
  { id: 2 as const, title: "สร้างคลิปขาย", short: "ได้ตารางพร้อมผลิตในครั้งเดียว" },
];

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-heading">
        <span>{label}{required && <b className="required"> *</b>}</span>
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder = "", required = false }: { value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <input aria-required={required || undefined} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function TextArea({ value, onChange, placeholder = "", rows = 4, required = false }: { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; required?: boolean }) {
  return <textarea aria-required={required || undefined} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} />;
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>;
}

function StepOneForm({ data, setData }: { data: SalesStepOneData; setData: React.Dispatch<React.SetStateAction<SalesStepOneData>> }) {
  const patch = <K extends keyof SalesStepOneData>(key: K, value: SalesStepOneData[K]) => setData((current) => ({ ...current, [key]: value }));
  return (
    <div className="form-stack">
      <div className="info-box info-box--sales">
        <b>ขั้นตอนใช้ Prompt นี้ใน Gemini</b>
        <span>กดคัดลอก Prompt → เปิด Gemini → แนบรูปสินค้าที่ชัดเจน → วาง Prompt → ส่ง</span>
        <span>เว็บนี้ไม่รับหรือเก็บไฟล์รูป รูปจะถูกแนบใน Gemini เท่านั้น</span>
      </div>
      <Field label="ชื่อสินค้า" hint="ใช้ชื่อที่อยู่บนแพ็กเกจหรือหน้าสินค้า" required>
        <TextInput required value={data.productName} onChange={(value) => patch("productName", value)} placeholder="เช่น ผ้าเช็ดคอนโซลรถยนต์ JI-KE 80 แผ่น" />
      </Field>
      <Field label="รายละเอียดสินค้าเท่าที่มี" hint="ไม่บังคับ · ไม่รู้ให้เว้นว่าง ห้ามเดา">
        <TextArea
          value={data.productDetails}
          onChange={(value) => patch("productDetails", value)}
          placeholder="คัดลอกจากหน้าสินค้าได้ เช่น ประเภท จำนวนหรือขนาด วัสดุ วิธีใช้ จุดเด่น คำเตือน หรือข้อห้าม"
          rows={8}
        />
      </Field>
      <div className="attachment-list" aria-label="รูปสินค้าที่ควรแนบใน STEP 1">
        <b>รูปที่ควรแนบ หากมี</b>
        <span>ด้านหน้าแพ็กเกจ</span><span>ด้านหลังหรือฉลาก</span><span>ด้านข้างและอุปกรณ์ในกล่อง</span><span>ภาพวิธีใช้จริง</span>
      </div>
      <label className="switch-row">
        <span className="switch-copy">
          <b id="sales-product-images-label">ฉันจะแนบรูปสินค้าใน Gemini พร้อม Prompt นี้</b>
          <span id="sales-product-images-hint">หากไม่มีรูป Gemini ต้องหยุดและขอรูปก่อนสร้าง Product Sheet</span>
        </span>
        <input
          aria-describedby="sales-product-images-hint"
          aria-labelledby="sales-product-images-label"
          aria-required="true"
          checked={data.willAttachProductImages}
          onChange={(event) => patch("willAttachProductImages", event.target.checked)}
          role="switch"
          type="checkbox"
        />
      </label>
    </div>
  );
}

function StepTwoForm({
  data,
  setData,
  onImportCharacter,
  importStatus,
  productResetNotice,
}: {
  data: SalesStepTwoData;
  setData: React.Dispatch<React.SetStateAction<SalesStepTwoData>>;
  onImportCharacter: () => void;
  importStatus: string;
  productResetNotice: string;
}) {
  const patch = <K extends keyof SalesStepTwoData>(key: K, value: SalesStepTwoData[K]) => setData((current) => ({ ...current, [key]: value }));
  const lockValidation = validateProductLock(data.productLock, data.productName);
  const lockPasses = lockValidation.ok;
  return (
    <div className="form-stack">
      <div className="sales-product-summary"><span>สินค้าที่กำลังทำ</span><b>{data.productName || "ยังไม่ได้ระบุชื่อสินค้า"}</b></div>
      {productResetNotice && <div className="info-box info-box--warning" role="status"><b>ข้อมูลสินค้าเปลี่ยนแล้ว</b><span>{productResetNotice}</span></div>}
      <div className="info-box info-box--sales">
        <b>ใน Gemini ให้แนบเพียง 2 ไฟล์</b>
        <span>1. Character Sheet</span>
        <span>2. Product Sheet ที่ตรวจผ่านจาก STEP 1</span>
        <span>จากนั้นวาง Prompt นี้เพื่อรับตารางคลิปขายพร้อมผลิต</span>
      </div>
      <Field label="PRODUCT LOCK จาก STEP 1" hint="วางบล็อก JSON ที่ Gemini ให้มา" required>
        <TextArea
          required
          value={data.productLock}
          onChange={(value) => setData((current) => ({ ...current, productLock: value, referencesConfirmed: false }))}
          placeholder='วางข้อมูลที่มี "status": "PASS"'
          rows={13}
        />
      </Field>
      {data.productLock.trim() && (
        <div className={lockPasses ? "lock-status lock-status--pass" : "lock-status lock-status--wait"} role="status">
          <b>{lockPasses ? "PRODUCT LOCK พร้อมใช้" : "PRODUCT LOCK ยังไม่พร้อม"}</b>
          <span>{lockValidation.message}</span>
        </div>
      )}
      <label className="switch-row">
        <span className="switch-copy">
          <b id="sales-references-label">ฉันตรวจแล้วว่า Product Sheet และ PRODUCT LOCK ตรงกับสินค้าจริง และจะแนบ Character Sheet กับ Product Sheet ใน Gemini พร้อม Prompt นี้</b>
          <span id="sales-references-hint">Product Sheet และ PRODUCT LOCK ต้องตรงทั้งชื่อ รุ่น สี รูปทรง ฝา ฉลาก จำนวนชิ้น อุปกรณ์ และวิธีใช้ก่อนผลิต</span>
        </span>
        <input
          aria-describedby="sales-references-hint"
          aria-labelledby="sales-references-label"
          aria-required="true"
          checked={data.referencesConfirmed}
          onChange={(event) => patch("referencesConfirmed", event.target.checked)}
          role="switch"
          type="checkbox"
        />
      </label>
      <div className="section-divider"><span>ข้อมูลช่องที่จะลงคลิป</span></div>
      <div className="info-box info-box--sales">
        <b>กรอกข้อมูลจากโหมดสร้างตัวตนอีกครั้ง</b>
        <span>นำข้อมูลจากผลลัพธ์เดิมมากรอก หรือปรับใหม่ให้เข้ากับช่องได้ ระบบจะจำข้อมูลไว้ในเครื่องนี้</span>
      </div>
      <Field label="ชื่อช่อง" hint="ชื่อเพจหรือช่องที่จะลงคลิปนี้" required>
        <TextInput
          required
          value={data.channelName}
          onChange={(value) => patch("channelName", value)}
          placeholder="เช่น แม่มะปรางลองแล้วมาเล่า"
        />
      </Field>
      <Field label="แก่นหลักของช่อง" hint="นำหัวข้อ “แก่นหลักของช่อง” จากผลลัพธ์โหมดสร้างตัวตนมากรอก หรือเติมเองได้เลย" required>
        <TextArea
          required
          value={data.channelConcept}
          onChange={(value) => patch("channelConcept", value)}
          placeholder="ช่องนี้พูดเรื่องอะไร เล่าแบบไหน และต่างจากช่องทั่วไปอย่างไร"
          rows={4}
        />
      </Field>
      <div className="field-grid sales-channel-grid">
        <Field label="กลุ่มเป้าหมายและปัญหาหลัก" hint="นำจากผลลัพธ์โหมดสร้างตัวตน หรือเติมเองได้เลย" required>
          <TextArea
            required
            value={data.targetAudience}
            onChange={(value) => patch("targetAudience", value)}
            placeholder="คนดูหลักคือใคร และกำลังเจอปัญหาอะไร"
            rows={5}
          />
        </Field>
        <Field label="เสาหลักเนื้อหา 3–5 ข้อ" hint="นำจากผลลัพธ์โหมดสร้างตัวตน และเขียนแยกบรรทัด" required>
          <TextArea
            required
            value={data.contentPillars}
            onChange={(value) => patch("contentPillars", value)}
            placeholder="เช่น รีวิวของใช้จริง\nเคล็ดลับประหยัดเวลา\nแก้ปัญหาในชีวิตประจำวัน"
            rows={5}
          />
        </Field>
      </div>
      <div className="section-divider"><span>ข้อมูลตัวละคร</span></div>
      <div className="field field-with-action">
        <div className="field-heading">
          <span>รายละเอียดตัวละครหลัก<b className="required"> *</b></span>
          <button className="import-identity-button" onClick={onImportCharacter} type="button">ดึงจากโหมดสร้างตัวตน</button>
        </div>
        <textarea
          aria-label="รายละเอียดตัวละครหลัก"
          aria-required="true"
          onChange={(event) => patch("characterDescription", event.target.value)}
          placeholder="วาง Character Description ที่ตรงกับ Character Sheet"
          rows={7}
          required
          value={data.characterDescription}
        />
        {importStatus && <small className="field-feedback" role="status">{importStatus}</small>}
      </div>
      <div className="section-divider"><span>ตั้งค่าคลิปที่จะผลิต</span></div>
      <div className="field-grid">
        <Field label="โครงสร้าง">
          <Select value={data.framework} onChange={(value) => patch("framework", value)}>{FRAMEWORKS.map((item) => <option key={item}>{item}</option>)}</Select>
        </Field>
        <Field label="ตอนจบอยากให้คนทำอะไร">
          <Select value={data.cta} onChange={(value) => patch("cta", value)}>{CTAS.map((item) => <option key={item}>{item}</option>)}</Select>
        </Field>
      </div>
      <div className="field-grid triple-grid">
        <Field label="จำนวนเรื่อง"><Select value={data.storyCount} onChange={(value) => patch("storyCount", value)}>{STORY_COUNTS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
        <Field label="ฉากต่อเรื่อง"><Select value={data.sceneCount} onChange={(value) => patch("sceneCount", value)}>{SCENE_COUNTS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
        <Field label="เวลาต่อฉาก"><Select value={data.sceneDuration} onChange={(value) => patch("sceneDuration", value)}>{DURATIONS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
      </div>
      <label className="switch-row">
        <span className="switch-copy">
          <b id="sales-agent-sheets-label">ให้ Agent บันทึกลง Google Sheets</b>
          <span id="sales-agent-sheets-hint">ใช้เมื่อวาง Prompt ในโหมด Agent ที่เชื่อม Google Sheets แล้ว · 1 เรื่อง = 1 แท็บ</span>
        </span>
        <input
          aria-describedby="sales-agent-sheets-hint"
          aria-labelledby="sales-agent-sheets-label"
          checked={data.useAgent}
          onChange={(event) => patch("useAgent", event.target.checked)}
          role="switch"
          type="checkbox"
        />
      </label>
      <Field label="โทนการเล่า"><TextInput value={data.tone} onChange={(value) => patch("tone", value)} /></Field>
      <div className="field-grid">
        <Field label="สถานที่หรือบรรยากาศที่ต้องการ"><TextArea value={data.settingPreferences} onChange={(value) => patch("settingPreferences", value)} rows={3} /></Field>
        <Field label="สถานที่ที่ไม่ต้องการ"><TextArea value={data.excludedSettings} onChange={(value) => patch("excludedSettings", value)} placeholder="เช่น ห้ามใช้คาเฟ่ ห้ามใช้ห้องหรู" rows={3} /></Field>
      </div>
    </div>
  );
}

export function SalesPromptBuilder() {
  const [savedState] = useState(loadSavedState);
  const [activeStep, setActiveStep] = useState<SalesStepId>(savedState.activeStep);
  const [stepOne, setStepOne] = useState(savedState.stepOne);
  const [stepTwo, setStepTwo] = useState(savedState.stepTwo);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [productResetNotice, setProductResetNotice] = useState("");
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeStep, stepOne, stepTwo }));
    } catch {
      // The builder remains usable when private browsing or storage policies block localStorage.
    }
  }, [activeStep, stepOne, stepTwo]);

  const prompt = useMemo(
    () => activeStep === 1 ? buildSalesStepOnePrompt(stepOne) : buildSalesStepTwoPrompt(stepTwo),
    [activeStep, stepOne, stepTwo],
  );

  const missing = useMemo(() => {
    if (activeStep === 1) {
      const fields: string[] = [];
      if (!stepOne.productName.trim()) fields.push("ชื่อสินค้า");
      if (!stepOne.willAttachProductImages) fields.push("ยืนยันว่าจะแนบรูปสินค้า");
      return fields;
    }
    const fields: string[] = [];
    if (!stepTwo.productName.trim()) fields.push("ชื่อสินค้า");
    if (stepTwo.sourceFingerprint !== productSourceFingerprint(stepOne)) fields.push("สร้าง PRODUCT LOCK ใหม่หลังข้อมูลสินค้าเปลี่ยน");
    if (!stepTwo.channelName.trim()) fields.push("ชื่อช่อง");
    if (!stepTwo.channelConcept.trim()) fields.push("แก่นหลักของช่อง");
    if (!stepTwo.targetAudience.trim()) fields.push("กลุ่มเป้าหมายและปัญหาหลัก");
    if (!stepTwo.contentPillars.trim()) fields.push("เสาหลักเนื้อหา 3–5 ข้อ");
    if (!stepTwo.productLock.trim()) fields.push("PRODUCT LOCK");
    else if (!validateProductLock(stepTwo.productLock, stepTwo.productName).ok) fields.push("PRODUCT LOCK ที่ตรวจผ่าน");
    if (!stepTwo.referencesConfirmed) fields.push("ยืนยัน Character Sheet และ Product Sheet");
    if (!stepTwo.characterDescription.trim()) fields.push("รายละเอียดตัวละครหลัก");
    return fields;
  }, [activeStep, stepOne, stepTwo]);

  async function copyPrompt() {
    if (missing.length) return;
    setCopyError("");
    try {
      await copyToClipboard(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError("คัดลอกอัตโนมัติไม่สำเร็จ กรุณากดดู Prompt แล้วคัดลอกด้วยตนเอง");
    }
  }

  function syncStepTwoProduct() {
    const sourceFingerprint = productSourceFingerprint(stepOne);
    const productChanged = stepTwo.sourceFingerprint !== sourceFingerprint;
    const clearedExistingLock = productChanged && (Boolean(stepTwo.productLock.trim()) || stepTwo.referencesConfirmed);

    setStepTwo((current) => productChanged
      ? {
          ...current,
          productName: stepOne.productName,
          sourceFingerprint,
          productLock: "",
          referencesConfirmed: false,
        }
      : { ...current, productName: stepOne.productName, sourceFingerprint });
    setProductResetNotice(clearedExistingLock
      ? "ระบบล้าง PRODUCT LOCK และคำยืนยันเดิมให้แล้ว กรุณาสร้างและตรวจ Product Sheet ใหม่ก่อนผลิต"
      : "");
  }

  function goNext() {
    if (missing.length || activeStep !== 1) return;
    syncStepTwoProduct();
    setActiveStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectStep(step: SalesStepId) {
    if (step === 2) {
      if (!stepOne.productName.trim() || !stepOne.willAttachProductImages) return;
      syncStepTwoProduct();
    }
    setActiveStep(step);
  }

  function resetStep() {
    if (!window.confirm(`ล้างข้อมูล STEP ${activeStep} ทั้งหมดใช่ไหม?`)) return;
    if (activeStep === 1) setStepOne(initialSalesStepOne);
    else setStepTwo({
      ...initialSalesStepTwo,
      productName: stepOne.productName,
      sourceFingerprint: productSourceFingerprint(stepOne),
    });
    setImportStatus("");
    setProductResetNotice("");
    setCopyError("");
  }

  function importCharacter() {
    const character = readIdentityCharacter();
    if (!character) {
      setImportStatus("ยังไม่พบรายละเอียดตัวละครในโหมดสร้างตัวตนบนเครื่องนี้");
      return;
    }
    setStepTwo((current) => ({ ...current, characterDescription: character }));
    setImportStatus("ดึงรายละเอียดตัวละครจากโหมดสร้างตัวตนแล้ว");
  }

  const currentStep = steps[activeStep - 1];
  const copyLabel = activeStep === 1 ? "คัดลอก Prompt สร้าง Product Sheet" : "คัดลอก Prompt สร้างคลิปขาย";

  return (
    <div className="builder-shell">
      <aside className="mode-banner mode-banner--sales" aria-label="โหมดที่กำลังใช้งาน">
        <span className="mode-banner__mark" aria-hidden="true">฿</span>
        <span className="mode-banner__copy">
          <span className="mode-banner__kicker">กำลังใช้งาน</span>
          <strong>คลิปขายสินค้า (Sales)</strong>
          <small>ล็อก Product Sheet ก่อน แล้วสร้างตารางขายพร้อมผลิตในขั้นเดียว</small>
        </span>
        <a className="mode-banner__link" href="/gen3">กลับหน้าเลือกประเภทคลิป</a>
      </aside>
      <nav className="stepper stepper--sales" aria-label="ขั้นตอนสร้าง Prompt คลิปขาย">
        {steps.map((step, index) => (
          <button
            aria-current={activeStep === step.id ? "step" : undefined}
            aria-label={`STEP 0${step.id}: ${step.title} — ${step.short}`}
            className={activeStep === step.id ? "step active" : activeStep > step.id ? "step done" : "step"}
            disabled={step.id === 2 && (!stepOne.productName.trim() || !stepOne.willAttachProductImages)}
            key={step.id}
            onClick={() => selectStep(step.id)}
            type="button"
          >
            <span className="step-number">{activeStep > step.id ? "✓" : `0${step.id}`}</span>
            <span><b>{step.title}</b><small>{step.short}</small></span>
            {index === 0 && <i />}
          </button>
        ))}
      </nav>
      <div className="builder-grid">
        <section className="form-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">STEP 0{activeStep}</span><h1>{currentStep.title}</h1><p>{currentStep.short}</p></div>
            <button className="reset-button" onClick={resetStep} type="button">ล้างข้อมูล</button>
          </div>
          {activeStep === 1
            ? <StepOneForm data={stepOne} setData={setStepOne} />
            : <StepTwoForm data={stepTwo} importStatus={importStatus} onImportCharacter={importCharacter} productResetNotice={productResetNotice} setData={setStepTwo} />}
        </section>
        <aside className={previewOpen ? "preview-panel mobile-open" : "preview-panel"}>
          <div className="preview-heading">
            <div><span className="status-dot" /><b>Prompt พร้อมใช้งาน</b><small>{prompt.length.toLocaleString("th-TH")} ตัวอักษร</small></div>
            <button aria-label="ปิดตัวอย่าง Prompt" onClick={() => setPreviewOpen(false)} type="button">×</button>
          </div>
          <pre>{prompt}</pre>
          <div className="preview-actions">
            {missing.length > 0 && <p>กรอกให้ครบ: {missing.join(", ")}</p>}
            {copyError && <p role="alert">{copyError}</p>}
            <button className="copy-button" disabled={missing.length > 0} onClick={copyPrompt} type="button">
              <span>{copied ? "✓" : "⧉"}</span>{copied ? "คัดลอกแล้ว" : copyLabel}
            </button>
          </div>
        </aside>
      </div>
      <div className="bottom-bar">
        <button className="preview-mobile-button" onClick={() => setPreviewOpen(true)} type="button">ดู Prompt</button>
        <div className="bottom-status"><span>บันทึกในเครื่องอัตโนมัติ</span>{missing.length > 0 && <small>เหลือ {missing.length} ช่องสำคัญ</small>}</div>
        <button className="copy-secondary" disabled={missing.length > 0} onClick={copyPrompt} type="button">{copied ? "คัดลอกแล้ว ✓" : "คัดลอก Prompt"}</button>
        {activeStep === 1 && <button className="next-button" disabled={missing.length > 0} onClick={goNext} type="button">บันทึกและไป STEP 2 →</button>}
      </div>
      {copied && <div className="toast" role="status">คัดลอก Prompt แล้ว นำไปวางใน Gemini ได้เลย</div>}
    </div>
  );
}
