"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BODY_STYLES,
  CHANNEL_NICHES,
  CHANNEL_TONES,
  COUNTRY_STYLES,
  FACE_STYLES,
  FRAMEWORKS,
  PERSONALITY_STYLES,
  PRESENTER_IDENTITY_MODE,
  PRESENTER_IDENTITY_SCHEMA_VERSION,
  PRESENTER_IDENTITY_STORAGE_KEY,
  PRESENTER_TYPES,
  SPICE_LEVELS,
  STYLING_STYLES,
  buildPresenterCharacterPrompt,
  buildPresenterIdeaPrompt,
  buildPresenterStoryPrompt,
  computeIdentityRevision,
  getPresenterSafetyIssues,
  initialStepOne,
  initialStepThree,
  initialStepTwo,
  presenterSummary,
  sanitizePresenterIdentityState,
  type PresenterIdentitySavedState,
  type StepId,
  type StepOneData,
  type StepThreeData,
  type StepTwoData,
} from "./presenter-identity-data";

const QUICK_PRESETS: Record<string, Partial<StepOneData>> = {
  "สาวไทยสวยหวาน": { presenterType: "สาวสวย", faceStyle: "สวยหวาน", faceStyleSecondary: "น่ารักสดใส", countryStyle: "ไทยร่วมสมัย", bodyStyle: "รูปร่างธรรมชาติ", stylingStyle: "คลีนดูดี", personalityStyle: "สดใส ขี้เล่น" },
  "สาวไทยสวยคม": { presenterType: "สาวสวย", faceStyle: "สวยคม", faceStyleSecondary: "สวยมั่นใจ", countryStyle: "ไทยร่วมสมัย", bodyStyle: "สมส่วน", stylingStyle: "แฟชั่นร่วมสมัย", personalityStyle: "มั่นใจ ทันสมัย" },
  "สาวไทยน่ารักสดใส": { presenterType: "สาวสวย", faceStyle: "น่ารักสดใส", faceStyleSecondary: "สวยธรรมชาติ", countryStyle: "ไทยร่วมสมัย", bodyStyle: "รูปร่างธรรมชาติ", stylingStyle: "ธรรมชาติแบบคนทั่วไป", personalityStyle: "คนข้างบ้าน เป็นกันเอง" },
  "สาวเกาหลีละมุน": { presenterType: "สาวสวย", faceStyle: "สวยหวาน", faceStyleSecondary: "สวยธรรมชาติ", countryStyle: "เกาหลีร่วมสมัย", bodyStyle: "สมส่วน", stylingStyle: "คลีนดูดี", personalityStyle: "อบอุ่น น่าไว้ใจ" },
  "สาวเกาหลีสายแฟชั่น": { presenterType: "สาวสวย", faceStyle: "สวยแพง", faceStyleSecondary: "สวยมั่นใจ", countryStyle: "เกาหลีร่วมสมัย", bodyStyle: "สูงเพรียว", stylingStyle: "แฟชั่นร่วมสมัย", personalityStyle: "สายแฟชั่นมั่นใจ" },
  "สาวอวบสวยมั่นใจ": { presenterType: "สาวสวย", faceStyle: "สวยมั่นใจ", faceStyleSecondary: "สวยคม", countryStyle: "ไทยร่วมสมัย", bodyStyle: "อวบสวยหรืออวบหล่อแบบมั่นใจ", stylingStyle: "แฟชั่นร่วมสมัย", personalityStyle: "มั่นใจ ทันสมัย" },
  "หนุ่มไทยหล่อเข้ม": { presenterType: "หนุ่มหล่อ", faceStyle: "หล่อเข้ม", faceStyleSecondary: "หล่ออบอุ่น", countryStyle: "ไทยร่วมสมัย", bodyStyle: "แอทเลติก", stylingStyle: "คลีนดูดี", personalityStyle: "อบอุ่น น่าไว้ใจ" },
  "หนุ่มไทยหล่ออบอุ่น": { presenterType: "หนุ่มหล่อ", faceStyle: "หล่ออบอุ่น", faceStyleSecondary: "หล่อสะอาด", countryStyle: "ไทยร่วมสมัย", bodyStyle: "สมส่วน", stylingStyle: "ธรรมชาติแบบคนทั่วไป", personalityStyle: "คนข้างบ้าน เป็นกันเอง" },
  "หนุ่มเกาหลีหล่อละมุน": { presenterType: "หนุ่มหล่อ", faceStyle: "หล่อละมุน", faceStyleSecondary: "หล่อสะอาด", countryStyle: "เกาหลีร่วมสมัย", bodyStyle: "สูงเพรียว", stylingStyle: "คลีนดูดี", personalityStyle: "อบอุ่น น่าไว้ใจ" },
  "หนุ่มเกาหลีสมาร์ต": { presenterType: "หนุ่มหล่อ", faceStyle: "หล่อสะอาด", faceStyleSecondary: "หล่อคม", countryStyle: "เกาหลีร่วมสมัย", bodyStyle: "สมส่วน", stylingStyle: "สมาร์ตออฟฟิศ", personalityStyle: "มั่นใจ ทันสมัย" },
  "หนุ่มหล่อนักกล้าม": { presenterType: "หนุ่มหล่อ", faceStyle: "หล่อเข้ม", faceStyleSecondary: "หล่ออบอุ่น", countryStyle: "ไทยร่วมสมัย", bodyStyle: "นักกล้าม", stylingStyle: "สปอร์ต", personalityStyle: "นักกล้ามใจดี" },
};

