export type StepId = 1 | 2 | 3;

export const PRESENTER_IDENTITY_STORAGE_KEY = "businessboy-gen3-presenter-identity-v1";
export const PRESENTER_IDENTITY_SCHEMA_VERSION = 1;
export const PRESENTER_IDENTITY_MODE = "presenter-identity" as const;

export const PRESENTER_TYPES = [
  "สาวสวย",
  "หนุ่มหล่อ",
  "ให้ AI เสนอทั้งสาวสวยและหนุ่มหล่อ",
  "กำหนดเอง",
] as const;

export const FACE_STYLES = [
  "ให้ AI เลือกให้เข้ากับแนวช่อง",
  "สวยหวาน",
  "สวยคม",
  "สวยแพง",
  "น่ารักสดใส",
  "สวยธรรมชาติ",
  "สวยมั่นใจ",
  "หล่อเข้ม",
  "หล่อละมุน",
  "หล่อคม",
  "หล่อสะอาด",
  "หล่ออบอุ่น",
  "หล่อเท่",
  "เท่มีคาแรกเตอร์",
  "กำหนดเอง",
] as const;

export const COUNTRY_STYLES = [
  "ไทยร่วมสมัย",
  "เกาหลีร่วมสมัย",
  "ญี่ปุ่นมินิมอล",
  "จีนโมเดิร์น",
  "อินเตอร์เอเชีย",
  "ไม่เน้นประเทศ",
  "กำหนดเอง",
] as const;

export const BODY_STYLES = [
  "รูปร่างธรรมชาติ",
  "สมส่วน",
  "สูงเพรียว",
  "แอทเลติก",
  "นักกล้าม",
  "มีส่วนเว้าส่วนโค้งตามธรรมชาติ",
  "อวบสวยหรืออวบหล่อแบบมั่นใจ",
  "ร่างใหญ่ดูอบอุ่น",
  "กำหนดเอง",
] as const;

export const STYLING_STYLES = [
  "ธรรมชาติแบบคนทั่วไป",
  "คลีนดูดี",
  "แฟชั่นร่วมสมัย",
  "สปอร์ต",
  "สตรีท",
  "สมาร์ตออฟฟิศ",
  "เรียบหรูพรีเมียม",
  "กำหนดเอง",
] as const;

export const PERSONALITY_STYLES = [
  "คนข้างบ้าน เป็นกันเอง",
  "อบอุ่น น่าไว้ใจ",
  "มั่นใจ ทันสมัย",
  "เรียบหรู มีรสนิยม",
  "สดใส ขี้เล่น",
  "กวน มีไหวพริบ",
  "เท่ พูดน้อย",
  "แอคทีฟ มีพลัง",
  "นักกล้ามใจดี",
  "สายแฟชั่นมั่นใจ",
  "กำหนดเอง",
] as const;

export const CHANNEL_NICHES = [
  "ให้ AI เสนอจาก Presenter DNA",
  "ไลฟ์สไตล์คนข้างบ้าน",
  "กวนฮาในชีวิตประจำวัน",
  "ฟิตเนสและการดูแลตัวเอง",
  "แฟชั่นและการแต่งตัว",
  "อาหารและครัว",
  "เที่ยว คาเฟ่ และสถานที่น่าสนใจ",
  "รถและเครื่องมือช่าง",
  "เกม เทคโนโลยี และแก็ดเจ็ต",
  "ชีวิตออฟฟิศ",
  "ความสัมพันธ์และมุมมองชีวิต",
  "รีวิวและทดลองสิ่งของ",
  "เล่าเรื่องสั้นหรือมินิซิตคอม",
  "กำหนดเอง",
] as const;

export const CHANNEL_TONES = [
  "เป็นธรรมชาติ คุยเหมือนเพื่อน",
  "น่ารักขี้เล่น",
  "กวนฮา",
  "มุกแสบแต่สะอาด",
  "หล่อหรือสวยดูแพง",
  "อบอุ่นชวนติดตาม",
  "หยอดเบา ๆ แบบมีเสน่ห์",
  "มั่นใจตรงประเด็น",
  "กำหนดเอง",
] as const;

export const SPICE_LEVELS = [
  "สุภาพ ดูได้ทั่วไป",
  "ขี้เล่น หยอดเบา ๆ",
  "มุกผู้ใหญ่สองแง่สองง่ามแบบไม่โจ่งแจ้ง",
] as const;

export const FRAMEWORKS = [
  "ให้ AI เลือกโครงสร้างที่เหมาะที่สุด",
  "Hook → Story → Insight",
  "Problem → Realization → Takeaway",
  "Setup → Twist → Payoff",
  "Moment → Meaning → Conversation",
] as const;

export const POSE_FAMILIES = [
  { id: "standing", label: "ยืนและพูด" },
  { id: "sitting", label: "นั่ง" },
  { id: "walking", label: "เดิน" },
  { id: "reclining", label: "เอนหรือนอนแบบมีบริบท" },
  { id: "low_context", label: "ย่อ คุกเข่า หรือคลานแบบมีเหตุผล" },
  { id: "daily", label: "ชีวิตประจำวัน" },
  { id: "comedy", label: "ปฏิกิริยาตลก" },
] as const;

export type PoseFamily = typeof POSE_FAMILIES[number]["id"];
export type SceneKind = "พูดเน้นหน้า" | "แอ็กชันนำเรื่อง" | "แอ็กชันแล้วหยุดพูด";

export type StepOneData = {
  ideaCount: string;
  presenterType: string;
  presenterCustom: string;
  faceStyle: string;
  faceStyleSecondary: string;
  faceStyleCustom: string;
  countryStyle: string;
  countryStyleCustom: string;
  bodyStyle: string;
  bodyStyleCustom: string;
  stylingStyle: string;
  stylingCustom: string;
  personalityStyle: string;
  personalityCustom: string;
  channelNiche: string;
  channelNicheCustom: string;
  tone: string;
  toneCustom: string;
  spiceLevel: string;
  audiencePreference: string;
  exclusions: string;
};

export type StepTwoData = {
  characterName: string;
  characterDescription: string;
  groomingLock: string;
  wardrobeLock: string;
  expressionSet: string;
  hasCharacterReference: boolean;
  referenceRevision: string;
};

export type StepThreeData = {
  channelName: string;
  channelConcept: string;
  targetAudience: string;
  contentPillars: string;
  characterDescription: string;
  characterRevision: string;
  topicBrief: string;
  framework: string;
  storyCount: string;
  sceneCount: string;
  sceneDuration: string;
  speechSpeed: string;
  poseBalance: string;
  allowedPoseFamilies: PoseFamily[];
  movementLevel: string;
  poseSeed: string;
  customPoseContext: string;
  excludedPoses: string;
  tone: string;
  settingPreferences: string;
  excludedSettings: string;
  useAgent: boolean;
};

export type PresenterIdentitySavedState = {
  schemaVersion: 1;
  mode: typeof PRESENTER_IDENTITY_MODE;
  activeStep: StepId;
  stepOne: StepOneData;
  stepTwo: StepTwoData;
  stepThree: StepThreeData;
};

