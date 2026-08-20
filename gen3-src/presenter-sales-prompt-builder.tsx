"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ADULT_ADDRESSES,
  ADULT_HOOK_ARCHETYPES,
  applyPresenterIdentityContext,
  buildPresenterSalesPrompt,
  CHARM_LEVELS,
  CHARM_STYLES,
  extractPresenterIdentityContext,
  initialPresenterSalesData,
  JANGRAI_FRAMEWORK,
  migratePresenterSalesState,
  DIRECT_SALES_CTAS,
  POSE_ENERGIES,
  PRESENTER_IDENTITY_STORAGE_KEY,
  PRESENTER_SALES_STORAGE_KEY,
  PRODUCT_CATEGORIES,
  PRODUCT_INTERACTIONS,
  presenterSalesMissingFields,
  presenterSalesSafetyIssues,
  SALES_CTAS,
  SALES_FRAMEWORKS,
  SCENE_COUNTS,
  SCENE_DURATIONS,
  SELLING_ANGLES,
  STORY_COUNTS,
  setPresenterSalesCreativeMode,
  updatePresenterSalesIdentityField,
  type PresenterIdentityConfirmationField,
  type PresenterSalesData,
  type PresenterSalesProductSceneMode,
  type PresenterSalesSavedState,
  type PresenterSalesSpeechSpeed,
} from "./presenter-sales-prompt-data";

const SPEECH_SPEEDS: Array<{ value: PresenterSalesSpeechSpeed; label: string }> = [
  { value: "slow", label: "ช้า — 10–15 คำ" },
  { value: "normal", label: "ปกติ — 20–25 คำ (แนะนำ)" },
  { value: "fast", label: "เร็ว — 30–35 คำ" },
];

function loadSavedState(): PresenterSalesSavedState {
  const fallback: PresenterSalesSavedState = { schemaVersion: 2, activeStep: 1, data: initialPresenterSalesData };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(PRESENTER_SALES_STORAGE_KEY);
    return raw ? migratePresenterSalesState(JSON.parse(raw)) : fallback;
  } catch {
    try { sessionStorage.removeItem(PRESENTER_SALES_STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
    return fallback;
  }
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard is unavailable");
}

function Field({ children, hint, label, required = false }: { children: React.ReactNode; hint?: string; label: string; required?: boolean }) {
  return <label className="field"><span className="field-heading"><span>{label}{required && <b className="required"> *</b>}</span>{hint && <small>{hint}</small>}</span>{children}</label>;
}

function TextInput({ onChange, placeholder, readOnly = false, required = false, value }: { onChange: (value: string) => void; placeholder?: string; readOnly?: boolean; required?: boolean; value: string }) {
  return <input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} required={required} type="text" value={value} />;
}

function TextArea({ maxLength, onChange, placeholder, readOnly = false, required = false, rows = 4, value }: { maxLength?: number; onChange: (value: string) => void; placeholder?: string; readOnly?: boolean; required?: boolean; rows?: number; value: string }) {
  return <textarea maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} required={required} rows={rows} value={value} />;
}

function Select({ children, disabled = false, onChange, value }: { children: React.ReactNode; disabled?: boolean; onChange: (value: string) => void; value: string }) {
  return <select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>{children}</select>;
}

function Confirmation({ checked, hint, id, label, onChange }: { checked: boolean; hint: string; id: string; label: string; onChange: (checked: boolean) => void }) {
  return <label className="switch-row"><span className="switch-copy"><b id={`${id}-label`}>{label}</b><span id={`${id}-hint`}>{hint}</span></span><input aria-describedby={`${id}-hint`} aria-labelledby={`${id}-label`} aria-required="true" checked={checked} onChange={(event) => onChange(event.target.checked)} role="switch" type="checkbox" /></label>;
}