const steps = [
  { id: 1 as const, title: "ออกแบบช่องและหน้าตา", short: "เลือกสาวสวย หนุ่มหล่อ ลุคประเทศ และ Presenter DNA" },
  { id: 2 as const, title: "สร้างตัวละคร", short: "ทำ Character Sheet 2×3 และล็อกตัวละครผู้ใหญ่" },
  { id: 3 as const, title: "สร้างคลิปตัวตน", short: "ให้ AI วางเรื่องและเลือกอิริยาบถธรรมชาติพร้อม Image + Video Prompt" },
];

function defaultState(): PresenterIdentitySavedState {
  return {
    schemaVersion: PRESENTER_IDENTITY_SCHEMA_VERSION,
    mode: PRESENTER_IDENTITY_MODE,
    activeStep: 1,
    stepOne: initialStepOne,
    stepTwo: initialStepTwo,
    stepThree: initialStepThree,
  };
}

function loadState() {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = sessionStorage.getItem(PRESENTER_IDENTITY_STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const migrated = sanitizePresenterIdentityState(parsed);
    if (!migrated) {
      try { sessionStorage.removeItem(PRESENTER_IDENTITY_STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
      return defaultState();
    }
    return migrated;
  } catch {
    try { sessionStorage.removeItem(PRESENTER_IDENTITY_STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
    return defaultState();
  }
}

const FieldLabelContext = React.createContext("");

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <div className="field-heading">
        <span>{label}{required && <b className="required"> *</b>}</span>
        {hint && <small>{hint}</small>}
      </div>
      <FieldLabelContext.Provider value={label}>{children}</FieldLabelContext.Provider>
    </div>
  );
}

function Select({ value, onChange, children, ariaLabel }: { value: string; onChange: (value: string) => void; children: React.ReactNode; ariaLabel?: string }) {
  const fieldLabel = React.useContext(FieldLabelContext);
  return <select aria-label={ariaLabel || fieldLabel || undefined} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>;
}

function TextInput({ value, onChange, placeholder = "", disabled = false }: { value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean }) {
  const fieldLabel = React.useContext(FieldLabelContext);
  return <input aria-label={fieldLabel || undefined} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function TextArea({ value, onChange, placeholder = "", rows = 4, disabled = false }: { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; disabled?: boolean }) {
  const fieldLabel = React.useContext(FieldLabelContext);
  return <textarea aria-label={fieldLabel || undefined} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} />;
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

function CustomField({ selected, value, onChange, placeholder }: { selected: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  if (selected !== "กำหนดเอง") return null;
  return <TextInput value={value} onChange={onChange} placeholder={placeholder} />;
}

function faceOptions(presenterType: string) {
  const general = ["ให้ AI เลือกให้เข้ากับแนวช่อง", "เท่มีคาแรกเตอร์", "กำหนดเอง"];
  if (presenterType === "สาวสวย") return FACE_STYLES.filter((item) => item.startsWith("สวย") || item.startsWith("น่ารัก") || general.includes(item));
  if (presenterType === "หนุ่มหล่อ") return FACE_STYLES.filter((item) => item.startsWith("หล่อ") || general.includes(item));
  return FACE_STYLES;
}

function StepOneForm({ data, patch, applyPreset }: { data: StepOneData; patch: <K extends keyof StepOneData>(key: K, value: StepOneData[K]) => void; applyPreset: (name: string) => void }) {
  const availableFaces = faceOptions(data.presenterType);
  const safetyIssues = getPresenterSafetyIssues(data);
  return (
    <div className="form-stack">
      <div className="info-box"><b>Presenter เป็นจุดจำ แต่เนื้อหาเป็นเหตุผลที่คนติดตาม</b><span>ทุกตัวละครเป็นบุคคลสมมติอายุ 25 ปีขึ้นไป ไม่เลียนแบบดารา และโหมดนี้ยังไม่มีสินค้า</span></div>
      <Field label="เริ่มไวด้วยชุดสำเร็จรูป" hint="เลือกแล้วแก้รายละเอียดแต่ละช่องต่อได้">
        <Select value="" onChange={applyPreset} ariaLabel="ชุด Presenter สำเร็จรูป">
          <option value="">เลือกชุดสำเร็จรูป…</option>
          {Object.keys(QUICK_PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
      </Field>
      <div className="field-grid">
        <Field label="ประเภทพรีเซนเตอร์" required>
          <Select value={data.presenterType} onChange={(value) => patch("presenterType", value)}>
            {PRESENTER_TYPES.map((option) => <option key={option}>{option}</option>)}
          </Select>
          <CustomField selected={data.presenterType} value={data.presenterCustom} onChange={(value) => patch("presenterCustom", value)} placeholder="เช่น พรีเซนเตอร์ผู้ใหญ่ลุคแอนโดรจีนัสอายุ 30 ปี" />
        </Field>
        <Field label="จำนวนไอเดียช่อง">
          <Select value={data.ideaCount} onChange={(value) => patch("ideaCount", value)}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((count) => <option key={count}>{count}</option>)}
          </Select>
        </Field>
      </div>
      <div className="section-divider"><span>ใบหน้าและลุค</span></div>
      <div className="field-grid">
        <Field label="สไตล์หน้าตาหลัก" required>
          <Select value={availableFaces.includes(data.faceStyle as never) ? data.faceStyle : "ให้ AI เลือกให้เข้ากับแนวช่อง"} onChange={(value) => patch("faceStyle", value)}>
            {availableFaces.map((option) => <option key={option}>{option}</option>)}
          </Select>
          <CustomField selected={data.faceStyle} value={data.faceStyleCustom} onChange={(value) => patch("faceStyleCustom", value)} placeholder="เช่น หล่อเข้มแต่ยิ้มอบอุ่น คิ้วคมดูเป็นมิตร" />
        </Field>
        <Field label="สไตล์หน้าตารอง" hint="เลือกได้ไม่เกินหนึ่งค่า">
          <Select value={data.faceStyleSecondary} onChange={(value) => patch("faceStyleSecondary", value)}>
            <option>ไม่ใช้สไตล์รอง</option>
            {availableFaces.filter((item) => item !== "กำหนดเอง" && item !== data.faceStyle).map((option) => <option key={option}>{option}</option>)}
          </Select>
        </Field>
      </div>
      <div className="field-grid">
        <Field label="สไตล์ประเทศหรือวัฒนธรรมภาพ" hint="ควบคุม mood, fashion, grooming และแสง ไม่เหมารวมเชื้อชาติ">
          <Select value={data.countryStyle} onChange={(value) => patch("countryStyle", value)}>
            {COUNTRY_STYLES.map((option) => <option key={option}>{option}</option>)}
          </Select>
          <CustomField selected={data.countryStyle} value={data.countryStyleCustom} onChange={(value) => patch("countryStyleCustom", value)} placeholder="เช่น อินเตอร์เอเชียร่วมสมัย โทนเมืองและเสื้อผ้ามินิมอล" />
        </Field>
        <Field label="รูปร่าง" hint="ใช้ภาษากลางและสัดส่วนมนุษย์จริง">
          <Select value={data.bodyStyle} onChange={(value) => patch("bodyStyle", value)}>
            {BODY_STYLES.map((option) => <option key={option}>{option}</option>)}
          </Select>
          <CustomField selected={data.bodyStyle} value={data.bodyStyleCustom} onChange={(value) => patch("bodyStyleCustom", value)} placeholder="เช่น ตัวสูง ไหล่กว้าง รูปร่างแข็งแรงตามธรรมชาติ" />
        </Field>
      </div>
      <div className="field-grid">
        <Field label="สไตล์การแต่งตัว">
          <Select value={data.stylingStyle} onChange={(value) => patch("stylingStyle", value)}>
            {STYLING_STYLES.map((option) => <option key={option}>{option}</option>)}
          </Select>
          <CustomField selected={data.stylingStyle} value={data.stylingCustom} onChange={(value) => patch("stylingCustom", value)} placeholder="เช่น smart casual โทนกรมท่าและครีม" />
        </Field>
        <Field label="บุคลิก">
          <Select value={data.personalityStyle} onChange={(value) => patch("personalityStyle", value)}>
            {PERSONALITY_STYLES.map((option) => <option key={option}>{option}</option>)}
          </Select>
          <CustomField selected={data.personalityStyle} value={data.personalityCustom} onChange={(value) => patch("personalityCustom", value)} placeholder="เช่น กวนแบบฉลาด แต่ใจดีและฟังคนอื่น" />
        </Field>
      </div>
      <div className="info-box"><b>Presenter DNA</b><span>{presenterSummary(data)}</span></div>
      <div className="section-divider"><span>แนวช่องและน้ำเสียง</span></div>
      <div className="field-grid">
        <Field label="แนวช่อง">
          <Select value={data.channelNiche} onChange={(value) => patch("channelNiche", value)}>
            {CHANNEL_NICHES.map((option) => <option key={option}>{option}</option>)}
          </Select>
          <CustomField selected={data.channelNiche} value={data.channelNicheCustom} onChange={(value) => patch("channelNicheCustom", value)} placeholder="เช่น หนุ่มช่างพูดตรง สอนดูแลรถแบบมือใหม่เข้าใจได้" />
        </Field>
        <Field label="โทนช่อง">
          <Select value={data.tone} onChange={(value) => patch("tone", value)}>
            {CHANNEL_TONES.map((option) => <option key={option}>{option}</option>)}
          </Select>
          <CustomField selected={data.tone} value={data.toneCustom} onChange={(value) => patch("toneCustom", value)} placeholder="เช่น จริงใจ พูดไว มีมุกจิกกัดตัวเองเล็กน้อย" />
        </Field>
      </div>
      <Field label="ระดับความแซ่บ" hint="ไม่มีภาพหรือคำพูดโจ่งแจ้ง และตัวละครทุกคนอายุ 25+">
        <Select value={data.spiceLevel} onChange={(value) => patch("spiceLevel", value)}>
          {SPICE_LEVELS.map((option) => <option key={option}>{option}</option>)}
        </Select>
      </Field>
      {data.spiceLevel === "มุกผู้ใหญ่สองแง่สองง่ามแบบไม่โจ่งแจ้ง" && (
        <div className="info-box info-box--warning" role="status"><b>มุกผู้ใหญ่แบบปลอดภัยเท่านั้น</b><span>ใช้การเล่นคำ ไม่กล่าวถึงอวัยวะหรือกิจกรรมทางเพศ ไม่คุกคาม และไม่ใช้มุมกล้องเน้นร่างกาย</span></div>
      )}
      <div className="field-grid">
        <Field label="กลุ่มคนที่อยากสื่อสารด้วย"><TextArea value={data.audiencePreference} onChange={(value) => patch("audiencePreference", value)} placeholder="เช่น คนทำงานวัย 25–40 ที่อยากได้ความสนุกหลังเลิกงาน" /></Field>
        <Field label="สิ่งที่ไม่ต้องการ" hint="เป็นข้อห้ามแบบ Hard exclusion"><TextArea value={data.exclusions} onChange={(value) => patch("exclusions", value)} placeholder="เช่น ไม่เอาการเมือง ไม่แต่งเรื่องความเชี่ยวชาญ ไม่ใช้มุกล้อรูปร่าง" /></Field>
      </div>
      {safetyIssues.length > 0 && <div className="info-box info-box--warning" role="alert"><b>ยังไปขั้นต่อไปไม่ได้</b><span>{safetyIssues.join(" · ")}</span></div>}
    </div>
  );
}

function StepTwoForm({ data, patch, currentRevision }: { data: StepTwoData; patch: <K extends keyof StepTwoData>(key: K, value: StepTwoData[K]) => void; currentRevision: string }) {
  const referenceIsCurrent = data.hasCharacterReference && data.referenceRevision === currentRevision;
  return (
    <div className="form-stack">
      <div className="info-box"><b>ทำ STEP 1 และเลือกแนวทางก่อน</b><span>วาง IDENTITY_LOCK ที่เลือก แล้วคัดลอก Prompt นี้ไปสร้าง Character Sheet 2×3 รวม 6 ช่อง</span></div>
      <Field label="ชื่อตัวละคร"><TextInput value={data.characterName} onChange={(value) => patch("characterName", value)} placeholder="เช่น มีนา หรือ คิม" /></Field>
      <Field label="IDENTITY_LOCK จาก STEP 1" hint="ต้องเป็นรายละเอียดหนึ่งชุด ไม่มีตัวเลือกหรือช่วงค่า" required>
        <TextArea value={data.characterDescription} onChange={(value) => patch("characterDescription", value)} placeholder="วางอายุ 25+ ใบหน้า ผิว ผม รูปร่าง ชุด รองเท้า เครื่องประดับ บุคลิก และจุดจำ" rows={9} />
      </Field>
      <div className="field-grid">
        <Field label="Grooming Lock"><TextArea value={data.groomingLock} onChange={(value) => patch("groomingLock", value)} rows={3} /></Field>
        <Field label="Wardrobe Lock"><TextArea value={data.wardrobeLock} onChange={(value) => patch("wardrobeLock", value)} rows={3} /></Field>
      </div>
      <Field label="ชุดสีหน้า"><TextInput value={data.expressionSet} onChange={(value) => patch("expressionSet", value)} /></Field>
      <label className="switch-row">
        <span className="switch-copy"><b id="presenter-reference-label">สร้างและพร้อมแนบ Character Reference ล่าสุดแล้ว</b><span id="presenter-reference-hint">ติ๊กหลังตรวจภาพเต็มความละเอียดครบ 6 ช่องแล้ว · หากแก้ Presenter DNA หรือ IDENTITY_LOCK ระบบจะยกเลิกให้อัตโนมัติ</span></span>
        <input
          aria-describedby="presenter-reference-hint"
          aria-labelledby="presenter-reference-label"
          checked={referenceIsCurrent}
          disabled={!data.characterDescription.trim()}
          onChange={(event) => {
            patch("hasCharacterReference", event.target.checked);
            patch("referenceRevision", event.target.checked ? currentRevision : "");
          }}
          role="switch"
          type="checkbox"
        />
      </label>
    </div>
  );
}

function StepThreeForm({ data, patch, referenceCurrent }: { data: StepThreeData; patch: <K extends keyof StepThreeData>(key: K, value: StepThreeData[K]) => void; referenceCurrent: boolean }) {
  return (
    <div className="form-stack">
      <div className={referenceCurrent ? "info-box" : "info-box info-box--warning"} role="status">
        <b>{referenceCurrent ? "Character Reference พร้อมใช้งาน" : "Character Reference ไม่ตรงกับตัวละครล่าสุด"}</b>
        <span>{referenceCurrent ? "ทุก Image Prompt จะใช้ reference นี้เป็นแหล่งความจริง" : "กลับ STEP 2 สร้างและยืนยัน Character Reference ล่าสุดก่อนคัดลอก Prompt"}</span>
      </div>
      <Field label="ชื่อช่อง" required><TextInput value={data.channelName} onChange={(value) => patch("channelName", value)} placeholder="เช่น มินท์เล่าให้ฟัง" /></Field>
      <Field label="แก่นหลักของช่อง" required><TextArea value={data.channelConcept} onChange={(value) => patch("channelConcept", value)} placeholder="ช่องนี้ให้คุณค่าหรืออารมณ์อะไร เล่าแบบไหน และคนติดตามเพราะอะไร" /></Field>
      <div className="field-grid">
        <Field label="กลุ่มเป้าหมาย" required><TextArea value={data.targetAudience} onChange={(value) => patch("targetAudience", value)} /></Field>
        <Field label="เสาหลักเนื้อหา 3–5 ข้อ" required><TextArea value={data.contentPillars} onChange={(value) => patch("contentPillars", value)} placeholder="เขียนแยกบรรทัด" /></Field>
      </div>
      <Field label="ตัวละครที่ล็อกจาก STEP 2"><TextArea disabled value={data.characterDescription} onChange={() => undefined} rows={5} /></Field>
      <div className="section-divider"><span>เนื้อหาที่จะผลิตรอบนี้</span></div>
      <Field label="หัวข้อหรือโจทย์รอบนี้" hint="เว้นไว้ให้ AI เลือกจากเสาหลักได้"><TextArea value={data.topicBrief} onChange={(value) => patch("topicBrief", value)} placeholder="เช่น เรื่องตลกตอนเตรียมตัวไปทำงาน หรือ เล่นกับสัตว์เลี้ยงในห้องนั่งเล่น" /></Field>
      <Field label="โครงสร้าง"><Select value={data.framework} onChange={(value) => patch("framework", value)}>{FRAMEWORKS.map((option) => <option key={option}>{option}</option>)}</Select></Field>
      <div className="field-grid triple-grid">
        <Field label="จำนวนเรื่อง"><Select value={data.storyCount} onChange={(value) => patch("storyCount", value)}>{Array.from({ length: 30 }, (_, index) => index + 1).map((number) => <option key={number}>{number}</option>)}</Select></Field>
        <Field label="ฉากต่อเรื่อง"><Select value={data.sceneCount} onChange={(value) => patch("sceneCount", value)}>{Array.from({ length: 10 }, (_, index) => index + 1).map((number) => <option key={number}>{number}</option>)}</Select></Field>
        <Field label="เวลาต่อฉาก"><Select value={data.sceneDuration} onChange={(value) => patch("sceneDuration", value)}><option>8 วินาที</option><option>10 วินาที</option><option>15 วินาที</option></Select></Field>
      </div>
      <Field label="ความเร็วในการพูด" hint="ใช้กับทุกฉาก · ทุกฉากมีบทพูด ไม่มีฉากเงียบ"><Select value={data.speechSpeed} onChange={(value) => patch("speechSpeed", value)}><option>ช้า — 10–15 คำ</option><option>ปกติ — 20–25 คำ</option><option>เร็ว — 30–35 คำ</option></Select></Field>
      {data.speechSpeed === "เร็ว — 30–35 คำ" && <div className="info-box info-box--warning"><b>โหมดเร็วต้องลดการเคลื่อนไหวทุกฉาก</b><span>ทุกฉากยังต้องพูดให้ครบ 30–35 คำ หาก action ทำให้คำหรือ lip sync ไม่ครบ ให้ลด action และสร้าง source ฉากนั้นใหม่</span></div>}
      <div className="section-divider"><span>โทนและสถานที่</span></div>
      <Field label="โทนการเล่า"><TextInput value={data.tone} onChange={(value) => patch("tone", value)} /></Field>
      <div className="field-grid">
        <Field label="สถานที่หรือบรรยากาศที่ต้องการ"><TextArea value={data.settingPreferences} onChange={(value) => patch("settingPreferences", value)} rows={3} /></Field>
        <Field label="สถานที่ที่ไม่ต้องการ"><TextArea value={data.excludedSettings} onChange={(value) => patch("excludedSettings", value)} placeholder="เช่น ไม่ใช้ห้องนอน ไม่ใช้คาเฟ่" rows={3} /></Field>
      </div>
      <label className="switch-row">
        <span className="switch-copy"><b id="presenter-agent-label">ให้ Agent บันทึกลง Google Sheets</b><span id="presenter-agent-hint">ใช้เมื่อ Agent เชื่อม Google Sheets จริง · หนึ่งเรื่องต่อหนึ่งแท็บ</span></span>
        <input aria-describedby="presenter-agent-hint" aria-labelledby="presenter-agent-label" checked={data.useAgent} onChange={(event) => patch("useAgent", event.target.checked)} role="switch" type="checkbox" />
      </label>
    </div>
  );
}

export function PresenterIdentityBuilder() {
  const [saved] = useState(loadState);
  const [activeStep, setActiveStep] = useState<StepId>(saved.activeStep);
  const [stepOne, setStepOne] = useState(saved.stepOne);
  const [stepTwo, setStepTwo] = useState(saved.stepTwo);
  const [stepThree, setStepThree] = useState(saved.stepThree);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const currentRevision = useMemo(() => computeIdentityRevision(stepOne, stepTwo), [stepOne, stepTwo]);
  const referenceCurrent = stepTwo.hasCharacterReference && stepTwo.referenceRevision === currentRevision && stepThree.characterRevision === currentRevision;

  useEffect(() => {
    const next: PresenterIdentitySavedState = {
      schemaVersion: PRESENTER_IDENTITY_SCHEMA_VERSION,
      mode: PRESENTER_IDENTITY_MODE,
      activeStep,
      stepOne,
      stepTwo,
      stepThree,
    };
    try { sessionStorage.setItem(PRESENTER_IDENTITY_STORAGE_KEY, JSON.stringify(next)); } catch { /* Storage can be unavailable. */ }
  }, [activeStep, stepOne, stepTwo, stepThree]);

  function invalidateReference() {
    setStepTwo((current) => ({ ...current, hasCharacterReference: false, referenceRevision: "" }));
    setStepThree((current) => ({ ...current, characterDescription: "", characterRevision: "" }));
  }

  function patchStepOne<K extends keyof StepOneData>(key: K, value: StepOneData[K]) {
    setStepOne((current) => ({ ...current, [key]: value }));
    invalidateReference();
  }

  function applyPreset(name: string) {
    const preset = QUICK_PRESETS[name];
    if (!preset) return;
    setStepOne((current) => ({ ...current, ...preset }));
    invalidateReference();
  }

  function patchStepTwo<K extends keyof StepTwoData>(key: K, value: StepTwoData[K]) {
    if (key === "hasCharacterReference" || key === "referenceRevision") {
      setStepTwo((current) => ({ ...current, [key]: value }));
      return;
    }
    setStepTwo((current) => ({ ...current, [key]: value, hasCharacterReference: false, referenceRevision: "" }));
    setStepThree((current) => ({ ...current, characterDescription: "", characterRevision: "" }));
  }

  function patchStepThree<K extends keyof StepThreeData>(key: K, value: StepThreeData[K]) {
    setStepThree((current) => ({ ...current, [key]: value }));
  }

  const prompt = useMemo(() => {
    if (activeStep === 1) return buildPresenterIdeaPrompt(stepOne);
    if (activeStep === 2) return buildPresenterCharacterPrompt(stepTwo, stepOne);
    return buildPresenterStoryPrompt(stepThree, stepOne);
  }, [activeStep, stepOne, stepTwo, stepThree]);

  const missing = useMemo(() => {
    const items: string[] = [];
    if (activeStep === 1) {
      if (stepOne.presenterType === "กำหนดเอง" && !stepOne.presenterCustom.trim()) items.push("ประเภทพรีเซนเตอร์ที่กำหนดเอง");
      if (stepOne.faceStyle === "กำหนดเอง" && !stepOne.faceStyleCustom.trim()) items.push("สไตล์หน้าตาที่กำหนดเอง");
      if (stepOne.countryStyle === "กำหนดเอง" && !stepOne.countryStyleCustom.trim()) items.push("สไตล์ประเทศที่กำหนดเอง");
      if (stepOne.bodyStyle === "กำหนดเอง" && !stepOne.bodyStyleCustom.trim()) items.push("รูปร่างที่กำหนดเอง");
      if (stepOne.stylingStyle === "กำหนดเอง" && !stepOne.stylingCustom.trim()) items.push("การแต่งตัวที่กำหนดเอง");
      if (stepOne.personalityStyle === "กำหนดเอง" && !stepOne.personalityCustom.trim()) items.push("บุคลิกที่กำหนดเอง");
      if (stepOne.channelNiche === "กำหนดเอง" && !stepOne.channelNicheCustom.trim()) items.push("แนวช่องที่กำหนดเอง");
      if (stepOne.tone === "กำหนดเอง" && !stepOne.toneCustom.trim()) items.push("โทนช่องที่กำหนดเอง");
    } else if (activeStep === 2) {
      if (!stepTwo.characterDescription.trim()) items.push("IDENTITY_LOCK");
    } else {
      if (!stepThree.channelName.trim()) items.push("ชื่อช่อง");
      if (!stepThree.channelConcept.trim()) items.push("แก่นหลักของช่อง");
      if (!stepThree.targetAudience.trim()) items.push("กลุ่มเป้าหมาย");
      if (!stepThree.contentPillars.trim()) items.push("เสาหลักเนื้อหา 3–5 ข้อ");
      if (!referenceCurrent) items.push("Character Reference ล่าสุด");
    }
    return [...items, ...getPresenterSafetyIssues(stepOne, activeStep >= 2 ? stepTwo : undefined)];
  }, [activeStep, referenceCurrent, stepOne, stepTwo, stepThree]);

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

  function goNext() {
    if (missing.length || activeStep >= 3) return;
    if (activeStep === 2) {
      const revision = computeIdentityRevision(stepOne, stepTwo);
      const confirmed = stepTwo.hasCharacterReference && stepTwo.referenceRevision === revision;
      if (!confirmed) return;
      setStepThree((current) => ({ ...current, characterDescription: stepTwo.characterDescription, characterRevision: revision }));
    }
    setActiveStep((activeStep + 1) as StepId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetStep() {
    if (!window.confirm(`ล้างข้อมูล STEP ${activeStep} ทั้งหมดใช่ไหม?`)) return;
    if (activeStep === 1) {
      setStepOne(initialStepOne);
      invalidateReference();
    } else if (activeStep === 2) {
      setStepTwo(initialStepTwo);
      setStepThree((current) => ({ ...current, characterDescription: "", characterRevision: "" }));
    } else {
      setStepThree(initialStepThree);
    }
  }

  const currentStep = steps[activeStep - 1];
  return (
    <div className="builder-shell presenter-identity-builder">
      <aside className="mode-banner" aria-label="โหมดที่กำลังใช้งาน">
        <span className="mode-banner__mark" aria-hidden="true">★</span>
        <span className="mode-banner__copy"><span className="mode-banner__kicker">ใหม่ · EP6</span><strong>คลิปสร้างตัวตนสาวสวย/หนุ่มหล่อ</strong><small>เลือกหน้าตา ลุคประเทศ และบุคลิก · ให้ AI เลือกฉากตามบท · ตัวละครสมมติอายุ 25+</small></span>
        <a className="mode-banner__link" href="/gen3">กลับหน้าเลือกประเภทคลิป</a>
      </aside>
      <nav className="stepper" aria-label="ขั้นตอนสร้าง Presenter Identity Prompt">
        {steps.map((step, index) => (
          <button aria-current={activeStep === step.id ? "step" : undefined} className={activeStep === step.id ? "step active" : activeStep > step.id ? "step done" : "step"} key={step.id} onClick={() => setActiveStep(step.id)} type="button">
            <span className="step-number">{activeStep > step.id ? "✓" : `0${step.id}`}</span>
            <span><b>{step.title}</b><small>{step.short}</small></span>{index < 2 && <i />}
          </button>
        ))}
      </nav>
      <div className="builder-grid">
        <section className="form-panel">
          <div className="panel-heading"><div><span className="eyebrow">STEP 0{activeStep}</span><h1>{currentStep.title}</h1><p>{currentStep.short}</p></div><button className="reset-button" onClick={resetStep} type="button">ล้างข้อมูล</button></div>
          {activeStep === 1 && <StepOneForm data={stepOne} patch={patchStepOne} applyPreset={applyPreset} />}
          {activeStep === 2 && <StepTwoForm data={stepTwo} patch={patchStepTwo} currentRevision={currentRevision} />}
          {activeStep === 3 && <StepThreeForm data={stepThree} patch={patchStepThree} referenceCurrent={referenceCurrent} />}
        </section>
        <aside className={previewOpen ? "preview-panel mobile-open" : "preview-panel"}>
          <div className="preview-heading"><div><span className="status-dot" /><b>Prompt พร้อมใช้งาน</b><small>{prompt.length.toLocaleString("th-TH")} ตัวอักษร</small></div><button aria-label="ปิดตัวอย่าง Prompt" onClick={() => setPreviewOpen(false)} type="button">×</button></div>
          <pre>{prompt}</pre>
          <div className="preview-actions">{missing.length > 0 && <p>ตรวจหรือกรอกให้ครบ: {missing.join(" · ")}</p>}{copyError && <p role="alert">{copyError}</p>}<button className="copy-button" disabled={missing.length > 0} onClick={copyPrompt} type="button"><span>{copied ? "✓" : "⧉"}</span>{copied ? "คัดลอกแล้ว" : "คัดลอก Prompt ทั้งหมด"}</button></div>
        </aside>
      </div>
      <div className="bottom-bar">
        <button className="preview-mobile-button" onClick={() => setPreviewOpen(true)} type="button">ดู Prompt</button>
        <div className="bottom-status"><span>บันทึกชั่วคราวในแท็บนี้อัตโนมัติ</span>{missing.length > 0 && <small>เหลือ {missing.length} รายการ</small>}</div>
        <button className="copy-secondary" disabled={missing.length > 0} onClick={copyPrompt} type="button">{copied ? "คัดลอกแล้ว ✓" : "คัดลอก Prompt"}</button>
        {activeStep < 3 && <button className="next-button" disabled={missing.length > 0} onClick={goNext} type="button">บันทึกและไป STEP {activeStep + 1} →</button>}
      </div>
      {copied && <div className="toast" role="status">คัดลอก Prompt แล้ว นำไปใช้กับ workflow ที่ได้รับอนุญาตได้เลย</div>}
    </div>
  );
}
