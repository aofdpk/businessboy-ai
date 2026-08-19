import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";

const identityBuilderSource = readFileSync("gen3-src/presenter-identity-builder.tsx", "utf8");
const salesBuilderSource = readFileSync("gen3-src/presenter-sales-prompt-builder.tsx", "utf8");
const identityAppSource = readFileSync("gen3-src/presenter-identity-app.tsx", "utf8");
const salesAppSource = readFileSync("gen3-src/presenter-sales-app.tsx", "utf8");
const presenterClientSource = [identityBuilderSource, salesBuilderSource, identityAppSource, salesAppSource].join("\n");
assert.doesNotMatch(presenterClientSource, /localStorage/, "Presenter modes must not persist form data beyond the browser tab");
assert.match(identityBuilderSource, /sessionStorage\.setItem\(PRESENTER_IDENTITY_STORAGE_KEY/);
assert.match(salesBuilderSource, /sessionStorage\.getItem\(PRESENTER_IDENTITY_STORAGE_KEY\)/, "Sales must import Identity from the same tab storage");
assert.match(identityBuilderSource, /document\.execCommand\("copy"\)/, "Identity copy action needs a restricted-browser fallback");
assert.match(identityBuilderSource, /aria-label=\{fieldLabel \|\| undefined\}/, "Identity form controls need an accessible name");
for (const source of [identityAppSource, salesAppSource]) {
  assert.match(source, /sessionStorage\.removeItem\("businessboy-gen3-presenter-identity-v1"\)/);
  assert.match(source, /sessionStorage\.removeItem\("businessboy-gen3-presenter-sales-v1"\)/);
}

const entryResult = buildSync({
  entryPoints: ["gen3-src/presenter-identity-app.tsx"],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
});
assert.ok(entryResult.outputFiles[0].contents.length > 0, "Presenter Identity entry must bundle");

const dataResult = buildSync({
  entryPoints: ["gen3-src/presenter-identity-data.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
});
const moduleObject = { exports: {} };
const loadBundle = new Function("module", "exports", "require", dataResult.outputFiles[0].text);
loadBundle(moduleObject, moduleObject.exports, () => { throw new Error("Unexpected runtime dependency"); });
const presenter = moduleObject.exports;

const stepThree = {
  ...presenter.initialStepThree,
  sceneCount: "6",
  storyCount: "2",
  topicBrief: "หาโทรศัพท์ที่หายใต้โต๊ะในห้องนั่งเล่น",
  allowedPoseFamilies: ["standing", "sitting", "walking", "low_context", "daily", "comedy"],
  poseSeed: "EP6-QA",
};
const planA = presenter.resolvePosePlan(stepThree, 1);
const planB = presenter.resolvePosePlan(stepThree, 1);
assert.deepEqual(planA, planB, "Same seed and inputs must yield the same pose plan");
assert.equal(planA.length, 6, "Pose plan must match scene count");
assert.ok(planA.every((item) => item.kind !== "แอ็กชันนำเรื่อง" || item.dialogueRule === "ไม่มีบทพูด"), "Action-only scenes must have no dialogue");
assert.ok(planA.every((item, index) => index === 0 || item.poseId !== planA[index - 1].poseId), "Adjacent scenes must not repeat an exact pose");

const noContextPlan = presenter.resolvePosePlan({
  ...stepThree,
  topicBrief: "ยืนเล่าเรื่องทั่วไปในสตูดิโอ",
  customPoseContext: "",
  sceneCount: "10",
}, 1);
assert.ok(noContextPlan.every((item) => item.poseId !== "crawl_search"), "Crawling must never appear without a supporting context");

const one = presenter.initialStepOne;
const two = { ...presenter.initialStepTwo, characterDescription: "ผู้หญิงสมมติ อายุ 31 ปี ลุคไทยร่วมสมัย ชุดคลีนคงที่" };
assert.equal(presenter.initialStepTwo.characterName, "", "Step 2 must not ship a sample character name");
assert.equal(presenter.initialStepTwo.characterDescription, "", "Step 2 must not ship a sample identity description");
assert.ok(presenter.FACE_STYLES.includes("หล่อเข้ม") && presenter.FACE_STYLES.includes("น่ารักสดใส"), "Required face-style choices are missing");
assert.ok(presenter.COUNTRY_STYLES.includes("ไทยร่วมสมัย") && presenter.COUNTRY_STYLES.includes("เกาหลีร่วมสมัย"), "Required regional looks are missing");
const ideaPrompt = presenter.buildPresenterIdeaPrompt(one);
assert.match(ideaPrompt, /ยังไม่มีสินค้า ราคา โปรโมชั่น ลิงก์ซื้อ หรือ CTA ขาย/);
assert.match(ideaPrompt, /อายุหนึ่งค่าอย่างน้อย 25 ปี/);
const characterState = {
  ...two,
  characterName: "ตัวละครตรวจสอบแบบไดนามิก",
  groomingLock: "ล็อกทรงผมและการดูแลใบหน้าตามสถานะทดสอบ",
  wardrobeLock: "ล็อกชุดสีน้ำเงินหนึ่งชุดตามสถานะทดสอบ",
  expressionSet: "เป็นกลาง, ยิ้ม, มั่นใจ",
};
const characterStepOne = {
  ...one,
  presenterType: "หนุ่มหล่อ",
  faceStyle: "หล่อเข้ม",
  countryStyle: "เกาหลีร่วมสมัย",
};
const characterPrompt = presenter.buildPresenterCharacterPrompt(characterState, characterStepOne);
assert.match(characterPrompt, /2 คอลัมน์ × 3 แถว รวม 6 ช่อง/);
assert.match(characterPrompt, /ตัวละครตรวจสอบแบบไดนามิก/, "Step 2 must use the current character name");
assert.match(characterPrompt, /หนุ่มหล่อ · หล่อเข้ม/, "Step 2 must use the current Step 1 Presenter DNA");
assert.match(characterPrompt, /ล็อกทรงผมและการดูแลใบหน้าตามสถานะทดสอบ/, "Step 2 must use the current grooming lock");
assert.match(characterPrompt, /ล็อกชุดสีน้ำเงินหนึ่งชุดตามสถานะทดสอบ/, "Step 2 must use the current wardrobe lock");
assert.match(characterPrompt, /FINAL IDENTITY_LOCK/);
assert.match(characterPrompt, /MASTER IMAGE PROMPT/);
assert.match(characterPrompt, /NEGATIVE CONSTRAINTS/);
assert.match(characterPrompt, /QC CHECKLIST 10 ข้อ/);
assert.match(characterPrompt, /อย่าสร้างภาพในคำตอบนี้ ให้ส่งเฉพาะ Prompt พร้อมใช้/);
assert.doesNotMatch(characterPrompt, /Kie|gpt-image|task\s*ID|credits|manifest/i, "Step 2 must be tool-neutral");
const userExampleName = ["พี่", "เบิ้ม"].join("");
assert.equal(characterPrompt.includes(userExampleName), false, "The user's example character must never become a default or output fixture");
const userExampleAge = ["2", "9"].join("");
const userExampleHeight = ["18", "2"].join("");
assert.equal(characterPrompt.includes(`อายุ ${userExampleAge} ปี`), false, "The user's example age must not leak into a neutral fixture");
assert.equal(characterPrompt.includes(userExampleHeight), false, "The user's example height must not leak into a neutral fixture");
const revision = presenter.computeIdentityRevision(one, two);
const sanitized = presenter.sanitizePresenterIdentityState({
  schemaVersion: 1,
  mode: "presenter-identity",
  activeStep: 3,
  stepOne: one,
  stepTwo: { ...two, hasCharacterReference: true, referenceRevision: "stale" },
  stepThree: { ...presenter.initialStepThree, characterDescription: two.characterDescription, characterRevision: revision },
});
assert.equal(sanitized.stepTwo.hasCharacterReference, false, "A stale character reference must be invalidated");
assert.equal(sanitized.stepThree.characterDescription, "", "Downstream character data must be cleared when the reference is stale");

const safetyIssues = presenter.getPresenterSafetyIssues({ ...one, presenterType: "กำหนดเอง", presenterCustom: "นักเรียนอายุ 17 ปี" });
assert.ok(safetyIssues.length > 0, "Minor or school-context input must be blocked");
const nicheSafetyIssues = presenter.getPresenterSafetyIssues({ ...one, channelNiche: "กำหนดเอง", channelNicheCustom: "สาววัย 18 ทำคลิปชีวิตประจำวัน" });
assert.ok(nicheSafetyIssues.length > 0, "Safety scanning must include custom channel fields");
const safeExclusion = presenter.getPresenterSafetyIssues({ ...one, exclusions: "ห้ามเด็กและห้ามชุดนักเรียน" });
assert.equal(safeExclusion.length, 0, "A safety concept named only as an explicit exclusion must not become a false positive");
const adultAudience = presenter.getPresenterSafetyIssues({ ...one, audiencePreference: "ผู้ใหญ่วัย 18–35 และพ่อแม่ที่ซื้อของให้เด็กเล็ก" });
assert.equal(adultAudience.length, 0, "Audience ages and child-related audience context must not redefine the adult presenter");

const crawlExcluded = presenter.resolvePosePlan({
  ...stepThree,
  topicBrief: "หาของหายใต้โต๊ะ",
  customPoseContext: "คลานหาของใต้โต๊ะ",
  excludedPoses: "คลาน",
  sceneCount: "10",
}, 1);
assert.ok(crawlExcluded.every((item) => item.poseId !== "crawl_search"), "Literal Thai pose exclusions must block matching poses");

const incompatibleSelection = {
  ...stepThree,
  allowedPoseFamilies: ["reclining"],
  topicBrief: "ยืนเล่าเรื่องทั่วไปในสตูดิโอ",
  customPoseContext: "",
  sceneDuration: "8 วินาที",
  sceneCount: "2",
};
const incompatiblePlan = presenter.resolvePosePlan(incompatibleSelection, 1);
assert.ok(incompatiblePlan.every((item) => item.poseId.startsWith("unresolved:") || item.family === "reclining"), "Resolver must never inject an unselected pose family");
assert.ok(presenter.getPosePlanIssues(incompatibleSelection).length > 0, "An impossible pose selection must block Prompt creation");

const noActionKindFallback = {
  ...presenter.initialStepThree,
  sceneCount: "3",
  sceneDuration: "15 วินาที",
  poseBalance: "เน้นพูด — ไม่มีฉากแอ็กชันล้วน",
  allowedPoseFamilies: ["low_context"],
  topicBrief: "หาของใต้โต๊ะ",
  customPoseContext: "หาของใต้โต๊ะ",
  poseSeed: "x",
};
const noActionKindPlan = presenter.resolvePosePlan(noActionKindFallback, 1);
assert.ok(noActionKindPlan.every((item) => item.kind !== "แอ็กชันนำเรื่อง"), "No-action pose balance must never fall back to action-only poses");
assert.ok(presenter.getPosePlanIssues(noActionKindFallback).length > 0, "An incompatible scene kind must block Prompt creation");

const storyPrompt = presenter.buildPresenterStoryPrompt({
  ...stepThree,
  channelName: "ช่องทดสอบ",
  channelConcept: "เล่าเรื่องขำในชีวิตประจำวัน",
  targetAudience: "ผู้ใหญ่ไทย",
  contentPillars: "ชีวิตประจำวัน",
  characterDescription: two.characterDescription,
  characterRevision: revision,
}, one);
assert.match(storyPrompt, /same take/i, "Story prompt must lock native same-take speech");
assert.match(storyPrompt, /— ไม่มีบทพูด/, "Story prompt must define dialogue-free action scenes");
assert.match(storyPrompt, /Character Reference ที่ผู้ใช้อัปโหลดเป็นแหล่งความจริงด้านตัวตนเพียงชุดเดียว/, "Scene workflow must preserve identity through the uploaded Character Reference");
assert.match(storyPrompt, /โหมด reference หรือ image edit ของเครื่องมือปลายทาง/, "Scene workflow must remain tool-neutral while requiring reference mode");
assert.doesNotMatch(storyPrompt, /Kie|gpt-image|task\s*ID|credits|manifest/i, "Step 3 must not leak internal image-tool workflow claims");
assert.match(storyPrompt, /ลำดับฉาก \| ประเภทฉากและอิริยาบถ \| คำอธิบายฉาก \| Image Prompt \| Video Prompt \| บทพูดภาษาไทย/);
assert.match(storyPrompt, /ไม่มีสินค้าและไม่มีการขาย/);

console.log("Presenter Identity QA passed");