function StepOneForm({ data, importStatus, onImport, setData }: { data: PresenterSalesData; importStatus: string; onImport: () => void; setData: React.Dispatch<React.SetStateAction<PresenterSalesData>> }) {
  const patch = <K extends keyof PresenterSalesData>(key: K, value: PresenterSalesData[K]) => setData((current) => ({ ...current, [key]: value }));
  const patchIdentity = <K extends PresenterIdentityConfirmationField>(key: K, value: PresenterSalesData[K]) => setData((current) => updatePresenterSalesIdentityField(current, key, value));
  const imported = data.presenterSource === "identity";
  return <div className="form-stack" style={{ padding: 0 }}>
    <div className="info-box info-box--sales"><b>ใช้ตัวละครเดิมเป็น Presenter Lock</b><span>Character Reference เป็นแหล่งจริงสูงสุด ระบบจะไม่เปลี่ยนหน้า อายุ รูปร่าง ผม เสื้อผ้า หรือลุคประเทศเพื่อให้เข้ากับสินค้า</span></div>
    <Field label="แหล่งข้อมูลพรีเซนเตอร์" required><Select onChange={(value) => patchIdentity("presenterSource", value === "manual" ? "manual" : "identity")} value={data.presenterSource}><option value="identity">ดึงจากโหมดสร้างตัวตนสาวสวย/หนุ่มหล่อ</option><option value="manual">กรอกข้อมูล Character Lock เอง</option></Select></Field>
    {imported && <div className="field field-with-action"><span className="field-heading"><span>ข้อมูลตัวตนบนเครื่องนี้</span><button className="import-identity-button" onClick={onImport} type="button">ดึงข้อมูล Presenter Identity</button></span>{importStatus && <small className="field-feedback" role="status">{importStatus}</small>}</div>}
    {imported && <div className="info-box"><b>ช่องด้านล่างล็อกตามข้อมูลที่นำเข้า</b><span>หากต้องสร้างคนใหม่ ให้กลับไปโหมดสร้างตัวตนและทำ Character Sheet ใหม่ หรือเปลี่ยนเป็น “กรอกเอง” เมื่อมี Character Lock จากภายนอก</span></div>}
    <div className="field-grid">
      <Field label="ชื่อตัวละคร"><TextInput onChange={(value) => patchIdentity("presenterName", value)} placeholder="เช่น มีลิน" readOnly={imported} value={data.presenterName} /></Field>
      <Field label="ชื่อช่อง" required><TextInput onChange={(value) => patch("channelName", value)} placeholder="เช่น มีลินลองให้แล้ว" readOnly={imported} required value={data.channelName} /></Field>
    </div>
    <Field label="แก่นหลักของช่อง" required><TextArea onChange={(value) => patch("channelConcept", value)} placeholder="ช่องนี้ช่วยคนดูเรื่องอะไร และต่างจากช่องอื่นอย่างไร" readOnly={imported} required value={data.channelConcept} /></Field>
    <div className="field-grid sales-channel-grid">
      <Field label="กลุ่มเป้าหมายและปัญหาหลัก" required><TextArea onChange={(value) => patch("targetAudience", value)} readOnly={imported} required rows={5} value={data.targetAudience} /></Field>
      <Field label="เสาหลักเนื้อหา 3–5 ข้อ" required><TextArea onChange={(value) => patch("contentPillars", value)} placeholder="เขียนแยกบรรทัด" readOnly={imported} required rows={5} value={data.contentPillars} /></Field>
    </div>
    <Field label="Character / Identity Lock" hint="ใบหน้า อายุ ผิว ผม รูปร่าง ชุด เครื่องประดับ และจุดจำ" required><TextArea onChange={(value) => patchIdentity("presenterDescription", value)} placeholder="วางรายละเอียดตัวละครจาก Character Sheet" readOnly={imported} required rows={8} value={data.presenterDescription} /></Field>
    <div className="field-grid">
      <Field label="สไตล์ใบหน้า"><TextInput onChange={(value) => patchIdentity("faceStyle", value)} placeholder="เช่น หล่อเข้ม / สวยน่ารัก" readOnly={imported} value={data.faceStyle} /></Field>
      <Field label="ลุคประเทศ/วัฒนธรรมภาพ"><TextInput onChange={(value) => patchIdentity("countryStyle", value)} placeholder="เช่น ไทยร่วมสมัย / เกาหลีร่วมสมัย" readOnly={imported} value={data.countryStyle} /></Field>
    </div>
    <div className="field-grid">
      <Field label="รูปร่าง"><TextInput onChange={(value) => patchIdentity("bodyStyle", value)} placeholder="เช่น สมส่วน / นักกล้าม / อวบมั่นใจ" readOnly={imported} value={data.bodyStyle} /></Field>
      <Field label="บุคลิก"><TextInput onChange={(value) => patchIdentity("personalityStyle", value)} placeholder="เช่น อบอุ่น ขี้เล่น มีไหวพริบ" readOnly={imported} value={data.personalityStyle} /></Field>
    </div>
    <div className="section-divider"><span>ยืนยันก่อนใช้ตัวละคร</span></div>
    <Confirmation checked={data.confirmsFictionalAdult} hint="ไม่ใช่ผู้เยาว์ ไม่ใช้ชุดหรือบริบทนักเรียน และไม่ทำให้ดูอายุต่ำกว่าเกณฑ์" id="presenter-adult" label="ตัวละครเป็นบุคคลสมมติที่เห็นชัดว่าอายุ 25 ปีขึ้นไป" onChange={(checked) => patch("confirmsFictionalAdult", checked)} />
    <Confirmation checked={data.confirmsReferenceRights} hint="ไม่ใช้ดารา คนดัง บุคคลจริง หรือภาพที่ไม่มีสิทธิ์นำมาเป็นตัวละคร" id="presenter-rights" label="ฉันมีสิทธิ์ใช้ Character Reference นี้" onChange={(checked) => patch("confirmsReferenceRights", checked)} />
    <Confirmation checked={data.willAttachCharacterReference} hint="ไฟล์ภาพไม่ถูกเก็บในเว็บไซต์ จึงต้องแนบพร้อม Prompt ทุกครั้ง" id="presenter-character-reference" label="ฉันจะแนบ Character Sheet พร้อม Prompt" onChange={(checked) => patch("willAttachCharacterReference", checked)} />
  </div>;
}

