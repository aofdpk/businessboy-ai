/* ============================================================
   gemini-kit.js — Template กลางสำหรับเรียก Gemini จากเบราว์เซอร์
   โมเดล BYO-key: ผู้ใช้ใส่ API key ของตัวเอง เก็บใน localStorage เท่านั้น
   ไม่มี backend · ไม่ส่ง key ไปไหนนอกจาก Google โดยตรง
   ============================================================ */
(function () {
  const LS_KEY = 'gemini_api_key';
  const EP = 'https://generativelanguage.googleapis.com';
  const MODEL_TEXT = 'gemini-2.5-flash';
  const MODEL_IMAGE = 'gemini-2.5-flash-image';

  // โหมดทำงาน: ถ้าเป็นเว็บจริง (https + ไม่ใช่ localhost) -> ใช้ proxy หลังบ้าน (keyless, key อยู่ฝั่ง server)
  //            ถ้าเปิดในเครื่อง (file:// หรือ localhost) -> โหมด BYO-key (ใส่ key เอง)
  const PROXY = (typeof location !== 'undefined'
    && location.protocol === 'https:'
    && !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname))
    ? '/api' : null;

  // ---------- key storage ----------
  function getKey() { return localStorage.getItem(LS_KEY) || ''; }
  function setKey(k) { localStorage.setItem(LS_KEY, k.trim()); }
  function clearKey() { localStorage.removeItem(LS_KEY); }
  function hasKey() { return !!getKey(); }

  // ---------- styles (inject once) ----------
  const css = `
  .gk-modal{position:fixed;inset:0;background:rgba(10,12,20,.82);display:flex;align-items:center;justify-content:center;z-index:9999;padding:18px;font-family:'Prompt',system-ui,sans-serif}
  .gk-box{background:#fff;border-radius:22px;padding:24px;max-width:400px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.4)}
  .gk-box h3{font-size:20px;margin:0 0 4px;color:#1f2937}
  .gk-box p{font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 14px}
  .gk-box input{width:100%;border:2px solid #eef2f7;border-radius:12px;padding:12px 14px;font-size:15px;outline:none;font-family:inherit;margin-bottom:10px}
  .gk-box input:focus{border-color:#7c3aed}
  .gk-box .gk-btn{width:100%;border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff}
  .gk-box .gk-link{display:inline-block;margin-top:4px;font-size:13px;color:#7c3aed;font-weight:600}
  .gk-warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:10px 12px;font-size:11.5px;line-height:1.6;margin-bottom:12px}
  .gk-row{display:flex;gap:8px;margin-top:8px}
  .gk-row .gk-btn2{flex:1;border:1px solid #e5e7eb;background:#f9fafb;border-radius:12px;padding:10px;font-size:13px;cursor:pointer;font-family:inherit;color:#6b7280;font-weight:600}
  .gk-gear{position:fixed;top:12px;right:12px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:18px;cursor:pointer;z-index:50;backdrop-filter:blur(4px)}
  .gk-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#111827;color:#fff;padding:12px 22px;border-radius:14px;font-size:14px;opacity:0;transition:.3s;pointer-events:none;z-index:10000;font-family:'Prompt',sans-serif;max-width:90vw;text-align:center}
  .gk-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  `;
  function injectCSS() {
    if (document.getElementById('gk-css')) return;
    const s = document.createElement('style'); s.id = 'gk-css'; s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------- key modal ----------
  function showKeyModal(onSaved) {
    injectCSS();
    const wrap = document.createElement('div');
    wrap.className = 'gk-modal';
    wrap.innerHTML = `
      <div class="gk-box">
        <h3>🔑 ใส่ Gemini API Key</h3>
        <p>โปรแกรมนี้ใช้ AI ของ Google (Gemini) — ใส่ key ของคุณเองครั้งเดียว เก็บไว้ในเครื่องนี้เท่านั้น</p>
        <input id="gk-input" type="password" placeholder="วาง API key ที่นี่ (AIza...)" value="${getKey()}">
        <a class="gk-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">→ ขอ key ฟรีที่ Google AI Studio</a>
        <div class="gk-warn">⚠️ ความปลอดภัย: key เก็บใน localStorage ของเบราว์เซอร์นี้เท่านั้น ไม่ถูกส่งไปเซิร์ฟเวอร์ใด · แนะนำตั้ง key ให้จำกัดเฉพาะ Gemini API + ตั้ง billing alert · งานลูกค้า/ความลับควรใช้ paid tier (free tier Google นำข้อมูลไปเทรน)</div>
        <button class="gk-btn" id="gk-save">บันทึกแล้วเริ่มใช้</button>
        <div class="gk-row">
          <button class="gk-btn2" id="gk-clear">ล้าง key</button>
          <button class="gk-btn2" id="gk-close">ปิด</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const inp = wrap.querySelector('#gk-input');
    inp.focus();
    wrap.querySelector('#gk-save').onclick = () => {
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      setKey(v); wrap.remove(); toast('บันทึก key แล้ว ✅'); if (onSaved) onSaved();
    };
    wrap.querySelector('#gk-clear').onclick = () => { clearKey(); inp.value = ''; inp.focus(); };
    wrap.querySelector('#gk-close').onclick = () => wrap.remove();
  }

  // require key: resolves once a key exists
  function requireKey() {
    return new Promise((resolve) => {
      if (hasKey()) return resolve();
      showKeyModal(() => resolve());
    });
  }

  function mountGear() {
    if (PROXY) return; // โหมดเว็บจริง: ไม่ต้องใส่ key เอง จึงไม่ต้องมีปุ่มเฟือง
    injectCSS();
    if (document.getElementById('gk-gear')) return;
    const b = document.createElement('button');
    b.id = 'gk-gear'; b.className = 'gk-gear'; b.title = 'ตั้งค่า API key'; b.textContent = '⚙️';
    b.onclick = () => showKeyModal();
    document.body.appendChild(b);
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    injectCSS();
    let t = document.getElementById('gk-toast');
    if (!t) { t = document.createElement('div'); t.id = 'gk-toast'; t.className = 'gk-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- helpers ----------
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function apiError(status, body) {
    let msg = 'เกิดข้อผิดพลาด (' + status + ')';
    try {
      const e = (typeof body === 'string' ? JSON.parse(body) : body);
      const m = e.error && e.error.message ? e.error.message : '';
      if (status === 400 && /API key not valid/i.test(m)) msg = 'API key ไม่ถูกต้อง — กดรูปเฟือง ⚙️ มุมขวาบนเพื่อใส่ใหม่';
      else if (status === 429) msg = 'เรียกถี่/โควต้าหมดชั่วคราว — รอสักครู่แล้วลองใหม่ (free tier จำกัดต่อนาที)';
      else if (status === 403) msg = 'key ถูกปฏิเสธ — ตรวจว่าเปิดสิทธิ์ Gemini API และไม่ติด restriction';
      else if (m) msg = m;
    } catch (e) {}
    return new Error(msg);
  }

  // core generateContent call (รองรับทั้ง proxy หลังบ้าน และ BYO-key)
  async function generate(model, parts, opts = {}) {
    const body = { contents: [{ parts }] };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
    if (opts.generationConfig) body.generationConfig = opts.generationConfig;
    let res;
    if (PROXY) {
      res = await fetch(PROXY + '/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model, body: body })
      });
    } else {
      if (!hasKey()) { await requireKey(); }
      res = await fetch(`${EP}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(getKey())}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
    }
    const txt = await res.text();
    if (!res.ok) throw apiError(res.status, txt);
    return JSON.parse(txt);
  }

  function extractText(resp) {
    try {
      const parts = resp.candidates[0].content.parts;
      return parts.filter(p => p.text).map(p => p.text).join('\n').trim();
    } catch (e) { return ''; }
  }
  function extractImage(resp) {
    try {
      const parts = resp.candidates[0].content.parts;
      const img = parts.find(p => p.inlineData || p.inline_data);
      const d = img.inlineData || img.inline_data;
      return 'data:' + (d.mimeType || d.mime_type || 'image/png') + ';base64,' + d.data;
    } catch (e) { return null; }
  }

  // ---------- public: text ----------
  async function text(prompt, opts = {}) {
    const gc = {};
    if (opts.json) gc.responseMimeType = 'application/json';
    const cfg = { system: opts.system, generationConfig: Object.keys(gc).length ? gc : undefined };
    const out = extractText(await generate(MODEL_TEXT, [{ text: prompt }], cfg));
    if (!opts.json) return out;
    let parsed = safeJson(out);
    if (parsed == null) { // retry once on bad JSON
      parsed = safeJson(extractText(await generate(MODEL_TEXT, [{ text: prompt + '\n\nสำคัญ: ตอบกลับเป็น JSON ที่ถูกต้องเท่านั้น ห้ามมีข้อความอื่นหรือ markdown' }], cfg)));
    }
    return parsed;
  }

  // ---------- public: vision (prompt + images) ----------
  // images: array of {data:base64, mime:'image/png'} OR File objects
  async function vision(prompt, images, opts = {}) {
    const parts = [];
    for (const im of (images || [])) {
      if (im instanceof File) parts.push({ inline_data: { mime_type: im.type, data: await fileToBase64(im) } });
      else parts.push({ inline_data: { mime_type: im.mime || 'image/jpeg', data: im.data } });
    }
    parts.push({ text: prompt });
    const gc = {};
    if (opts.json) gc.responseMimeType = 'application/json';
    const cfg = { system: opts.system, generationConfig: Object.keys(gc).length ? gc : undefined };
    const out = extractText(await generate(MODEL_TEXT, parts, cfg));
    if (!opts.json) return out;
    let parsed = safeJson(out);
    if (parsed == null) { // retry once on bad JSON
      const parts2 = parts.slice(0, -1).concat([{ text: prompt + '\n\nสำคัญ: ตอบกลับเป็น JSON ที่ถูกต้องเท่านั้น ห้ามมีข้อความอื่นหรือ markdown' }]);
      parsed = safeJson(extractText(await generate(MODEL_TEXT, parts2, cfg)));
    }
    return parsed;
  }

  // ---------- public: image generation (Nano Banana) ----------
  // inputImages optional: array of File or {data,mime} to edit/compose
  async function generateImage(prompt, inputImages = []) {
    const parts = [];
    for (const im of inputImages) {
      if (im instanceof File) parts.push({ inline_data: { mime_type: im.type, data: await fileToBase64(im) } });
      else parts.push({ inline_data: { mime_type: im.mime || 'image/jpeg', data: im.data } });
    }
    parts.push({ text: prompt });
    // try a few generationConfig variants for cross-version compatibility
    const variants = [
      { responseModalities: ['IMAGE'] },
      { responseModalities: ['TEXT', 'IMAGE'] },
      undefined
    ];
    let lastErr;
    for (const gc of variants) {
      try {
        const resp = await generate(MODEL_IMAGE, parts, gc ? { generationConfig: gc } : {});
        const dataUrl = extractImage(resp);
        if (dataUrl) return dataUrl;
        lastErr = new Error('AI ไม่ได้ส่งรูปกลับมา — ลองปรับคำสั่งหรือลองใหม่');
      } catch (e) {
        lastErr = e;
        // if it's clearly not a config problem (bad key/quota), stop retrying
        if (/API key|โควต้า|ปฏิเสธ/i.test(e.message)) break;
      }
    }
    throw lastErr || new Error('สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
  }

  // ---------- public: video understanding (File API) ----------
  // file: File object; onProgress(stage,text)
  async function video(prompt, file, onProgress = () => {}) {
    // โหมดเว็บจริง (proxy): ส่งไฟล์เป็น inline base64 ผ่าน /api/generate ตรงๆ
    // (ไม่ใช้ File API เพราะ upload session ที่สร้างฝั่ง server ไม่เปิด CORS ให้เบราว์เซอร์อัปไฟล์)
    // จำกัด ~3MB เพราะ serverless รับ body ได้ ~4.5MB (base64 พองขึ้น ~33%)
    if (PROXY) {
      if (file.size > 3 * 1024 * 1024) {
        throw new Error('ไฟล์ใหญ่เกินไปสำหรับเว็บนี้ (รองรับราว 3MB) — ลองใช้คลิป/ไฟล์เสียงที่สั้นลง');
      }
      onProgress('upload', 'กำลังส่งไฟล์...');
      const b64 = await fileToBase64(file);
      onProgress('analyze', 'AI กำลังวิเคราะห์เนื้อหา...');
      const resp = await generate(MODEL_TEXT, [
        { inline_data: { mime_type: file.type || 'application/octet-stream', data: b64 } },
        { text: prompt }
      ]);
      return extractText(resp);
    }
    let key = '';
    if (!PROXY) { if (!hasKey()) await requireKey(); key = encodeURIComponent(getKey()); }
    onProgress('upload', 'กำลังอัปโหลดไฟล์...');
    // 1) start resumable (proxy หรือ direct) — ได้ upload URL ที่อัปได้โดยไม่ต้องใช้ key
    let uploadUrl;
    if (PROXY) {
      const sr = await fetch(PROXY + '/file-start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: file.name || 'clip', mimeType: file.type, size: file.size })
      });
      if (!sr.ok) throw apiError(sr.status, await sr.text());
      uploadUrl = (await sr.json()).uploadUrl;
    } else {
      const startRes = await fetch(`${EP}/upload/v1beta/files?key=${key}`, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(file.size),
          'X-Goog-Upload-Header-Content-Type': file.type,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file: { display_name: file.name || 'clip' } })
      });
      if (!startRes.ok) throw apiError(startRes.status, await startRes.text());
      uploadUrl = startRes.headers.get('X-Goog-Upload-URL') || startRes.headers.get('x-goog-upload-url');
    }
    if (!uploadUrl) throw new Error('อัปโหลดไม่สำเร็จ (ไม่ได้ upload URL)');
    // 2) upload bytes + finalize
    // ส่งเป็น ArrayBuffer (ไม่มี Content-Type) เลี่ยง CORS preflight ของ content-type
    // ที่ติดเมื่อ upload session ถูกสร้างฝั่ง server (โหมด proxy)
    const fileBytes = await file.arrayBuffer();
    const upRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
      body: fileBytes
    });
    if (!upRes.ok) throw apiError(upRes.status, await upRes.text());
    let fileInfo = (await upRes.json()).file;
    // 3) poll until ACTIVE
    onProgress('process', 'AI กำลังประมวลผลคลิป (อาจใช้เวลาสักครู่)...');
    let tries = 0;
    while (fileInfo.state !== 'ACTIVE') {
      if (fileInfo.state === 'FAILED') throw new Error('ประมวลผลคลิปไม่สำเร็จ ลองคลิปสั้นลง/ไฟล์เล็กลง');
      if (tries++ > 120) throw new Error('ประมวลผลนานเกินไป ลองคลิปสั้นลง');
      await new Promise(r => setTimeout(r, 2500));
      const chk = PROXY
        ? await fetch(PROXY + '/file-get?name=' + encodeURIComponent(fileInfo.name))
        : await fetch(`${EP}/v1beta/${fileInfo.name}?key=${key}`);
      fileInfo = await chk.json();
    }
    // 4) generateContent with file_data
    onProgress('analyze', 'AI กำลังวิเคราะห์เนื้อหา...');
    const resp = await generate(MODEL_TEXT, [
      { file_data: { mime_type: fileInfo.mimeType || file.type, file_uri: fileInfo.uri } },
      { text: prompt }
    ]);
    return extractText(resp);
  }

  function safeJson(s) {
    if (!s) return null;
    s = String(s).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try { return JSON.parse(s); } catch (e) {}
    const m = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }

  // ---------- robust copy (clipboard + execCommand fallback) ----------
  function copy(textVal) {
    return new Promise(function (resolve) {
      function fallback() {
        try {
          var ta = document.createElement('textarea');
          ta.value = textVal; ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.focus(); ta.select();
          var ok = document.execCommand('copy'); ta.remove();
          if (ok) { toast('คัดลอกแล้ว ✅'); resolve(true); }
          else { toast('คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ข้อความเพื่อคัดลอกเอง'); resolve(false); }
        } catch (e) { toast('คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ข้อความเพื่อคัดลอกเอง'); resolve(false); }
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textVal).then(function () { toast('คัดลอกแล้ว ✅'); resolve(true); }, fallback);
        } else fallback();
      } catch (e) { fallback(); }
    });
  }

  // ---------- download helper ----------
  function download(filename, content, mime) {
    try {
      var blob = new Blob(['﻿' + content], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
      toast('ดาวน์โหลดแล้ว ✅');
    } catch (e) { toast('ดาวน์โหลดไม่สำเร็จ'); }
  }

  // ---------- global safety net: never let a clipboard rejection crash a copy button ----------
  if (typeof window !== 'undefined' && !window.__gkClipNet) {
    window.__gkClipNet = true;
    window.addEventListener('unhandledrejection', function (e) {
      try {
        var r = e && e.reason;
        var msg = (r && (r.message || r.name || '')) + '';
        if ((r && r.name === 'NotAllowedError') || /clipboard|writeText|not allowed|secure context|document is not focused|permission/i.test(msg)) {
          e.preventDefault();
          toast('คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ข้อความเพื่อคัดลอกเอง');
        }
      } catch (_) {}
    });
  }

  window.GeminiKit = {
    getKey, setKey, clearKey, hasKey, requireKey, showKeyModal, mountGear, toast,
    fileToBase64, text, vision, generateImage, video, media: video,
    copy, download,
    MODEL_TEXT, MODEL_IMAGE
  };
})();


