import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";

const identityBuilderSource = readFileSync("gen3-src/presenter-identity-builder.tsx", "utf8");
const identityDataSource = readFileSync("gen3-src/presenter-identity-data.ts", "utf8");
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
};
assert.equal(presenter.initialStepThree.sceneDuration, "8 วินาที", "Fresh and reset Step 3 state must default to 8 seconds");
assert.equal(presenter.sanitizeStepThree({}).sceneDuration, "8 วินาที", "Missing duration must sanitize to the 8-second default");
assert.equal(presenter.sanitizeStepThree({ sceneDuration: "invalid" }).sceneDuration, "8 วินาที", "Invalid duration must sanitize to the 8-second default");
assert.equal(presenter.sanitizeStepThree({ sceneDuration: "10 วินาที" }).sceneDuration, "10 วินาที", "An explicit saved 10-second choice must survive sanitization");
assert.equal(presenter.sanitizeStepThree({ sceneDuration: "15 วินาที" }).sceneDuration, "15 วินาที", "An explicit saved 15-second choice must survive sanitization");
const removedPoseFields = ["poseBalance", "allowedPoseFamilies", "movementLevel", "motionLevel", "poseSeed", "customPoseContext", "excludedPoses"];
for (const field of removedPoseFields) {
  assert.equal(Object.hasOwn(presenter.initialStepThree, field), false, `${field} must not remain in Step 3 defaults`);
}
assert.doesNotMatch(identityBuilderSource, /PoseFamilyPicker|resolvePosePlan|getPosePlanIssues|ตัวอย่างแผนท่า|Seed สำหรับสุ่ม|ระบบอิริยาบถ/, "Removed pose controls must not remain in the UI");
assert.doesNotMatch(identityDataSource, /POSE_FAMILIES|PoseDefinition|ResolvedPose|resolvePosePlan|getPosePlanIssues|seededRandom|poseSchedule/, "Deterministic pose-engine code must be removed");

const one = presenter.initialStepOne;
const two = { ...presenter.initialStepTwo, characterDescription: "ผู้หญิงสมมติ อายุ 31 ปี ลุคไทยร่วมสมัย ชุดคลีนคงที่" };
assert.equal(presenter.initialStepTwo.characterName, "", "Step 2 must not ship a sample character name");
assert.equal(presenter.initialStepTwo.characterDescription, "", "Step 2 must not ship a sample identity description");
assert.ok(presenter.FACE_STYLES.includes("หล่อเข้ม") && presenter.FACE_STYLES.includes("น่ารักสดใส"), "Required face-style choices are missing");
assert.ok(presenter.COUNTRY_STYLES.includes("ไทยร่วมสมัย") && presenter.COUNTRY_STYLES.includes("เกาหลีร่วมสมัย"), "Required regional looks are missing");
const ideaPrompt = presenter.buildPresenterIdeaPrompt(one);
assert.match(ideaPrompt, /ยังไม่มีสินค้า ราคา โปรโมชั่น ลิงก์ซื้อ หรือ CTA ขาย/);
assert.match(ideaPrompt, /อายุหนึ่งค่าอย่างน้อย 25 ปี/);
assert.match(ideaPrompt, /2\. กลุ่มเป้าหมาย พร้อมปัญหา ความสนใจ และเหตุผลที่เขาจะติดตาม/);
assert.match(ideaPrompt, /6\. แก่นหลักของช่องในหนึ่งประโยค/);
assert.match(ideaPrompt, /7\. เสาหลักเนื้อหา 3–5 ข้อ/);
assert.ok(ideaPrompt.indexOf("2. กลุ่มเป้าหมาย") < ideaPrompt.indexOf("6. แก่นหลักของช่อง") && ideaPrompt.indexOf("6. แก่นหลักของช่อง") < ideaPrompt.indexOf("7. เสาหลักเนื้อหา 3–5 ข้อ"), "Step 1 output labels must follow the approved order");
assert.doesNotMatch(ideaPrompt, /Content Promise|กลุ่มผู้ชมและเหตุผลที่ติดตาม|เสาหลักเนื้อหา 5 ข้อ/, "Obsolete Presenter labels must not remain");
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
assert.match(characterPrompt, /^สวมบทบาทเป็น Character Director และผู้กำกับภาพสำหรับมนุษย์สมจริง ให้สร้างภาพ Character Sheet/,
  "Step 2 must directly request image creation");
