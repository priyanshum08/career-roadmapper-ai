import { h, clear } from './ui.js';
import { api } from './api.js';
import { addRoute, navigate, render } from './router.js';
import { authView } from './views/auth.js';
import { landingView } from './views/landing.js';
import { dashboardView } from './views/dashboard.js';
import { createView } from './views/create.js';
import { roadmapView } from './views/roadmap.js';
import { compareView } from './views/compare.js';
import { publicView } from './views/public.js';

export const app = { user: null, config: { aiConfigured: true } };
const root = document.getElementById('app');

export function logoMark(size = 28) {
  const w = document.createElement('span');
  w.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#12303A"/><path d="M10 48 26 22l8 12 6-9 14 23z" fill="#E9EEEC"/><path d="M26 22v-9l11 4-11 5z" fill="#F0A202"/></svg>`;
  return w.firstChild;
}

/** Mounts a page. Signed-in pages get the top bar. */
export function mount(content, { chrome = true, wide = false } = {}) {
  clear(root);
  if (chrome) {
    root.append(h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '/app', 'data-link': true }, logoMark(30), h('span', {}, 'Summit')),
      h('nav', { class: 'nav', 'aria-label': 'Main' },
        navLink('/app', 'My routes'), navLink('/new', 'Plot a route'), navLink('/compare', 'Compare')),
      h('div', { class: 'userbox' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, (app.user?.name || '?').slice(0, 1).toUpperCase()),
        h('span', { class: 'uname' }, app.user?.name),
        h('button', { class: 'btn ghost sm', onclick: logout }, 'Log out')),
    ));
  }
  root.append(h('main', { id: 'main', class: wide ? 'wide' : '', tabindex: '-1' }, content));
}

function navLink(href, label) {
  const active = location.pathname === href || (href === '/app' && location.pathname.startsWith('/r/'));
  return h('a', { href, 'data-link': true, class: active ? 'active' : '', 'aria-current': active ? 'page' : undefined }, label);
}

async function logout() {
  try { await api.logout(); } catch {}
  app.user = null; navigate('/');
}

export function requireAuth(fn) {
  return async (params) => {
    if (!app.user) { navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true }); return; }
    return fn(params);
  };
}
export function guestOnly(fn) {
  return async (params) => {
    if (app.user) { navigate('/app', { replace: true }); return; }
    return fn(params);
  };
}

addRoute('/', guestOnly(() => landingView()));
addRoute('/login', guestOnly(() => authView('login')));
addRoute('/register', guestOnly(() => authView('register')));
addRoute('/app', requireAuth(() => dashboardView()));
addRoute('/new', requireAuth(() => createView()));
addRoute('/r/:id', requireAuth((p) => roadmapView(p.id)));
addRoute('/compare', requireAuth(() => compareView()));
addRoute('/s/:token', (p) => publicView(p.token));

(async () => {
  try { app.config = await api.config(); } catch {}
  try { app.user = (await api.me()).user; } catch {}
  render();
})();