function jangraiFirewallSummary(category: string) {
  if (category === "สินค้าเด็ก") return "ปิดใช้งาน: จังไรโหมดไม่รองรับสินค้าเด็ก";
  if (category === "สินค้าสัตว์เลี้ยง") return "ปิดใช้งานในรุ่นนี้: ยังไม่รองรับสินค้าสัตว์เลี้ยง";
  if (category === "อาหารเสริม" || category === "สุขภาพหรืออุปกรณ์การแพทย์") return "ห้ามโยงกับสมรรถภาพ ความต้องการ ฮอร์โมน fertility จำนวนรอบ หรือผลรักษาโรค";
  if (category === "สกินแคร์หรือเครื่องสำอาง" || category === "สินค้าใช้กับร่างกาย") return "ห้ามโยงกับความน่าดึงดูด ความขาว ผอม อ่อนวัย การเปลี่ยนรูปร่าง หรือการดึงดูดคู่";
  if (category === "รถยนต์/มอเตอร์ไซค์/อุปกรณ์ยานยนต์") return "ห้ามเคลมความเร็ว แรงม้า เบรก ประหยัดน้ำมัน ความปลอดภัย หรือความน่าเชื่อถือ";
  if (category === "อุปกรณ์ไฟฟ้า") return "ห้ามเคลมความปลอดภัย ประหยัดไฟ กำลัง กันน้ำ กันไฟ หรือสาธิตไฟจริงโดยไม่มีหลักฐาน";
  if (category === "อาหารหรือเครื่องดื่ม") return "ห้ามสื่อว่าเป็นยาเพิ่มความต้องการหรือพลังทางเพศ และห้ามแต่งผลสุขภาพ";
  if (category === PRODUCT_CATEGORIES[0]) return "AI ต้องจำแนกหมวดก่อน หากเป็นหมวดปิดหรือควบคุมให้ใช้กฎที่เข้มกว่าทันที";
  return "มุกพูดถึงผู้ชมเท่านั้น ห้ามทำให้เข้าใจว่าสินค้าให้ผลทางเพศ ความสัมพันธ์ หรือเปลี่ยนร่างกาย";
}

