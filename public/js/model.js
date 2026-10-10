// Pure roadmap logic: statuses, re-routing, scheduling, comparison. No DOM.

export const TYPE_LABEL = { skill: 'Skill', role: 'Role', cert: 'Certification', project: 'Project', goal: 'Dream job' };

/**
 * Work out the state of every node from the user's progress.
 *  done / known : the user has it
 *  bypassed     : not needed any more, because everything it unlocks is already covered (the re-route)
 *  available    : every prerequisite is resolved, so it can be started now
 *  locked       : still waiting on prerequisites
 */
export function computeState(data, progress, hoursPerWeek) {
  const nodes = data.nodes;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const children = Object.fromEntries(nodes.map((n) => [n.id, []]));
  for (const n of nodes) for (const p of n.prerequisites) children[p]?.push(n.id);

  const topo = topoOrder(nodes);
  const status = {};
  for (const n of nodes) if (progress[n.id]) status[n.id] = progress[n.id];

  // bypass: walk from the goal backwards. A pending node whose every child is resolved is no longer needed.
  for (const id of [...topo].reverse()) {
    if (status[id]) continue;
    const kids = children[id];
    if (kids.length && kids.every((k) => status[k] === 'done' || status[k] === 'known' || status[k] === 'bypassed')) status[id] = 'bypassed';
  }
  const resolved = (id) => ['done', 'known', 'bypassed'].includes(status[id]);
  for (const id of topo) {
    if (status[id]) continue;
    status[id] = byId[id].prerequisites.every(resolved) ? 'available' : 'locked';
  }

  // single-learner schedule: remaining nodes in dependency order, hours spread over hoursPerWeek
  const layer = {};
  for (const id of topo) layer[id] = Math.max(-1, ...byId[id].prerequisites.map((p) => layer[p])) + 1;
  const pending = topo.filter((id) => status[id] === 'available' || status[id] === 'locked')
    .sort((a, b) => layer[a] - layer[b]);
  const week = {};
  let cum = 0;
  for (const id of pending) {
    const start = cum / hoursPerWeek;
    cum += byId[id].hours;
    week[id] = { start, end: cum / hoursPerWeek };
  }
  const totalHours = nodes.reduce((a, n) => a + n.hours, 0);
  const counted = nodes.filter((n) => status[n.id] === 'done' || status[n.id] === 'known');
  const doneHours = counted.reduce((a, n) => a + n.hours, 0);

  // phase completion
  const phaseDone = {};
  for (const p of data.phases) {
    const inPhase = nodes.filter((n) => n.phase === p.id);
    phaseDone[p.id] = inPhase.length > 0 && inPhase.every((n) => ['done', 'known', 'bypassed'].includes(status[n.id]));
  }
  const goal = nodes.find((n) => n.type === 'goal');
  return {
    status, week, phaseDone,
    remainingHours: cum, remainingWeeks: cum / hoursPerWeek,
    totalHours, doneHours,
    percent: totalHours ? Math.round((doneHours / totalHours) * 100) : 0,
    completeCount: counted.length,
    bypassedCount: nodes.filter((n) => status[n.id] === 'bypassed').length,
    reachedGoal: goal ? (status[goal.id] === 'done' || status[goal.id] === 'known') : false,
  };
}

export function topoOrder(nodes) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const out = []; const seen = new Set();
  const visit = (id) => {
    if (seen.has(id)) return; seen.add(id);
    for (const p of byId[id].prerequisites) if (byId[p]) visit(p);
    out.push(id);
  };
  nodes.forEach((n) => visit(n.id));
  return out;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9+#.\s]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'a', 'an', 'to', 'of', 'in', 'on', 'basics', 'intro', 'introduction', 'build', 'learn', 'master']);
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)));

/** Which nodes of A and B cover the same ground (shared skill tag, or very similar title). */
export function compareRoadmaps(a, b) {
  const sharedA = new Map(); const sharedB = new Map();
  for (const na of a.nodes) {
    if (na.type === 'goal') continue;
    for (const nb of b.nodes) {
      if (nb.type === 'goal') continue;
      const tagsA = new Set(na.skills.map(norm)); const tagsB = nb.skills.map(norm);
      const tagHit = tagsB.find((t) => t && tagsA.has(t));
      const ta = tokens(na.title), tb = tokens(nb.title);
      const inter = [...ta].filter((w) => tb.has(w)).length;
      const jac = inter / (new Set([...ta, ...tb]).size || 1);
      if (tagHit || jac >= 0.5) {
        if (!sharedA.has(na.id)) sharedA.set(na.id, { with: nb.id, via: tagHit || `${na.title} ~ ${nb.title}` });
        if (!sharedB.has(nb.id)) sharedB.set(nb.id, { with: na.id, via: tagHit || `${na.title} ~ ${nb.title}` });
      }
    }
  }
  const hours = (data, set) => data.nodes.filter((n) => set.has(n.id)).reduce((x, n) => x + n.hours, 0);
  const total = (data) => data.nodes.filter((n) => n.type !== 'goal').reduce((x, n) => x + n.hours, 0);
  return {
    sharedA, sharedB,
    hoursSharedA: hours(a, sharedA), hoursSharedB: hours(b, sharedB),
    totalA: total(a), totalB: total(b),
  };
}
