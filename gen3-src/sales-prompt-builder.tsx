"use client";

import React, { useEffect, useMemo, useState } from "react";
import { trackGen3Event } from "./analytics";
import { buildSalesPrompt, initialSalesPrompt, type SalesProductSceneMode, type SalesPromptData, type SalesSpeechSpeed } from "./sales-prompt-data";

const STORAGE_KEY = "businessboy-gen3-sales-v3";
const PREVIOUS_STORAGE_KEY = "businessboy-gen3-sales-v2";
const LEGACY_STORAGE_KEY = "businessboy-gen3-sales-v1";
const IDENTITY_STORAGE_KEY = "businessboy-gen3-identity-v1";
const STORY_COUNTS = Array.from({ length: 30 }, (_, index) => String(index + 1));
const SCENE_COUNTS = Array.from({ length: 10 }, (_, index) => String(index + 1));
const DURATIONS = ["8 วินาที", "10 วินาที", "15 วินาที"];
const SPEECH_SPEEDS: Array<{ value: SalesSpeechSpeed; label: string }> = [
  { value: "slow", label: "ช้า — 10–15 คำ" },
  { value: "normal", label: "ปกติ — 20–25 คำ (แนะนำ)" },
  { value: "fast", label: "เร็ว — 30–35 คำ" },
];
const FRAMEWORKS = ["ให้ AI เลือกโครงสร้างที่เหมาะที่สุด", "PAS — Problem, Agitate, Solution", "HSO — Hook, Story, Offer", "AIDA — Attention, Interest, Desire, Action"];
const CTAS = ["ให้ AI เลือก CTA ที่เป็นธรรมชาติ", "ดูรายละเอียดสินค้าที่ลิงก์", "กดตะกร้าเพื่อดูรายละเอียด", "คอมเมนต์หรือส่งข้อความเพื่อสอบถาม"];

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

function validProductScenes(value: unknown, sceneCount: string) {
  const maximum = Number.parseInt(sceneCount, 10);
  if (!Array.isArray(value) || !Number.isInteger(maximum) || maximum < 1) return [];
  return Array.from(new Set(value.map(Number).filter((scene) => Number.isInteger(scene) && scene >= 1 && scene <= maximum))).sort((a, b) => a - b);
}

function sanitizeData(input: unknown): SalesPromptData {
  const source = record(input);
  const sceneCount = oneOf(source, "sceneCount", SCENE_COUNTS, initialSalesPrompt.sceneCount);
  return {
    productName: text(source, "productName", initialSalesPrompt.productName),
    productDetails: text(source, "productDetails", initialSalesPrompt.productDetails),
    // Retain legacy fields for saved-data compatibility; references are optional.
    willAttachCharacterReference: false,
    willAttachProductReference: false,
    channelName: text(source, "channelName", initialSalesPrompt.channelName),
    channelConcept: text(source, "channelConcept", initialSalesPrompt.channelConcept),
    targetAudience: text(source, "targetAudience", initialSalesPrompt.targetAudience),
    contentPillars: text(source, "contentPillars", initialSalesPrompt.contentPillars),
    framework: oneOf(source, "framework", FRAMEWORKS, initialSalesPrompt.framework),
    storyCount: oneOf(source, "storyCount", STORY_COUNTS, initialSalesPrompt.storyCount),
    sceneCount,
    productSceneMode: oneOf(source, "productSceneMode", ["auto", "manual"], initialSalesPrompt.productSceneMode) as SalesProductSceneMode,
    productSceneNumbers: validProductScenes(source.productSceneNumbers, sceneCount),
    sceneDuration: oneOf(source, "sceneDuration", DURATIONS, initialSalesPrompt.sceneDuration),
    speechSpeed: oneOf(source, "speechSpeed", ["slow", "normal", "fast"], initialSalesPrompt.speechSpeed) as SalesSpeechSpeed,
    cta: oneOf(source, "cta", CTAS, initialSalesPrompt.cta),
    tone: text(source, "tone", initialSalesPrompt.tone),
    settingPreferences: text(source, "settingPreferences", initialSalesPrompt.settingPreferences),
    excludedSettings: text(source, "excludedSettings", initialSalesPrompt.excludedSettings),
    useAgent: source.useAgent === true,
  };
}

