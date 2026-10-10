import { h } from '../ui.js';
import { api } from '../api.js';
import { app, mount } from '../main.js';
import { toast, timeAgo, modal } from '../ui.js';
import { navigate } from '../router.js';

const EXAMPLES = ['Full Stack Developer at a climate tech startup', 'UI/UX Designer for fintech apps', 'Data Analyst at a healthcare company', 'Machine Learning Engineer at a robotics startup'];

export async function dashboardView() {
  const list = h('div', { class: 'cards', 'aria-live': 'polite' }, h('p', { class: 'muted' }, 'Loading your routes…'));
  mount(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, `Hello, ${app.user.name.split(' ')[0]}`), h('p', { class: 'sub' }, 'Pick up a route or plot a new one.')),
      h('a', { class: 'btn primary', href: '/new', 'data-link': true }, 'Plot a new route')),
    list));
  try {
    const { roadmaps } = await api.list();
    list.replaceChildren();
    if (!roadmaps.length) {
      list.append(h('section', { class: 'empty' },
        h('h2', {}, 'No routes yet'),
        h('p', {}, 'Describe a specific job and Summit will map the way there. Try one of these:'),
        h('div', { class: 'chips' }, EXAMPLES.map((g) => h('a', { class: 'chip', href: `/new?goal=${encodeURIComponent(g)}`, 'data-link': true }, g)))));
      return;
    }
    for (const r of roadmaps) list.append(card(r, list));
  } catch (err) { list.replaceChildren(h('p', { class: 'form-error' }, err.message)); }
}

function card(r, list) {
  const pct = Math.round((r.doneCount / r.nodeCount) * 100);
  const el = h('article', { class: 'rcard' },
    h('a', { class: 'rcard-link', href: `/r/${r.id}`, 'data-link': true, 'aria-label': `Open route: ${r.title}` },
      h('h2', {}, r.title),
      h('p', { class: 'goal' }, r.goal),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Progress' }, h('span', { style: { width: `${pct}%` } })),
      h('div', { class: 'rmeta' }, h('span', {}, `${r.doneCount} of ${r.nodeCount} steps`), h('span', {}, `${r.constraints.hoursPerWeek} h/week · ${r.constraints.months} months`)),
      h('div', { class: 'rmeta faint' }, h('span', {}, `Updated ${timeAgo(r.updatedAt)}`), r.shared && h('span', {}, 'Shared'), r.mock && h('span', {}, 'Mock data'))),
    h('button', { class: 'icon-btn', 'aria-label': `Delete route: ${r.title}`, title: 'Delete', onclick: () => confirmDelete(r, el, list) }, trash()));
  return el;
}

function trash() {
  const w = document.createElement('span');
  w.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
  return w.firstChild;
}

function confirmDelete(r, el, list) {
  const m = modal(h('div', {},
    h('h2', {}, 'Delete this route?'),
    h('p', {}, `"${r.title}" and its progress will be removed. This cannot be undone.`),
    h('div', { class: 'row gap end' },
      h('button', { class: 'btn ghost', onclick: () => m.close(), autofocus: true }, 'Keep route'),
      h('button', { class: 'btn danger', onclick: async (e) => {
        e.target.disabled = true;
        try { await api.remove(r.id); el.remove(); m.close(); toast('Route deleted'); if (!list.children.length) navigate('/app', { replace: true }); }
        catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
      } }, 'Delete route'))), { label: 'Delete route' });
}
