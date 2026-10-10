// Tiny DOM helpers. No framework, no build step.
const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && !(el instanceof SVGElement) && k !== 'list' && k !== 'form') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
}
function append(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
export function h(tag, props, ...kids) { const el = document.createElement(tag); apply(el, props); append(el, kids); return el; }
export function s(tag, props, ...kids) { const el = document.createElementNS(SVG_NS, tag); apply(el, props); append(el, kids); return el; }

export function toast(message, kind = 'info', ms = 4200) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast ${kind}` }, message);
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export function timeAgo(ms) {
  const d = Math.max(0, Date.now() - ms) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return `${Math.floor(d / 86400)} d ago`;
}

export function fmtWeeks(w) {
  if (w < 1) return 'under a week';
  if (w < 9) return `${Math.round(w)} week${Math.round(w) === 1 ? '' : 's'}`;
  const m = w / 4.345;
  return `${m < 10 ? m.toFixed(1).replace('.0', '') : Math.round(m)} months`;
}

/** Trap focus + close on Escape for dialogs. */
export function modal(content, { label, onClose } = {}) {
  const prev = document.activeElement;
  const overlay = h('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, content));
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); onClose?.(); }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...overlay.querySelectorAll('button,a[href],input,textarea,select,[tabindex="0"]')].filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  (overlay.querySelector('[autofocus]') || overlay.querySelector('button,input'))?.focus();
  return { close, overlay };
}

// Small celebratory burst on a canvas; respects reduced motion.
export function confetti(big = false) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
  c.width = innerWidth; c.height = innerHeight;
  document.body.append(c);
  const ctx = c.getContext('2d');
  const colors = ['#F0A202', '#0E7C86', '#2E8B57', '#3558D6', '#C2255C', '#12303A'];
  const n = big ? 220 : 90;
  const ps = Array.from({ length: n }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * (big ? 16 : 11), vy: -Math.random() * (big ? 17 : 12) - 3,
    r: 3 + Math.random() * 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, color: colors[(Math.random() * colors.length) | 0],
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of ps) {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.a += p.va; p.vx *= 0.99;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
    }
    if (++frames < 130) requestAnimationFrame(tick); else c.remove();
  })();
}
