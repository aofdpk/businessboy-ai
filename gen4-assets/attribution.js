(() => {
  'use strict';
  const source = new URL(location.href);
  const labels = new URLSearchParams();
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = source.searchParams.get(key);
    if (value && /^[a-z][a-z0-9_-]{0,79}$/i.test(value)) labels.set(key, value);
  }
  if (!labels.size) return;
  document.querySelectorAll('a[data-register]').forEach(link => {
    const target = new URL(link.href, location.href);
    if (target.origin !== 'https://kvid.klangtech.com' || target.pathname !== '/dpkgen4/register') return;
    for (const [key, value] of labels) target.searchParams.set(key, value);
    link.href = target.href;
  });
})();
