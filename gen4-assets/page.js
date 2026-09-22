(() => {
  'use strict';
  const videos = [...document.querySelectorAll('video')];
  videos.forEach(video => {
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'video-play';
    play.textContent = '▶ เล่นคลิป';
    play.setAttribute('aria-label', 'เล่น ' + video.getAttribute('aria-label'));
    video.parentElement.append(play);
    play.addEventListener('click', () => video.play().catch(() => {
      play.textContent = '▶ ลองเล่นอีกครั้ง';
    }));
    video.addEventListener('play', () => { play.hidden = true; });
    video.addEventListener('pause', () => { play.hidden = false; });
    video.addEventListener('ended', () => { play.hidden = false; });
  });
  videos.forEach(video => video.addEventListener('play', () => {
    videos.forEach(other => { if (other !== video) other.pause(); });
  }));
  const selected = document.getElementById('selected-plan');
  const line = document.getElementById('line-contact');
  const hint = document.getElementById('contact-hint');
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const lineMessage = message => 'https://line.me/R/oaMessage/%40034oysgq/?' + encodeURIComponent(message);
  if (mobile) line.href = lineMessage('สนใจสมัครคอร์สรุ่น 4 จากหน้าเว็บไซต์');
  document.querySelectorAll('[data-plan]').forEach(link => link.addEventListener('click', () => {
    const message = `สนใจสมัครคอร์สรุ่น 4 โปร ${link.dataset.plan} ราคา ${link.dataset.price} บาท จากหน้าเว็บไซต์`;
    selected.textContent = `คุณเลือกโปร ${link.dataset.plan} · ${link.dataset.planName} · ${link.dataset.price} บาท`;
    hint.textContent = `เข้า LINE แล้วแจ้ง “สมัครรุ่น 4 โปร ${link.dataset.plan}” กับแอดมิน`;
    line.href = mobile ? lineMessage(message) : 'https://lin.ee/sl6unNh';
    line.textContent = `เปิด LINE สมัครโปร ${link.dataset.plan} ↗`;
  }));
  const dialog = document.getElementById('image-dialog');
  const image = document.getElementById('dialog-image');
  const title = document.getElementById('image-title');
  let previousFocus;
  document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {
    previousFocus = button;
    image.src = button.dataset.image;
    image.alt = button.dataset.title;
    title.textContent = button.dataset.title;
    dialog.showModal();
    document.body.classList.add('dialog-open');
    document.getElementById('close-dialog').focus();
  }));
  document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    previousFocus?.focus({preventScroll:true});
  });
})();