function StepTwoForm({ data, setData }: { data: PresenterSalesData; setData: React.Dispatch<React.SetStateAction<PresenterSalesData>> }) {
  const patch = <K extends keyof PresenterSalesData>(key: K, value: PresenterSalesData[K]) => setData((current) => ({ ...current, [key]: value }));
  const jangraiMode = data.creativeMode === "jangrai-safe";
  const safetyIssues = presenterSalesSafetyIssues(data);

  function toggleJangraiMode(enabled: boolean) {
    setData((current) => setPresenterSalesCreativeMode(current, enabled ? "jangrai-safe" : "standard"));
  }

  return <div className="form-stack" style={{ padding: 0 }}>
    <div className="info-box info-box--sales"><b>เสน่ห์ใช้หยุดสายตา สินค้าและหลักฐานใช้ปิดการขาย</b><span>ระบบไม่ใช้หน้าตาหรือรูปร่างของพรีเซนเตอร์เป็นหลักฐานว่าสินค้าทำให้สวย หล่อ ขาว ผอม อ่อนวัย หรือเปลี่ยนร่างกาย</span></div>
    <div className="section-divider"><span>ข้อมูลสินค้าและรูปอ้างอิง</span></div>
    <Field label="ชื่อสินค้า" hint="ใช้ชื่อบนสินค้า หรือชื่อที่ต้องการให้พูด" required><TextInput onChange={(value) => patch("productName", value)} placeholder="เช่น เซรั่มบำรุงผิว รุ่น..." required value={data.productName} /></Field>
    <Field label="รายละเอียดสินค้าที่รู้จริง" hint="ใส่เฉพาะรุ่น สี จำนวน วิธีใช้ จุดเด่น หรือคำเตือนที่มีข้อมูลยืนยัน"><TextArea onChange={(value) => patch("productDetails", value)} placeholder="ถ้าไม่รู้ให้เว้นว่าง ห้ามเดา" rows={6} value={data.productDetails} /></Field>
    <Confirmation checked={data.willAttachProductReference} hint="อย่างน้อย 1 รูป หากมีหลายรูปต้องเป็นรุ่น สี และจำนวนเดียวกัน" id="presenter-product-reference" label="ฉันจะแนบรูปสินค้าต้นฉบับพร้อม Prompt" onChange={(checked) => patch("willAttachProductReference", checked)} />
    <div className="field-grid">
      <Field label="หมวดความเสี่ยงของสินค้า" hint="ช่วยให้ Evidence Gate เลือกกฎควบคุมได้ตรง"><Select onChange={(value) => patch("productCategory", value)} value={data.productCategory}>{PRODUCT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
      <Field label="ระดับตรวจหลักฐาน"><Select onChange={(value) => patch("evidenceStrictness", value === "extra-strict" ? "extra-strict" : "strict")} value={data.evidenceStrictness}><option value="strict">เข้มงวดตาม PASS / LIMITED / STOP</option><option value="extra-strict">เข้มงวดพิเศษ — ไม่ชัดให้ STOP</option></Select></Field>
    </div>
    {(data.productCategory === "อาหารเสริม" || data.productCategory === "สุขภาพหรืออุปกรณ์การแพทย์" || data.productCategory === "สกินแคร์หรือเครื่องสำอาง" || data.productCategory === "สินค้าใช้กับร่างกาย" || data.productCategory === "รถยนต์/มอเตอร์ไซค์/อุปกรณ์ยานยนต์") && <div className="info-box info-box--warning" role="status"><b>สินค้ากลุ่มนี้ต้องระวังคำกล่าวอ้างและการสาธิต</b><span>ถ้ารูปหรือข้อมูลไม่รองรับ ระบบจะใช้เพียงการโชว์สิ่งที่เห็นจริงแบบ LIMITED หรือ STOP แทนการแต่งผลลัพธ์</span></div>}
    <div className="section-divider"><span>มุมขายและบุคลิกบนกล้อง</span></div>
    <Field label="รูปแบบการขาย"><Select onChange={(value) => patch("sellingAngle", value)} value={data.sellingAngle}>{SELLING_ANGLES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
    <div className="field-grid">
      <Field label="เสน่ห์หลักของพรีเซนเตอร์"><Select onChange={(value) => patch("charmStyle", value)} value={data.charmStyle}>{CHARM_STYLES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
      <Field label="ระดับการหยอด"><Select disabled={jangraiMode} onChange={(value) => patch("charmLevel", value)} value={data.charmLevel}>{CHARM_LEVELS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
    </div>
    {data.charmLevel === CHARM_LEVELS[2] && !jangraiMode && <div className="info-box info-box--warning" role="status"><b>มุกผู้ใหญ่ต้องเป็นการเล่นคำแบบสะอาด</b><span>ห้ามอวัยวะหรือกิจกรรมทางเพศ ห้ามมุมกล้องเชิงเพศ และต้องเฉลยกลับเข้าสินค้า หากทำไม่ได้ Prompt จะลดเป็นขี้เล่นอัตโนมัติ</span></div>}
    <div className="section-divider"><span>โหมด Hook ผู้ใหญ่แบบตรงแต่ไม่โจ่งแจ้ง</span></div>
    <label className="switch-row"><span className="switch-copy"><b id="jangrai-mode-label">จังไรโหมด</b><span id="jangrai-mode-hint">มุกอยู่เฉพาะ 0–2 วินาทีแรก จากนั้นตัดความเชื่อมโยงและพูดข้อเท็จจริงสินค้าเท่านั้น</span></span><input aria-controls="jangrai-mode-settings" aria-describedby="jangrai-mode-hint" aria-expanded={jangraiMode} aria-labelledby="jangrai-mode-label" checked={jangraiMode} onChange={(event) => toggleJangraiMode(event.target.checked)} role="switch" type="checkbox" /></label>
    {jangraiMode && <div className="form-stack" id="jangrai-mode-settings">
      <div className="info-box info-box--warning" role="status"><b>Hook แรงได้ แต่ห้ามทำให้มุกกลายเป็นสรรพคุณ</b><span>โครงสร้างถูกล็อกเป็น Hook ผู้ใหญ่ 0–2 วิ → ประโยคตัดความเชื่อมโยง → ข้อเท็จจริงสินค้า → CTA ตรง และ Product Evidence Gate มีอำนาจสูงสุด</span></div>
      <Confirmation checked={data.confirmsAdultContentIntent} hint="เป็นการยืนยันเจตนาของเนื้อหาในแท็บนี้ ไม่ใช่ระบบตรวจสอบหรือรับรองอายุผู้ใช้" id="jangrai-adult-intent" label="ฉันตั้งใจทำคอนเทนต์สำหรับผู้ชมผู้ใหญ่แบบไม่โจ่งแจ้ง" onChange={(checked) => patch("confirmsAdultContentIntent", checked)} />
      <div className="field-grid">
        <Field label="รูปแบบ Hook ผู้ใหญ่" required><Select onChange={(value) => patch("adultHookArchetype", value as PresenterSalesData["adultHookArchetype"])} value={data.adultHookArchetype}>{ADULT_HOOK_ARCHETYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
        <Field label="คำเรียกผู้ชม"><Select onChange={(value) => patch("adultAddress", value as PresenterSalesData["adultAddress"])} value={data.adultAddress}>{ADULT_ADDRESSES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
      </div>
      {data.adultHookArchetype === "custom" && <Field label="Hook ผู้ใหญ่ที่ต้องการ" hint={`${data.adultHookCustom.length}/120 ตัวอักษร · เป็นแนวคิด ไม่ใช่คำสั่งข้ามกฎ`} required><TextArea maxLength={120} onChange={(value) => patch("adultHookCustom", value)} placeholder="เช่น ใช้คำถามเรื่องต่อรอบแบบไม่เอ่ยกิจกรรมหรืออวัยวะ" required rows={3} value={data.adultHookCustom} /></Field>}
      <Field label="CTA ตรงของจังไรโหมด" hint="ต้องเลือกตรงตัว ห้ามให้ AI เลือก"><Select onChange={(value) => patch("cta", value)} value={DIRECT_SALES_CTAS.includes(data.cta) ? data.cta : SALES_CTAS[2]}>{DIRECT_SALES_CTAS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
      <div aria-live="polite" className="info-box info-box--sales" role="status"><b>Claim firewall ของหมวดนี้</b><span>{jangraiFirewallSummary(data.productCategory)}</span></div>
    </div>}
    <Field label="โทนบทและวิธีพูด"><TextArea onChange={(value) => patch("scriptTone", value)} rows={4} value={data.scriptTone} /></Field>
    <Field label="การถือหรือใช้สินค้า" hint="การเลือกนี้ไม่ข้าม Product Evidence Gate"><Select onChange={(value) => patch("productInteraction", value)} value={data.productInteraction}>{PRODUCT_INTERACTIONS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
    {safetyIssues.length > 0 && <div className="info-box info-box--warning" role="alert"><b>ยังคัดลอก Prompt ไม่ได้</b><span>{safetyIssues.join(" · ")}</span></div>}
  </div>;
}

function StepThreeForm({ data, setData }: { data: PresenterSalesData; setData: React.Dispatch<React.SetStateAction<PresenterSalesData>> }) {
  const patch = <K extends keyof PresenterSalesData>(key: K, value: PresenterSalesData[K]) => setData((current) => ({ ...current, [key]: value }));
  const jangraiMode = data.creativeMode === "jangrai-safe";
  const sceneTotal = Number.parseInt(data.sceneCount, 10);
  const availableScenes = Array.from({ length: Number.isInteger(sceneTotal) ? sceneTotal : 0 }, (_, index) => index + 1);
  const selectedSceneLabel = data.productSceneNumbers.map((scene) => String(scene).padStart(2, "0")).join(", ");

  function changeSceneCount(value: string) {
    const maximum = Number.parseInt(value, 10);
    setData((current) => ({ ...current, sceneCount: value, productSceneNumbers: current.productSceneNumbers.filter((scene) => scene <= maximum) }));
  }

  function toggleProductScene(scene: number) {
    setData((current) => ({
      ...current,
      productSceneNumbers: current.productSceneNumbers.includes(scene)
        ? current.productSceneNumbers.filter((item) => item !== scene)
        : [...current.productSceneNumbers, scene].sort((left, right) => left - right),
    }));
  }

  return <div className="form-stack" style={{ padding: 0 }}>
    <div className="sales-product-summary"><span>กำลังสร้างให้สินค้า</span><b>{data.productName || "ยังไม่ได้ระบุชื่อสินค้า"}</b></div>
    <div className="info-box info-box--sales"><b>Reference routing เดิมยังอยู่ครบ</b><span>ฉากมีสินค้าใช้ Character Reference + Original Product Reference ส่วนฉากไม่มีสินค้าใช้ Character Reference เท่านั้น พร้อม PASS / LIMITED / STOP และ U1 continuity</span></div>
    <div className="field-grid"><Field label="โครงสร้าง"><Select disabled={jangraiMode} onChange={(value) => patch("framework", value)} value={data.framework}>{jangraiMode ? <option value={JANGRAI_FRAMEWORK}>{JANGRAI_FRAMEWORK}</option> : SALES_FRAMEWORKS.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="ตอนจบอยากให้คนทำอะไร"><Select onChange={(value) => patch("cta", value)} value={data.cta}>{(jangraiMode ? DIRECT_SALES_CTAS : SALES_CTAS).map((item) => <option key={item}>{item}</option>)}</Select></Field></div>
    <div className="field-grid"><Field label="จำนวนเรื่อง"><Select onChange={(value) => patch("storyCount", value)} value={data.storyCount}>{STORY_COUNTS.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="ฉากต่อเรื่อง"><Select onChange={changeSceneCount} value={data.sceneCount}>{SCENE_COUNTS.map((item) => <option key={item}>{item}</option>)}</Select></Field></div>
    {jangraiMode && data.sceneCount === "1" && <div className="info-box info-box--warning" role="status"><b>หนึ่งฉากทำได้ แต่พื้นที่เล่าน้อย</b><span>ต้องพูด Hook ประโยคตัด ข้อเท็จจริงหนึ่งข้อ และ CTA ให้จบด้วย action เดียว หากแน่นเกินไป Prompt จะ STOP และแนะนำอย่างน้อย 2 ฉาก</span></div>}
    {jangraiMode && Number.parseInt(data.sceneCount, 10) >= 2 && <div className="info-box info-box--sales" role="status"><b>โครงสร้างจังไรโหมดพร้อมใช้</b><span>ฉากแรกมีมุกผู้ใหญ่เพียงครั้งเดียว ฉากกลางพูดข้อเท็จจริง และฉากสุดท้ายใช้ CTA ตรง</span></div>}
    <Field label="ให้สินค้าโผล่ฉากไหน" hint="ค่าเริ่มต้นให้ AI เลือกตามเรื่องและระดับหลักฐาน"><Select onChange={(value) => patch("productSceneMode", value as PresenterSalesProductSceneMode)} value={data.productSceneMode}><option value="auto">ให้ AI เลือกให้ (แนะนำ)</option><option value="manual">ฉันเลือกฉากเอง</option></Select></Field>
    {data.productSceneMode === "manual" && <fieldset aria-describedby="presenter-product-scenes-hint presenter-product-scenes-summary" aria-invalid={data.productSceneNumbers.length === 0} className="product-scene-picker">
      <legend>เลือกฉากที่สินค้าโผล่ <b className="required">*</b></legend>
      <p id="presenter-product-scenes-hint">ติ๊กได้หลายฉาก ใช้เลขฉากชุดเดียวกันกับทุกเรื่อง และต้องผ่าน Evidence Gate ก่อนเสมอ</p>
      <div className="product-scene-options">{availableScenes.map((scene) => { const checked = data.productSceneNumbers.includes(scene); return <label className={checked ? "product-scene-chip active" : "product-scene-chip"} key={scene}><input checked={checked} onChange={() => toggleProductScene(scene)} type="checkbox" /><span aria-hidden="true" className="product-scene-chip__check">{checked ? "✓" : ""}</span><span>ฉาก {String(scene).padStart(2, "0")}</span></label>; })}</div>
      <p aria-live="polite" className={data.productSceneNumbers.length === 0 ? "product-scene-summary product-scene-summary--error" : "product-scene-summary"} id="presenter-product-scenes-summary">{data.productSceneNumbers.length === 0 ? "ยังไม่ได้เลือกฉาก กรุณาเลือกอย่างน้อย 1 ฉาก" : `เลือกแล้ว: ฉาก ${selectedSceneLabel}`}</p>
    </fieldset>}
    {data.productSceneMode === "manual" && data.productSceneNumbers.length > 1 && <div className="info-box info-box--warning" role="status"><b>หลายฉากต้องมีหลักฐานเพียงพอ</b><span>ถ้า Product Evidence เป็น LIMITED ระบบจะ STOP และให้เลือกเหลือ 1 ฉากหรือแนบรูปที่ชัดหลายมุม ห้ามลดจำนวนฉากให้เอง</span></div>}
    <div className="field-grid"><Field label="เวลาต่อฉาก"><Select onChange={(value) => patch("sceneDuration", value)} value={data.sceneDuration}>{SCENE_DURATIONS.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="ความเร็วในการพูด"><Select onChange={(value) => patch("speechSpeed", value as PresenterSalesSpeechSpeed)} value={data.speechSpeed}>{SPEECH_SPEEDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field></div>
    {data.speechSpeed === "fast" && <div className="info-box info-box--warning" role="status"><b>พูดเร็วกับท่าทางมากเสี่ยงพูดไม่ครบ</b><span>Prompt จะลดการเคลื่อนไหวในฉากพูดและต้องตรวจ native speech กับ lip sync จาก source take จริง</span></div>}
    <div className="section-divider"><span>ท่าทางและภาพ</span></div>
    <Field label="พลังท่าทาง"><Select onChange={(value) => patch("poseEnergy", value)} value={data.poseEnergy}>{POSE_ENERGIES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
    <Field label="ท่าฉากไม่มีสินค้า" hint="เดิน นั่ง ลุก หรือท่าชีวิตประจำวันได้เมื่อเข้ากับเรื่อง"><TextArea onChange={(value) => patch("nonProductPosePlan", value)} rows={4} value={data.nonProductPosePlan} /></Field>
    <Field label="ท่าฉากมีสินค้า" hint="ค่าเริ่มต้นยืนหรือนั่งมั่นคง ไม่บังหน้า ปาก มือ ฉลาก หรือสินค้า"><TextArea onChange={(value) => patch("productPosePlan", value)} rows={4} value={data.productPosePlan} /></Field>
    <Field label="ส่วนผสมของ Hook"><TextArea onChange={(value) => patch("hookBalance", value)} rows={3} value={data.hookBalance} /></Field>
    <div className="field-grid"><Field label="สถานที่หรือบรรยากาศที่ต้องการ"><TextArea onChange={(value) => patch("settingPreferences", value)} rows={3} value={data.settingPreferences} /></Field><Field label="สถานที่ที่ไม่ต้องการ"><TextArea onChange={(value) => patch("excludedSettings", value)} rows={3} value={data.excludedSettings} /></Field></div>
    <label className="switch-row"><span className="switch-copy"><b id="presenter-agent-sheets-label">ให้ Agent บันทึกลง Google Sheets</b><span id="presenter-agent-sheets-hint">1 เรื่อง = 1 แท็บ และคงตาราง Sales 6 คอลัมน์เดิม</span></span><input aria-describedby="presenter-agent-sheets-hint" aria-labelledby="presenter-agent-sheets-label" checked={data.useAgent} onChange={(event) => patch("useAgent", event.target.checked)} role="switch" type="checkbox" /></label>
    <div className="attachment-list" aria-label="ไฟล์ที่ต้องแนบใน Gemini"><b>ก่อนส่ง Prompt ให้แนบพร้อมกัน</b><span>Character Sheet 1 รูป</span><span>Original Product Reference อย่างน้อย 1 รูป</span></div>
  </div>;
}

function PresenterSalesForm({ data, importStatus, onImport, setData }: { data: PresenterSalesData; importStatus: string; onImport: () => void; setData: React.Dispatch<React.SetStateAction<PresenterSalesData>> }) {
  return <div className="form-stack">
    <section aria-labelledby="presenter-sales-identity-section" className="form-stack" style={{ padding: 0 }}>
      <div className="section-divider"><span id="presenter-sales-identity-section">ตัวตนพรีเซนเตอร์และ Character Reference</span></div>
      <StepOneForm data={data} importStatus={importStatus} onImport={onImport} setData={setData} />
    </section>
    <section aria-labelledby="presenter-sales-product-section" className="form-stack" style={{ padding: 0 }}>
      <div className="section-divider"><span id="presenter-sales-product-section">สินค้า มุมขาย และจังไรโหมด</span></div>
      <StepTwoForm data={data} setData={setData} />
    </section>
    <section aria-labelledby="presenter-sales-production-section" className="form-stack" style={{ padding: 0 }}>
      <div className="section-divider"><span id="presenter-sales-production-section">ฉาก บทพูด และการผลิต</span></div>
      <StepThreeForm data={data} setData={setData} />
    </section>
  </div>;
}

export function PresenterSalesPromptBuilder() {
  const [data, setData] = useState<PresenterSalesData>(() => loadSavedState().data);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    try { sessionStorage.setItem(PRESENTER_SALES_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, activeStep: 1, data })); } catch { /* Storage can be unavailable. */ }
  }, [data]);

  const prompt = useMemo(() => buildPresenterSalesPrompt(data), [data]);
  const allMissing = useMemo(() => presenterSalesMissingFields(data), [data]);

  function resetData() {
    if (!window.confirm("ล้างข้อมูลคลิปขายสาวสวย/หนุ่มหล่อทั้งหมดใช่ไหม?")) return;
    setData(initialPresenterSalesData);
    setImportStatus("");
    setCopyError("");
  }

  function importPresenterIdentity() {
    try {
      const raw = sessionStorage.getItem(PRESENTER_IDENTITY_STORAGE_KEY);
      const context = raw ? extractPresenterIdentityContext(JSON.parse(raw)) : null;
      if (!context) {
        setImportStatus("ยังไม่พบ Presenter Identity บนเครื่องนี้ ให้สร้างตัวตนก่อนหรือเลือกกรอกเอง");
        return;
      }
      setData((current) => applyPresenterIdentityContext(current, context));
      setImportStatus("นำเข้าตัวตนแล้ว กรุณาตรวจ Character Lock และยืนยันรูปอ้างอิงด้านล่าง");
    } catch {
      setImportStatus("อ่านข้อมูล Presenter Identity ไม่สำเร็จ ลองกลับไปบันทึกโหมดสร้างตัวตนอีกครั้ง");
    }
  }

  async function copyPrompt() {
    if (allMissing.length) return;
    setCopyError("");
    try {
      await copyToClipboard(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError("คัดลอกอัตโนมัติไม่สำเร็จ กรุณากดดู Prompt แล้วคัดลอกด้วยตนเอง");
    }
  }

  return <div className="builder-shell">
    <aside className="mode-banner mode-banner--sales" aria-label="โหมดที่กำลังใช้งาน"><span className="mode-banner__mark" aria-hidden="true">♥</span><span className="mode-banner__copy"><span className="mode-banner__kicker">โหมดทดสอบ EP6</span><strong>ขายสินค้าสาวสวย/หนุ่มหล่อ</strong><small>ใช้ Presenter Lock ช่วยหยุดสายตา โดยสินค้าและหลักฐานยังเป็นพระเอก</small></span><a className="mode-banner__link" href="/gen3">กลับหน้าเลือกประเภทคลิป</a></aside>
    <div className="builder-grid">
      <section className="form-panel"><div className="panel-heading"><div><span className="eyebrow">ขั้นตอนเดียว</span><h1>สร้างคลิปขายด้วย Presenter พร้อมผลิต</h1><p>กรอกตัวตน สินค้า และการผลิตต่อเนื่องในหน้าเดียว แล้วคัดลอก Prompt เมื่อข้อมูลครบ</p></div><button className="reset-button" onClick={resetData} type="button">ล้างข้อมูล</button></div>
        <PresenterSalesForm data={data} importStatus={importStatus} onImport={importPresenterIdentity} setData={setData} />
      </section>
      <aside className={previewOpen ? "preview-panel mobile-open" : "preview-panel"}><div className="preview-heading"><div><span className="status-dot" /><b>Prompt พร้อมใช้งาน</b><small>{prompt.length.toLocaleString("th-TH")} ตัวอักษร</small></div><button aria-label="ปิดตัวอย่าง Prompt" onClick={() => setPreviewOpen(false)} type="button">×</button></div><pre>{prompt}</pre><div className="preview-actions">{allMissing.length > 0 && <p>กรอกให้ครบ: {allMissing.join(", ")}</p>}{copyError && <p role="alert">{copyError}</p>}<button className="copy-button" disabled={allMissing.length > 0} onClick={copyPrompt} type="button"><span>{copied ? "✓" : "⧉"}</span>{copied ? "คัดลอกแล้ว" : "คัดลอก Prompt สร้างคลิปขาย"}</button></div></aside>
    </div>
    <div className="bottom-bar"><button className="preview-mobile-button" onClick={() => setPreviewOpen(true)} type="button">ดู Prompt</button><div className="bottom-status"><span>บันทึกชั่วคราวในแท็บนี้อัตโนมัติ</span>{allMissing.length > 0 && <small>เหลือ {allMissing.length} ช่องสำคัญ</small>}</div><button className="copy-secondary" disabled={allMissing.length > 0} onClick={copyPrompt} type="button">{copied ? "คัดลอกแล้ว ✓" : "คัดลอก Prompt"}</button></div>
    {copied && <div className="toast" role="status">คัดลอก Prompt แล้ว แนบ Character Sheet และรูปสินค้าต้นฉบับใน Gemini แล้วส่งได้เลย</div>}
  </div>;
}