function migrateLegacyState(input: unknown): SalesPromptData {
  const root = record(input);
  const stepOne = record(root.stepOne);
  const stepTwo = record(root.stepTwo);
  return sanitizeData({
    productName: text(stepOne, "productName") || text(stepTwo, "productName"),
    productDetails: text(stepOne, "productDetails"),
    channelName: text(stepTwo, "channelName"), channelConcept: text(stepTwo, "channelConcept"),
    targetAudience: text(stepTwo, "targetAudience"), contentPillars: text(stepTwo, "contentPillars"),
    framework: text(stepTwo, "framework"), storyCount: text(stepTwo, "storyCount"), sceneCount: text(stepTwo, "sceneCount"),
    sceneDuration: text(stepTwo, "sceneDuration"), speechSpeed: text(stepTwo, "speechSpeed"), cta: text(stepTwo, "cta"),
    tone: text(stepTwo, "tone"), settingPreferences: text(stepTwo, "settingPreferences"), excludedSettings: text(stepTwo, "excludedSettings"),
    useAgent: stepTwo.useAgent === true,
  });
}

function loadSavedData(): SalesPromptData {
  if (typeof window === "undefined") return initialSalesPrompt;
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      const parsed = record(JSON.parse(current));
      return sanitizeData(parsed.data || parsed);
    }
    const previous = localStorage.getItem(PREVIOUS_STORAGE_KEY);
    if (previous) {
      const parsed = record(JSON.parse(previous));
      return sanitizeData(parsed.data || parsed);
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    return legacy ? migrateLegacyState(JSON.parse(legacy)) : initialSalesPrompt;
  } catch {
    return initialSalesPrompt;
  }
}

type IdentityContext = Pick<SalesPromptData, "channelName" | "channelConcept" | "targetAudience" | "contentPillars">;

function readIdentityContext(): IdentityContext | null {
  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    const stepThree = record(record(JSON.parse(raw)).stepThree);
    const context = { channelName: text(stepThree, "channelName"), channelConcept: text(stepThree, "channelConcept"), targetAudience: text(stepThree, "targetAudience"), contentPillars: text(stepThree, "contentPillars") };
    return Object.values(context).some((item) => item.trim()) ? context : null;
  } catch {
    return null;
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

function Field({ children, hint, label }: { children: React.ReactNode; hint?: string; label: string }) {
  return <label className="field"><span className="field-heading"><span>{label}</span>{hint && <small>{hint}</small>}</span>{children}</label>;
}

function TextInput({ onChange, placeholder, required = false, value }: { onChange: (value: string) => void; placeholder?: string; required?: boolean; value: string }) {
  return <input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type="text" value={value} />;
}

function TextArea({ onChange, placeholder, required = false, rows = 4, value }: { onChange: (value: string) => void; placeholder?: string; required?: boolean; rows?: number; value: string }) {
  return <textarea onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} rows={rows} value={value} />;
}

function Select({ children, onChange, value }: { children: React.ReactNode; onChange: (value: string) => void; value: string }) {
  return <select onChange={(event) => onChange(event.target.value)} value={value}>{children}</select>;
}

