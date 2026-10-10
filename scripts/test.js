// API + logic tests. Runs against an in-memory DB with the mock AI. No network needed.
// Usage: npm test
process.env.AI_PROVIDER = 'mock';
process.env.DB_FILE = ':memory:';
process.env.PORT = '0';
const { server } = await import('../server/index.js');
const { computeState } = await import('../public/js/model.js');
const { normaliseRoadmap, } = await import('../server/roadmap.js');
const { extractJson } = await import('../server/ai.js');
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
let cookie = '', pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };
const call = async (method, path, body, withCookie = true) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(withCookie && cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

// auth
ok('unauthenticated list is rejected', (await call('GET', '/api/roadmaps', null, false)).status === 401);
ok('short password rejected', (await call('POST', '/api/auth/register', { name: 'A B', email: 'a@b.co', password: 'short' })).status === 400);
ok('bad email rejected', (await call('POST', '/api/auth/register', { name: 'A B', email: 'nope', password: 'longenough1' })).status === 400);
const reg = await call('POST', '/api/auth/register', { name: 'Test User', email: 'Test@Example.com', password: 'longenough1' });
ok('register works and sets session', reg.status === 200 && !!cookie);
ok('duplicate email rejected', (await call('POST', '/api/auth/register', { name: 'X Y', email: 'test@example.com', password: 'longenough1' }, false)).status === 409);
ok('/api/me returns user', (await call('GET', '/api/me')).data.user?.email === 'test@example.com');
await call('POST', '/api/auth/logout', {});
ok('logout clears session', (await call('GET', '/api/me', null, false)).data.user === null);
ok('wrong password rejected', (await call('POST', '/api/auth/login', { email: 'test@example.com', password: 'wrongwrong' }, false)).status === 401);
ok('login works', (await call('POST', '/api/auth/login', { email: 'test@example.com', password: 'longenough1' }, false)).status === 200);

// roadmap
ok('too-short goal rejected', (await call('POST', '/api/roadmaps/generate', { goal: 'ab' })).status === 400);
const gen = await call('POST', '/api/roadmaps/generate', { goal: 'UI/UX Designer for fintech apps', hoursPerWeek: 8, months: 5 });
ok('generate returns roadmap', gen.status === 200 && gen.data.roadmap.data.nodes.length >= 6);
const rm = gen.data.roadmap;
ok('exactly one goal node', rm.data.nodes.filter((n) => n.type === 'goal').length === 1);
const adv = await call('POST', `/api/roadmaps/${rm.id}/nodes/${rm.data.nodes[0].id}/advice`, {});
ok('advice generated', adv.status === 200 && adv.data.advice.interviewQuestions.length > 0);
ok('advice cached on second call', (await call('POST', `/api/roadmaps/${rm.id}/nodes/${rm.data.nodes[0].id}/advice`, {})).data.cached === true);
const prog = await call('PUT', `/api/roadmaps/${rm.id}/progress`, { progress: { [rm.data.nodes[0].id]: 'known', bogus: 'done' } });
ok('progress saved, unknown ids dropped', Object.keys(prog.data.progress).length === 1);
const sh = await call('POST', `/api/roadmaps/${rm.id}/share`, { enabled: true });
const pub = await call('GET', `/api/public/${sh.data.shareToken}`, null, false);
ok('public link works without login and hides progress/email', pub.status === 200 && !JSON.stringify(pub.data).includes('example.com') && Object.keys(pub.data.roadmap.progress).length === 0);
await call('POST', `/api/roadmaps/${rm.id}/share`, { enabled: false });
ok('unshared link stops working', (await call('GET', `/api/public/${sh.data.shareToken}`, null, false)).status === 404);

// isolation
await call('POST', '/api/auth/logout', {});
await call('POST', '/api/auth/register', { name: 'Other Person', email: 'other@example.com', password: 'longenough1' });
ok("cannot read another user's roadmap", (await call('GET', `/api/roadmaps/${rm.id}`)).status === 404);

// model logic
const d = rm.data;
const base0 = computeState(d, {}, 10);
const goal = d.nodes.find((n) => n.type === 'goal');
ok('goal locked at the start', base0.status[goal.id] === 'locked');
const known = computeState(d, { [d.nodes[0].id]: 'known' }, 10);
ok('marking known cuts remaining hours', known.remainingHours < base0.remainingHours);
const allDone = Object.fromEntries(d.nodes.map((n) => [n.id, 'done']));
ok('everything done reaches the goal', computeState(d, allDone, 10).reachedGoal);

// validator hardening
const messy = normaliseRoadmap({ phases: [{ id: 'a', name: 'A' }], nodes: Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, title: `T${i}`, type: 'weird', hours: 9999, prerequisites: [`n${(i + 1) % 8}`, 'ghost', `n${i}`] })) });
const order = new Set();
ok('validator breaks cycles and clamps values', messy.nodes.every((n) => n.hours <= 400) && messy.nodes.filter((n) => n.type === 'goal').length === 1);
ok('extractJson copes with fences and trailing commas', extractJson('```json\n{"a":[1,2,],}\n```').a.length === 2);

console.log(`\n${pass} passed, ${fail} failed`);
server.close(); process.exit(fail ? 1 : 0);
