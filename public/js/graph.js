// Interactive trail-map renderer: pure SVG, with pan, zoom, pinch, keyboard and minimap.
import { s, h } from './ui.js';
import { layout, edgePath, NODE_W, NODE_H, BAND_TOP } from './layout.js';
import { TYPE_LABEL } from './model.js';

const PAPER = '#E9EEEC';
const FONT_UI = `'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif`;
const FONT_DISPLAY = `'Bricolage Grotesque', 'Instrument Sans', system-ui, sans-serif`;

// Literal colours on purpose: the same stylesheet is embedded in exported PNGs.
const SVG_CSS = `
.band .bg{fill:#DCE5E2;stroke:#C3D1CE;stroke-width:1.5}
.band:nth-of-type(even) .bg{fill:#E2EAE7}
.band .name{font:700 22px ${FONT_DISPLAY};fill:#12303A}
.band .sub{font:500 12.5px ${FONT_UI};fill:#4F6870}
.band .goal{font:400 12.5px ${FONT_UI};fill:#4F6870}
.band.cleared .bg{fill:#D3E8DC;stroke:#8DBFA2}
.edge{fill:none;stroke:#8CA0A5;stroke-width:2;stroke-linecap:round;opacity:.55}
.edge.lit{stroke:#12303A;opacity:1;stroke-width:2.6}
.edge.flow{stroke-dasharray:7 7;animation:flow 1s linear infinite}
.edge.dim{stroke-dasharray:2 7;opacity:.35}
.edge.focus{stroke:#F0A202;opacity:1;stroke-width:3.4;stroke-dasharray:none}
@keyframes flow{to{stroke-dashoffset:-14}}
.node{cursor:pointer;outline:none}
.node .card{fill:#F8FAF8;stroke:#B7C7C4;stroke-width:1.6;transition:fill .25s,stroke .25s,opacity .25s}
.node .shadow{fill:#12303A;opacity:.08}
.node .title{font:600 14.5px ${FONT_UI};fill:#12303A}
.node .meta{font:500 12px ${FONT_UI};fill:#5B7079}
.node .tag{font:600 11.5px ${FONT_UI}}
.node .glyph{fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.node .glyph.solid{fill:#fff;stroke:none}
.node:hover .card,.node:focus-visible .card{stroke:#12303A;stroke-width:2.4}
.node:focus-visible .ring{opacity:1}
.node .ring{fill:none;stroke:#3558D6;stroke-width:3;opacity:0}
.node.selected .card{stroke:#12303A;stroke-width:3}
.node.t-skill .badge{fill:#0E7C86}.node.t-role .badge{fill:#5F3DC4}.node.t-cert .badge{fill:#B7791F}
.node.t-project .badge{fill:#C2255C}.node.t-goal .badge{fill:#12303A}
.node.t-goal .card{fill:#FFF4D6;stroke:#F0A202;stroke-width:2.6}
.node.s-available .card{stroke:#12303A;stroke-width:2.2}
.node.s-available .pulse{display:block}
.node .pulse{display:none;fill:#F0A202;animation:pulse 1.8s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(1.5)}}
.node.s-locked{opacity:.62}
.node.s-bypassed{opacity:.5}
.node.s-bypassed .card{stroke-dasharray:6 5;fill:#EDF1EF}
.node.s-bypassed .title{text-decoration:line-through;text-decoration-thickness:1.4px}
.node.s-done .card{fill:#E3F2E9;stroke:#2E8B57}
.node.s-known .card{fill:#E4EAFB;stroke:#3558D6}
.node.s-done .tag{fill:#1F6B40}.node.s-known .tag{fill:#2646B0}.node.s-bypassed .tag{fill:#5B7079}.node.s-locked .tag{fill:#5B7079}.node.s-available .tag{fill:#8A5A00}
.node .check{display:none}
.node.s-done .check,.node.s-known .check{display:block}
.node.s-done .check circle{fill:#2E8B57}.node.s-known .check circle{fill:#3558D6}
.node.hl .card{stroke:#F0A202;stroke-width:4}
.node.dimmed{opacity:.28}
@media (prefers-reduced-motion:reduce){.edge.flow,.node .pulse{animation:none}}
`;