export const initialStepOne: StepOneData = {
  ideaCount: "5",
  presenterType: "ให้ AI เสนอทั้งสาวสวยและหนุ่มหล่อ",
  presenterCustom: "",
  faceStyle: "ให้ AI เลือกให้เข้ากับแนวช่อง",
  faceStyleSecondary: "ไม่ใช้สไตล์รอง",
  faceStyleCustom: "",
  countryStyle: "ไทยร่วมสมัย",
  countryStyleCustom: "",
  bodyStyle: "รูปร่างธรรมชาติ",
  bodyStyleCustom: "",
  stylingStyle: "คลีนดูดี",
  stylingCustom: "",
  personalityStyle: "คนข้างบ้าน เป็นกันเอง",
  personalityCustom: "",
  channelNiche: "ให้ AI เสนอจาก Presenter DNA",
  channelNicheCustom: "",
  tone: "เป็นธรรมชาติ คุยเหมือนเพื่อน",
  toneCustom: "",
  spiceLevel: "สุภาพ ดูได้ทั่วไป",
  audiencePreference: "",
  exclusions: "",
};

export const initialStepTwo: StepTwoData = {
  characterName: "",
  characterDescription: "",
  groomingLock: "ล็อกใบหน้า ทรงผม สีผม การแต่งหน้า หรือหนวดเคราเป็นค่าเดียวตลอดทุกช่อง",
  wardrobeLock: "ล็อกเสื้อท่อนบน เสื้อท่อนล่าง รองเท้า และเครื่องประดับเป็นชุดเดียวตลอดทุกช่อง",
  expressionSet: "เป็นกลาง, ยิ้มเป็นมิตร, มั่นใจ, ประหลาดใจเล็กน้อย",
  hasCharacterReference: false,
  referenceRevision: "",
};