assert.match(characterPrompt, /ตัวละครตรวจสอบแบบไดนามิก/, "Step 2 must use the current character name");
assert.match(characterPrompt, /หนุ่มหล่อ · หล่อเข้ม/, "Step 2 must use the current Step 1 Presenter DNA");
assert.match(characterPrompt, /ล็อกทรงผมและการดูแลใบหน้าตามสถานะทดสอบ/, "Step 2 must use the current grooming lock");
assert.match(characterPrompt, /ล็อกชุดสีน้ำเงินหนึ่งชุดตามสถานะทดสอบ/, "Step 2 must use the current wardrobe lock");
assert.match(characterPrompt, /สร้างภาพ Character Sheet แนวตั้ง 9:16 แบบ 2 คอลัมน์ × 3 แถว จำนวน 1 ภาพตามข้อกำหนดทั้งหมดข้างต้นทันที และแสดงผลลัพธ์เป็นภาพเดียว$/,
  "Step 2 must end with an affirmative one-image instruction");
assert.doesNotMatch(characterPrompt, /สร้างคำสั่งผลิต|แสดงผลลัพธ์เป็น\s*\n\s*1\.|FINAL IDENTITY_LOCK|MASTER IMAGE PROMPT|NEGATIVE CONSTRAINTS|QC CHECKLIST|อย่าสร้างภาพ/,
  "Step 2 must not fall back to a prose prompt package or a no-image instruction");
assert.doesNotMatch(characterPrompt, /Kie|gpt-image|task\s*ID|credits|manifest/i, "Step 2 must be tool-neutral");
const userExampleName = ["พี่", "เบิ้ม"].join("");
assert.equal(characterPrompt.includes(userExampleName), false, "The user's example character must never become a default or output fixture");
const userExampleAge = ["2", "9"].join("");
const userExampleHeight = ["18", "2"].join("");
assert.equal(characterPrompt.includes(`อายุ ${userExampleAge} ปี`), false, "The user's example age must not leak into a neutral fixture");
assert.equal(characterPrompt.includes(userExampleHeight), false, "The user's example height must not leak into a neutral fixture");
const revision = presenter.computeIdentityRevision(one, two);
const legacyStepThree = {
  ...presenter.initialStepThree,
  channelName: "ช่องเดิมที่ต้องรักษา",
  channelConcept: "แก่นช่องเดิมที่ต้องรักษา",
  targetAudience: "กลุ่มเดิมที่ต้องรักษา",
  contentPillars: "เสาหลักเดิมที่ต้องรักษา",
  sceneDuration: "10 วินาที",
  characterDescription: two.characterDescription,
  characterRevision: revision,
  poseBalance: "สมดุล — แอ็กชันประมาณทุก 3 ฉาก",
  allowedPoseFamilies: ["standing", "walking"],
  movementLevel: "กลาง — หนึ่งการกระทำชัดเจนต่อฉาก",
  motionLevel: "legacy alias",
  poseSeed: "legacy-seed",
  customPoseContext: "legacy context",
  excludedPoses: "legacy exclusion",
};
const migrated = presenter.sanitizePresenterIdentityState({
  schemaVersion: 1,
  mode: "presenter-identity",
  activeStep: 3,
  stepOne: one,
  stepTwo: { ...two, hasCharacterReference: true, referenceRevision: revision },
  stepThree: legacyStepThree,
});
assert.ok(migrated, "Schema 1 state must migrate to schema 2");
assert.equal(migrated.schemaVersion, 2, "Migrated state must be written as schema 2");
assert.equal(migrated.activeStep, 3);
assert.equal(migrated.stepTwo.hasCharacterReference, true, "Migration must preserve a current Character Reference");
assert.equal(migrated.stepThree.characterDescription, two.characterDescription, "Migration must preserve the current Character Lock");
assert.equal(migrated.stepThree.channelName, "ช่องเดิมที่ต้องรักษา");
assert.equal(migrated.stepThree.channelConcept, "แก่นช่องเดิมที่ต้องรักษา");
assert.equal(migrated.stepThree.sceneDuration, "10 วินาที", "Schema 1 migration must preserve an explicit 10-second choice");
for (const field of removedPoseFields) {
  assert.equal(Object.hasOwn(migrated.stepThree, field), false, `Migration must drop legacy ${field}`);
}
assert.equal(presenter.sanitizePresenterIdentityState({ ...migrated, schemaVersion: 3 }), null, "Future schemas must be rejected");
assert.equal(presenter.sanitizePresenterIdentityState({ ...migrated, schemaVersion: 0 }), null, "Unknown old schemas must be rejected");
assert.equal(presenter.sanitizePresenterIdentityState({ ...migrated, mode: "wrong-mode" }), null, "Wrong modes must be rejected");
const migratedFifteen = presenter.sanitizePresenterIdentityState({
  ...migrated,
  schemaVersion: 2,
  stepThree: { ...migrated.stepThree, sceneDuration: "15 วินาที" },
});
assert.ok(migratedFifteen);
assert.equal(migratedFifteen.stepThree.sceneDuration, "15 วินาที", "Schema 2 migration must preserve an explicit 15-second choice");