/* ===== แบรนด์ เด็กประกอบการ (The Business Boy) — โลโก้ + ลิขสิทธิ์ + วิธีใช้ : auto-inject ทุกหน้า ===== */
(function () {
  var LOGO = 'data:image/jpeg;base64,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';
  var BRAND_CSS = ".gk-howto{background:rgba(255,255,255,.97);border-radius:16px;padding:14px 16px;margin:0 0 16px;box-shadow:0 8px 24px rgba(0,0,0,.15);font-family:'Prompt',system-ui,sans-serif;color:#1f2937}\n.gk-howto-h{font-size:14px;font-weight:700;cursor:pointer;display:flex;justify-content:space-between;align-items:center;color:#4f46e5;gap:8px}\n.gk-howto-h .gk-tog{font-size:11px;font-weight:500;color:#9ca3af;white-space:nowrap}\n.gk-howto-b{margin:10px 0 2px;padding-left:20px;font-size:13px;line-height:1.85;color:#374151}\n.gk-howto-b li{margin-bottom:3px}.gk-howto-b b{color:#1f2937}.gk-howto-b u{text-decoration-color:#7c3aed}\n.gk-howto.collapsed .gk-howto-b{display:none}\n.gk-footer{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.97);border-radius:16px;padding:12px 14px;margin-top:22px;box-shadow:0 8px 24px rgba(0,0,0,.15);font-family:'Prompt',system-ui,sans-serif}\n.gk-logo{width:46px;height:46px;border-radius:10px;flex-shrink:0;object-fit:cover;box-shadow:0 2px 6px rgba(0,0,0,.2)}\n.gk-cr{display:flex;flex-direction:column;line-height:1.45}.gk-cr b{font-size:13px;color:#1f2937}.gk-cr span{font-size:10.5px;color:#6b7280}";
  function inject() {
    if (document.getElementById('gk-brand-css')) return;
    var st = document.createElement('style'); st.id = 'gk-brand-css'; st.textContent = BRAND_CSS; document.head.appendChild(st);
    var wrap = document.querySelector('.wrap') || document.body;
    var header = wrap.querySelector('header');
    var fi = document.querySelector('input[type=file]');
    var step2 = '<b>กรอกข้อมูลในช่องด้านล่าง</b>';
    if (fi) {
      var a = fi.getAttribute('accept') || '';
      var what = a.indexOf('video') >= 0 ? 'อัปโหลดคลิปวิดีโอ' : a.indexOf('audio') >= 0 ? 'อัปโหลดไฟล์เสียง/คลิป' : a.indexOf('image') >= 0 ? 'อัปโหลดรูปภาพ' : 'อัปโหลดไฟล์';
      step2 = '<b>' + what + '</b> (กรอกช่องอื่นถ้ามี)';
    }
    var collapsed = localStorage.getItem('gk_howto_collapsed') === '1';
    var howto = document.createElement('div');
    howto.className = 'gk-howto' + (collapsed ? ' collapsed' : ''); howto.id = 'gk-howto';
    howto.innerHTML =
      '<div class="gk-howto-h" id="gk-howto-h">📖 วิธีใช้งานง่ายๆ <span class="gk-tog">' + (collapsed ? '▸ แตะดู' : '▾ ย่อ') + '</span></div>' +
      '<ol class="gk-howto-b">' +
      (PROXY
        ? '<li><b>พร้อมใช้ได้ทันที</b> — ไม่ต้องสมัครหรือใส่ key อะไรเลย</li>'
        : '<li><b>ใส่ Gemini API key</b> — กดปุ่มเฟือง ⚙️ มุมขวาบน วาง key (ขอ<u>ฟรี</u>ที่ Google AI Studio) ใส่ครั้งเดียวพอ</li>') +
      '<li>' + step2 + '</li>' +
      '<li>กด<b>ปุ่มหลัก</b> แล้วรอ AI ทำงานสักครู่ ⏳</li>' +
      '<li><b>คัดลอก/ดาวน์โหลด</b> ผลลัพธ์ไปใช้ได้เลย ✅</li>' +
      '</ol>';
    if (header && header.parentNode) header.parentNode.insertBefore(howto, header.nextSibling);
    else wrap.insertBefore(howto, wrap.firstChild);
    var h = document.getElementById('gk-howto-h');
    h.onclick = function () {
      var c = howto.classList.toggle('collapsed');
      localStorage.setItem('gk_howto_collapsed', c ? '1' : '0');
      howto.querySelector('.gk-tog').textContent = c ? '▸ แตะดู' : '▾ ย่อ';
    };
    var f = document.createElement('div'); f.className = 'gk-footer';
    f.innerHTML = '<img class="gk-logo" src="' + LOGO + '" alt="เด็กประกอบการ"><div class="gk-cr"><b>เด็กประกอบการ · The Business Boy</b><span>© สงวนลิขสิทธิ์ — โปรแกรมนี้เป็นลิขสิทธิ์ของ เด็กประกอบการ ห้ามทำซ้ำ ดัดแปลง หรือจำหน่ายต่อ</span></div>';
    wrap.appendChild(f);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject); else inject();
})();