export const initialStepThree: StepThreeData = {
  channelName: "",
  channelConcept: "",
  targetAudience: "",
  contentPillars: "",
  characterDescription: "",
  characterRevision: "",
  topicBrief: "",
  framework: "ให้ AI เลือกโครงสร้างที่เหมาะที่สุด",
  storyCount: "1",
  sceneCount: "3",
  sceneDuration: "10 วินาที",
  speechSpeed: "ปกติ — 20–25 คำ",
  poseBalance: "สมดุล — แอ็กชันประมาณทุก 3 ฉาก",
  allowedPoseFamilies: ["standing", "sitting", "walking", "daily", "comedy"],
  movementLevel: "กลาง — หนึ่งการกระทำชัดเจนต่อฉาก",
  poseSeed: "EP6",
  customPoseContext: "",
  excludedPoses: "",
  tone: "เป็นธรรมชาติ มีเสน่ห์ และฟังเหมือนคนไทยจริง",
  settingPreferences: "สถานที่จริงในประเทศไทยที่ตรงกับเรื่องและบุคลิกช่อง",
  excludedSettings: "",
  useAgent: false,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanText(value: unknown, fallback = "", maxLength = 4000) {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function oneOf(value: unknown, allowed: readonly string[], fallback: string) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function cleanBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function sanitizeStepOne(input: unknown): StepOneData {
  const source = record(input);
  return {
    ideaCount: oneOf(source.ideaCount, ["3", "4", "5", "6", "7", "8", "9", "10"], initialStepOne.ideaCount),
    presenterType: oneOf(source.presenterType, PRESENTER_TYPES, initialStepOne.presenterType),
    presenterCustom: cleanText(source.presenterCustom, "", 500),
    faceStyle: oneOf(source.faceStyle, FACE_STYLES, initialStepOne.faceStyle),
    faceStyleSecondary: oneOf(source.faceStyleSecondary, ["ไม่ใช้สไตล์รอง", ...FACE_STYLES.filter((item) => item !== "กำหนดเอง")], initialStepOne.faceStyleSecondary),
    faceStyleCustom: cleanText(source.faceStyleCustom, "", 500),
    countryStyle: oneOf(source.countryStyle, COUNTRY_STYLES, initialStepOne.countryStyle),
    countryStyleCustom: cleanText(source.countryStyleCustom, "", 500),
    bodyStyle: oneOf(source.bodyStyle, BODY_STYLES, initialStepOne.bodyStyle),
    bodyStyleCustom: cleanText(source.bodyStyleCustom, "", 500),
    stylingStyle: oneOf(source.stylingStyle, STYLING_STYLES, initialStepOne.stylingStyle),
    stylingCustom: cleanText(source.stylingCustom, "", 500),
    personalityStyle: oneOf(source.personalityStyle, PERSONALITY_STYLES, initialStepOne.personalityStyle),
    personalityCustom: cleanText(source.personalityCustom, "", 500),
    channelNiche: oneOf(source.channelNiche, CHANNEL_NICHES, initialStepOne.channelNiche),
    channelNicheCustom: cleanText(source.channelNicheCustom, "", 1000),
    tone: oneOf(source.tone, CHANNEL_TONES, initialStepOne.tone),
    toneCustom: cleanText(source.toneCustom, "", 500),
    spiceLevel: oneOf(source.spiceLevel, SPICE_LEVELS, initialStepOne.spiceLevel),
    audiencePreference: cleanText(source.audiencePreference, "", 1500),
    exclusions: cleanText(source.exclusions, "", 1500),
  };
}

export function sanitizeStepTwo(input: unknown): StepTwoData {
  const source = record(input);
  return {
    characterName: cleanText(source.characterName, "", 200),
    characterDescription: cleanText(source.characterDescription, "", 8000),
    groomingLock: cleanText(source.groomingLock, initialStepTwo.groomingLock, 1500),
    wardrobeLock: cleanText(source.wardrobeLock, initialStepTwo.wardrobeLock, 1500),
    expressionSet: cleanText(source.expressionSet, initialStepTwo.expressionSet, 1000),
    hasCharacterReference: cleanBoolean(source.hasCharacterReference),
    referenceRevision: cleanText(source.referenceRevision, "", 100),
  };
}

export function sanitizeStepThree(input: unknown): StepThreeData {
  const source = record(input);
  const families = Array.isArray(source.allowedPoseFamilies)
    ? source.allowedPoseFamilies.filter((item): item is PoseFamily => typeof item === "string" && POSE_FAMILIES.some((family) => family.id === item))
    : initialStepThree.allowedPoseFamilies;
  return {
    channelName: cleanText(source.channelName, "", 300),
    channelConcept: cleanText(source.channelConcept, "", 2500),
    targetAudience: cleanText(source.targetAudience, "", 2000),
    contentPillars: cleanText(source.contentPillars, "", 2500),
    characterDescription: cleanText(source.characterDescription, "", 8000),
    characterRevision: cleanText(source.characterRevision, "", 100),
    topicBrief: cleanText(source.topicBrief, "", 2500),
    framework: oneOf(source.framework, FRAMEWORKS, initialStepThree.framework),
    storyCount: oneOf(source.storyCount, Array.from({ length: 30 }, (_, index) => String(index + 1)), initialStepThree.storyCount),
    sceneCount: oneOf(source.sceneCount, Array.from({ length: 10 }, (_, index) => String(index + 1)), initialStepThree.sceneCount),
    sceneDuration: oneOf(source.sceneDuration, ["8 วินาที", "10 วินาที", "15 วินาที"], initialStepThree.sceneDuration),
    speechSpeed: oneOf(source.speechSpeed, ["ช้า — 10–15 คำ", "ปกติ — 20–25 คำ", "เร็ว — 30–35 คำ"], initialStepThree.speechSpeed),
    poseBalance: oneOf(source.poseBalance, [
      "เน้นพูด — ไม่มีฉากแอ็กชันล้วน",
      "เน้นพูด — แอ็กชันประมาณทุก 4 ฉาก",
      "สมดุล — แอ็กชันประมาณทุก 3 ฉาก",
      "เน้นภาพ — แอ็กชันประมาณทุก 2 ฉาก",
    ], initialStepThree.poseBalance),
    allowedPoseFamilies: families.length ? [...new Set(families)] : initialStepThree.allowedPoseFamilies,
    movementLevel: oneOf(source.movementLevel, [
      "ต่ำ — สีหน้าและท่าทางเล็กน้อย",
      "กลาง — หนึ่งการกระทำชัดเจนต่อฉาก",
      "สูง — แอ็กชันเด่นเฉพาะฉากที่ไม่มีบทพูด",
    ], initialStepThree.movementLevel),
    poseSeed: cleanText(source.poseSeed, initialStepThree.poseSeed, 80),
    customPoseContext: cleanText(source.customPoseContext, "", 1500),
    excludedPoses: cleanText(source.excludedPoses, "", 1500),
    tone: cleanText(source.tone, initialStepThree.tone, 1000),
    settingPreferences: cleanText(source.settingPreferences, initialStepThree.settingPreferences, 1500),
    excludedSettings: cleanText(source.excludedSettings, "", 1500),
    useAgent: cleanBoolean(source.useAgent),
  };
}

export function computeIdentityRevision(stepOne: StepOneData, stepTwo: StepTwoData) {
  const source = JSON.stringify({
    presenterType: stepOne.presenterType,
    presenterCustom: stepOne.presenterCustom,
    faceStyle: stepOne.faceStyle,
    faceStyleSecondary: stepOne.faceStyleSecondary,
    faceStyleCustom: stepOne.faceStyleCustom,
    countryStyle: stepOne.countryStyle,
    countryStyleCustom: stepOne.countryStyleCustom,
    bodyStyle: stepOne.bodyStyle,
    bodyStyleCustom: stepOne.bodyStyleCustom,
    stylingStyle: stepOne.stylingStyle,
    stylingCustom: stepOne.stylingCustom,
    personalityStyle: stepOne.personalityStyle,
    personalityCustom: stepOne.personalityCustom,
    characterName: stepTwo.characterName,
    characterDescription: stepTwo.characterDescription,
    groomingLock: stepTwo.groomingLock,
    wardrobeLock: stepTwo.wardrobeLock,
    expressionSet: stepTwo.expressionSet,
  });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `pi-${(hash >>> 0).toString(36)}`;
}

export function sanitizePresenterIdentityState(input: unknown): PresenterIdentitySavedState {
  const source = record(input);
  const stepOne = sanitizeStepOne(source.stepOne);
  const rawStepTwo = sanitizeStepTwo(source.stepTwo);
  const revision = computeIdentityRevision(stepOne, rawStepTwo);
  const referenceIsCurrent = rawStepTwo.hasCharacterReference && rawStepTwo.referenceRevision === revision;
  const stepTwo = referenceIsCurrent
    ? rawStepTwo
    : { ...rawStepTwo, hasCharacterReference: false, referenceRevision: "" };
  const rawStepThree = sanitizeStepThree(source.stepThree);
  const stepThree = rawStepThree.characterRevision === revision && referenceIsCurrent
    ? rawStepThree
    : { ...rawStepThree, characterDescription: "", characterRevision: "" };
  return {
    schemaVersion: PRESENTER_IDENTITY_SCHEMA_VERSION,
    mode: PRESENTER_IDENTITY_MODE,
    activeStep: source.activeStep === 2 || source.activeStep === 3 ? source.activeStep : 1,
    stepOne,
    stepTwo,
    stepThree,
  };
}

function displayCustom(selected: string, custom: string) {
  return selected === "กำหนดเอง" ? (custom.trim() || "ยังไม่ได้ระบุ") : selected;
}

export function presenterSummary(data: StepOneData) {
  const secondary = data.faceStyleSecondary === "ไม่ใช้สไตล์รอง" ? "" : ` + ${data.faceStyleSecondary}`;
  return `${displayCustom(data.presenterType, data.presenterCustom)} · ${displayCustom(data.faceStyle, data.faceStyleCustom)}${secondary} · ${displayCustom(data.countryStyle, data.countryStyleCustom)} · ${displayCustom(data.bodyStyle, data.bodyStyleCustom)} · ${displayCustom(data.personalityStyle, data.personalityCustom)}`;
}

export function getPresenterSafetyIssues(stepOne: StepOneData, stepTwo?: StepTwoData) {
  const identityContext = [
    stepOne.presenterCustom,
    stepOne.faceStyleCustom,
    stepOne.countryStyleCustom,
    stepOne.bodyStyleCustom,
    stepOne.stylingCustom,
    stepOne.personalityCustom,
    stepOne.channelNicheCustom,
    stepOne.toneCustom,
    stepTwo?.characterDescription || "",
  ].join(" ").toLowerCase();
  const contentContext = `${identityContext} ${stepOne.audiencePreference}`.toLowerCase();
  const issues: string[] = [];
  if (/(?:อายุ|วัย|age)\s*(?:[0-9]|1[0-9]|2[0-4])(?:\D|$)/i.test(identityContext) || /(เด็ก|ผู้เยาว์|มัธยม|นักเรียน|ชุดนักเรียน|schoolgirl|schoolboy|teen|minor)/i.test(identityContext)) {
    issues.push("ตัวละครต้องเป็นผู้ใหญ่สมมติอายุ 25 ปีขึ้นไป และห้ามใช้บริบทนักเรียนหรือผู้เยาว์");
  }
  if (/(โป๊|เปลือย|อวัยวะเพศ|กิจกรรมทางเพศ|nude|naked|explicit sex|porn)/i.test(contentContext)) {
    issues.push("ไม่รองรับภาพเปลือย กิจกรรมทางเพศ หรือรายละเอียดโจ่งแจ้ง");
  }
  if (/(เหมือนดารา|หน้าดารา|หน้าคล้าย|celebrity|deepfake)/i.test(identityContext)) {
    issues.push("ตัวละครต้องเป็นบุคคลสมมติใหม่ ไม่เลียนแบบดาราหรือบุคคลจริง");
  }
  return issues;
}

function value(input: string, fallback = "ไม่ระบุ — ให้ AI เลือกอย่างเหมาะสม") {
  return input.trim() || fallback;
}

function hardSafetyRules() {
  return `ขอบเขตบังคับของ Presenter Mode
- ตัวละครทุกคนเป็นบุคคลสมมติอายุ 25 ปีขึ้นไป ระบุอายุเป็นจำนวนเต็มหนึ่งค่า ห้ามผู้เยาว์ ลุคคล้ายผู้เยาว์ ชุดนักเรียน หรือบริบทโรงเรียน
- สร้างหน้าตาใหม่ ห้ามคล้ายดารา อินฟลูเอนเซอร์ บุคคลสาธารณะ หรือบุคคลจริง และห้าม deepfake
- อนุญาตความสวย ความหล่อ ความน่ารัก ความมั่นใจ และเสน่ห์แบบผู้ใหญ่ แต่ห้ามภาพเปลือย กิจกรรมทางเพศ fetish การบังคับ การคุกคาม หรือคำบรรยายอวัยวะ
- ห้ามมุมกล้องหรือท่าทางที่จงใจเน้นหน้าอก สะโพก เป้า หรือส่วนร่างกายเชิงเพศ เสื้อผ้าต้องเหมาะกับกิจกรรมและแพลตฟอร์มทั่วไป
- มุกสองแง่สองง่ามต้องเป็นการเล่นคำที่ไม่กล่าวถึงอวัยวะหรือกิจกรรมทางเพศ ไม่คุกคามใคร และจบด้วยความตลกที่สะอาด
- อธิบายรูปร่างด้วยภาษากลางและเคารพตัวละคร ห้าม body shaming ห้ามสัดส่วนเกินจริง และห้ามโยงคุณค่าของคนกับรูปร่าง
- หากคำขอขัดข้อใด ให้หยุดเฉพาะส่วนนั้นและเสนอทางเลือกผู้ใหญ่ที่ปลอดภัย ห้ามแอบลดอายุหรือเปลี่ยนถ้อยคำเพื่อหลบข้อห้าม`;
}

export function buildPresenterIdeaPrompt(data: StepOneData) {
  return `สวมบทบาทเป็นนักวางกลยุทธ์ช่องวิดีโอสั้นไทย นักออกแบบตัวละคร AI และ Creative Director ที่เชี่ยวชาญช่องซึ่งมีพรีเซนเตอร์สาวสวยหรือหนุ่มหล่อเป็นจุดจำ โดยใช้บุคลิก ความสามารถ และเนื้อหาเป็นเหตุผลหลักที่ทำให้ผู้ชมติดตาม

ภารกิจ
เสนอไอเดียช่องสร้างตัวตนจำนวน ${data.ideaCount} แนวทาง แต่ละแนวทางต้องผลิตต่อเนื่องได้อย่างน้อย 50 คลิป แตกต่างกันจริง และยังไม่มีสินค้า ราคา โปรโมชั่น ลิงก์ซื้อ หรือ CTA ขาย

Presenter DNA ที่ผู้ใช้เลือก
- ประเภทพรีเซนเตอร์: ${displayCustom(data.presenterType, data.presenterCustom)}
- สไตล์ใบหน้าหลัก: ${displayCustom(data.faceStyle, data.faceStyleCustom)}
- สไตล์ใบหน้ารอง: ${data.faceStyleSecondary}
- ลุคประเทศหรือวัฒนธรรมภาพ: ${displayCustom(data.countryStyle, data.countryStyleCustom)}
- รูปร่าง: ${displayCustom(data.bodyStyle, data.bodyStyleCustom)}
- การแต่งตัว: ${displayCustom(data.stylingStyle, data.stylingCustom)}
- บุคลิก: ${displayCustom(data.personalityStyle, data.personalityCustom)}
- แนวช่อง: ${displayCustom(data.channelNiche, data.channelNicheCustom)}
- โทนช่อง: ${displayCustom(data.tone, data.toneCustom)}
- ระดับความแซ่บ: ${data.spiceLevel}
- กลุ่มผู้ชมที่สนใจ: ${value(data.audiencePreference)}
- สิ่งที่ไม่ต้องการ: ${value(data.exclusions, "ไม่มีข้อห้ามเพิ่มเติม")}

การใช้ลุคประเทศ
ให้แปลตัวเลือกประเทศเป็น mood, grooming, fashion, color palette, lighting และ visual direction ร่วมสมัยเท่านั้น ห้ามเหมารวมเชื้อชาติ ห้ามเปลี่ยนชาติพันธุ์เป็นมุก และห้ามอ้างว่าคนประเทศหนึ่งมีหน้าตาหรือพฤติกรรมแบบเดียวกัน

${hardSafetyRules()}

กฎออกแบบ
1. หากผู้ใช้เลือกให้ AI เสนอทั้งสาวสวยและหนุ่มหล่อ ให้กระจายแนวทางทั้งสองประเภทอย่างสมดุล ห้ามทำตัวละครก้ำกึ่งโดยไม่ได้รับคำขอ
2. ใช้สไตล์ใบหน้าหลักเป็นแกน สไตล์รองเป็นอารมณ์เสริม ห้ามผสมจนขัดกัน
3. Presenter เป็น hook ทางภาพ แต่เหตุผลที่ผู้ชมติดตามต้องมาจาก Content Promise, บุคลิก, ประโยชน์หรืออารมณ์ที่ได้รับ และรูปแบบซีรีส์ที่ทำซ้ำได้
4. ห้ามแต่งประสบการณ์จริง อาชีพ ใบรับรอง หรือความเชี่ยวชาญที่ผู้ใช้ไม่ได้ให้มา ตัวละครเป็นตัวละคร AI สมมติ
5. สิ่งที่ไม่ต้องการเป็น HARD EXCLUSION ครอบคลุมคำพ้องและแนวคิดใกล้เคียง ห้ามทวนข้อห้ามกลับมาในผลงาน
6. ทุกแนวทางต้องให้ IDENTITY_LOCK เป็นค่าคงที่ชุดเดียว: เพศการนำเสนอ อายุหนึ่งค่าอย่างน้อย 25 ปี รูปหน้า ผิว ตา คิ้ว จมูก ปาก ผม รูปร่าง ส่วนสูง ชุด รองเท้า เครื่องประดับ บุคลิก จุดจำ และระบุพร็อพประจำตัวว่าไม่มี ห้ามใช้คำว่า หรือ อาจ สลับ เปลี่ยนได้ ช่วงค่า หรือหลายตัวเลือกใน lock เดียว
7. ความสมจริงต้องมีรูขุมขน ผิวสัมผัส ความไม่สมมาตรเล็กน้อย และสัดส่วนธรรมชาติ ห้ามผิวพลาสติก beauty filter อนิเมะ 3D หรือตุ๊กตา
8. รอบนี้เป็น Identity Content เท่านั้น อาจวิเคราะห์หมวดสินค้าที่เข้ากันในอนาคตเป็นข้อมูลประกอบ แต่ห้ามใส่สินค้าในหัวข้อคลิป บทพูด หรือ CTA

รูปแบบผลลัพธ์ของแต่ละแนวทาง
## แนวทาง 01 — ชื่อแนวคิด
1. ชื่อช่อง 3 ตัวเลือก
2. Presenter DNA ฉบับสรุป
3. Content Promise หนึ่งประโยค
4. กลุ่มผู้ชมและเหตุผลที่ติดตาม
5. ลายเซ็นการพูดและลายเซ็นทางภาพ
6. เสาหลักเนื้อหา 5 ข้อ
7. ซีรีส์ทำซ้ำได้ 5 รูปแบบ
8. หัวข้อ 10 คลิปแรก โดยไม่มีสินค้า
9. หมวดสินค้าที่อาจต่อยอดในอนาคต 3 หมวด พร้อมเหตุผล แต่ห้ามเขียนบทขาย
10. ความยากในการผลิตและสิ่งที่ต้องระวัง
11. IDENTITY_LOCK ฉบับเต็มหนึ่งชุด

ปิดท้ายด้วยตารางเปรียบเทียบทุกแนวทาง: ลำดับ | ชื่อแนวคิด | ประเภทพรีเซนเตอร์ | เสน่ห์หลัก | กลุ่มผู้ชม | จุดจำ | ความง่ายในการผลิต | โอกาสทำต่อเนื่อง

ตรวจความปลอดภัย ความแตกต่าง และความสอดคล้องกับ Presenter DNA ทุกบรรทัดก่อนแสดงเฉพาะฉบับสุดท้าย`;
}

export function buildPresenterCharacterPrompt(data: StepTwoData, stepOne: StepOneData) {
  return `สวมบทบาทเป็น Character Director และ Prompt Engineer สำหรับภาพมนุษย์สมจริง ให้สร้างคำสั่งผลิต Character Sheet ของพรีเซนเตอร์ AI หนึ่งคน โดยใช้ IDENTITY_LOCK เป็นแหล่งความจริงเพียงชุดเดียว

ชื่อเรียกตัวละคร: ${value(data.characterName, "ไม่ตั้งชื่อ")}
Presenter DNA: ${presenterSummary(stepOne)}

IDENTITY_LOCK จาก STEP 1
${value(data.characterDescription, "ยังไม่มี Character Description")}

GROOMING_LOCK
${value(data.groomingLock)}

WARDROBE_LOCK
${value(data.wardrobeLock)}

EXPRESSION_SET
${value(data.expressionSet)}

${hardSafetyRules()}

ข้อกำหนด Character Sheet
- ภาพแนวตั้ง 9:16 แบบ contact sheet 2 คอลัมน์ × 3 แถว รวม 6 ช่อง ขอบเขตแต่ละช่องชัด พื้นหลังสตูดิโอสีเทาอ่อนเรียบ ไม่มีตัวหนังสือ ป้าย โลโก้ ลายน้ำ หรือตัวเลข
- ช่อง 1: ใบหน้าตรงระยะใกล้ สีหน้าเป็นกลาง สบกล้อง
- ช่อง 2: ใบหน้าและไหล่มุม 45 องศาซ้าย สีหน้าเป็นกลาง
- ช่อง 3: ใบหน้าและไหล่มุม 45 องศาขวา ยิ้มเล็กน้อย
- ช่อง 4: เต็มตัวด้านหน้า ยืนผ่อนคลาย มือว่างและเห็นสัดส่วนครบ
- ช่อง 5: เต็มตัวมุม 45 องศา ท่าทางมั่นใจตามธรรมชาติ
- ช่อง 6: ภาพช่วงอกที่จัด expression reference 4 สีหน้าขนาดเท่ากันภายในช่องเดียว
- ใช้บุคคลเดียวกันเป๊ะทุกช่อง: หน้า อายุ ผิว ตา คิ้ว จมูก ปาก ผม รูปร่าง สัดส่วน ชุด รองเท้า และเครื่องประดับไม่เปลี่ยน
- ตัวละครเป็นผู้ใหญ่สมมติอายุอย่างน้อย 25 ปี หน้าตาไม่คล้ายบุคคลจริง ไม่ใช้ฟิลเตอร์ความงาม ผิวมีรายละเอียดตามธรรมชาติ มือและกายวิภาคถูกต้อง
- ไม่ถือพร็อพ ไม่มีสินค้า ไม่มีท่าเชิงเพศ ไม่มีมุมกล้องเน้นส่วนร่างกาย

แสดงผลลัพธ์เป็น
1. FINAL IDENTITY_LOCK ฉบับจัดระเบียบ โดยทุกคุณสมบัติมีค่าเดียว
2. MASTER IMAGE PROMPT ภาษาอังกฤษพร้อมใช้ โดยรวมรายละเอียดทั้ง contact sheet และตัวละครครบในข้อความเดียว
3. NEGATIVE CONSTRAINTS แบบสั้น ไม่ซ้ำซ้อน
4. QC CHECKLIST 10 ข้อสำหรับตรวจภาพเต็มความละเอียด

อย่าสร้างภาพในคำตอบนี้ ให้ส่งเฉพาะ Prompt พร้อมใช้และห้ามอ้างว่าสร้างภาพแล้ว`;
}

type PoseDefinition = {
  id: string;
  label: string;
  family: PoseFamily;
  kinds: SceneKind[];
  minSeconds: 8 | 10 | 15;
  maxSpeech: "fast" | "normal" | "none";
  requiresContext?: RegExp;
  contextHint?: string;
};

const POSES: PoseDefinition[] = [
  { id: "stand_relaxed", label: "ยืนผ่อนคลาย ถ่ายน้ำหนักข้างเดียว", family: "standing", kinds: ["พูดเน้นหน้า", "แอ็กชันแล้วหยุดพูด"], minSeconds: 8, maxSpeech: "fast" },
  { id: "lean_counter", label: "พิงเคาน์เตอร์เบา ๆ แล้วสบกล้อง", family: "standing", kinds: ["พูดเน้นหน้า"], minSeconds: 8, maxSpeech: "fast", requiresContext: /(เคาน์เตอร์|ครัว|ร้าน|โต๊ะ|counter)/i },
  { id: "turn_to_camera", label: "หันไหล่กลับมาสบกล้องแล้วหยุดนิ่ง", family: "standing", kinds: ["แอ็กชันแล้วหยุดพูด"], minSeconds: 10, maxSpeech: "normal" },
  { id: "sit_chair", label: "นั่งเก้าอี้มุม 45 องศา ท่าตรงและเป็นธรรมชาติ", family: "sitting", kinds: ["พูดเน้นหน้า"], minSeconds: 8, maxSpeech: "fast" },
  { id: "sit_steps", label: "นั่งขั้นบันไดแล้วเงยหน้าสบกล้อง", family: "sitting", kinds: ["พูดเน้นหน้า", "แอ็กชันแล้วหยุดพูด"], minSeconds: 10, maxSpeech: "normal", requiresContext: /(บันได|ขั้น|ทางเข้า|steps)/i },
  { id: "sit_floor", label: "นั่งพื้นขัดสมาธิในพื้นที่สะอาด", family: "sitting", kinds: ["พูดเน้นหน้า"], minSeconds: 8, maxSpeech: "normal", requiresContext: /(พื้น|เสื่อ|บ้าน|ห้อง|ปิกนิก|โยคะ|floor)/i },
  { id: "walk_in_stop", label: "เดินเข้าหากล้องสองก้าวแล้วหยุดก่อนพูด", family: "walking", kinds: ["แอ็กชันแล้วหยุดพูด"], minSeconds: 10, maxSpeech: "normal" },
  { id: "walk_past_turn", label: "เดินผ่านเฟรมแล้วหันกลับมามอง", family: "walking", kinds: ["แอ็กชันนำเรื่อง"], minSeconds: 10, maxSpeech: "none" },
  { id: "open_door_enter", label: "เปิดประตู เดินเข้าฉาก แล้วหยุดที่จุดกำหนด", family: "walking", kinds: ["แอ็กชันนำเรื่อง", "แอ็กชันแล้วหยุดพูด"], minSeconds: 15, maxSpeech: "normal", requiresContext: /(ประตู|ห้อง|บ้าน|ออฟฟิศ|ร้าน|door)/i },
  { id: "recline_sofa", label: "เอนตัวบนโซฟาแล้วหันมาสบกล้อง", family: "reclining", kinds: ["พูดเน้นหน้า"], minSeconds: 10, maxSpeech: "normal", requiresContext: /(โซฟา|ห้องนั่งเล่น|พักผ่อน|sofa)/i },
  { id: "lie_exercise_mat", label: "นอนบนเสื่อออกกำลังกายแล้วลุกขึ้นนั่ง", family: "reclining", kinds: ["แอ็กชันนำเรื่อง"], minSeconds: 15, maxSpeech: "none", requiresContext: /(ออกกำลัง|ฟิตเนส|โยคะ|เสื่อ|เหนื่อย|workout)/i },
  { id: "wake_sit", label: "เริ่มจากเอนพักแล้วลุกขึ้นนั่งอย่างเป็นธรรมชาติ", family: "reclining", kinds: ["แอ็กชันแล้วหยุดพูด"], minSeconds: 15, maxSpeech: "normal", requiresContext: /(ตื่น|พัก|ง่วง|นอน|เช้า|เหนื่อย)/i },
  { id: "crouch_pick", label: "ย่อตัวหยิบของตกแล้วลุกขึ้น", family: "low_context", kinds: ["แอ็กชันนำเรื่อง"], minSeconds: 10, maxSpeech: "none", requiresContext: /(ตก|หยิบ|หา|เก็บ|ชั้นล่าง|รองเท้า)/i },
  { id: "kneel_shoelace", label: "คุกเข่าผูกเชือกรองเท้าแล้วลุก", family: "low_context", kinds: ["แอ็กชันนำเรื่อง"], minSeconds: 15, maxSpeech: "none", requiresContext: /(รองเท้า|วิ่ง|ออกกำลัง|เดินทาง|เชือก)/i },
  { id: "crawl_search", label: "คลานระยะสั้นเพื่อหาของใต้โต๊ะ แล้วหยุดเมื่อพบ", family: "low_context", kinds: ["แอ็กชันนำเรื่อง"], minSeconds: 15, maxSpeech: "none", requiresContext: /(หา.*ใต้โต๊ะ|ของหาย|ค้นหา|สัตว์เลี้ยง|ทำความสะอาด|ใต้โต๊ะ)/i, contextHint: "ใช้ได้เฉพาะเรื่องค้นหาของ เล่นกับสัตว์เลี้ยง หรือทำความสะอาด และใช้มุมกล้องระดับสายตาด้านหน้าเท่านั้น" },
  { id: "fix_hair", label: "ทัดหรือจัดผมหนึ่งครั้งแล้วลดมือลง", family: "daily", kinds: ["แอ็กชันแล้วหยุดพูด"], minSeconds: 10, maxSpeech: "normal", requiresContext: /(ผม|กระจก|แต่งตัว|ลม|เตรียม|หน้า)/i },
  { id: "open_notebook", label: "เปิดสมุด มองหนึ่งจังหวะ แล้วกลับมาสบกล้อง", family: "daily", kinds: ["แอ็กชันแล้วหยุดพูด"], minSeconds: 10, maxSpeech: "normal", requiresContext: /(สมุด|จด|งาน|เรียนรู้|วางแผน|โต๊ะ)/i },
  { id: "curtain", label: "เปิดม่านหนึ่งครั้งแล้วหยุดมองแสงด้านนอก", family: "daily", kinds: ["แอ็กชันนำเรื่อง"], minSeconds: 10, maxSpeech: "none", requiresContext: /(ม่าน|หน้าต่าง|เช้า|แสง|ห้อง)/i },
  { id: "startled_freeze", label: "สะดุ้งเล็กน้อย ถอยครึ่งก้าว แล้วหยุดนิ่ง", family: "comedy", kinds: ["แอ็กชันนำเรื่อง", "แอ็กชันแล้วหยุดพูด"], minSeconds: 10, maxSpeech: "normal" },
  { id: "peek_door", label: "แอบมองจากขอบประตูแล้วเดินออกมา", family: "comedy", kinds: ["แอ็กชันนำเรื่อง"], minSeconds: 10, maxSpeech: "none", requiresContext: /(ประตู|ห้อง|แอบ|สงสัย|ดู|หา)/i },
  { id: "double_take", label: "มองสิ่งหนึ่งแล้วหันกลับมามองซ้ำแบบตลก", family: "comedy", kinds: ["แอ็กชันนำเรื่อง", "แอ็กชันแล้วหยุดพูด"], minSeconds: 10, maxSpeech: "normal" },
];

const POSE_FAMILY_ALIASES: Record<PoseFamily, string[]> = {
  standing: ["standing", "ยืน"],
  sitting: ["sitting", "นั่ง"],
  walking: ["walking", "เดิน"],
  reclining: ["reclining", "เอน", "นอน"],
  low_context: ["lowcontext", "ย่อ", "คุกเข่า", "คลาน"],
  daily: ["daily", "ชีวิตประจำวัน"],
  comedy: ["comedy", "ตลก"],
};

function normalizedPoseTerm(input: string) {
  return input
    .toLowerCase()
    .replace(/(?:ไม่เอา|ไม่ใช้|ไม่ต้องการ|ห้าม|หลีกเลี่ยง)/g, "")
    .replace(/^ท่า/g, "")
    .replace(/[^a-z0-9ก-๙]+/g, "")
    .trim();
}

function excludedPoseTerms(input: string) {
  const phrases = input.split(/[,;\n/|]+/g);
  const words = input.split(/\s+/g);
  return [...new Set([...phrases, ...words].map(normalizedPoseTerm).filter((term) => term.length >= 2))];
}

function isPoseExcluded(pose: PoseDefinition, rawExclusions: string) {
  const terms = excludedPoseTerms(rawExclusions);
  if (!terms.length) return false;
  const id = normalizedPoseTerm(pose.id);
  const label = normalizedPoseTerm(pose.label);
  const family = normalizedPoseTerm(pose.family);
  const familyAliases = POSE_FAMILY_ALIASES[pose.family].map(normalizedPoseTerm);
  return terms.some((term) => {
    if (id.includes(term) || label.includes(term) || term === family) return true;
    return familyAliases.some((alias) => term === alias);
  });
}

function seededRandom(seed: string) {
  let state = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 3432918353);
    state = state << 13 | state >>> 19;
  }
  return () => {
    state = Math.imul(state ^ state >>> 16, 2246822507);
    state = Math.imul(state ^ state >>> 13, 3266489909);
    return ((state ^= state >>> 16) >>> 0) / 4294967296;
  };
}

