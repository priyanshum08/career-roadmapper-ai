const routes = [];
let current = null;

export function addRoute(pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ re, keys, handler });
}

export function navigate(to, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', to); else history.pushState({}, '', to);
  render();
}

export async function render() {
  const path = location.pathname;
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    if (current?.cleanup) { try { current.cleanup(); } catch {} }
    const token = {};
    current = token;
    const result = await r.handler(params);
    if (current === token) current.cleanup = result?.cleanup;
    window.scrollTo(0, 0);
    return;
  }
  navigate('/', { replace: true });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  navigate(a.getAttribute('href'));
});
window.addEventListener('popstate', render);
