import './env.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import {
  hashPassword, verifyPassword, validateSignup, createSession, destroySession,
  getSessionToken, userFromRequest, sessionCookie, rateLimit,
} from './auth.js';
import { generateRoadmap, generateAdvice, providerConfig, AIError } from './ai.js';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }

function send(res, status, body, headers = {}) {
  const isJson = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, { ...SECURITY_HEADERS, ...(isJson ? { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } : {}), ...headers });
  res.end(isJson ? JSON.stringify(body) : body);
}

async function readJson(req) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'Send JSON.');
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 100_000) throw new HttpError(413, 'Request too large.'); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
const cleanText = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

function rowToRoadmap(r, { includeOwner = true } = {}) {
  const out = {
    id: r.id, goal: r.goal, constraints: JSON.parse(r.constraints), data: JSON.parse(r.data),
    progress: JSON.parse(r.progress), createdAt: r.created_at, updatedAt: r.updated_at,
  };
  if (includeOwner) out.shareToken = r.share_token;
  return out;
}

function requireUser(req) {
  const u = userFromRequest(req);
  if (!u) throw new HttpError(401, 'Please log in to continue.');
  return u;
}
function ownRoadmap(user, id) {
  const r = db.prepare('SELECT * FROM roadmaps WHERE id=? AND user_id=?').get(id, user.id);
  if (!r) throw new HttpError(404, 'Roadmap not found.');
  return r;
}

function parseConstraints(body) {
  const goal = cleanText(body.goal, 160);
  if (goal.length < 4) throw new HttpError(400, 'Describe your dream job in a few words, for example "Full Stack Developer at a climate tech startup".', { field: 'goal' });
  const hoursPerWeek = Math.min(80, Math.max(1, Math.round(Number(body.hoursPerWeek) || 10)));
  const months = Math.min(48, Math.max(1, Math.round(Number(body.months) || 6)));
  const background = cleanText(body.background, 400);
  const knownSkills = (Array.isArray(body.knownSkills) ? body.knownSkills : String(body.knownSkills || '').split(','))
    .map((s) => cleanText(s, 40)).filter(Boolean).slice(0, 15);
  return { goal, hoursPerWeek, months, background, knownSkills };
}

async function createRoadmap(user, c) {
  const data = await generateRoadmap(c);
  const id = crypto.randomBytes(8).toString('hex');
  const now = Date.now();
  const { goal, ...constraints } = c;
  db.prepare('INSERT INTO roadmaps (id,user_id,goal,constraints,data,progress,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, user.id, goal, JSON.stringify(constraints), JSON.stringify(data), '{}', now, now);
  return rowToRoadmap(db.prepare('SELECT * FROM roadmaps WHERE id=?').get(id));
}

// ---------- routes ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler });

route('GET', '/api/health', async () => ({ ok: true }));

route('GET', '/api/config', async () => {
  const p = providerConfig();
  return { aiConfigured: !!p, provider: p ? p.name : null, mock: p?.kind === 'mock' };
});

route('POST', '/api/auth/register', async (req, res) => {
  const rl = rateLimit(`reg:${clientIp(req)}`, 10, 3600_000);
  if (!rl.ok) throw new HttpError(429, 'Too many sign-ups from this network. Try again later.');
  const { errors, clean } = validateSignup(await readJson(req));
  if (Object.keys(errors).length) throw new HttpError(400, 'Fix the highlighted fields.', { fields: errors });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(clean.email)) {
    throw new HttpError(409, 'An account with this email already exists. Log in instead.', { fields: { email: 'This email is already registered.' } });
  }
  const info = db.prepare('INSERT INTO users (name,email,pass_hash,created_at) VALUES (?,?,?,?)')
    .run(clean.name, clean.email, hashPassword(clean.password), Date.now());
  const user = { id: Number(info.lastInsertRowid), name: clean.name, email: clean.email };
  res.setHeader('Set-Cookie', sessionCookie(req, createSession(user.id)));
  return { user: publicUser(user) };
});