function durationSeconds(value: string) {
  return Number.parseInt(value, 10) === 15 ? 15 : Number.parseInt(value, 10) === 10 ? 10 : 8;
}

function actionEvery(value: string) {
  if (value.startsWith("เน้นภาพ")) return 2;
  if (value.startsWith("สมดุล")) return 3;
  if (value.includes("ทุก 4")) return 4;
  return 0;
}

export type ResolvedPose = {
  scene: number;
  kind: SceneKind;
  poseId: string;
  label: string;
  family: PoseFamily;
  dialogueRule: string;
  contextHint?: string;
};

export function resolvePosePlan(data: StepThreeData, storyIndex = 1): ResolvedPose[] {
  const sceneCount = Number.parseInt(data.sceneCount, 10) || 1;
  const seconds = durationSeconds(data.sceneDuration);
  const interval = actionEvery(data.poseBalance);
  const context = `${data.topicBrief} ${data.channelConcept} ${data.contentPillars} ${data.settingPreferences} ${data.customPoseContext}`;
  const random = seededRandom(`${data.poseSeed || "EP6"}|${storyIndex}|${sceneCount}|${data.sceneDuration}|${data.speechSpeed}`);
  const selected: ResolvedPose[] = [];

  for (let index = 0; index < sceneCount; index += 1) {
    const actionSlot = interval > 0 && (index + 1) % interval === 0;
    const desiredKinds: SceneKind[] = actionSlot
      ? ["แอ็กชันนำเรื่อง"]
      : (index > 0 && seconds >= 10 && data.speechSpeed !== "เร็ว — 30–35 คำ" && random() > 0.72
        ? ["แอ็กชันแล้วหยุดพูด", "พูดเน้นหน้า"]
        : ["พูดเน้นหน้า"]);
    const isGenerallyCompatible = (pose: PoseDefinition) => {
      if (!data.allowedPoseFamilies.includes(pose.family)) return false;
      if (pose.minSeconds > seconds) return false;
      if (pose.requiresContext && !pose.requiresContext.test(context)) return false;
      if (isPoseExcluded(pose, data.excludedPoses)) return false;
      return true;
    };
    const compatibleSelected = POSES.filter(isGenerallyCompatible);
    const candidates = compatibleSelected.filter((pose) => {
      if (!pose.kinds.some((kind) => desiredKinds.includes(kind))) return false;
      if (data.speechSpeed === "เร็ว — 30–35 คำ" && !actionSlot && pose.maxSpeech !== "fast") return false;
      return true;
    });
    const previous = selected[selected.length - 1];
    const withoutRepeat = candidates.filter((pose) => pose.id !== previous?.poseId && pose.family !== previous?.family);
    const pool = withoutRepeat.length ? withoutRepeat : candidates.filter((pose) => pose.id !== previous?.poseId);
    const pose = pool.length ? pool[Math.floor(random() * pool.length)] : undefined;
    if (!pose) {
      const family = data.allowedPoseFamilies[0] || "standing";
      selected.push({
        scene: index + 1,
        kind: desiredKinds[0],
        poseId: `unresolved:${family}`,
        label: `ยังไม่พบท่าปลอดภัยในกลุ่ม ${POSE_FAMILIES.find((item) => item.id === family)?.label || family} ที่เข้ากับเวลา บริบท และรายการห้าม`,
        family,
        dialogueRule: "ต้องแก้ตัวเลือกก่อนสร้าง Prompt",
        contextHint: "เพิ่มบริบทที่รองรับ เลือกกลุ่มท่าอื่น เพิ่มเวลา หรือลดรายการท่าที่ห้าม",
      });
      continue;
    }
    const kind = pose.kinds.find((item) => desiredKinds.includes(item)) || pose.kinds[0];
    selected.push({
      scene: index + 1,
      kind,
      poseId: pose.id,
      label: pose.label,
      family: pose.family,
      dialogueRule: kind === "แอ็กชันนำเรื่อง" ? "ไม่มีบทพูด" : "พูดสดจากตัวละครที่เห็นใน source take เดียวกัน",
      contextHint: pose.contextHint,
    });
  }
  return selected;
}