function SalesForm({ data, importStatus, onImportContext, setData }: { data: SalesPromptData; importStatus: string; onImportContext: () => void; setData: React.Dispatch<React.SetStateAction<SalesPromptData>> }) {
  const patch = <K extends keyof SalesPromptData>(key: K, value: SalesPromptData[K]) => setData((current) => ({ ...current, [key]: value }));
  const sceneTotal = Number.parseInt(data.sceneCount, 10);
  const availableScenes = Array.from({ length: Number.isInteger(sceneTotal) ? sceneTotal : 0 }, (_, index) => index + 1);
  const selectedSceneLabel = data.productSceneNumbers.map((scene) => String(scene).padStart(2, "0")).join(", ");

  function changeSceneCount(value: string) {
    const maximum = Number.parseInt(value, 10);
    setData((current) => ({
      ...current,
      sceneCount: value,
      productSceneNumbers: current.productSceneNumbers.filter((scene) => scene <= maximum),
    }));
  }

  function toggleProductScene(scene: number) {
    setData((current) => {
      const selected = current.productSceneNumbers.includes(scene)
        ? current.productSceneNumbers.filter((item) => item !== scene)
        : [...current.productSceneNumbers, scene].sort((a, b) => a - b);
      return { ...current, productSceneNumbers: selected };
    });
  }

  return <div className="form-stack">
    <div className="info-box info-box--sales"><b>มีอะไรแนบมา ก็สร้างคลิปขายได้เลย</b><span>คัดลอก Prompt ไปใช้กับรูป ไฟล์ หรือข้อความที่มี เว้นข้อมูลที่ไม่รู้ได้ AI จะสร้างสรรค์ส่วนที่เหลือให้</span></div>

    <div className="section-divider"><span>ข้อมูลสินค้า</span></div>
    <Field label="ชื่อสินค้า" hint="ใช้ชื่อที่อยู่บนสินค้า หรือชื่อที่ต้องการให้พูด"><TextInput onChange={(value) => patch("productName", value)} placeholder="เช่น ถุงมือขัดผิวห้านิ้วสีส้ม" value={data.productName} /></Field>
    <Field label="รายละเอียดสินค้า" hint="ไม่บังคับ · เว้นว่างให้ AI ช่วยคิดได้"><TextArea onChange={(value) => patch("productDetails", value)} placeholder="ใส่รายละเอียด จุดเด่น หรือแนวทางที่อยากให้ AI ใช้" rows={5} value={data.productDetails} /></Field>

    <div className="section-divider"><span>บริบทช่องและผู้ชม</span></div>
    <div className="info-box info-box--sales"><b>ช่วยให้ AI เขียนได้ตรงแนวช่อง</b><span>กรอกเอง ดึงจากโหมดสร้างตัวตน หรือเว้นว่างให้ AI เลือกให้ได้</span></div>
    <div className="field field-with-action"><span className="field-heading"><span id="sales-channel-name-label">ชื่อช่อง</span><button className="import-identity-button" onClick={onImportContext} type="button">ดึงข้อมูลจากโหมดสร้างตัวตน</button></span><input aria-labelledby="sales-channel-name-label" onChange={(event) => patch("channelName", event.target.value)} placeholder="เช่น แม่มะปรางลองแล้วมาเล่า" type="text" value={data.channelName} />{importStatus && <small className="field-feedback" role="status">{importStatus}</small>}</div>
    <Field label="แก่นหลักของช่อง" hint="ช่องนี้พูดเรื่องอะไร และต่างจากช่องทั่วไปอย่างไร"><TextArea onChange={(value) => patch("channelConcept", value)} placeholder="วางแก่นหลักของช่องจาก STEP 1 หรือกรอกเอง" value={data.channelConcept} /></Field>
    <div className="field-grid sales-channel-grid"><Field label="กลุ่มเป้าหมายและปัญหาหลัก"><TextArea onChange={(value) => patch("targetAudience", value)} placeholder="คนดูหลักคือใคร และกำลังเจอปัญหาอะไร" rows={5} value={data.targetAudience} /></Field><Field label="เสาหลักเนื้อหา 3–5 ข้อ" hint="เขียนแยกบรรทัด"><TextArea onChange={(value) => patch("contentPillars", value)} placeholder={"เช่น รีวิวของใช้จริง\nเทคนิคประหยัดเวลา\nแก้ปัญหาในชีวิตประจำวัน"} rows={5} value={data.contentPillars} /></Field></div>

    <div className="section-divider"><span>ตั้งค่าคลิปที่จะผลิต</span></div>
    <div className="field-grid"><Field label="โครงสร้าง"><Select onChange={(value) => patch("framework", value)} value={data.framework}>{FRAMEWORKS.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="ตอนจบอยากให้คนทำอะไร"><Select onChange={(value) => patch("cta", value)} value={data.cta}>{CTAS.map((item) => <option key={item}>{item}</option>)}</Select></Field></div>
    <div className="field-grid"><Field label="จำนวนเรื่อง"><Select onChange={(value) => patch("storyCount", value)} value={data.storyCount}>{STORY_COUNTS.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="ฉากต่อเรื่อง"><Select onChange={changeSceneCount} value={data.sceneCount}>{SCENE_COUNTS.map((item) => <option key={item}>{item}</option>)}</Select></Field></div>
    <Field label="ให้สินค้าโผล่ฉากไหน" hint="ให้ AI เลือก หรือเลือกฉากที่ต้องการเองได้"><Select onChange={(value) => patch("productSceneMode", value as SalesProductSceneMode)} value={data.productSceneMode}><option value="auto">ให้ AI เลือกให้ (แนะนำ)</option><option value="manual">ฉันเลือกฉากเอง</option></Select></Field>
    {data.productSceneMode === "manual" && <fieldset aria-describedby="sales-product-scenes-hint sales-product-scenes-summary" className="product-scene-picker">
      <legend>เลือกฉากที่สินค้าโผล่ </legend>
      <p id="sales-product-scenes-hint">เลือกได้ทุกฉากที่ต้องการ · ใช้เลขฉากชุดเดียวกันทุกเรื่อง · ถ้าเว้นว่าง AI จะเลือกให้</p>
      <div className="product-scene-options">
        {availableScenes.map((scene) => {
          const checked = data.productSceneNumbers.includes(scene);
          const label = String(scene).padStart(2, "0");
          return <label className={checked ? "product-scene-chip active" : "product-scene-chip"} key={scene}><input checked={checked} onChange={() => toggleProductScene(scene)} type="checkbox" /><span aria-hidden="true" className="product-scene-chip__check">{checked ? "✓" : ""}</span><span>ฉาก {label}</span></label>;
        })}
      </div>
      <p aria-live="polite" className="product-scene-summary" id="sales-product-scenes-summary">{data.productSceneNumbers.length === 0 ? "AI จะเลือกฉากสินค้าให้" : `เลือกแล้ว: ฉาก ${selectedSceneLabel}`}</p>
    </fieldset>}
    <div className="field-grid"><Field label="เวลาต่อฉาก"><Select onChange={(value) => patch("sceneDuration", value)} value={data.sceneDuration}>{DURATIONS.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="ความเร็วในการพูด" hint="จำนวนคำต่อฉาก · ค่าแนะนำออกแบบจากคลิป 8 วินาที"><Select onChange={(value) => patch("speechSpeed", value as SalesSpeechSpeed)} value={data.speechSpeed}>{SPEECH_SPEEDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field></div>
    {data.speechSpeed === "fast" && <div className="info-box info-box--warning" role="status"><b>โหมดเร็วอาจพูดไม่ครบภายในเวลาที่เลือก</b><span>ควรทดสอบ 1 คลิปก่อนผลิตหลายเรื่อง และตรวจการออกเสียงกับปากให้ตรงทุกคำ</span></div>}
    <label className="switch-row"><span className="switch-copy"><b id="sales-agent-sheets-label">ให้ Agent บันทึกลง Google Sheets</b><span id="sales-agent-sheets-hint">ใช้เมื่อวาง Prompt ในโหมด Agent ที่เชื่อม Google Sheets แล้ว · 1 เรื่อง = 1 แท็บ</span></span><input aria-describedby="sales-agent-sheets-hint" aria-labelledby="sales-agent-sheets-label" checked={data.useAgent} onChange={(event) => patch("useAgent", event.target.checked)} role="switch" type="checkbox" /></label>
    <Field label="โทนการเล่า"><TextInput onChange={(value) => patch("tone", value)} value={data.tone} /></Field>
    <div className="field-grid"><Field label="สถานที่หรือบรรยากาศที่ต้องการ"><TextArea onChange={(value) => patch("settingPreferences", value)} rows={3} value={data.settingPreferences} /></Field><Field label="สถานที่ที่ไม่ต้องการ"><TextArea onChange={(value) => patch("excludedSettings", value)} placeholder="เช่น ห้ามใช้คาเฟ่ ห้ามใช้ห้องหรู" rows={3} value={data.excludedSettings} /></Field></div>
  </div>;
}

export function SalesPromptBuilder() {
  const [data, setData] = useState(loadSavedData);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 3, data })); } catch { /* Storage may be unavailable. */ }
  }, [data]);

  const prompt = useMemo(() => buildSalesPrompt(data), [data]);
  async function copyPrompt() {
    setCopyError("");
    try { await copyToClipboard(prompt); trackGen3Event("sales_prompt_copied"); setCopied(true); window.setTimeout(() => setCopied(false), 2200); }
    catch { setCopyError("คัดลอกอัตโนมัติไม่สำเร็จ กรุณากดดู Prompt แล้วคัดลอกด้วยตนเอง"); }
  }

  function resetData() {
    if (!window.confirm("ล้างข้อมูลคลิปขายทั้งหมดใช่ไหม?")) return;
    setData(initialSalesPrompt); setImportStatus(""); setCopyError("");
  }

  function importIdentityContext() {
    const context = readIdentityContext();
    if (!context) { setImportStatus("ยังไม่พบข้อมูลช่องจากโหมดสร้างตัวตนบนเครื่องนี้"); return; }
    setData((current) => ({ ...current, ...context }));
    setImportStatus("ดึงข้อมูลช่องจากโหมดสร้างตัวตนแล้ว แก้ไขต่อได้เลย");
  }

  return <div className="builder-shell">
    <aside className="mode-banner mode-banner--sales" aria-label="โหมดที่กำลังใช้งาน"><span className="mode-banner__mark" aria-hidden="true">฿</span><span className="mode-banner__copy"><span className="mode-banner__kicker">กำลังใช้งาน</span><strong>คลิปขายสินค้า (Sales)</strong><small>ใช้รูปหรือข้อมูลที่มี แล้วสร้างคลิปขายใน Prompt เดียว</small></span><a className="mode-banner__link" href="/gen3">กลับหน้าเลือกประเภทคลิป</a></aside>
    <div className="builder-grid"><section className="form-panel"><div className="panel-heading"><div><span className="eyebrow">ขั้นตอนเดียว</span><h1>สร้างคลิปขายพร้อมผลิต</h1><p>ตั้งค่าที่ต้องการ แล้วนำ Prompt ไปใช้ได้ทันที ข้อมูลทุกช่องเว้นว่างได้</p></div><button className="reset-button" onClick={resetData} type="button">ล้างข้อมูล</button></div><SalesForm data={data} importStatus={importStatus} onImportContext={importIdentityContext} setData={setData} /></section>
      <aside className={previewOpen ? "preview-panel mobile-open" : "preview-panel"}><div className="preview-heading"><div><span className="status-dot" /><b>Prompt พร้อมใช้งาน</b><small>{prompt.length.toLocaleString("th-TH")} ตัวอักษร</small></div><button aria-label="ปิดตัวอย่าง Prompt" onClick={() => setPreviewOpen(false)} type="button">×</button></div><pre>{prompt}</pre><div className="preview-actions">{copyError && <p role="alert">{copyError}</p>}<button className="copy-button" onClick={copyPrompt} type="button"><span>{copied ? "✓" : "⧉"}</span>{copied ? "คัดลอกแล้ว" : "คัดลอก Prompt สร้างคลิปขาย"}</button></div></aside>
    </div>
    <div className="bottom-bar"><button className="preview-mobile-button" onClick={() => setPreviewOpen(true)} type="button">ดู Prompt</button><div className="bottom-status"><span>บันทึกข้อมูลในเครื่องอัตโนมัติ</span></div><button className="copy-secondary" onClick={copyPrompt} type="button">{copied ? "คัดลอกแล้ว ✓" : "คัดลอก Prompt"}</button></div>
    {copied && <div className="toast" role="status">คัดลอก Prompt แล้ว นำไปใช้กับรูปหรือข้อมูลที่มีได้เลย</div>}
  </div>;
}
