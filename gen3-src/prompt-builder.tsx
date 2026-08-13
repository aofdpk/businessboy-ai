"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  buildStepOnePrompt,
  buildStepThreePrompt,
  buildStepTwoPrompt,
  initialStepOne,
  initialStepThree,
  initialStepTwo,
  type StepId,
  type StepOneData,
  type StepThreeData,
  type StepTwoData,
} from "./prompt-data";

const STORAGE_KEY = "businessboy-gen3-prompt-builder-v1";

type SavedState = {
  activeStep: StepId;
  stepOne: StepOneData;
  stepTwo: StepTwoData;
  stepThree: StepThreeData;
};

function loadSavedState(): SavedState {
  const defaults: SavedState = {
    activeStep: 1,
    stepOne: initialStepOne,
    stepTwo: initialStepTwo,
    stepThree: initialStepThree,
  };
  if (typeof window === "undefined") return defaults;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved);
    return {
      activeStep: [1, 2, 3].includes(parsed.activeStep) ? parsed.activeStep : 1,
      stepOne: {
        ...initialStepOne,
        ...parsed.stepOne,
        platforms: initialStepOne.platforms,
        productionConstraints: initialStepOne.productionConstraints,
      },
      stepTwo: {
        ...initialStepTwo,
        ...parsed.stepTwo,
        wardrobeLock: initialStepTwo.wardrobeLock,
        signatureTraits: initialStepTwo.signatureTraits,
        expressionSet: initialStepTwo.expressionSet,
      },
      stepThree: {
        ...initialStepThree,
        ...parsed.stepThree,
        hasCharacterReference: initialStepThree.hasCharacterReference,
        topicBrief: initialStepThree.topicBrief,
        presentationMode: initialStepThree.presentationMode,
      },
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return defaults;
  }
}

const steps = [
  { id: 1 as const, title: "หาไอเดียช่อง", short: "วางทิศทางช่องและตัวละคร" },
  { id: 2 as const, title: "สร้างตัวละคร", short: "ทำ Character Sheet ให้คงที่" },
  { id: 3 as const, title: "สร้างเรื่องพร้อมผลิต", short: "จบเป็นตาราง Image + Video Prompt" },
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
    <div className="field">
      <div className="field-heading">
        <span>{label}{required && <b className="required"> *</b>}</span>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>;
}