export function getPosePlanIssues(data: StepThreeData) {
  const issues: string[] = [];
  const stories = Number.parseInt(data.storyCount, 10) || 1;
  for (let story = 1; story <= stories; story += 1) {
    const unresolved = resolvePosePlan(data, story).filter((pose) => pose.poseId.startsWith("unresolved:"));
    if (unresolved.length) {
      issues.push(`เรื่อง ${story}: ไม่มีอิริยาบถที่ปลอดภัยและเข้ากันได้ ${unresolved.length} ฉาก`);
    }
  }
  return issues;
}

function dialogueLimit(speed: string) {
  if (speed.startsWith("ช้า")) return "10–15 คำ";
  if (speed.startsWith("เร็ว")) return "30–35 คำ";
  return "20–25 คำ";
}

function poseSchedule(data: StepThreeData) {
  const stories = Number.parseInt(data.storyCount, 10) || 1;
  const rows: string[] = [];
  for (let story = 1; story <= stories; story += 1) {
    rows.push(`เรื่อง ${String(story).padStart(2, "0")}`);
    for (const pose of resolvePosePlan(data, story)) {
      rows.push(`- ฉาก ${String(pose.scene).padStart(2, "0")}: ${pose.kind} | ${pose.label} | ${pose.dialogueRule}${pose.contextHint ? ` | ${pose.contextHint}` : ""}`);
    }
  }
  return rows.join("\n");
}