const stale = presenter.sanitizePresenterIdentityState({
  schemaVersion: 2,
  mode: "presenter-identity",
  activeStep: 3,
  stepOne: one,
  stepTwo: { ...two, hasCharacterReference: true, referenceRevision: "stale" },
  stepThree: { ...presenter.initialStepThree, characterDescription: two.characterDescription, characterRevision: revision },
});
assert.ok(stale);
assert.equal(stale.stepTwo.hasCharacterReference, false, "A stale character reference must be invalidated");
assert.equal(stale.stepThree.characterDescription, "", "Downstream character data must be cleared when the reference is stale");

const safetyIssues = presenter.getPresenterSafetyIssues({ ...one, presenterType: "กำหนดเอง", presenterCustom: "นักเรียนอายุ 17 ปี" });
assert.ok(safetyIssues.length > 0, "Minor or school-context input must be blocked");
const nicheSafetyIssues = presenter.getPresenterSafetyIssues({ ...one, channelNiche: "กำหนดเอง", channelNicheCustom: "สาววัย 18 ทำคลิปชีวิตประจำวัน" });
assert.ok(nicheSafetyIssues.length > 0, "Safety scanning must include custom channel fields");
const safeExclusion = presenter.getPresenterSafetyIssues({ ...one, exclusions: "ห้ามเด็กและห้ามชุดนักเรียน" });
assert.equal(safeExclusion.length, 0, "A safety concept named only as an explicit exclusion must not become a false positive");
const adultAudience = presenter.getPresenterSafetyIssues({ ...one, audiencePreference: "ผู้ใหญ่วัย 18–35 และพ่อแม่ที่ซื้อของให้เด็กเล็ก" });
assert.equal(adultAudience.length, 0, "Audience ages and child-related audience context must not redefine the adult presenter");
assert.match(identityBuilderSource, /hint="ใช้กับทุกฉาก · ทุกฉากมีบทพูด ไม่มีฉากเงียบ"/,
  "The speech-speed UI must explain that every scene speaks");
assert.match(identityBuilderSource, /โหมดเร็วต้องลดการเคลื่อนไหวทุกฉาก/,
  "The fast-speech warning must apply to every scene");