function TextInput({ value, onChange, placeholder = "" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function TextArea({ value, onChange, placeholder = "", rows = 4 }: { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} />;
}

function StepOneForm({ data, setData }: { data: StepOneData; setData: React.Dispatch<React.SetStateAction<StepOneData>> }) {
  const patch = (key: keyof StepOneData, value: StepOneData[keyof StepOneData]) => setData((current) => ({ ...current, [key]: value }));

  return (
    <div className="form-stack">
      <div className="field-grid compact-grid">
        <Field label="จำนวนไอเดียช่อง" required>
          <Select value={data.ideaCount} onChange={(v) => patch("ideaCount", v)}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((item) => <option key={item}>{item}</option>)}
          </Select>
        </Field>
        <Field label="รูปแบบธุรกิจ" required>
          <Select value={data.businessModel} onChange={(v) => patch("businessModel", v)}>
            <option>ให้ AI แนะนำจากข้อมูลของผู้ใช้</option>
            <option>A — สร้างตัวตนเป็นหลัก</option>
            <option>B — สร้างตัวตนและขาย</option>
            <option>C — ขายของเป็นหลัก</option>
          </Select>
        </Field>
      </div>
      <Field label="ความถนัด ความสนใจ หรือทรัพยากรที่มี" hint="ไม่มีก็เว้นได้">
        <TextArea value={data.creatorStrengths} onChange={(v) => patch("creatorStrengths", v)} placeholder="เช่น ชอบทำอาหาร เคยขายเสื้อผ้า มีเวลาทำวันละ 2 ชั่วโมง" />
      </Field>
      <div className="field-grid">
        <Field label="กลุ่มคนที่อยากสื่อสารด้วย">
          <TextArea value={data.audiencePreference} onChange={(v) => patch("audiencePreference", v)} placeholder="เช่น คุณแม่วัย 30–45 ปี หรือให้ AI วิเคราะห์" />
        </Field>
        <Field label="แนวช่องที่สนใจ">
          <TextArea value={data.nichePreference} onChange={(v) => patch("nichePreference", v)} placeholder="เช่น เรื่องงานบ้าน สุขภาพทั่วไป เรื่องเล่าสอนใจ" />
        </Field>
      </div>
      <Field label="หมวดสินค้า Affiliate ที่สนใจ">
        <TextArea value={data.affiliateCategories} onChange={(v) => patch("affiliateCategories", v)} placeholder="เช่น ของใช้ในบ้าน อุปกรณ์ครัว แฟชั่นไซซ์ใหญ่ หรือเว้นให้ AI เลือก" />
      </Field>
      <Field label="โทนของช่อง">
        <TextInput value={data.contentTone} onChange={(v) => patch("contentTone", v)} />
      </Field>
      <Field label="สิ่งที่ไม่อยากทำหรือหัวข้อต้องห้าม">
        <TextArea value={data.avoidTopics} onChange={(v) => patch("avoidTopics", v)} placeholder="เช่น ไม่ทำข่าว ไม่ทำสุขภาพ ไม่ใช้เด็กเป็นตัวละคร" rows={3} />
      </Field>
    </div>
  );
}

function StepTwoForm({ data, setData }: { data: StepTwoData; setData: React.Dispatch<React.SetStateAction<StepTwoData>> }) {
  const patch = (key: keyof StepTwoData, value: string) => setData((current) => ({ ...current, [key]: value }));
  return (
    <div className="form-stack">
      <div className="info-box"><b>ทำ STEP 1 ใน Gemini ก่อน</b><span>เลือกแนวทางที่ชอบ แล้วนำ Character Description ที่ AI ให้มาวางด้านล่าง</span></div>
      <Field label="ชื่อตัวละคร">
        <TextInput value={data.characterName} onChange={(v) => patch("characterName", v)} placeholder="เช่น น้าอิ่ม หรือ ตาบุญ" />
      </Field>
      <Field label="Character Description จาก STEP 1" hint="วางรายละเอียดทั้งชุด" required>
        <TextArea value={data.characterDescription} onChange={(v) => patch("characterDescription", v)} placeholder="วางรายละเอียดหน้าตา อายุ ผิว ทรงผม รูปร่าง บุคลิก และเสื้อผ้าของตัวละครที่เลือก" rows={9} />
      </Field>
    </div>
  );
}

function StepThreeForm({ data, setData }: { data: StepThreeData; setData: React.Dispatch<React.SetStateAction<StepThreeData>> }) {
  const patch = <K extends keyof StepThreeData>(key: K, value: StepThreeData[K]) => setData((current) => ({ ...current, [key]: value }));
  const selling = data.objective !== "สร้างตัวตน";
  return (
    <div className="form-stack">
      <div className="field-grid">
        <Field label="ชื่อช่อง" required><TextInput value={data.channelName} onChange={(v) => patch("channelName", v)} placeholder="เช่น ตาบุญสอนใจ" /></Field>
        <Field label="รูปแบบธุรกิจ" required>
          <Select value={data.businessModel} onChange={(v) => patch("businessModel", v)}>
            <option>A — สร้างตัวตนเป็นหลัก</option><option>B — สร้างตัวตนและขาย</option><option>C — ขายของเป็นหลัก</option>
          </Select>
        </Field>
      </div>
      <Field label="คอนเซปต์และจุดแตกต่างของช่อง" hint="นำข้อมูลจากผลลัพธ์ STEP 1 มากรอก หรือเติมรายละเอียดเองได้เลย" required>
        <TextArea value={data.channelConcept} onChange={(v) => patch("channelConcept", v)} placeholder="ช่องนี้พูดเรื่องอะไร เล่าแบบไหน และต่างจากช่องทั่วไปอย่างไร" />
      </Field>
      <div className="field-grid">
        <Field label="กลุ่มเป้าหมายและปัญหาหลัก" hint="นำข้อมูลจากผลลัพธ์ STEP 1 มากรอก หรือเติมรายละเอียดเองได้เลย" required><TextArea value={data.targetAudience} onChange={(v) => patch("targetAudience", v)} /></Field>
        <Field label="เสาหลักเนื้อหา 3–5 ข้อ" hint="นำข้อมูลจากผลลัพธ์ STEP 1 มากรอก หรือเติมรายละเอียดเองได้เลย" required><TextArea value={data.contentPillars} onChange={(v) => patch("contentPillars", v)} placeholder="เขียนแยกบรรทัด เช่น เรื่องเงิน / ครอบครัว / การใช้ชีวิต" /></Field>
      </div>
      <Field label="รายละเอียดตัวละครหลัก" hint="นำ Character Description จาก STEP 1 มากรอก หรือเติมรายละเอียดเองได้เลย" required>
        <TextArea value={data.characterDescription} onChange={(v) => patch("characterDescription", v)} rows={6} />
      </Field>
      <div className="section-divider"><span>เนื้อหาที่จะผลิตรอบนี้</span></div>
      <div className="field-grid">
        <Field label="เป้าหมายของคลิป" required>
          <Select value={data.objective} onChange={(v) => patch("objective", v)}>
            <option>สร้างตัวตน</option><option>ขายสินค้า</option><option>ผสม — ให้คุณค่าและขาย</option>
          </Select>
        </Field>
        <Field label="โครงสร้าง" hint="ไม่แน่ใจให้ AI เลือก" required>
          <Select value={data.framework} onChange={(v) => patch("framework", v)}>
            <option>ให้ AI เลือกโครงสร้างที่เหมาะที่สุด</option><option>PAS — Problem, Agitate, Solution</option><option>HSO — Hook, Story, Offer</option><option>AIDA — Attention, Interest, Desire, Action</option>
          </Select>
        </Field>
      </div>
      <div className="framework-note">
        <span><b>PAS</b> แก้ปัญหา</span><span><b>HSO</b> เล่าเรื่อง</span><span><b>AIDA</b> นำเสนอขาย</span>
      </div>
      <div className="field-grid triple-grid">
        <Field label="จำนวนเรื่อง"><Select value={data.storyCount} onChange={(v) => patch("storyCount", v)}>{Array.from({ length: 30 }, (_, index) => index + 1).map((n)=><option key={n}>{n}</option>)}</Select></Field>
        <Field label="ฉากต่อเรื่อง"><Select value={data.sceneCount} onChange={(v) => patch("sceneCount", v)}>{Array.from({ length: 10 }, (_, index) => index + 1).map((n)=><option key={n}>{n}</option>)}</Select></Field>
        <Field label="เวลาต่อฉาก"><Select value={data.sceneDuration} onChange={(v) => patch("sceneDuration", v)}><option>8 วินาที</option><option>10 วินาที</option><option>15 วินาที</option></Select></Field>
      </div>
      <Field label="โทนการเล่า"><TextInput value={data.tone} onChange={(v) => patch("tone", v)} /></Field>
      <div className="field-grid">
        <Field label="สถานที่หรือบรรยากาศที่ต้องการ"><TextArea value={data.settingPreferences} onChange={(v) => patch("settingPreferences", v)} rows={3} /></Field>
        <Field label="สถานที่ที่ไม่ต้องการ"><TextArea value={data.excludedSettings} onChange={(v) => patch("excludedSettings", v)} placeholder="เช่น ห้ามใช้คาเฟ่ ห้ามใช้ห้องหรู" rows={3} /></Field>
      </div>

      {selling && (
        <div className="product-zone">
          <div className="product-zone-title"><span>ข้อมูลสินค้า</span><small>กรอกให้ตรงกับสินค้าจริง ห้ามแต่งสรรพคุณ</small></div>
          <div className="field-grid">
            <Field label="ชื่อสินค้า" required><TextInput value={data.productName} onChange={(v) => patch("productName", v)} /></Field>
            <Field label="หมวดสินค้า" required><TextInput value={data.productCategory} onChange={(v) => patch("productCategory", v)} /></Field>
          </div>
          <Field label="รูปลักษณ์ วิธีใช้ และจุดเด่นที่พิสูจน์ได้" required><TextArea value={data.productDetails} onChange={(v) => patch("productDetails", v)} /></Field>
          <Field label="ประโยชน์หลักที่ต้องการสื่อ" required><TextArea value={data.sellingPoint} onChange={(v) => patch("sellingPoint", v)} rows={3} /></Field>
          <div className="field-grid">
            <Field label="CTA"><TextInput value={data.cta} onChange={(v) => patch("cta", v)} /></Field>
            <Field label="คำกล่าวอ้างที่ห้ามใช้"><TextArea value={data.claimsToAvoid} onChange={(v) => patch("claimsToAvoid", v)} rows={3} /></Field>
          </div>
        </div>
      )}
    </div>
  );
}

export function PromptBuilder() {
  const [savedState] = useState(loadSavedState);
  const [activeStep, setActiveStep] = useState<StepId>(savedState.activeStep);
  const [stepOne, setStepOne] = useState(savedState.stepOne);
  const [stepTwo, setStepTwo] = useState(savedState.stepTwo);
  const [stepThree, setStepThree] = useState(savedState.stepThree);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeStep, stepOne, stepTwo, stepThree }));
  }, [activeStep, stepOne, stepTwo, stepThree]);

  const prompt = useMemo(() => {
    if (activeStep === 1) return buildStepOnePrompt(stepOne);
    if (activeStep === 2) return buildStepTwoPrompt(stepTwo);
    return buildStepThreePrompt(stepThree);
  }, [activeStep, stepOne, stepTwo, stepThree]);

  const missing = useMemo(() => {
    if (activeStep === 1) return [];
    if (activeStep === 2) return stepTwo.characterDescription.trim() ? [] : ["Character Description"];
    const fields = [
      [stepThree.channelName, "ชื่อช่อง"], [stepThree.channelConcept, "คอนเซปต์ช่อง"],
      [stepThree.targetAudience, "กลุ่มเป้าหมาย"], [stepThree.contentPillars, "เสาหลักเนื้อหา"],
      [stepThree.characterDescription, "รายละเอียดตัวละคร"],
    ].filter(([value]) => !value.trim()).map(([, label]) => label);
    if (stepThree.objective !== "สร้างตัวตน") {
      if (!stepThree.productName.trim()) fields.push("ชื่อสินค้า");
      if (!stepThree.productDetails.trim()) fields.push("รายละเอียดสินค้า");
    }
    return fields;
  }, [activeStep, stepOne, stepTwo, stepThree]);

  async function copyPrompt() {
    if (missing.length) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  function resetStep() {
    if (!window.confirm(`ล้างข้อมูล STEP ${activeStep} ทั้งหมดใช่ไหม?`)) return;
    if (activeStep === 1) setStepOne(initialStepOne);
    if (activeStep === 2) setStepTwo(initialStepTwo);
    if (activeStep === 3) setStepThree(initialStepThree);
  }

  function goNext() {
    if (missing.length) return;
    if (activeStep < 3) {
      if (activeStep === 2 && stepTwo.characterDescription && !stepThree.characterDescription) {
        setStepThree((current) => ({ ...current, characterDescription: stepTwo.characterDescription }));
      }
      setActiveStep((activeStep + 1) as StepId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const currentStep = steps[activeStep - 1];

  return (
    <div className="builder-shell">
      <nav className="stepper" aria-label="ขั้นตอนสร้าง Prompt">
        {steps.map((step, index) => (
          <button className={activeStep === step.id ? "step active" : activeStep > step.id ? "step done" : "step"} key={step.id} onClick={() => setActiveStep(step.id)} type="button">
            <span className="step-number">{activeStep > step.id ? "✓" : `0${step.id}`}</span>
            <span><b>{step.title}</b><small>{step.short}</small></span>
            {index < 2 && <i />}
          </button>
        ))}
      </nav>

      <div className="builder-grid">
        <section className="form-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">STEP 0{activeStep}</span><h1>{currentStep.title}</h1><p>{currentStep.short}</p></div>
            <button className="reset-button" onClick={resetStep} type="button">ล้างข้อมูล</button>
          </div>
          {activeStep === 1 && <StepOneForm data={stepOne} setData={setStepOne} />}
          {activeStep === 2 && <StepTwoForm data={stepTwo} setData={setStepTwo} />}
          {activeStep === 3 && <StepThreeForm data={stepThree} setData={setStepThree} />}
        </section>

        <aside className={previewOpen ? "preview-panel mobile-open" : "preview-panel"}>
          <div className="preview-heading">
            <div><span className="status-dot" /><b>Prompt พร้อมใช้งาน</b><small>{prompt.length.toLocaleString("th-TH")} ตัวอักษร</small></div>
            <button aria-label="ปิดตัวอย่าง Prompt" onClick={() => setPreviewOpen(false)} type="button">×</button>
          </div>
          <pre>{prompt}</pre>
          <div className="preview-actions">
            {missing.length > 0 && <p>กรอกให้ครบ: {missing.join(", ")}</p>}
            <button className="copy-button" disabled={missing.length > 0} onClick={copyPrompt} type="button">
              <span>{copied ? "✓" : "⧉"}</span>{copied ? "คัดลอกแล้ว" : "คัดลอก Prompt ทั้งหมด"}
            </button>
          </div>
        </aside>
      </div>

      <div className="bottom-bar">
        <button className="preview-mobile-button" onClick={() => setPreviewOpen(true)} type="button">ดู Prompt</button>
        <div className="bottom-status"><span>บันทึกในเครื่องอัตโนมัติ</span>{missing.length > 0 && <small>เหลือ {missing.length} ช่องสำคัญ</small>}</div>
        <button className="copy-secondary" disabled={missing.length > 0} onClick={copyPrompt} type="button">{copied ? "คัดลอกแล้ว ✓" : "คัดลอก Prompt"}</button>
        {activeStep < 3 && <button className="next-button" disabled={missing.length > 0} onClick={goNext} type="button">บันทึกและไป STEP {activeStep + 1} →</button>}
      </div>
      {copied && <div className="toast" role="status">คัดลอก Prompt แล้ว นำไปวางใน Gemini ได้เลย</div>}
    </div>
  );
}