export function buildPresenterStoryPrompt(data: StepThreeData, stepOne: StepOneData) {
  const limit = dialogueLimit(data.speechSpeed);
  const schedule = poseSchedule(data);
  const base = `สวมบทบาทเป็นผู้กำกับ นักเขียนบทไทย Prompt Engineer และ Continuity Supervisor สำหรับคลิปสร้างตัวตนแนวสาวสวยหรือหนุ่มหล่อ ให้ตัวละครมีเสน่ห์จากใบหน้า บุคลิก การแสดง และจังหวะเรื่อง โดยไม่มีสินค้าและไม่มีการขาย

ข้อมูลงาน
- ชื่อช่อง: ${value(data.channelName)}
- แก่นช่อง: ${value(data.channelConcept)}
- กลุ่มเป้าหมาย: ${value(data.targetAudience)}
- เสาหลักเนื้อหา: ${value(data.contentPillars)}
- หัวข้อหรือโจทย์รอบนี้: ${value(data.topicBrief, "ให้ AI เลือกหัวข้อใหม่จากเสาหลักโดยไม่ซ้ำกัน")}
- โครงสร้าง: ${data.framework}
- จำนวน: ${data.storyCount} เรื่อง เรื่องละ ${data.sceneCount} ฉาก ฉากละ ${data.sceneDuration}
- ความเร็วและจำนวนคำของฉากพูด: ${data.speechSpeed}
- โทน: ${value(data.tone)}
- สถานที่ที่ต้องการ: ${value(data.settingPreferences)}
- สถานที่ที่ไม่ต้องการ: ${value(data.excludedSettings, "ไม่มี")}
- ระดับการเคลื่อนไหว: ${data.movementLevel}
- บริบทท่าที่ผู้ใช้เพิ่ม: ${value(data.customPoseContext, "ไม่มี")}
- ท่าที่ห้าม: ${value(data.excludedPoses, "ไม่มี")}

Presenter DNA
${presenterSummary(stepOne)}

CHARACTER_REFERENCE_LOCK
${value(data.characterDescription)}

ผู้ใช้ยืนยันว่าได้สร้าง Character Reference ล่าสุดและจะอัปโหลดภาพนั้นเป็น reference ทุกครั้งที่สร้างภาพฉาก ห้ามสร้างภาพหรือวิดีโอต่อหากไม่มีไฟล์จริงให้แนบ

${hardSafetyRules()}

ตารางอิริยาบถที่ระบบจัดแบบ deterministic จาก seed “${value(data.poseSeed, "EP6")}”
ต้องใช้ชนิดฉากและท่าตามตารางนี้ ห้ามสุ่มใหม่ ห้ามสลับท่า ห้ามเพิ่ม gesture ที่ไม่ได้ระบุ หากท่าขัดกับเรื่องให้เปลี่ยนรายละเอียดเรื่องโดยยังอยู่ในเสาหลัก แต่ห้ามทำให้ท่าดูเชิงเพศ
${schedule}

กฎเนื้อหา
1. ทุกเรื่องเป็น Identity Content เท่านั้น ห้ามสินค้า ราคา ร้าน โปรโมชัน ลิงก์ ตะกร้า Affiliate บทขาย หรือ CTA ซื้อสินค้า
2. เรื่องแต่ละเรื่องต้องต่างกัน มี Hook ชัด ให้คุณค่า อารมณ์ หรือมุมมองใหม่ และจบด้วย takeaway หรือคำชวนสนทนาได้หนึ่งอย่าง
3. มุกและความหยอดต้องไม่เกินระดับที่ Presenter DNA กำหนด ห้ามทำให้คนอื่นเป็นวัตถุทางเพศ ห้ามคุกคาม และห้ามใช้เรือนร่างแทนแก่นเรื่อง
4. หนึ่งฉากมีการกระทำหลักเพียงหนึ่งลำดับที่ทำได้จริงในเวลา ${data.sceneDuration} มือแตะวัตถุก่อนวัตถุขยับ และรักษาฟิสิกส์ ตำแหน่ง จำนวน สถานะวัตถุ ผังห้อง แสง เสื้อผ้า และตัวตนต่อเนื่อง
5. ห้ามท่าเดิมติดกัน ห้าม family เดิมติดกันตามตาราง และห้ามเพิ่มการเดิน นั่ง นอน คลาน ทัดผม ชี้ โบก หรือถือของเองนอกตาราง
6. ท่าเอน นอน คุกเข่า หรือคลานต้องมีเหตุผลในเรื่องตามคำอธิบาย ใช้มุมกล้องระดับสายตาหรือด้านหน้า เสื้อผ้าเหมาะสม และไม่มี framing เชิงเพศ

กฎสามชนิดฉาก
- พูดเน้นหน้า: medium close-up หรือ medium shot ใบหน้าอย่างน้อย 25% ของเฟรม ปากไม่ถูกบัง กล้องนิ่งหรือ slow push-in เล็กน้อย การพูดเป็น action หลัก ใช้เพียงสีหน้าและการเคลื่อนศีรษะเล็กน้อย
- แอ็กชันนำเรื่อง: medium full หรือ full body ไม่มีบทพูด ช่องบทพูดเขียนตรงตัวว่า “— ไม่มีบทพูด” และ Video Prompt ระบุ quiet natural ambience เท่านั้น
- แอ็กชันแล้วหยุดพูด: ตัวละครทำหนึ่ง action ให้จบก่อน หยุดใน medium shot แล้วจึงพูด หากเวลาไม่พอให้ลดคำหรือเปลี่ยนเป็นฉากแอ็กชันล้วนตามตาราง ห้ามพูดระหว่างการเคลื่อนไหวหนัก

กฎเสียงพูดสด
- ทุกคำต้องมาจากการสร้าง source video เดียวกับภาพตัวละครที่กำลังพูด เห็นปากชัดและ lip sync ภาษาไทยตรงคำ ห้าม TTS voiceover cloned voice dubbing post-sync เสียงจาก take อื่น หรือผู้บรรยายนอกจอ
- Video Prompt ของฉากพูดต้องใส่บทไทยคำต่อคำหนึ่งครั้งในรูปแบบ Speech และระบุว่า spoken words are generated natively by the visible on-camera character in this same take with accurate Thai lip sync
- ฉากพูดมี ${limit} เท่านั้น ให้ตรวจจำนวนคำภาษาไทยตามความหมายและพูดจบใน ${data.sceneDuration} หากเป็นฉากแอ็กชันล้วนไม่ต้องเติมบทเพื่อให้ครบจำนวนคำ
- ห้ามซับไตเติล ข้อความ กราฟิก โลโก้ หรือลายน้ำในวิดีโอ

กฎ Image Prompt และ Video Prompt
- Image Prompt เป็นภาษาอังกฤษและใช้ Character Reference เป็นแหล่งความจริง ต้องระบุ subject, exact pose start state, wardrobe, location layout, important object state, camera, lighting และ continuity anchor ครบ
- ภาพทุกฉากต้องใช้ Character Reference ที่ผู้ใช้อัปโหลดเป็นแหล่งความจริงด้านตัวตนเพียงชุดเดียว เลือกโหมด reference หรือ image edit ของเครื่องมือปลายทาง ห้ามสร้างตัวละครใหม่จากข้อความล้วนเมื่อจำเป็นต้องรักษาความต่อเนื่องของตัวตน
- Video Prompt เป็นภาษาอังกฤษและเริ่มจากภาพฉากเดียวกัน อธิบาย action ตามลำดับ เหตุและผล กล้อง เวลา end state เสียง และบทพูดตามชนิดฉาก ห้าม morph, teleport, extra limbs, finger deformation, floating object, random gesture หรือเปลี่ยนชุด
- Prompt ต้องใช้งานเดี่ยวได้ ห้ามเขียนว่า “เหมือนฉากก่อน” โดยไม่ทวน continuity anchor ที่จำเป็น

รูปแบบผลลัพธ์
แสดงทีละเรื่องตามลำดับ:
## เรื่อง 01 — ชื่อเรื่อง
- Hook หลัก
- แก่นของเรื่อง
- โครงสร้างและการแบ่งช่วงตามฉาก
- Presenter และ Pose Direction

ตาราง 6 คอลัมน์ตรงตัว:
ลำดับฉาก | ประเภทฉากและอิริยาบถ | คำอธิบายฉาก | Image Prompt | Video Prompt | บทพูดภาษาไทย

ตรวจ final transcription ของ source และฟังเสียงความเร็วจริงทุกฉากพูด หากคำหาย ออกเสียงผิด เสียงไม่ใช่ตัวละครเดิม หรือ lip sync ไม่ตรง ให้สร้าง source ฉากนั้นใหม่เท่านั้น ห้ามซ่อมเสียงภายหลัง

ก่อนส่ง ให้ตรวจครบ ${data.storyCount} เรื่อง เรื่องละ ${data.sceneCount} ฉาก ตารางอิริยาบถตรงทุกแถว ไม่มีสินค้า ไม่มี CTA ขาย ไม่มีบทพูดในฉากแอ็กชันล้วน และทุกฉากพูดผ่านกฎ same-take native speech แล้ว แสดงเฉพาะฉบับสุดท้าย`;

  if (!data.useAgent) return base;

  return `${base}

คำสั่งเพิ่มเติมสำหรับ Agent และ Google Sheets
ใช้ส่วนนี้เฉพาะเมื่อมีเครื่องมือ Google Sheets ที่เชื่อมบัญชีผู้ใช้จริง ห้ามแต่งลิงก์หรืออ้างว่าสร้างไฟล์เมื่อไม่มีสิทธิ์
1. สร้าง Spreadsheet ใหม่ชื่อ “${value(data.channelName, "Presenter Identity")} — Presenter Identity Scripts” เท่านั้น
2. ทำงานและบันทึกทีละเรื่องทันที ภายในไฟล์มี ${data.storyCount} แท็บพอดี ชื่อ “01 - ชื่อเรื่อง” ตามลำดับ และห้ามเหลือ Sheet1 ว่าง
3. ในแต่ละแท็บ: A1 ชื่อเรื่อง, A2 Hook หลัก, A3 แก่นเรื่อง, A4 โครงสร้างและ Pose Direction, แถว 6 ใช้หัวคอลัมน์ตรงตัวว่า ลำดับฉาก | ประเภทฉากและอิริยาบถ | คำอธิบายฉาก | Image Prompt | Video Prompt | บทพูดภาษาไทย
4. แถว 7 เป็นต้นไปหนึ่งฉากต่อหนึ่งแถว เก็บทุกค่าเป็นข้อความธรรมดา ห้ามสูตร ห้ามย่อ แปล หรือตัด Prompt
5. เปิด Wrap text ตรึงแถว 1–6 ปรับความกว้างคอลัมน์ และตรวจแต่ละแท็บมี ${data.sceneCount} ฉากครบ
6. ถ้าสำเร็จจริงจึงตอบชื่อไฟล์ จำนวนเรื่อง จำนวนฉากทั้งหมด และลิงก์ที่เปิดได้ ถ้าทำได้บางส่วนให้รายงานตามจริงและแสดงงานที่เหลือในแชท`;
}
