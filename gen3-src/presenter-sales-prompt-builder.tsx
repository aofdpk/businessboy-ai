"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  buildPresenterSalesPrompt,
  CHARM_LEVELS,
  CHARM_STYLES,
  extractPresenterIdentityContext,
  initialPresenterSalesData,
  migratePresenterSalesState,
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
  type PresenterSalesData,
  type PresenterSalesProductSceneMode,
  type PresenterSalesSavedState,
  type PresenterSalesSpeechSpeed,
  type PresenterSalesStepId,
} from "./presenter-sales-prompt-data";

const SPEECH_SPEEDS: Array<{ value: PresenterSalesSpeechSpeed; label: string }> = [
  { value: "slow", label: "ช้า — 10–15 คำ" },
  { value: "normal", label: "ปกติ — 20–25 คำ (แนะนำ)" },
  { value: "fast", label: "เร็ว — 30–35 คำ" },
];

const STEPS: Array<{ id: PresenterSalesStepId; title: string; short: string }> = [
  { id: 1, title: "เลือกพรีเซนเตอร์", short: "นำเข้าตัวตนและยืนยัน Character Reference" },
  { id: 2, title: "วางมุมขาย", short: "ใส่สินค้า เสน่ห์ มุมเล่า และระดับหลักฐาน" },
  { id: 3, title: "สร้าง Prompt", short: "กำหนดฉาก ท่าทาง บทพูด และ Agent" },
];

