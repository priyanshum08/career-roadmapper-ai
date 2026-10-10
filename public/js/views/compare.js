import { h } from '../ui.js';
import { api } from '../api.js';
import { mount } from '../main.js';
import { createGraph } from '../graph.js';
import { computeState, compareRoadmaps } from '../model.js';

export async function compareView() {
  mount(h('div', { class: 'page' }, h('p', { class: 'muted' }, 'Loading your routes…')), { wide: true });
  let list;
  try { list = (await api.list()).roadmaps; } catch (e) { mount(h('div', { class: 'page' }, h('p', { class: 'form-error' }, e.message))); return; }
  if (list.length < 2) {
    mount(h('div', { class: 'page narrow' }, h('h1', {}, 'Compare two dream jobs'),
      h('section', { class: 'empty' }, h('h2', {}, 'You need two routes to compare'), h('p', {}, 'Plot at least two routes, then see where their paths overlap and how much work you can reuse.'),
        h('a', { class: 'btn primary', href: '/new', 'data-link': true }, 'Plot a route'))), { wide: false });
    return;
  }
  const qs = new URLSearchParams(location.search);
  const sel = (id, def) => h('select', { id, class: 'input' }, list.map((r) => h('option', { value: r.id, selected: r.id === def }, r.title)));
  const a = sel('cmp-a', qs.get('a') || list[0].id); const b = sel('cmp-b', qs.get('b') || list[1].id);
  const out = h('div', { class: 'cmp-out', 'aria-live': 'polite' });
  let graphs = [];
  const run = async () => {
    graphs.forEach((g) => g.destroy()); graphs = [];
    if (a.value === b.value) { out.replaceChildren(h('p', { class: 'callout' }, 'Pick two different routes.')); return; }
    out.replaceChildren(h('p', { class: 'muted' }, 'Comparing…'));
    try {
      const [ra, rb] = (await Promise.all([api.get(a.value), api.get(b.value)])).map((x) => x.roadmap);
      const c = compareRoadmaps(ra.data, rb.data);
      const pct = (x, t) => (t ? Math.round((x / t) * 100) : 0);
      const sharedTags = [...new Set([...c.sharedA.values()].map((v) => v.via).filter((v) => !v.includes(' ~ ')))].slice(0, 12);
      const panel = (r, shared, title) => {
        const box = h('div', { class: 'canvas small' });
        const wrap = h('section', { class: 'cmp-panel' }, h('h3', {}, title), box);
        queueMicrotask(() => {
          const g = createGraph(box, { data: r.data, readOnly: true, label: r.data.title, minimap: false, onSelect: () => {} });
          g.update(computeState(r.data, {}, r.constraints.hoursPerWeek), { highlight: new Set(shared.keys()) });
          graphs.push(g);
        });
        return wrap;
      };
      out.replaceChildren(
        h('div', { class: 'cmp-summary' },
          h('div', { class: 'stat' }, h('span', { class: 'stat-num' }, `${pct(c.hoursSharedA, c.totalA)}%`), h('span', { class: 'stat-label' }, `of "${ra.data.targetRole}" prep also counts toward "${rb.data.targetRole}"`)),
          h('div', { class: 'stat' }, h('span', { class: 'stat-num' }, `${pct(c.hoursSharedB, c.totalB)}%`), h('span', { class: 'stat-label' }, `of "${rb.data.targetRole}" prep also counts toward "${ra.data.targetRole}"`)),
          h('div', { class: 'stat' }, h('span', { class: 'stat-num' }, `${c.sharedA.size} + ${c.sharedB.size}`), h('span', { class: 'stat-label' }, 'overlapping steps (A + B)'))),
        sharedTags.length ? h('p', { class: 'chips-row' }, h('strong', {}, 'Shared skills: '), sharedTags.map((t) => h('span', { class: 'pill' }, t))) : h('p', { class: 'muted' }, 'These routes share very little. They are genuinely different paths.'),
        h('p', { class: 'small muted' }, 'Highlighted steps in the maps below are the ones the two routes have in common (matched by skill tags and step names).'),
        h('div', { class: 'cmp-grid' }, panel(ra, c.sharedA, ra.data.targetRole), panel(rb, c.sharedB, rb.data.targetRole)));
    } catch (e) { out.replaceChildren(h('p', { class: 'form-error' }, e.message)); }
  };
  a.addEventListener('change', run); b.addEventListener('change', run);
  mount(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Compare two dream jobs'), h('p', { class: 'sub' }, 'See where the paths overlap, so you can prepare once for both.'))),
    h('div', { class: 'grid2 picker' }, h('div', { class: 'field' }, h('label', { for: 'cmp-a' }, 'First route'), a), h('div', { class: 'field' }, h('label', { for: 'cmp-b' }, 'Second route'), b)), out), { wide: true });
  run();
  return { cleanup: () => graphs.forEach((g) => g.destroy()) };
}
