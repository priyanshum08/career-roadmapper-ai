// Validation + normalisation of AI output. The model is never trusted to return clean JSON.
const TYPES = ['skill', 'role', 'cert', 'project', 'goal'];

const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const slug = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };

export function normaliseRoadmap(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Model returned no object');
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  if (rawNodes.length < 6) throw new Error('Roadmap had too few nodes');

  // phases
  let phases = (Array.isArray(raw.phases) ? raw.phases : []).slice(0, 7).map((p, i) => ({
    id: slug(p?.id) || `phase-${i + 1}`,
    name: str(p?.name, 50) || `Phase ${i + 1}`,
    goal: str(p?.goal, 160),
  }));
  if (!phases.length) phases = [{ id: 'phase-1', name: 'Phase 1', goal: '' }];
  const phaseIds = new Set(phases.map((p) => p.id));

  // nodes
  const seen = new Set();
  let nodes = [];
  rawNodes.slice(0, 30).forEach((n, i) => {
    let id = slug(n?.id) || slug(n?.title) || `node-${i + 1}`;
    while (seen.has(id)) id += '-x';
    seen.add(id);
    let type = String(n?.type ?? 'skill').toLowerCase();
    if (!TYPES.includes(type)) type = 'skill';
    let phase = slug(n?.phase);
    if (!phaseIds.has(phase)) phase = phases[Math.min(phases.length - 1, Math.floor((i / rawNodes.length) * phases.length))].id;
    nodes.push({
      id, type, phase,
      title: str(n?.title, 70) || `Step ${i + 1}`,
      summary: str(n?.summary, 300),
      hours: num(n?.hours, 1, 400, 20),
      skills: (Array.isArray(n?.skills) ? n.skills : []).slice(0, 6).map((s) => str(s, 30)).filter(Boolean),
      prerequisites: (Array.isArray(n?.prerequisites) ? n.prerequisites : []).map(slug),
    });
  });

  // prerequisites: keep only existing ids, no self loops, then break cycles.
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) n.prerequisites = [...new Set(n.prerequisites.filter((p) => ids.has(p) && p !== n.id))];
  breakCycles(nodes);

  // exactly one goal node
  const goals = nodes.filter((n) => n.type === 'goal');
  let goal = goals[goals.length - 1];
  if (!goal) {
    const hasChild = new Set(nodes.flatMap((n) => n.prerequisites));
    const sinks = nodes.filter((n) => !hasChild.has(n.id));
    goal = sinks[sinks.length - 1] || nodes[nodes.length - 1];
    goal.type = 'goal';
  }
  for (const n of nodes) if (n !== goal && n.type === 'goal') n.type = 'role';
  // every other sink feeds the goal so the map converges on the summit
  const hasChild = new Set(nodes.flatMap((n) => n.prerequisites));
  for (const n of nodes) {
    if (n !== goal && !hasChild.has(n.id) && !reaches(nodes, goal.id, n.id)) goal.prerequisites.push(n.id);
  }
  breakCycles(nodes);

  // phases must be ordered by dependency: push a node's phase index >= its prerequisites' phase index
  const order = Object.fromEntries(phases.map((p, i) => [p.id, i]));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const n of nodes) for (const p of n.prerequisites) {
      if (order[byId[p].phase] > order[n.phase]) { n.phase = byId[p].phase; changed = true; }
    }
    if (!changed) break;
  }
  const used = new Set(nodes.map((n) => n.phase));
  phases = phases.filter((p) => used.has(p.id));

  const paths = (Array.isArray(raw.paths) ? raw.paths : []).slice(0, 4).map((p) => ({
    label: str(p?.label, 60),
    who: str(p?.who, 160),
    steps: (Array.isArray(p?.steps) ? p.steps : []).slice(0, 7).map((s) => ({
      title: str(s?.title, 80),
      kind: ['role', 'project', 'cert', 'course'].includes(s?.kind) ? s.kind : 'role',
      duration: str(s?.duration, 30),
    })).filter((s) => s.title),
    lesson: str(p?.lesson, 220),
  })).filter((p) => p.label && p.steps.length);

  return {
    title: str(raw.title, 90) || goal.title,
    targetRole: str(raw.targetRole, 90) || goal.title,
    companyType: str(raw.companyType, 90),
    summary: str(raw.summary, 400),
    realityCheck: str(raw.realityCheck, 400),
    assumed: (Array.isArray(raw.assumed) ? raw.assumed : []).slice(0, 8).map((s) => str(s, 60)).filter(Boolean),
    phases, nodes, paths,
  };
}

function reaches(nodes, fromId, targetId) {
  // does `fromId` (transitively) depend on `targetId`?
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const stack = [fromId]; const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === targetId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId[id]?.prerequisites || []));
  }
  return false;
}

function breakCycles(nodes) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const state = {};
  const visit = (id) => {
    state[id] = 1;
    for (const p of [...byId[id].prerequisites]) {
      if (state[p] === 1) byId[id].prerequisites = byId[id].prerequisites.filter((x) => x !== p);
      else if (!state[p]) visit(p);
    }
    state[id] = 2;
  };
  for (const n of nodes) if (!state[n.id]) visit(n.id);
}

export function normaliseAdvice(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Model returned no object');
  const wp = raw.weekendProject || {};
  const repo = raw.repoToStudy || null;
  return {
    whyItMatters: str(raw.whyItMatters, 400),
    weekendProject: {
      title: str(wp.title, 90),
      pitch: str(wp.pitch, 400),
      steps: (Array.isArray(wp.steps) ? wp.steps : []).slice(0, 6).map((s) => str(s, 200)).filter(Boolean),
      deliverable: str(wp.deliverable, 200),
      stretchGoal: str(wp.stretchGoal, 200),
    },
    repoToStudy: repo && repo.name ? {
      name: str(repo.name, 80), why: str(repo.why, 250), howToUse: str(repo.howToUse, 250),
    } : null,
    interviewQuestions: (Array.isArray(raw.interviewQuestions) ? raw.interviewQuestions : []).slice(0, 8).map((q) => ({
      question: str(q?.question, 250), lookFor: str(q?.lookFor, 250),
    })).filter((q) => q.question),
    searchQueries: (Array.isArray(raw.searchQueries) ? raw.searchQueries : []).slice(0, 5).map((s) => str(s, 90)).filter(Boolean),
    doneWhen: (Array.isArray(raw.doneWhen) ? raw.doneWhen : []).slice(0, 5).map((s) => str(s, 160)).filter(Boolean),
    pitfalls: (Array.isArray(raw.pitfalls) ? raw.pitfalls : []).slice(0, 4).map((s) => str(s, 200)).filter(Boolean),
  };
}