function loadSavedState(): PresenterSalesSavedState {
  const fallback: PresenterSalesSavedState = { schemaVersion: 1, activeStep: 1, data: initialPresenterSalesData };
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

function TextArea({ onChange, placeholder, readOnly = false, required = false, rows = 4, value }: { onChange: (value: string) => void; placeholder?: string; readOnly?: boolean; required?: boolean; rows?: number; value: string }) {
  return <textarea onChange={(event) => onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} required={required} rows={rows} value={value} />;
}

function Select({ children, onChange, value }: { children: React.ReactNode; onChange: (value: string) => void; value: string }) {
  return <select onChange={(event) => onChange(event.target.value)} value={value}>{children}</select>;
}

function Confirmation({ checked, hint, id, label, onChange }: { checked: boolean; hint: string; id: string; label: string; onChange: (checked: boolean) => void }) {
  return <label className="switch-row"><span className="switch-copy"><b id={`${id}-label`}>{label}</b><span id={`${id}-hint`}>{hint}</span></span><input aria-describedby={`${id}-hint`} aria-labelledby={`${id}-label`} aria-required="true" checked={checked} onChange={(event) => onChange(event.target.checked)} role="switch" type="checkbox" /></label>;
}

function StepOneForm({ data, importStatus, onImport, setData }: { data: PresenterSalesData; importStatus: string; onImport: () => void; setData: React.Dispatch<React.SetStateAction<PresenterSalesData>> }) {
  const patch = <K extends keyof PresenterSalesData>(key: K, value: PresenterSalesData[K]) => setData((current) => ({ ...current, [key]: value }));
  const imported = data.presenterSource === "identity";
  const safetyIssues = presenterSalesSafetyIssues(data);
  return <div className="form-stack">
    <div className="info-box info-box--sales"><b>ใช้ตัวละครเดิมเป็น Presenter Lock</b><span>Character Reference เป็นแหล่งจริงสูงสุด ระบบจะไม่เปลี่ยนหน้า อายุ รูปร่าง ผม เสื้อผ้า หรือลุคประเทศเพื่อให้เข้ากับสินค้า</span></div>
    <Field label="แหล่งข้อมูลพรีเซนเตอร์" required><Select onChange={(value) => patch("presenterSource", value === "manual" ? "manual" : "identity")} value={data.presenterSource}><option value="identity">ดึงจากโหมดสร้างตัวตนสาวสวย/หนุ่มหล่อ</option><option value="manual">กรอกข้อมูล Character Lock เอง</option></Select></Field>
    {imported && <div className="field field-with-action"><span className="field-heading"><span>ข้อมูลตัวตนบนเครื่องนี้</span><button className="import-identity-button" onClick={onImport} type="button">ดึงข้อมูล Presenter Identity</button></span>{importStatus && <small className="field-feedback" role="status">{importStatus}</small>}</div>}
    {imported && <div className="info-box"><b>ช่องด้านล่างล็อกตามข้อมูลที่นำเข้า</b><span>หากต้องสร้างคนใหม่ ให้กลับไปโหมดสร้างตัวตนและทำ Character Sheet ใหม่ หรือเปลี่ยนเป็น “กรอกเอง” เมื่อมี Character Lock จากภายนอก</span></div>}
    <div className="field-grid">
      <Field label="ชื่อตัวละคร"><TextInput onChange={(value) => patch("presenterName", value)} placeholder="เช่น มีลิน" readOnly={imported} value={data.presenterName} /></Field>
      <Field label="ชื่อช่อง" required><TextInput onChange={(value) => patch("channelName", value)} placeholder="เช่น มีลินลองให้แล้ว" readOnly={imported} required value={data.channelName} /></Field>
    </div>
    <Field label="แก่นหลักของช่อง" required><TextArea onChange={(value) => patch("channelConcept", value)} placeholder="ช่องนี้ช่วยคนดูเรื่องอะไร และต่างจากช่องอื่นอย่างไร" readOnly={imported} required value={data.channelConcept} /></Field>
    <div className="field-grid sales-channel-grid">
      <Field label="กลุ่มเป้าหมายและปัญหาหลัก" required><TextArea onChange={(value) => patch("targetAudience", value)} readOnly={imported} required rows={5} value={data.targetAudience} /></Field>
      <Field label="เสาหลักเนื้อหา 3–5 ข้อ" required><TextArea onChange={(value) => patch("contentPillars", value)} placeholder="เขียนแยกบรรทัด" readOnly={imported} required rows={5} value={data.contentPillars} /></Field>
    </div>
    <Field label="Character / Identity Lock" hint="ใบหน้า อายุ ผิว ผม รูปร่าง ชุด เครื่องประดับ และจุดจำ" required><TextArea onChange={(value) => patch("presenterDescription", value)} placeholder="วางรายละเอียดตัวละครจาก Character Sheet" readOnly={imported} required rows={8} value={data.presenterDescription} /></Field>
    <div className="field-grid">
      <Field label="สไตล์ใบหน้า"><TextInput onChange={(value) => patch("faceStyle", value)} placeholder="เช่น หล่อเข้ม / สวยน่ารัก" readOnly={imported} value={data.faceStyle} /></Field>
      <Field label="ลุคประเทศ/วัฒนธรรมภาพ"><TextInput onChange={(value) => patch("countryStyle", value)} placeholder="เช่น ไทยร่วมสมัย / เกาหลีร่วมสมัย" readOnly={imported} value={data.countryStyle} /></Field>
    </div>
    <div className="field-grid">
      <Field label="รูปร่าง"><TextInput onChange={(value) => patch("bodyStyle", value)} placeholder="เช่น สมส่วน / นักกล้าม / อวบมั่นใจ" readOnly={imported} value={data.bodyStyle} /></Field>
      <Field label="บุคลิก"><TextInput onChange={(value) => patch("personalityStyle", value)} placeholder="เช่น อบอุ่น ขี้เล่น มีไหวพริบ" readOnly={imported} value={data.personalityStyle} /></Field>
    </div>
    <div className="section-divider"><span>ยืนยันก่อนใช้ตัวละคร</span></div>
    <Confirmation checked={data.confirmsFictionalAdult} hint="ไม่ใช่ผู้เยาว์ ไม่ใช้ชุดหรือบริบทนักเรียน และไม่ทำให้ดูอายุต่ำกว่าเกณฑ์" id="presenter-adult" label="ตัวละครเป็นบุคคลสมมติที่เห็นชัดว่าอายุ 25 ปีขึ้นไป" onChange={(checked) => patch("confirmsFictionalAdult", checked)} />
    <Confirmation checked={data.confirmsReferenceRights} hint="ไม่ใช้ดารา คนดัง บุคคลจริง หรือภาพที่ไม่มีสิทธิ์นำมาเป็นตัวละคร" id="presenter-rights" label="ฉันมีสิทธิ์ใช้ Character Reference นี้" onChange={(checked) => patch("confirmsReferenceRights", checked)} />
    <Confirmation checked={data.willAttachCharacterReference} hint="ไฟล์ภาพไม่ถูกเก็บในเว็บไซต์ จึงต้องแนบพร้อม Prompt ทุกครั้ง" id="presenter-character-reference" label="ฉันจะแนบ Character Sheet พร้อม Prompt" onChange={(checked) => patch("willAttachCharacterReference", checked)} />
    {safetyIssues.length > 0 && <div className="info-box info-box--warning" role="alert"><b>ยังไปขั้นต่อไปไม่ได้</b><span>{safetyIssues.join(" · ")}</span></div>}
  </div>;
}

function StepTwoForm({ data, setData }: { data: PresenterSalesData; setData: React.Dispatch<React.SetStateAction<PresenterSalesData>> }) {
  const patch = <K extends keyof PresenterSalesData>(key: K, value: PresenterSalesData[K]) => setData((current) => ({ ...current, [key]: value }));
  return <div className="form-stack">
    <div className="info-box info-box--sales"><b>เสน่ห์ใช้หยุดสายตา สินค้าและหลักฐานใช้ปิดการขาย</b><span>ระบบไม่ใช้หน้าตาหรือรูปร่างของพรีเซนเตอร์เป็นหลักฐานว่าสินค้าทำให้สวย หล่อ ขาว ผอม อ่อนวัย หรือเปลี่ยนร่างกาย</span></div>
    <div className="section-divider"><span>ข้อมูลสินค้าและรูปอ้างอิง</span></div>
    <Field label="ชื่อสินค้า" hint="ใช้ชื่อบนสินค้า หรือชื่อที่ต้องการให้พูด" required><TextInput onChange={(value) => patch("productName", value)} placeholder="เช่น เซรั่มบำรุงผิว รุ่น..." required value={data.productName} /></Field>
    <Field label="รายละเอียดสินค้าที่รู้จริง" hint="ใส่เฉพาะรุ่น สี จำนวน วิธีใช้ จุดเด่น หรือคำเตือนที่มีข้อมูลยืนยัน"><TextArea onChange={(value) => patch("productDetails", value)} placeholder="ถ้าไม่รู้ให้เว้นว่าง ห้ามเดา" rows={6} value={data.productDetails} /></Field>
    <Confirmation checked={data.willAttachProductReference} hint="อย่างน้อย 1 รูป หากมีหลายรูปต้องเป็นรุ่น สี และจำนวนเดียวกัน" id="presenter-product-reference" label="ฉันจะแนบรูปสินค้าต้นฉบับพร้อม Prompt" onChange={(checked) => patch("willAttachProductReference", checked)} />
    <div className="field-grid">
      <Field label="หมวดความเสี่ยงของสินค้า" hint="ช่วยให้ Evidence Gate เลือกกฎควบคุมได้ตรง"><Select onChange={(value) => patch("productCategory", value)} value={data.productCategory}>{PRODUCT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
      <Field label="ระดับตรวจหลักฐาน"><Select onChange={(value) => patch("evidenceStrictness", value === "extra-strict" ? "extra-strict" : "strict")} value={data.evidenceStrictness}><option value="strict">เข้มงวดตาม PASS / LIMITED / STOP</option><option value="extra-strict">เข้มงวดพิเศษ — ไม่ชัดให้ STOP</option></Select></Field>
    </div>
    {(data.productCategory === "อาหารเสริม" || data.productCategory === "สกินแคร์หรือเครื่องสำอาง" || data.productCategory === "สินค้าใช้กับร่างกาย") && <div className="info-box info-box--warning" role="status"><b>สินค้ากลุ่มนี้ต้องระวังคำกล่าวอ้างและการสาธิต</b><span>ถ้ารูปหรือข้อมูลไม่รองรับ ระบบจะใช้เพียงการโชว์สิ่งที่เห็นจริงแบบ LIMITED หรือ STOP แทนการแต่งผลลัพธ์</span></div>}
    <div className="section-divider"><span>มุมขายและบุคลิกบนกล้อง</span></div>
    <Field label="รูปแบบการขาย"><Select onChange={(value) => patch("sellingAngle", value)} value={data.sellingAngle}>{SELLING_ANGLES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
    <div className="field-grid">
      <Field label="เสน่ห์หลักของพรีเซนเตอร์"><Select onChange={(value) => patch("charmStyle", value)} value={data.charmStyle}>{CHARM_STYLES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
      <Field label="ระดับการหยอด"><Select onChange={(value) => patch("charmLevel", value)} value={data.charmLevel}>{CHARM_LEVELS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
    </div>
    {data.charmLevel === CHARM_LEVELS[2] && <div className="info-box info-box--warning" role="status"><b>มุกผู้ใหญ่ต้องเป็นการเล่นคำแบบสะอาด</b><span>ห้ามอวัยวะหรือกิจกรรมทางเพศ ห้ามมุมกล้องเชิงเพศ และต้องเฉลยกลับเข้าสินค้า หากทำไม่ได้ Prompt จะลดเป็นขี้เล่นอัตโนมัติ</span></div>}
    <Field label="โทนบทและวิธีพูด"><TextArea onChange={(value) => patch("scriptTone", value)} rows={4} value={data.scriptTone} /></Field>
    <Field label="การถือหรือใช้สินค้า" hint="การเลือกนี้ไม่ข้าม Product Evidence Gate"><Select onChange={(value) => patch("productInteraction", value)} value={data.productInteraction}>{PRODUCT_INTERACTIONS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
  </div>;
}

function StepThreeForm({ data, setData }: { data: PresenterSalesData; setData: React.Dispatch<React.SetStateAction<PresenterSalesData>> }) {
  const patch = <K extends keyof PresenterSalesData>(key: K, value: PresenterSalesData[K]) => setData((current) => ({ ...current, [key]: value }));
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

  return <div className="form-stack">
    <div className="sales-product-summary"><span>กำลังสร้างให้สินค้า</span><b>{data.productName || "ยังไม่ได้ระบุชื่อสินค้า"}</b></div>
    <div className="info-box info-box--sales"><b>Reference routing เดิมยังอยู่ครบ</b><span>ฉากมีสินค้าใช้ Character Reference + Original Product Reference ส่วนฉากไม่มีสินค้าใช้ Character Reference เท่านั้น พร้อม PASS / LIMITED / STOP และ U1 continuity</span></div>
    <div className="field-grid"><Field label="โครงสร้าง"><Select onChange={(value) => patch("framework", value)} value={data.framework}>{SALES_FRAMEWORKS.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="ตอนจบอยากให้คนทำอะไร"><Select onChange={(value) => patch("cta", value)} value={data.cta}>{SALES_CTAS.map((item) => <option key={item}>{item}</option>)}</Select></Field></div>
    <div className="field-grid"><Field label="จำนวนเรื่อง"><Select onChange={(value) => patch("storyCount", value)} value={data.storyCount}>{STORY_COUNTS.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="ฉากต่อเรื่อง"><Select onChange={changeSceneCount} value={data.sceneCount}>{SCENE_COUNTS.map((item) => <option key={item}>{item}</option>)}</Select></Field></div>
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

function resetFieldsForStep(step: PresenterSalesStepId, current: PresenterSalesData): PresenterSalesData {
  if (step === 1) return {
    ...current,
    presenterSource: initialPresenterSalesData.presenterSource,
    presenterName: "", channelName: "", channelConcept: "", targetAudience: "", contentPillars: "", presenterDescription: "",
    faceStyle: "", countryStyle: "", bodyStyle: "", personalityStyle: "",
    confirmsFictionalAdult: false, confirmsReferenceRights: false, willAttachCharacterReference: false,
  };
  if (step === 2) return {
    ...current,
    productName: "", productDetails: "", willAttachProductReference: false,
    productCategory: initialPresenterSalesData.productCategory, evidenceStrictness: initialPresenterSalesData.evidenceStrictness,
    sellingAngle: initialPresenterSalesData.sellingAngle, charmStyle: initialPresenterSalesData.charmStyle,
    charmLevel: initialPresenterSalesData.charmLevel, scriptTone: initialPresenterSalesData.scriptTone,
    productInteraction: initialPresenterSalesData.productInteraction,
  };
  return {
    ...current,
    framework: initialPresenterSalesData.framework, storyCount: initialPresenterSalesData.storyCount,
    sceneCount: initialPresenterSalesData.sceneCount, productSceneMode: initialPresenterSalesData.productSceneMode,
    productSceneNumbers: [], sceneDuration: initialPresenterSalesData.sceneDuration, speechSpeed: initialPresenterSalesData.speechSpeed,
    cta: initialPresenterSalesData.cta, poseEnergy: initialPresenterSalesData.poseEnergy,
    nonProductPosePlan: initialPresenterSalesData.nonProductPosePlan, productPosePlan: initialPresenterSalesData.productPosePlan,
    hookBalance: initialPresenterSalesData.hookBalance, settingPreferences: initialPresenterSalesData.settingPreferences,
    excludedSettings: initialPresenterSalesData.excludedSettings, useAgent: false,
  };
}

export function PresenterSalesPromptBuilder() {
  const [saved] = useState(loadSavedState);
  const [activeStep, setActiveStep] = useState<PresenterSalesStepId>(saved.activeStep);
  const [data, setData] = useState<PresenterSalesData>(saved.data);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    try { sessionStorage.setItem(PRESENTER_SALES_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeStep, data })); } catch { /* Storage can be unavailable. */ }
  }, [activeStep, data]);

  const prompt = useMemo(() => buildPresenterSalesPrompt(data), [data]);
  const currentMissing = useMemo(() => presenterSalesMissingFields(data, activeStep), [activeStep, data]);
  const allMissing = useMemo(() => presenterSalesMissingFields(data), [data]);
  const currentStep = STEPS[activeStep - 1];

  function canOpenStep(step: PresenterSalesStepId) {
    if (step === 1) return true;
    if (presenterSalesMissingFields(data, 1).length) return false;
    return step === 2 || presenterSalesMissingFields(data, 2).length === 0;
  }

  function goToStep(step: PresenterSalesStepId) {
    if (!canOpenStep(step)) return;
    setActiveStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goNext() {
    if (currentMissing.length || activeStep === 3) return;
    goToStep((activeStep + 1) as PresenterSalesStepId);
  }

  function resetStep() {
    if (!window.confirm(`ล้างข้อมูล STEP ${activeStep} ทั้งหมดใช่ไหม?`)) return;
    setData((current) => resetFieldsForStep(activeStep, current));
    setCopyError("");
    if (activeStep === 1) setImportStatus("");
  }

  function importPresenterIdentity() {
    try {
      const raw = sessionStorage.getItem(PRESENTER_IDENTITY_STORAGE_KEY);
      const context = raw ? extractPresenterIdentityContext(JSON.parse(raw)) : null;
      if (!context) {
        setImportStatus("ยังไม่พบ Presenter Identity บนเครื่องนี้ ให้สร้างตัวตนก่อนหรือเลือกกรอกเอง");
        return;
      }
      setData((current) => ({ ...current, ...context, presenterSource: "identity" }));
      setImportStatus("นำเข้าตัวตนแล้ว กรุณาตรวจ Character Lock และยืนยันรูปอ้างอิงด้านล่าง");
    } catch {
      setImportStatus("อ่านข้อมูล Presenter Identity ไม่สำเร็จ ลองกลับไปบันทึกโหมดสร้างตัวตนอีกครั้ง");
    }
  }

  async function copyPrompt() {
    if (activeStep !== 3 || allMissing.length) return;
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
    <nav className="stepper" aria-label="ขั้นตอนสร้าง Prompt ขายสินค้า">{STEPS.map((step, index) => { const enabled = canOpenStep(step.id); return <button aria-current={activeStep === step.id ? "step" : undefined} className={activeStep === step.id ? "step active" : activeStep > step.id ? "step done" : "step"} disabled={!enabled} key={step.id} onClick={() => goToStep(step.id)} type="button"><span className="step-number">{activeStep > step.id ? "✓" : `0${step.id}`}</span><span><b>{step.title}</b><small>{step.short}</small></span>{index < 2 && <i />}</button>; })}</nav>
    <div className="builder-grid">
      <section className="form-panel"><div className="panel-heading"><div><span className="eyebrow">STEP 0{activeStep}</span><h1>{currentStep.title}</h1><p>{currentStep.short}</p></div><button className="reset-button" onClick={resetStep} type="button">ล้างข้อมูล</button></div>
        {activeStep === 1 && <StepOneForm data={data} importStatus={importStatus} onImport={importPresenterIdentity} setData={setData} />}
        {activeStep === 2 && <StepTwoForm data={data} setData={setData} />}
        {activeStep === 3 && <StepThreeForm data={data} setData={setData} />}
      </section>
      <aside className={previewOpen ? "preview-panel mobile-open" : "preview-panel"}><div className="preview-heading"><div><span className="status-dot" /><b>Prompt พร้อมใช้งานเมื่อครบ 3 Steps</b><small>{prompt.length.toLocaleString("th-TH")} ตัวอักษร</small></div><button aria-label="ปิดตัวอย่าง Prompt" onClick={() => setPreviewOpen(false)} type="button">×</button></div><pre>{prompt}</pre><div className="preview-actions">{allMissing.length > 0 && <p>กรอกให้ครบ: {allMissing.join(", ")}</p>}{activeStep !== 3 && <p>ไป STEP 3 เพื่อคัดลอก Prompt ฉบับผลิต</p>}{copyError && <p role="alert">{copyError}</p>}<button className="copy-button" disabled={activeStep !== 3 || allMissing.length > 0} onClick={copyPrompt} type="button"><span>{copied ? "✓" : "⧉"}</span>{copied ? "คัดลอกแล้ว" : "คัดลอก Prompt สร้างคลิปขาย"}</button></div></aside>
    </div>
    <div className="bottom-bar"><button className="preview-mobile-button" onClick={() => setPreviewOpen(true)} type="button">ดู Prompt</button><div className="bottom-status"><span>บันทึกชั่วคราวในแท็บนี้อัตโนมัติ</span>{currentMissing.length > 0 && <small>STEP นี้เหลือ {currentMissing.length} ช่องสำคัญ</small>}</div>{activeStep > 1 && <button className="copy-secondary" onClick={() => goToStep((activeStep - 1) as PresenterSalesStepId)} type="button">← STEP {activeStep - 1}</button>}{activeStep < 3 && <button className="next-button" disabled={currentMissing.length > 0} onClick={goNext} type="button">บันทึกและไป STEP {activeStep + 1} →</button>}{activeStep === 3 && <button className="copy-secondary" disabled={allMissing.length > 0} onClick={copyPrompt} type="button">{copied ? "คัดลอกแล้ว ✓" : "คัดลอก Prompt"}</button>}</div>
    {copied && <div className="toast" role="status">คัดลอก Prompt แล้ว แนบ Character Sheet และรูปสินค้าต้นฉบับใน Gemini แล้วส่งได้เลย</div>}
  </div>;
}