const storyStepOne = { ...one, exclusions: "ห้ามฉากบนเตียงและห้ามมุกล้อรูปร่าง" };
const storyPrompt = presenter.buildPresenterStoryPrompt({
  ...stepThree,
  channelName: "ช่องทดสอบ",
  channelConcept: "เล่าเรื่องขำในชีวิตประจำวัน",
  targetAudience: "ผู้ใหญ่ไทย",
  contentPillars: "ชีวิตประจำวัน",
  characterDescription: two.characterDescription,
  characterRevision: revision,
}, storyStepOne);
assert.match(storyPrompt, /same take/i, "Story prompt must lock native same-take speech");
assert.match(storyPrompt, /พูดเน้นหน้า:[^\n]+/);
assert.match(storyPrompt, /พูดพร้อมแอ็กชันเบา:[^\n]+/);
assert.match(storyPrompt, /ทำแอ็กชันให้จบ แล้วหยุดนิ่งเพื่อพูด:[^\n]+/);
assert.match(storyPrompt, /ทุกฉากต้องเลือกหนึ่งในสามชนิดนี้และทุกชนิดต้องมีบทพูด/);
assert.match(storyPrompt, /ทุกฉากต้องมีบทพูดภาษาไทยที่ไม่ว่าง/);
assert.match(storyPrompt, /ความเร็วและจำนวนคำของทุกฉาก: ปกติ — 20–25 คำ/);
assert.doesNotMatch(storyPrompt, /ความเร็วและจำนวนคำของฉากพูด/,
  "The job summary must not imply that any scene can be non-speaking");
assert.match(storyPrompt, /Video Prompt ของทุกฉากต้องใส่บทไทยจากคอลัมน์ “บทพูดภาษาไทย” แบบคำต่อคำหนึ่งครั้งในรูปแบบ Speech: The visible character says exactly once in natural Thai/);
assert.match(storyPrompt, /บทพูดทุกฉากมี 20–25 คำ เท่านั้น/);
assert.match(storyPrompt, /ทุกแถวมีบทพูดภาษาไทย 20–25 คำ และ Video Prompt มี Speech เดียวกันแบบคำต่อคำ/);
assert.doesNotMatch(storyPrompt, /— ไม่มีบทพูด|แอ็กชันล้วน|quiet natural ambience เท่านั้น|แอ็กชันนำเรื่อง:/,
  "No action-only or dialogue-free exception may remain");
assert.match(storyPrompt, /วางแก่นเรื่อง Hook ลำดับเหตุการณ์ บทพูด และความต่อเนื่อง[^\n]+ก่อน/,
  "The story and script must be planned before poses");
const storyPlanningIndex = storyPrompt.indexOf("วางแก่นเรื่อง Hook ลำดับเหตุการณ์ บทพูด และความต่อเนื่อง");
const motionSelectionIndex = storyPrompt.indexOf("หลังล็อกเรื่องแล้ว ให้ AI เลือกและปรับระดับการเคลื่อนไหวต่อฉาก");
assert.ok(storyPlanningIndex >= 0 && motionSelectionIndex > storyPlanningIndex,
  "Story and script planning must precede per-scene motion-level selection");
assert.match(storyPrompt, /- ต่ำ: ท่ากลางผ่อนคลาย/);
assert.match(storyPrompt, /- กลาง: การกระทำชัดเจนหนึ่งอย่าง/);
assert.match(storyPrompt, /- สูง: การเคลื่อนไหวเด่นแต่ปลอดภัย/);
assert.match(storyPrompt, /ทำ action ให้จบ หยุดนิ่งในระยะที่เห็นปากชัด แล้วพูดบทของฉากให้ครบ/,
  "High motion must settle before the required dialogue or be reduced");
assert.match(storyPrompt, /ระดับทั้งสามเป็นคำแนะนำ ไม่ใช่ allowlist โควตา ลำดับ seed หรือ fixed mapping/,
  "Motion levels must be advisory rather than a fixed control contract");
