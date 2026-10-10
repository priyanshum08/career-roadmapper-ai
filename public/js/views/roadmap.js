import { h, clear, toast, confetti, modal, fmtWeeks } from '../ui.js';
import { api } from '../api.js';
import { mount } from '../main.js';
import { navigate } from '../router.js';
import { createGraph } from '../graph.js';
import { computeState, TYPE_LABEL } from '../model.js';

export async function roadmapView(id) {
  mount(h('div', { class: 'page' }, h('p', { class: 'muted' }, 'Loading route…')), { wide: true });
  try {
    const { roadmap } = await api.get(id);
    return roadmapScreen({ roadmap, readOnly: false });
  } catch (err) {
    mount(h('div', { class: 'page narrow' }, h('h1', {}, err.status === 404 ? 'Route not found' : 'Could not load this route'), h('p', {}, err.message), h('a', { class: 'btn primary', href: '/app', 'data-link': true }, 'Back to my routes')));
  }
}

const icon = (path) => { const w = document.createElement('span'); w.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`; return w.firstChild; };
const ICON = {
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  share: '<path d="M4 12v7h16v-7M12 3v12M8 7l4-4 4 4"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.1.7 3.5 2.4 3.5 5.2"/>',
  replan: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
};

export function roadmapScreen({ roadmap, readOnly }) {
  const { data, constraints } = roadmap;
  const hpw = constraints.hoursPerWeek;
  let progress = { ...roadmap.progress };
  let state = computeState(data, progress, hpw);
  let selected = null;
  let saveTimer = null;
  const nodeById = Object.fromEntries(data.nodes.map((n) => [n.id, n]));

  // ---------- header + stats
  const statProgress = h('div', { class: 'stat' }); const statLeft = h('div', { class: 'stat' });
  const statEta = h('div', { class: 'stat' }); const statFit = h('div', { class: 'stat' });
  const stats = h('div', { class: 'stats', 'aria-live': 'polite' }, statProgress, statLeft, statEta, statFit);

  const actions = readOnly
    ? [h('a', { class: 'btn primary', href: '/register', 'data-link': true }, 'Make my own route')]
    : [
      btn(ICON.people, 'People who took this path', () => showPaths()),
      btn(ICON.replan, 'Re-plan', () => showReplan()),
      btn(ICON.share, 'Share', () => showShare()),
      btn(ICON.image, 'Download image', exportImage),
    ];
  if (readOnly) actions.unshift(btn(ICON.image, 'Download image', exportImage), btn(ICON.people, 'Example paths', () => showPaths()));

  const head = h('div', { class: 'rm-head' },
    h('div', { class: 'rm-title' },
      !readOnly && h('a', { class: 'crumb', href: '/app', 'data-link': true }, '← My routes'),
      h('h1', {}, data.title),
      h('p', { class: 'chips-row' },
        data.companyType && h('span', { class: 'pill' }, data.companyType),
        h('span', { class: 'pill' }, `${hpw} h/week`), h('span', { class: 'pill' }, `${constraints.months} months`),
        data.mock && h('span', { class: 'pill warn' }, 'Mock data'),
        h('span', { class: 'pill faint', title: 'The model that drew this map' }, data.model ? `Made by AI: ${data.model}` : 'Made by AI'))),
    h('div', { class: 'rm-actions' }, ...actions));

  const summary = (data.summary || data.realityCheck) && h('details', { class: 'summary' },
    h('summary', {}, data.realityCheck ? h('span', {}, h('strong', {}, 'Reality check: '), data.realityCheck) : h('strong', {}, 'About this route')),
    data.summary && h('p', {}, data.summary));

  // ---------- stage
  const canvas = h('div', { class: 'canvas' });
  const drawer = h('aside', { class: 'drawer', 'aria-label': 'Step details', hidden: true });
  const graph = createGraph(canvas, {
    data, label: data.title, readOnly,
    onSelect: (id) => (id ? openNode(id) : closeNode()),
  });
  const toolbar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Map controls' },
    iconBtn(ICON.plus, 'Zoom in', () => graph.zoomIn()), iconBtn(ICON.minus, 'Zoom out', () => graph.zoomOut()), iconBtn(ICON.fit, 'Fit whole map', () => graph.fit()));
  const legend = h('details', { class: 'legend' }, h('summary', {}, 'Legend'),
    h('ul', {},
      legendItem('l-ready', 'Ready to start'), legendItem('l-done', 'Done'), legendItem('l-known', 'Already known'),
      legendItem('l-skip', 'Skippable: everything it leads to is covered'), legendItem('l-lock', 'Locked until its prerequisites are resolved')),
    h('p', { class: 'small muted' }, 'Drag to pan, scroll or pinch to zoom, click a step to open it.'));
  const stage = h('div', { class: 'stage' }, canvas, toolbar, legend, drawer);

  mount(h('div', { class: 'rm' }, head, summary, stats, stage), { wide: true, chrome: !readOnly });
  if (readOnly) document.getElementById('app').prepend(h('div', { class: 'public-banner' }, 'Shared route', h('a', { href: '/', 'data-link': true }, 'Summit')));
  refresh();

  // ---------- state
  function refresh() {
    graph.update(state);
    const budgetWeeks = constraints.months * 4.345;
    const diff = budgetWeeks - state.remainingWeeks;
    clear(statProgress).append(h('span', { class: 'stat-num' }, `${state.percent}%`), h('span', { class: 'stat-label' }, `${state.completeCount} of ${data.nodes.length} steps covered`),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': state.percent, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Progress' }, h('span', { style: { width: `${state.percent}%` } })));
    clear(statLeft).append(h('span', { class: 'stat-num' }, `${Math.round(state.remainingHours)} h`), h('span', { class: 'stat-label' }, state.bypassedCount ? `left, after skipping ${state.bypassedCount} step${state.bypassedCount === 1 ? '' : 's'}` : 'of work left'));
    clear(statEta).append(h('span', { class: 'stat-num' }, state.reachedGoal ? 'Summit!' : fmtWeeks(state.remainingWeeks)), h('span', { class: 'stat-label' }, state.reachedGoal ? 'You reached the dream job' : `to the summit at ${hpw} h/week`));
    statFit.className = `stat ${diff >= 0 ? 'ok' : 'over'}`;
    clear(statFit).append(h('span', { class: 'stat-num' }, diff >= 0 ? 'On track' : 'Over budget'), h('span', { class: 'stat-label' }, diff >= 0 ? `${fmtWeeks(diff)} to spare in your ${constraints.months}-month plan` : `${fmtWeeks(-diff)} past your ${constraints.months}-month plan`));
    if (selected) renderDrawerHeader();
  }

  function setStatus(id, status) {
    const prev = state;
    if (status) progress[id] = status; else delete progress[id];
    state = computeState(data, progress, hpw);
    refresh();
    // feedback: reroutes, unlocks, camps cleared
    const newly = (from, to) => data.nodes.filter((n) => prev.status[n.id] !== from && state.status[n.id] === to && !progress[n.id]);
    const skipped = data.nodes.filter((n) => prev.status[n.id] !== 'bypassed' && state.status[n.id] === 'bypassed');
    const unlocked = data.nodes.filter((n) => prev.status[n.id] === 'locked' && state.status[n.id] === 'available');
    const cleared = data.phases.filter((p) => !prev.phaseDone[p.id] && state.phaseDone[p.id]);
    if (state.reachedGoal && !prev.reachedGoal) { confetti(true); toast('You reached the summit. Time to apply.', 'success', 6000); }
    else if (cleared.length) { confetti(); toast(`Camp cleared: ${cleared[0].name}`, 'success'); }
    else if (skipped.length) toast(`Rerouted: ${skipped.length === 1 ? `"${skipped[0].title}" is` : `${skipped.length} steps are`} now skippable. ${Math.round(prev.remainingHours - state.remainingHours)} h saved.`, 'info', 5200);
    else if (unlocked.length) toast(`Unlocked: ${unlocked.slice(0, 2).map((n) => n.title).join(', ')}${unlocked.length > 2 ? ` and ${unlocked.length - 2} more` : ''}`, 'success');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => { try { await api.saveProgress(roadmap.id, progress); } catch (e) { toast(`Progress not saved: ${e.message}`, 'error'); } }, 400);
  }

  // ---------- drawer
  const drawerHead = h('div', { class: 'drawer-head' });
  const drawerBody = h('div', { class: 'drawer-body' });
  let lastFocus = null;
  drawer.append(drawerHead, drawerBody);

  function openNode(id) {
    selected = id; graph.select(id);
    lastFocus = document.activeElement;
    drawer.hidden = false; drawer.classList.add('open');
    renderDrawerHeader(); renderDrawerBody(id);
    const narrow = matchMedia('(max-width: 820px)').matches;
    graph.focus(id, narrow ? { padBottom: canvas.clientHeight * 0.55 } : { padRight: 430 });
  }
  function closeNode() {
    selected = null; graph.select(null); drawer.classList.remove('open'); drawer.hidden = true;
    try { lastFocus?.focus?.(); } catch {}
  }

  function renderDrawerHeader() {
    const n = nodeById[selected]; const st = state.status[n.id]; const wk = state.week[n.id];
    clear(drawerHead).append(
      h('div', { class: 'drawer-top' },
        h('span', { class: `type-chip t-${n.type}` }, TYPE_LABEL[n.type]),
        h('button', { class: 'icon-btn', 'aria-label': 'Close details', onclick: closeNode }, icon(ICON.close))),
      h('h2', { id: 'drawer-title', tabindex: '-1' }, n.title),
      h('p', { class: 'dmeta' },
        h('span', {}, `${n.hours} h`),
        wk && h('span', {}, `Week ${Math.floor(wk.start) + 1} to ${Math.max(Math.floor(wk.start) + 1, Math.ceil(wk.end))}`),
        h('span', { class: `status s-${st}` }, { done: 'Done', known: 'Already known', bypassed: 'Skippable', locked: 'Locked', available: 'Ready to start' }[st])),
      n.skills.length ? h('p', { class: 'chips-row' }, n.skills.map((s) => h('span', { class: 'pill faint' }, s))) : null);
  }

  function renderDrawerBody(id) {
    const n = nodeById[id];
    clear(drawerBody);
    const st = state.status[id];
    drawerBody.append(h('p', { class: 'dsummary' }, n.summary));
    if (!readOnly) {
      const known = progress[id] === 'known', done = progress[id] === 'done';
      drawerBody.append(h('div', { class: 'status-actions' },
        h('button', { class: `btn ${done ? 'success' : 'primary'}`, 'aria-pressed': String(done), onclick: () => { setStatus(id, done ? null : 'done'); renderDrawerBody(id); } }, done ? 'Done. Undo' : 'Mark as done'),
        n.type !== 'goal' && h('button', { class: `btn ${known ? 'blue' : 'ghost'}`, 'aria-pressed': String(known), onclick: () => { setStatus(id, known ? null : 'known'); renderDrawerBody(id); } }, known ? 'Marked as known. Undo' : 'I already know this')));
      if (st === 'bypassed') drawerBody.append(h('p', { class: 'callout' }, 'Skippable: everything this step leads to is already covered, so Summit routed around it.'));
      if (st === 'locked') drawerBody.append(h('p', { class: 'callout' }, `Waiting on: ${n.prerequisites.filter((p) => !['done', 'known', 'bypassed'].includes(state.status[p])).map((p) => nodeById[p].title).join(', ')}.`));
      const adviceBox = h('div', { class: 'advice' });
      drawerBody.append(adviceBox);
      loadAdvice(id, adviceBox, false);
    } else {
      drawerBody.append(h('p', { class: 'callout' }, 'Log in to get a tailored weekend project, a repo to study and interview questions for each step.'));
    }
    drawer.scrollTop = 0; drawerBody.scrollTop = 0;
  }

  async function loadAdvice(id, box, refresh) {
    clear(box).append(h('div', { class: 'skeleton-block', role: 'status', 'aria-label': 'Generating advice' }, h('p', { class: 'muted' }, 'Writing advice for this exact step…'), h('div', { class: 'sk' }), h('div', { class: 'sk short' }), h('div', { class: 'sk' })));
    try {
      const { advice } = await api.advice(roadmap.id, id, refresh);
      if (selected !== id) return;
      renderAdvice(box, advice, id);
    } catch (err) {
      if (selected !== id) return;
      clear(box).append(h('div', { class: 'form-error' }, err.message), h('button', { class: 'btn ghost sm', onclick: () => loadAdvice(id, box, refresh) }, 'Try again'));
    }
  }

  function renderAdvice(box, a, id) {
    const g = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    const wp = a.weekendProject;
    const repo = a.repoToStudy;
    const repoHref = repo && /^[\w.-]+\/[\w.-]+$/.test(repo.name) ? `https://github.com/${repo.name}` : repo ? g(`${repo.name} github`) : null;
    const panels = {
      project: h('div', {},
        h('h3', {}, wp.title), h('p', {}, wp.pitch),
        wp.steps.length ? h('ol', { class: 'steps' }, wp.steps.map((x) => h('li', {}, x))) : null,
        wp.deliverable && h('p', {}, h('strong', {}, 'Show it as: '), wp.deliverable),
        wp.stretchGoal && h('p', { class: 'muted' }, h('strong', {}, 'Stretch: '), wp.stretchGoal)),
      repo: h('div', {},
        repo ? [h('h3', {}, h('a', { href: repoHref, target: '_blank', rel: 'noopener noreferrer' }, repo.name)), h('p', {}, repo.why), repo.howToUse && h('p', {}, h('strong', {}, 'How to use it: '), repo.howToUse), h('p', { class: 'small muted' }, 'Check that the repository exists and is maintained before you rely on it.')]
          : h('p', { class: 'muted' }, 'No single well-known repository fits this step. Try these searches instead.'),
        a.searchQueries.length ? [h('h4', {}, 'Search for'), h('ul', { class: 'links' }, a.searchQueries.map((q) => h('li', {}, h('a', { href: g(q), target: '_blank', rel: 'noopener noreferrer' }, q))))] : null),
      interview: h('div', {}, h('ol', { class: 'qs' }, a.interviewQuestions.map((q) => h('li', {}, h('p', { class: 'q' }, q.question), q.lookFor && h('p', { class: 'look' }, h('strong', {}, 'A strong answer: '), q.lookFor))))),
      done: h('div', {},
        h('h4', {}, 'You are done when'), h('ul', { class: 'checks' }, a.doneWhen.map((x) => h('li', {}, x))),
        a.pitfalls.length ? [h('h4', {}, 'Common pitfalls'), h('ul', {}, a.pitfalls.map((x) => h('li', {}, x)))] : null),
    };
    const tabs = [['project', 'Project'], ['repo', 'Repo'], ['interview', 'Interview'], ['done', 'Done when']];
    const tabList = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Advice' });
    const panelBox = h('div', { class: 'tabpanel', role: 'tabpanel', tabindex: '0' });
    const show = (key) => {
      tabList.querySelectorAll('button').forEach((b) => { const on = b.dataset.key === key; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      clear(panelBox).append(panels[key]);
    };
    tabs.forEach(([key, label]) => tabList.append(h('button', { role: 'tab', 'data-key': key, onclick: () => show(key) }, label)));
    tabList.addEventListener('keydown', (e) => {
      const btns = [...tabList.children]; const i = btns.indexOf(document.activeElement);
      if (i < 0 || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      const nb = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length]; nb.focus(); nb.click();
    });
    clear(box).append(
      h('div', { class: 'advice-head' }, h('h3', {}, 'Tailored for this step'), h('button', { class: 'btn ghost sm', onclick: () => loadAdvice(id, box, true) }, 'Regenerate')),
      a.whyItMatters && h('p', { class: 'why' }, a.whyItMatters),
      tabList, panelBox, h('p', { class: 'small muted' }, 'Written by AI for this step. Verify details before you rely on them.'));
    show('project');
  }

  // ---------- modals
  function showPaths() {
    const paths = data.paths || [];
    const m = modal(h('div', { class: 'paths' },
      h('div', { class: 'modal-head' }, h('h2', {}, 'People who took this path'), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => m.close() }, icon(ICON.close))),
      h('p', { class: 'muted' }, 'Composite example journeys written by AI to show the intermediate roles and side projects behind the steps. They are archetypes, not real individuals.'),
      paths.length ? paths.map((p) => h('section', { class: 'journey' },
        h('h3', {}, p.label), h('p', { class: 'muted' }, p.who),
        h('ol', { class: 'timeline' }, p.steps.map((st) => h('li', { class: `k-${st.kind}` }, h('span', { class: 'k' }, { role: 'Role', project: 'Project', cert: 'Certification', course: 'Course' }[st.kind]), h('strong', {}, st.title), st.duration && h('span', { class: 'dur' }, st.duration)))),
        p.lesson && h('p', { class: 'lesson' }, h('strong', {}, 'Takeaway: '), p.lesson))) : h('p', {}, 'No example paths were generated for this route.')), { label: 'People who took this path' });
  }

  function showReplan() {
    const hrs = h('input', { type: 'range', min: 1, max: 40, value: hpw, id: 'rp-h', class: 'slider' });
    const mo = h('input', { type: 'range', min: 1, max: 24, value: constraints.months, id: 'rp-m', class: 'slider' });
    const hv = h('output', {}, String(hpw)), mv = h('output', {}, String(constraints.months));
    hrs.oninput = () => { hv.textContent = hrs.value; }; mo.oninput = () => { mv.textContent = mo.value; };
    const err = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const go = h('button', { class: 'btn primary', onclick: async () => {
      go.disabled = true; go.textContent = 'Re-planning… this takes up to a minute';
      try {
        const { roadmap: nr } = await api.replan(roadmap.id, { hoursPerWeek: hrs.value, months: mo.value });
        m.close(); toast('New route created. Your old one is still in My routes.', 'success'); navigate(`/r/${nr.id}`);
      } catch (e) { err.textContent = e.message; err.hidden = false; go.disabled = false; go.textContent = 'Re-plan route'; }
    } }, 'Re-plan route');
    const m = modal(h('div', {},
      h('div', { class: 'modal-head' }, h('h2', {}, 'Re-plan to fit your time'), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => m.close() }, icon(ICON.close))),
      h('p', { class: 'muted' }, 'The AI redraws the route for your new limits. Steps you marked as done or already known are left out. Your current route is kept.'),
      h('div', { class: 'field' }, h('label', { for: 'rp-h' }, 'Hours per week: ', hv), hrs),
      h('div', { class: 'field' }, h('label', { for: 'rp-m' }, 'Months available: ', mv), mo), err, go), { label: 'Re-plan' });
  }

  function showShare() {
    const box = h('div', {});
    const draw = (token) => {
      clear(box);
      if (!token) {
        box.append(h('p', {}, 'Anyone with the link can view this map. They cannot see your account, progress or the advice you generated.'),
          h('button', { class: 'btn primary', onclick: async (e) => { e.target.disabled = true; try { const r = await api.share(roadmap.id, true); roadmap.shareToken = r.shareToken; draw(r.shareToken); } catch (er) { toast(er.message, 'error'); e.target.disabled = false; } } }, 'Create public link'));
      } else {
        const url = `${location.origin}/s/${token}`;
        const input = h('input', { class: 'input', readOnly: true, value: url, 'aria-label': 'Public link', onfocus: (e) => e.target.select() });
        box.append(h('div', { class: 'copy-row' }, input, h('button', { class: 'btn primary', onclick: async () => { try { await navigator.clipboard.writeText(url); toast('Link copied', 'success'); } catch { input.select(); toast('Press Ctrl+C to copy', 'info'); } } }, 'Copy link')),
          h('p', { class: 'small muted' }, 'Read-only. Turn it off any time.'),
          h('button', { class: 'btn ghost', onclick: async () => { try { await api.share(roadmap.id, false); roadmap.shareToken = null; draw(null); toast('Link turned off'); } catch (er) { toast(er.message, 'error'); } } }, 'Turn off sharing'));
      }
    };
    draw(roadmap.shareToken);
    const m = modal(h('div', {}, h('div', { class: 'modal-head' }, h('h2', {}, 'Share this route'), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => m.close() }, icon(ICON.close))), box,
      h('div', { class: 'divider' }), h('p', { class: 'small muted' }, 'Prefer an image? Use "Download image" for a PNG of the whole map.')), { label: 'Share' });
  }

  async function exportImage() {
    try {
      const blob = await graph.toPng({ title: data.title, subtitle: `${constraints.hoursPerWeek} h/week for ${constraints.months} months · ${Math.round(state.totalHours)} h of steps · ${state.percent}% covered` });
      const a = h('a', { href: URL.createObjectURL(blob), download: `${data.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-roadmap.png` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Image downloaded', 'success');
    } catch { toast('Could not create the image in this browser.', 'error'); }
  }

  return { cleanup: () => { clearTimeout(saveTimer); graph.destroy(); document.querySelector('.public-banner')?.remove(); } };
}

function btn(path, label, onclick) { return h('button', { class: 'btn ghost', onclick }, icon(path), h('span', {}, label)); }
function iconBtn(path, label, onclick) { return h('button', { class: 'tool', 'aria-label': label, title: label, onclick }, icon(path)); }
function legendItem(cls, text) { return h('li', {}, h('i', { class: `dot ${cls}` }), text); }