const GLYPHS = {
  skill: { d: 'M13 3 5 14h6l-1 7 8-11h-6z', solid: true },
  role: { d: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5z', solid: true },
  cert: { d: 'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z', solid: true },
  project: { d: 'M9 7l-5 5 5 5M15 7l5 5-5 5' },
  goal: { d: 'M6 3v18M6 4h12l-3 4 3 4H6' },
};

function wrap(text, maxChars, maxLines) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.{0,2}$/, '') + '…';
    return kept;
  }
  return lines;
}

export function createGraph(container, { data, onSelect, readOnly = false, label = 'Career roadmap', minimap = true }) {
  const L = layout(data);
  const nodeById = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
  const svg = s('svg', { class: 'graph-svg', role: 'group', 'aria-label': `${label}. Use arrow keys to pan, plus and minus to zoom, and Tab to move between steps.`, tabindex: '0', focusable: 'true' });
  svg.append(s('style', {}, SVG_CSS));
  const view = s('g', { class: 'viewport' });
  const bandLayer = s('g'); const edgeLayer = s('g'); const nodeLayer = s('g');
  view.append(bandLayer, edgeLayer, nodeLayer);
  svg.append(view);

  // ---- bands
  const bandEls = {};
  for (const b of L.bands) {
    const members = data.nodes.filter((n) => n.phase === b.id);
    const hours = members.reduce((a, n) => a + n.hours, 0);
    const g = s('g', { class: 'band' });
    g.append(s('rect', { class: 'bg', x: b.x, y: b.y + 8, width: b.w, height: b.h - 8, rx: 28 }));
    const name = s('text', { class: 'name', x: b.x + 26, y: 44 }, `Camp ${b.index + 1}: ${b.name}`);
    const sub = s('text', { class: 'sub', x: b.x + 26, y: 64 }, `${hours} h of work across ${members.length} step${members.length === 1 ? '' : 's'}`);
    g.append(name, sub);
    wrap(b.goal || '', Math.max(24, Math.floor((b.w - 52) / 6.6)), 1).forEach((ln, i) => g.append(s('text', { class: 'goal', x: b.x + 26, y: 82 + i * 16 }, ln)));
    bandLayer.append(g); bandEls[b.id] = { g, sub, hours, count: members.length };
  }

  // ---- edges
  const edgeEls = [];
  for (const n of data.nodes) for (const p of n.prerequisites) {
    const path = s('path', { class: 'edge', d: edgePath(L.pos[p], L.pos[n.id]) });
    edgeLayer.append(path); edgeEls.push({ from: p, to: n.id, path });
  }

  // ---- nodes
  const nodeEls = {};
  for (const n of data.nodes) {
    const { x, y } = L.pos[n.id];
    const big = n.type === 'goal';
    const g = s('g', { class: `node t-${n.type} s-locked`, transform: `translate(${x},${y})`, tabindex: '0', role: 'button', 'data-id': n.id });
    const tip = s('title', {}, `${n.title}: ${n.summary}`);
    const lines = wrap(n.title, big ? 27 : 22, 2);
    const ty = lines.length === 1 ? 42 : 34;
    const glyph = GLYPHS[n.type];
    const gl = s('path', { class: `glyph${glyph.solid ? ' solid' : ''}`, d: glyph.d, transform: 'translate(18,30) scale(1.0)' });
    const tag = s('text', { class: 'tag', x: NODE_W - 16, y: NODE_H - 15, 'text-anchor': 'end' }, '');
    const meta = s('text', { class: 'meta', x: 58, y: NODE_H - 15 }, '');
    g.append(
      tip,
      s('rect', { class: 'shadow', x: 0, y: 4, width: NODE_W, height: NODE_H, rx: 18 }),
      s('rect', { class: 'card', width: NODE_W, height: NODE_H, rx: 18 }),
      s('rect', { class: 'ring', x: -5, y: -5, width: NODE_W + 10, height: NODE_H + 10, rx: 22 }),
      s('circle', { class: 'badge', cx: 30, cy: 42, r: 19 }), gl,
      ...lines.map((ln, i) => s('text', { class: 'title', x: 58, y: ty + i * 18 }, ln)),
      meta, tag,
      s('circle', { class: 'pulse', cx: NODE_W - 14, cy: 14, r: 4.5 }),
      s('g', { class: 'check', transform: `translate(${NODE_W - 4},4)` }, s('circle', { r: 11 }), s('path', { d: 'M-5 0.5l3.5 3.5L5 -3.5', fill: 'none', stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })),
    );
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); selectNode(n.id, true); } });
    nodeLayer.append(g);
    nodeEls[n.id] = { g, tag, meta };
  }

  // ---- viewport maths
  let tx = 0, ty = 0, k = 1;
  let selected = null;
  const MIN_K = 0.18, MAX_K = 2.6;
  const apply = () => { view.setAttribute('transform', `translate(${tx},${ty}) scale(${k})`); drawMini(); };
  const size = () => { const r = container.getBoundingClientRect(); return { w: r.width || 800, h: r.height || 500 }; };

  let anim = null;
  function animateTo(ntx, nty, nk, ms = 450) {
    cancelAnimationFrame(anim);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { tx = ntx; ty = nty; k = nk; apply(); return; }
    const a = { tx, ty, k }; const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - p, 3);
      tx = a.tx + (ntx - a.tx) * e; ty = a.ty + (nty - a.ty) * e; k = a.k + (nk - a.k) * e; apply();
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function fit(animate = true) {
    const { w, h: hh } = size(); const pad = 24;
    const nk = Math.min(1.1, Math.max(MIN_K, Math.min((w - pad * 2) / L.width, (hh - pad * 2) / L.height)));
    const ntx = (w - L.width * nk) / 2; const nty = (hh - L.height * nk) / 2;
    if (animate) animateTo(ntx, nty, nk); else { tx = ntx; ty = nty; k = nk; apply(); }
  }

  function zoomAt(factor, cx, cy, animate = false) {
    const nk = Math.min(MAX_K, Math.max(MIN_K, k * factor));
    const f = nk / k;
    const ntx = cx - (cx - tx) * f, nty = cy - (cy - ty) * f;
    if (animate) animateTo(ntx, nty, nk, 220); else { tx = ntx; ty = nty; k = nk; apply(); }
  }
  const zoomCenter = (f) => { const { w, h: hh } = size(); zoomAt(f, w / 2, hh / 2, true); };

  function focus(id, { padRight = 0, padBottom = 0 } = {}) {
    const p = L.pos[id]; if (!p) return;
    const { w, h: hh } = size();
    const nk = Math.min(MAX_K, Math.max(k, 0.95));
    const cx = (w - padRight) / 2, cy = (hh - padBottom) / 2;
    animateTo(cx - (p.x + NODE_W / 2) * nk, cy - (p.y + NODE_H / 2) * nk, nk, 500);
  }

  // ---- input: pointer pan + pinch, wheel zoom, keyboard
  const pointers = new Map();
  let dragMoved = false, startPt = null, pinchDist = 0;
  svg.addEventListener('pointerdown', (e) => {
    cancelAnimationFrame(anim);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startPt = { x: e.clientX, y: e.clientY, tx, ty }; dragMoved = false;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = svg.getBoundingClientRect();
      if (pinchDist) zoomAt(d / pinchDist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinchDist = d; dragMoved = true; return;
    }
    const dx = e.clientX - startPt.x, dy = e.clientY - startPt.y;
    if (!dragMoved && Math.hypot(dx, dy) > 5) { dragMoved = true; svg.setPointerCapture(e.pointerId); svg.classList.add('panning'); }
    if (dragMoved) { tx = startPt.tx + dx; ty = startPt.ty + dy; apply(); }
  });
  const endPointer = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId); pinchDist = 0; svg.classList.remove('panning');
    if (pointers.size === 1) { const [p] = [...pointers.values()]; startPt = { x: p.x, y: p.y, tx, ty }; }
    if (e.type === 'pointerup' && !dragMoved && pointers.size === 0) {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.node');
      if (el && svg.contains(el)) selectNode(el.getAttribute('data-id'), true); else if (!readOnly) selectNode(null, true);
    }
  };
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    if (e.shiftKey) { tx -= e.deltaY || e.deltaX; apply(); }
    else zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  svg.addEventListener('keydown', (e) => {
    const step = 60;
    if (e.target !== svg) return;
    if (e.key === 'ArrowLeft') tx += step; else if (e.key === 'ArrowRight') tx -= step;
    else if (e.key === 'ArrowUp') ty += step; else if (e.key === 'ArrowDown') ty -= step;
    else if (e.key === '+' || e.key === '=') return zoomCenter(1.25);
    else if (e.key === '-' || e.key === '_') return zoomCenter(0.8);
    else if (e.key === '0') return fit();
    else return;
    e.preventDefault(); apply();
  });

  // ---- selection
  function selectNode(id, notify) {
    selected = id;
    for (const [nid, el] of Object.entries(nodeEls)) el.g.classList.toggle('selected', nid === id);
    for (const e of edgeEls) e.path.classList.toggle('focus', !!id && (e.from === id || e.to === id));
    if (notify) onSelect?.(id);
  }

  // ---- state
  function update(state, { highlight } = {}) {
    for (const n of data.nodes) {
      const el = nodeEls[n.id]; const st = state.status[n.id];
      el.g.setAttribute('class', `node t-${n.type} s-${st}${el.g.classList.contains('selected') ? ' selected' : ''}${highlight ? (highlight.has(n.id) ? ' hl' : ' dimmed') : ''}`);
      const wk = state.week[n.id];
      el.meta.textContent = `${n.hours} h${wk ? ` · wk ${Math.floor(wk.start) + 1}-${Math.max(Math.floor(wk.start) + 1, Math.ceil(wk.end))}` : ''}`;
      el.tag.textContent = { done: 'Done', known: 'Already known', bypassed: 'Skippable', locked: 'Locked', available: 'Ready' }[st];
      el.g.setAttribute('aria-label', `${n.title}, ${TYPE_LABEL[n.type]}, ${n.hours} hours, ${el.tag.textContent}`);
    }
    for (const e of edgeEls) {
      const a = state.status[e.from], b = state.status[e.to];
      const got = (x) => x === 'done' || x === 'known';
      let cls = 'edge';
      if (a === 'bypassed' || b === 'bypassed') cls += ' dim';
      else if (got(a) && (b === 'available' || got(b))) cls += ` lit${b === 'available' ? ' flow' : ''}`;
      if (selected && (e.from === selected || e.to === selected)) cls += ' focus';
      e.path.setAttribute('class', cls);
    }
    for (const b of L.bands) {
      const be = bandEls[b.id]; const cleared = state.phaseDone[b.id];
      be.g.setAttribute('class', `band${cleared ? ' cleared' : ''}`);
      be.sub.textContent = cleared ? 'Camp cleared' : `${be.hours} h of work across ${be.count} step${be.count === 1 ? '' : 's'}`;
    }
    mini.state = state; drawMini();
  }

  // ---- minimap
  const mini = { svg: null, state: null };
  const MW = 168, MH = 84;
  const miniSvg = s('svg', { class: 'minimap', viewBox: `0 0 ${MW} ${MH}`, 'aria-hidden': 'true' });
  const miniScale = Math.min((MW - 8) / L.width, (MH - 8) / L.height);
  const mox = (MW - L.width * miniScale) / 2, moy = (MH - L.height * miniScale) / 2;
  const miniNodes = s('g'); const miniRect = s('rect', { class: 'mini-view', rx: 2 });
  for (const n of data.nodes) { const p = L.pos[n.id]; miniNodes.append(s('rect', { 'data-id': n.id, x: mox + p.x * miniScale, y: moy + p.y * miniScale, width: NODE_W * miniScale, height: NODE_H * miniScale, rx: 1.5, fill: '#8CA0A5' })); }
  miniSvg.append(miniNodes, miniRect);
  function drawMini() {
    const { w, h: hh } = size();
    miniRect.setAttribute('x', mox + (-tx / k) * miniScale); miniRect.setAttribute('y', moy + (-ty / k) * miniScale);
    miniRect.setAttribute('width', (w / k) * miniScale); miniRect.setAttribute('height', (hh / k) * miniScale);
    if (mini.state) for (const r of miniNodes.children) {
      const st = mini.state.status[r.getAttribute('data-id')];
      r.setAttribute('fill', { done: '#2E8B57', known: '#3558D6', available: '#F0A202', bypassed: '#C3CFCC', locked: '#8CA0A5' }[st]);
    }
  }
  const jump = (e) => {
    const r = miniSvg.getBoundingClientRect(); const { w, h: hh } = size();
    const wx = ((e.clientX - r.left) / r.width * MW - mox) / miniScale, wy = ((e.clientY - r.top) / r.height * MH - moy) / miniScale;
    tx = w / 2 - wx * k; ty = hh / 2 - wy * k; apply();
  };
  let miniDrag = false;
  miniSvg.addEventListener('pointerdown', (e) => { miniDrag = true; miniSvg.setPointerCapture(e.pointerId); jump(e); e.stopPropagation(); });
  miniSvg.addEventListener('pointermove', (e) => { if (miniDrag) jump(e); });
  miniSvg.addEventListener('pointerup', () => { miniDrag = false; });

  container.append(svg);
  if (minimap) container.append(h('div', { class: 'minimap-wrap' }, miniSvg));
  const ro = new ResizeObserver(() => { if (!touched) fit(false); else drawMini(); });
  let touched = false;
  svg.addEventListener('pointerdown', () => { touched = true; }, { once: true });
  svg.addEventListener('wheel', () => { touched = true; }, { once: true });
  ro.observe(container);
  requestAnimationFrame(() => fit(false));

  // ---- PNG export (self-contained SVG, rendered via canvas)
  async function toPng({ title = '', subtitle = '', scale = 2 } = {}) {
    const head = title ? 110 : 0;
    const W = L.width, H = L.height + head;
    const clone = svg.cloneNode(true);
    clone.removeAttribute('tabindex');
    const vp = clone.querySelector('.viewport');
    vp.setAttribute('transform', `translate(0,${head})`);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', W * scale); clone.setAttribute('height', H * scale);
    clone.setAttribute('viewBox', `0 0 ${W} ${H}`);
    clone.querySelectorAll('.selected').forEach((e) => e.classList.remove('selected'));
    clone.insertBefore(s('rect', { width: W, height: H, fill: PAPER }), clone.querySelector('.viewport'));
    if (title) {
      clone.append(
        s('text', { x: 40, y: 56, style: `font:800 38px ${FONT_DISPLAY};fill:#12303A` }, title),
        s('text', { x: 40, y: 88, style: `font:500 16px ${FONT_UI};fill:#4F6870` }, subtitle),
      );
    }
    clone.append(s('text', { x: W - 40, y: H - 14, 'text-anchor': 'end', style: `font:600 13px ${FONT_UI};fill:#4F6870` }, 'Made with Summit'));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const canvas = document.createElement('canvas'); canvas.width = W * scale; canvas.height = H * scale;
      canvas.getContext('2d').drawImage(img, 0, 0);
      return await new Promise((res) => canvas.toBlob(res, 'image/png'));
    } finally { URL.revokeObjectURL(url); }
  }

  return {
    update, select: (id) => selectNode(id, false), fit: () => fit(true), zoomIn: () => zoomCenter(1.3), zoomOut: () => zoomCenter(0.77),
    focus, toPng, getZoom: () => k, destroy: () => { ro.disconnect(); cancelAnimationFrame(anim); svg.remove(); },
  };
}
