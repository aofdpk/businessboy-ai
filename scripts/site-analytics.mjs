import { inject, track } from '@vercel/analytics';

const hosts = new Set(['businessboy.ai', 'www.businessboy.ai']);
const sections = new Set(['top', 'instructor-results', 'learning', 'examples', 'reviews', 'results', 'schedule', 'costs', 'packages', 'faq', 'contact']);
const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

// Keep only campaign labels, never arbitrary query strings, fragments or form data.
export function sanitizeUrl(value) {
  const url = new URL(value);
  if (!hosts.has(url.hostname) || url.protocol !== 'https:' || url.username || url.password) return null;
  if (/\/admin(?:\/|$)|\/api(?:\/|$)/.test(url.pathname)) return null;
  const clean = new URL(url.origin + url.pathname);
  for (const key of campaignKeys) {
    const label = url.searchParams.get(key);
    if (label && /^[a-z][a-z0-9_-]{0,79}$/i.test(label)) clean.searchParams.set(key, label);
  }
  return clean.href;
}

export function startAnalytics() {
  if (!hosts.has(location.hostname) || location.protocol !== 'https:' || !sanitizeUrl(location.href)) return;
  const mode = new URL(location.href).searchParams.get('analytics');
  let excluded = mode === 'off';
  try {
    if (mode === 'off') localStorage.setItem('bb_analytics_excluded', '1');
    if (mode === 'on') localStorage.removeItem('bb_analytics_excluded');
    excluded ||= localStorage.getItem('bb_analytics_excluded') === '1';
  } catch { /* Storage restrictions must not break the page. */ }
  if (excluded || window.bbAnalyticsStarted) return;
  window.bbAnalyticsStarted = true;
  inject({ mode: 'production', beforeSend: event => {
    try { const url = sanitizeUrl(event.url); return url ? { ...event, url } : null; }
    catch { return null; }
  }});
  if (!/^\/ai-page-gen4(?:\.html)?\/?$/.test(location.pathname)) return;
  const send = (name, data) => { try { track(name, data); } catch { /* Never block enrollment. */ } };
  const packageName = () => ({ '1 เดือน': '1_month', '3 เดือน': '3_months', '1 ปี': '1_year', 'ตลอดชีพ': 'lifetime' }[document.querySelector('input[name="package"]:checked')?.dataset.duration] || 'unknown');
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[data-line], a[data-register]');
    if (!link) return;
    const section = link.closest('section[id]')?.id;
    const placement = sections.has(section) ? section : link.closest('header') ? 'header' : 'floating';
    send(link.hasAttribute('data-register') ? 'gen4_register_click' : 'gen4_line_click', { placement, package: ['selected-cta', 'register-cta'].includes(link.id) ? packageName() : link.hasAttribute('data-onsite') ? 'onsite' : 'general' });
  });
  document.querySelectorAll('input[name="package"]').forEach(input => input.addEventListener('change', () => send('gen4_package_selected', { package: packageName() })));
  document.querySelectorAll('#faq details').forEach((detail, index) => {
    let sent = false;
    detail.addEventListener('toggle', () => { if (detail.open && !sent) { sent = true; send('gen4_faq_opened', { question: index + 1 }); } });
  });
  document.querySelectorAll('[data-video]').forEach((button, index) => button.addEventListener('click', () => send('gen4_video_opened', { video: index + 1 })));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        send('gen4_section_viewed', { section: entry.target.id });
        observer.unobserve(entry.target);
      }
    }, { threshold: 0 });
    document.querySelectorAll('section[id]').forEach(section => { if (sections.has(section.id)) observer.observe(section); });
  }
}

if (typeof window !== 'undefined') startAnalytics();
