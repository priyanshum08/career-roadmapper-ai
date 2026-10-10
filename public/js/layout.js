// Layered layout: columns follow the dependency depth, grouped into phase "camps".
import { topoOrder } from './model.js';

export const NODE_W = 232;
export const NODE_H = 96;
const GAP_X = 96;
const GAP_Y = 26;
export const BAND_TOP = 96;     // room for the camp title above the nodes
const BAND_PAD = 34;

export function layout(data) {
  const { nodes, phases } = data;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const topo = topoOrder(nodes);
  const phaseIndex = Object.fromEntries(phases.map((p, i) => [p.id, i]));

  // layer = longest path, but never earlier than the start of the node's phase
  const layer = {};
  const phaseStart = {};
  let nextStart = 0;
  for (const p of phases) {
    phaseStart[p.id] = nextStart;
    let maxLayer = nextStart - 1;
    const members = topo.filter((id) => byId[id].phase === p.id);
    for (const id of members) {
      layer[id] = Math.max(nextStart, ...byId[id].prerequisites.map((q) => layer[q] + 1 || 0));
      maxLayer = Math.max(maxLayer, layer[id]);
    }
    nextStart = maxLayer + 1;
  }
  const layerCount = nextStart;
  const columns = Array.from({ length: layerCount }, () => []);
  for (const id of topo) columns[layer[id]].push(id);

  // reduce crossings: a few barycenter sweeps
  const y = {};
  const place = (col) => col.forEach((id, i) => { y[id] = i; });
  columns.forEach(place);
  const children = Object.fromEntries(nodes.map((n) => [n.id, []]));
  nodes.forEach((n) => n.prerequisites.forEach((p) => children[p].push(n.id)));
  const bary = (ids, fallback) => (ids.length ? ids.reduce((a, q) => a + y[q], 0) / ids.length : fallback);
  for (let sweep = 0; sweep < 4; sweep++) {
    for (let c = 1; c < layerCount; c++) { columns[c].sort((a, b) => bary(byId[a].prerequisites, y[a]) - bary(byId[b].prerequisites, y[b])); place(columns[c]); }
    for (let c = layerCount - 2; c >= 0; c--) { columns[c].sort((a, b) => bary(children[a], y[a]) - bary(children[b], y[b])); place(columns[c]); }
  }

  // coordinates: each column centred on y = 0, then nudged toward the average of its neighbours
  const pos = {};
  const colX = (c) => c * (NODE_W + GAP_X) + 40;
  const maxRows = Math.max(...columns.map((c) => c.length));
  const height = maxRows * (NODE_H + GAP_Y) - GAP_Y;
  columns.forEach((col, c) => {
    const h = col.length * (NODE_H + GAP_Y) - GAP_Y;
    col.forEach((id, i) => { pos[id] = { x: colX(c), y: BAND_TOP + (height - h) / 2 + i * (NODE_H + GAP_Y) }; });
  });

  // phase bands
  const bands = phases.map((p) => {
    const cols = [...new Set(nodes.filter((n) => n.phase === p.id).map((n) => layer[n.id]))];
    const from = Math.min(...cols), to = Math.max(...cols);
    return { ...p, index: phaseIndex[p.id], x: colX(from) - BAND_PAD, w: colX(to) + NODE_W + BAND_PAD - (colX(from) - BAND_PAD), y: 0, h: BAND_TOP + height + BAND_PAD };
  });
  return { pos, bands, width: colX(layerCount - 1) + NODE_W + 40, height: BAND_TOP + height + BAND_PAD };
}

export function edgePath(from, to) {
  const x1 = from.x + NODE_W, y1 = from.y + NODE_H / 2;
  const x2 = to.x, y2 = to.y + NODE_H / 2;
  const dx = Math.max(40, (x2 - x1) * 0.5);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}
