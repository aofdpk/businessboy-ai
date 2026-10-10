(() => {
  const form = document.getElementById('gen4-login');
  const password = document.getElementById('gen4-password');
  const feedback = document.getElementById('gen4-feedback');
  document.getElementById('gen4-show-password')?.addEventListener('click', function () {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    this.textContent = show ? 'ซ่อน' : 'แสดง';
    this.setAttribute('aria-pressed', String(show));
  });
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    button.textContent = 'กำลังตรวจรหัส…';
    feedback.textContent = '';
    try {
      const response = await fetch('/api/gen4?action=session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: password.value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
      password.value = '';
      location.replace(location.pathname.includes('toolkit-2') || new URLSearchParams(location.search).get('view') === 'toolkit2' ? '/gen4/toolkit-2' : location.pathname.includes('meta-ai-prompt') || new URLSearchParams(location.search).get('view') === 'prompt' ? '/gen4/meta-ai-prompt' : '/gen4');
    } catch (error) {
      feedback.textContent = error instanceof TypeError ? 'เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่' : error.message;
      button.disabled = false;
      button.textContent = 'เข้าใช้งานรุ่น 4 →';
      password.focus();
    }
  });
  document.getElementById('gen4-logout')?.addEventListener('click', async function () {
    this.disabled = true;
    try {
      const response = await fetch('/api/gen4?action=session', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      location.replace('/gen4');
    } catch { this.disabled = false; this.textContent = 'ลองออกจากระบบอีกครั้ง'; }
  });
  // Reload a restored private page so the server checks the cookie after logout.
  if (document.getElementById('gen4-logout')) window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
})();