route('POST', '/api/auth/login', async (req, res) => {
  const body = await readJson(req);
  const email = String(body.email ?? '').trim().toLowerCase();
  const rl = rateLimit(`login:${clientIp(req)}:${email}`, 8, 15 * 60_000);
  if (!rl.ok) throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} minutes.`);
  const row = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  // verify against a dummy hash when the user is missing so timing does not reveal accounts
  const ok = row ? verifyPassword(String(body.password ?? ''), row.pass_hash) : (verifyPassword('x', hashPassword('y')), false);
  if (!ok) throw new HttpError(401, 'Email or password is incorrect.');
  res.setHeader('Set-Cookie', sessionCookie(req, createSession(row.id)));
  return { user: publicUser(row) };
});

route('POST', '/api/auth/logout', async (req, res) => {
  destroySession(getSessionToken(req));
  res.setHeader('Set-Cookie', sessionCookie(req, ''));
  return { ok: true };
});

route('GET', '/api/me', async (req) => {
  const u = userFromRequest(req);
  return { user: u ? publicUser(u) : null };
});

route('GET', '/api/roadmaps', async (req) => {
  const u = requireUser(req);
  const rows = db.prepare('SELECT * FROM roadmaps WHERE user_id=? ORDER BY updated_at DESC').all(u.id);
  return {
    roadmaps: rows.map((r) => {
      const rm = rowToRoadmap(r);
      const nodes = rm.data.nodes;
      const doneCount = nodes.filter((n) => rm.progress[n.id]).length;
      return { id: rm.id, goal: rm.goal, title: rm.data.title, nodeCount: nodes.length, doneCount, constraints: rm.constraints, updatedAt: rm.updatedAt, shared: !!rm.shareToken, mock: !!rm.data.mock };
    }),
  };
});

route('POST', '/api/roadmaps/generate', async (req) => {
  const u = requireUser(req);
  const rl = rateLimit(`ai:${u.id}`, 30, 3600_000);
  if (!rl.ok) throw new HttpError(429, 'You have hit the hourly AI limit. Try again later.');
  const c = parseConstraints(await readJson(req));
  return { roadmap: await createRoadmap(u, c) };
});

route('GET', '/api/roadmaps/:id', async (req, _res, p) => {
  const u = requireUser(req);
  return { roadmap: rowToRoadmap(ownRoadmap(u, p.id)) };
});

route('DELETE', '/api/roadmaps/:id', async (req, _res, p) => {
  const u = requireUser(req);
  ownRoadmap(u, p.id);
  db.prepare('DELETE FROM roadmaps WHERE id=?').run(p.id);
  return { ok: true };
});

route('PUT', '/api/roadmaps/:id/progress', async (req, _res, p) => {
  const u = requireUser(req);
  const r = ownRoadmap(u, p.id);
  const body = await readJson(req);
  const ids = new Set(JSON.parse(r.data).nodes.map((n) => n.id));
  const progress = {};
  for (const [k, v] of Object.entries(body.progress || {})) if (ids.has(k) && (v === 'done' || v === 'known')) progress[k] = v;
  db.prepare('UPDATE roadmaps SET progress=?, updated_at=? WHERE id=?').run(JSON.stringify(progress), Date.now(), p.id);
  return { progress };
});

route('POST', '/api/roadmaps/:id/replan', async (req, _res, p) => {
  const u = requireUser(req);
  const rl = rateLimit(`ai:${u.id}`, 30, 3600_000);
  if (!rl.ok) throw new HttpError(429, 'You have hit the hourly AI limit. Try again later.');
  const r = ownRoadmap(u, p.id);
  const rm = rowToRoadmap(r);
  const body = await readJson(req);
  const base = parseConstraints({ ...rm.constraints, goal: rm.goal, hoursPerWeek: body.hoursPerWeek ?? rm.constraints.hoursPerWeek, months: body.months ?? rm.constraints.months });
  const doneTitles = rm.data.nodes.filter((n) => rm.progress[n.id] && n.type !== 'goal').map((n) => n.title);
  const knownSkills = [...new Set([...base.knownSkills, ...doneTitles])].slice(0, 15);
  const created = await createRoadmap(u, { ...base, knownSkills });
  return { roadmap: created };
});

route('POST', '/api/roadmaps/:id/nodes/:nodeId/advice', async (req, _res, p) => {
  const u = requireUser(req);
  const r = ownRoadmap(u, p.id);
  const body = await readJson(req).catch(() => ({}));
  const rm = rowToRoadmap(r);
  const node = rm.data.nodes.find((n) => n.id === p.nodeId);
  if (!node) throw new HttpError(404, 'Step not found.');
  if (!body.refresh) {
    const cached = db.prepare('SELECT data FROM advice WHERE roadmap_id=? AND node_id=?').get(p.id, p.nodeId);
    if (cached) return { advice: JSON.parse(cached.data), cached: true };
  }
  const rl = rateLimit(`ai:${u.id}`, 30, 3600_000);
  if (!rl.ok) throw new HttpError(429, 'You have hit the hourly AI limit. Try again later.');
  const title = (id) => rm.data.nodes.find((n) => n.id === id)?.title;
  const neighbours = {
    before: node.prerequisites.map(title).filter(Boolean),
    after: rm.data.nodes.filter((n) => n.prerequisites.includes(node.id)).map((n) => n.title),
  };
  const advice = await generateAdvice({ goal: rm.goal, node, neighbours, hoursPerWeek: rm.constraints.hoursPerWeek });
  db.prepare('INSERT OR REPLACE INTO advice (roadmap_id,node_id,data) VALUES (?,?,?)').run(p.id, p.nodeId, JSON.stringify(advice));
  return { advice, cached: false };
});

route('POST', '/api/roadmaps/:id/share', async (req, _res, p) => {
  const u = requireUser(req);
  const r = ownRoadmap(u, p.id);
  const body = await readJson(req);
  let token = null;
  if (body.enabled) token = r.share_token || crypto.randomBytes(12).toString('base64url');
  db.prepare('UPDATE roadmaps SET share_token=? WHERE id=?').run(token, p.id);
  return { shareToken: token };
});

// Public, read-only. No account, email or advice is exposed.
route('GET', '/api/public/:token', async (_req, _res, p) => {
  const r = db.prepare('SELECT * FROM roadmaps WHERE share_token=?').get(p.token);
  if (!r) throw new HttpError(404, 'This shared roadmap does not exist or is no longer shared.');
  const rm = rowToRoadmap(r, { includeOwner: false });
  return { roadmap: { goal: rm.goal, constraints: { hoursPerWeek: rm.constraints.hoursPerWeek, months: rm.constraints.months }, data: rm.data, progress: {} } };
});

// ---------- static files ----------
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden');
  let st = null; try { st = fs.statSync(file); } catch {}
  if (!st || !st.isFile()) {
    if (path.extname(rel)) return send(res, 404, 'Not found');
    file = path.join(PUBLIC, 'index.html'); // SPA fallback
  }
  const ext = path.extname(file);
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' };
  res.writeHead(200, { ...SECURITY_HEADERS, ...headers });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) throw new HttpError(404, 'Unknown endpoint.');
      const params = url.pathname.match(r.re).groups || {};
      const out = await r.handler(req, res, params);
      return send(res, 200, out, res.getHeader('Set-Cookie') ? { 'Set-Cookie': res.getHeader('Set-Cookie') } : {});
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    serveStatic(req, res, url.pathname);
  } catch (err) {
    if (res.headersSent) return res.end();
    const status = err instanceof HttpError || err instanceof AIError ? err.status : 500;
    if (status === 500) console.error(err);
    send(res, status, { error: status === 500 ? 'Something went wrong on our side. Please try again.' : err.message, ...(err.extra || {}) }, res.getHeader('Set-Cookie') ? { 'Set-Cookie': res.getHeader('Set-Cookie') } : {});
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => {
    const p = providerConfig();
    console.log(`Summit running at http://localhost:${port}`);
    console.log(p ? `AI provider: ${p.name} (${p.model})` : 'AI provider: NOT CONFIGURED. Add a key to .env (see .env.example).');
  });
}