assert.match(storyPrompt, /ให้ AI เลือก ผสม ลด หรือปรับได้ต่อฉากหลังจากวางเรื่องแล้ว/);
assert.match(storyPrompt, /ใช้ความยาวฉากเป็นเพดานตรวจความเป็นไปได้ ไม่ใช่ตัวกำหนดระดับการเคลื่อนไหว/);
assert.match(storyPrompt, /ห้ามผูก ต่ำ\/กลาง\/สูง เข้ากับเวลาแบบตายตัว/);
assert.match(storyPrompt, /ไม่ใช่ allowlist และไม่มี POSE_ID บังคับ/,
  "Pose examples must remain adaptable rather than becoming a rigid ID catalog");
assert.match(storyPrompt, /ไม่มีโควตา ลำดับ หรือ seed สำหรับท่า/);
assert.match(storyPrompt, /ไม่จำเป็นต้องใช้ทุกกลุ่ม/);
assert.match(storyPrompt, /ห้ามเขียนหรือบิดเรื่องใหม่เพียงเพื่อหาเหตุผลรองรับท่า/);
assert.match(storyPrompt, /หนึ่งการกระทำหลักต่อฉาก/);
assert.match(storyPrompt, /HARD EXCLUSIONS ที่สืบทอดจาก STEP 1/);
assert.match(storyPrompt, /ห้ามฉากบนเตียงและห้ามมุกล้อรูปร่าง/,
  "Step 1 exclusions must flow into Step 3 without another form field");
assert.doesNotMatch(storyPrompt, /ตารางอิริยาบถ|ตามตาราง|deterministic/, "No precomputed pose schedule may remain");
assert.match(storyPrompt, /Character Reference ที่ผู้ใช้อัปโหลดเป็นแหล่งความจริงด้านตัวตนเพียงชุดเดียว/, "Scene workflow must preserve identity through the uploaded Character Reference");
assert.match(storyPrompt, /โหมด reference หรือ image edit ของเครื่องมือปลายทาง/, "Scene workflow must remain tool-neutral while requiring reference mode");
assert.doesNotMatch(storyPrompt, /Kie|gpt-image|task\s*ID|credits|manifest/i, "Step 3 must not leak internal image-tool workflow claims");
assert.match(storyPrompt, /แก่นหลักของช่อง:/);
assert.match(storyPrompt, /กลุ่มเป้าหมาย:/);
assert.match(storyPrompt, /เสาหลักเนื้อหา 3–5 ข้อ:/);
assert.match(storyPrompt, /ลำดับฉาก \| ประเภทฉากและอิริยาบถ \| คำอธิบายฉาก \| Image Prompt \| Video Prompt \| บทพูดภาษาไทย/);
assert.match(storyPrompt, /ห้ามใช้ POSE_ID รหัสภายใน/);
assert.match(storyPrompt, /ไม่มีสินค้าและไม่มีการขาย/);

const fastEightSecondPrompt = presenter.buildPresenterStoryPrompt({
  ...stepThree,
  channelName: "ช่องทดสอบโหมดเร็ว",
  channelConcept: "เล่าเรื่องกระชับด้วยเหตุการณ์ใกล้ตัว",
  targetAudience: "ผู้ใหญ่ไทย",
  contentPillars: "ชีวิตประจำวัน",
  characterDescription: two.characterDescription,
  characterRevision: revision,
  sceneDuration: "8 วินาที",
  speechSpeed: "เร็ว — 30–35 คำ",
}, storyStepOne);
assert.match(fastEightSecondPrompt, /บทพูดทุกฉากมี 30–35 คำ เท่านั้น[^\n]+พูดจบใน 8 วินาที/,
  "The 8-second fast fixture must keep the selected dialogue range mandatory in every scene");
assert.match(fastEightSecondPrompt, /หากเวลาไม่พอให้ลดระดับหรือความซับซ้อนของ action/,
  "The 8-second fast fixture must reduce motion instead of removing dialogue");
assert.doesNotMatch(fastEightSecondPrompt, /— ไม่มีบทพูด|แอ็กชันล้วน|quiet natural ambience เท่านั้น|แอ็กชันนำเรื่อง:/,
  "The 8-second fast fixture must not regain a silent-scene escape hatch");

console.log("Presenter Identity QA passed");
