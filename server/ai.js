import { ROADMAP_SYSTEM, roadmapUser, ADVICE_SYSTEM, adviceUser } from './prompts.js';
import { normaliseRoadmap, normaliseAdvice } from './roadmap.js';

export function providerConfig() {
  const e = process.env;
  const k = (name) => (e[name] || '').trim();
  const forced = (e.AI_PROVIDER || '').trim().toLowerCase();
  const pick = forced || (k('ANTHROPIC_API_KEY') ? 'anthropic' : k('GEMINI_API_KEY') ? 'gemini' : k('GROQ_API_KEY') ? 'groq' : k('OPENAI_API_KEY') ? 'openai' : '');
  let cfg = null;
  switch (pick) {
    case 'anthropic': cfg = { kind: 'anthropic', name: 'Claude', model: k('ANTHROPIC_MODEL') || 'claude-sonnet-4-5', key: k('ANTHROPIC_API_KEY') }; break;
    case 'gemini': cfg = { kind: 'openai', name: 'Gemini', model: k('GEMINI_MODEL') || 'gemini-2.5-flash', key: k('GEMINI_API_KEY'), base: 'https://generativelanguage.googleapis.com/v1beta/openai' }; break;
    case 'groq': cfg = { kind: 'openai', name: 'Groq', model: k('GROQ_MODEL') || 'openai/gpt-oss-120b', key: k('GROQ_API_KEY'), base: 'https://api.groq.com/openai/v1' }; break;
    case 'openai': cfg = { kind: 'openai', name: 'OpenAI-compatible', model: k('OPENAI_MODEL') || 'gpt-4o-mini', key: k('OPENAI_API_KEY'), base: (k('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '') }; break;
    case 'mock': return { kind: 'mock', name: 'Mock (development only)', model: 'mock' };
    default: return null;
  }
  // A provider chosen without its key is treated as "not configured" so the UI shows the setup hint.
  return cfg.key ? cfg : null;
}

export class AIError extends Error {
  constructor(message, status = 502, code = '') { super(message); this.status = status; this.code = code; }
}

async function callModel(cfg, system, user, maxTokens) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 150_000);
  try {
    if (cfg.kind === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new AIError(`AI provider error (${r.status}): ${j?.error?.message || 'request failed'}`);
      return (j.content || []).map((c) => c.text || '').join('');
    }
    const body = {
      model: cfg.model, max_tokens: maxTokens, temperature: 0.6,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
    };
    // gpt-oss models on Groq are reasoning models: keep reasoning short so it does not eat the token budget.
    if (cfg.name === 'Groq' && /gpt-oss/i.test(cfg.model)) body.reasoning_effort = 'low';
    let r, j;
    for (let attempt = 0; attempt < 2; attempt++) {
      r = await fetch(`${cfg.base}/chat/completions`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify(body),
      });
      j = await r.json().catch(() => ({}));
      // Groq free tier is rate limited per minute: wait as told and retry once.
      if (r.status === 429 && attempt === 0) {
        const wait = Math.min(Math.max(Number(r.headers.get('retry-after')) || 5, 1), 30);
        await new Promise((res) => setTimeout(res, wait * 1000));
        continue;
      }
      break;
    }
    if (!r.ok) {
      const err = Array.isArray(j) ? j[0]?.error : j?.error;
      throw new AIError(`AI provider error (${r.status}): ${err?.message || 'request failed'}`, 502, err?.code || '');
    }
    return j.choices?.[0]?.message?.content || '';
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err.name === 'AbortError') throw new AIError('The AI took too long to answer. Try again.', 504);
    throw new AIError('Could not reach the AI provider. Check your connection and API key.');
  } finally { clearTimeout(timer); }
}

export function extractJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('No JSON object found');
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch {
    // common slip: trailing commas
    return JSON.parse(t.replace(/,\s*([}\]])/g, '$1'));
  }
}

async function jsonCall(cfg, system, user, maxTokens, normalise) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? user : `${user}\n\nYour previous reply was not valid. Reply with ONLY the JSON object that matches the schema. Error: ${lastErr?.message}`;
    let text;
    try { text = await callModel(cfg, system, prompt, maxTokens); }
    catch (e) {
      if (e instanceof AIError && e.code === 'json_validate_failed' && attempt === 0) { lastErr = e; continue; }
      throw e;
    }
    try { return normalise(extractJson(text)); } catch (e) { lastErr = e; }
  }
  throw new AIError(`The AI returned a roadmap we could not read (${lastErr?.message}). Please try again.`);
}

export async function generateRoadmap(input) {
  const cfg = providerConfig();
  if (!cfg) throw new AIError('No AI provider is configured. Add an API key to .env (see .env.example).', 503);
  if (cfg.kind === 'mock') return { ...mockRoadmap(input), mock: true, model: 'mock' };
  const data = await jsonCall(cfg, ROADMAP_SYSTEM, roadmapUser(input), 6000, normaliseRoadmap);
  return { ...data, model: `${cfg.name} / ${cfg.model}` };
}

export async function generateAdvice({ goal, node, neighbours, hoursPerWeek }) {
  const cfg = providerConfig();
  if (!cfg) throw new AIError('No AI provider is configured. Add an API key to .env (see .env.example).', 503);
  if (cfg.kind === 'mock') return { ...mockAdvice(node), mock: true };
  return jsonCall(cfg, ADVICE_SYSTEM, adviceUser({ goal, node, neighbours, hoursPerWeek }), 3000, normaliseAdvice);
}

// ---- Development-only mock (AI_PROVIDER=mock). Never used unless explicitly forced. ----
function mockRoadmap({ goal }) {
  const g = goal.slice(0, 60);
  const mk = (id, phase, type, title, hours, prerequisites, skills = []) => ({ id, phase, type, title, summary: `Placeholder step for "${g}". Configure a real AI provider for real content.`, hours, skills, prerequisites });
  return normaliseRoadmap({
    title: `${g} (mock)`, targetRole: g, companyType: 'mock', summary: 'MOCK DATA for UI development. Not a real roadmap.',
    realityCheck: 'Mock mode: no real analysis was done.', assumed: [],
    phases: [{ id: 'p1', name: 'Base camp' }, { id: 'p2', name: 'Climb' }, { id: 'p3', name: 'Ridge' }, { id: 'p4', name: 'Summit' }],
    nodes: [
      mk('fund', 'p1', 'skill', 'Core fundamentals', 40, [], ['basics']),
      mk('tools', 'p1', 'skill', 'Tooling and workflow', 20, [], ['git']),
      mk('net', 'p1', 'skill', 'Join the community', 8, [], ['networking']),
      mk('lang', 'p2', 'skill', 'Main language deep dive', 60, ['fund'], ['language']),
      mk('proj1', 'p2', 'project', 'First portfolio project', 30, ['fund', 'tools'], ['portfolio']),
      mk('cert', 'p2', 'cert', 'Entry certification', 30, ['fund'], ['cert']),
      mk('data', 'p3', 'skill', 'Data and storage', 40, ['lang'], ['sql']),
      mk('proj2', 'p3', 'project', 'Capstone project', 50, ['proj1', 'data'], ['portfolio']),
      mk('intern', 'p3', 'role', 'Internship or junior role', 80, ['proj1', 'net', 'cert'], ['experience']),
      mk('mock', 'p4', 'skill', 'Mock interviews', 15, ['proj2', 'intern'], ['interview']),
      mk('goal', 'p4', 'goal', g, 10, ['mock', 'proj2', 'intern']),
    ],
    paths: [{ label: 'Campus route', who: 'Mock archetype', steps: [{ title: 'Internship', kind: 'role', duration: '3 months' }], lesson: 'Mock.' }],
  });
}
function mockAdvice(node) {
  return normaliseAdvice({
    whyItMatters: `Mock advice for "${node.title}".`,
    weekendProject: { title: `Mock project for ${node.title}`, pitch: 'Placeholder.', steps: ['Step one', 'Step two'], deliverable: 'A repo', stretchGoal: 'Deploy it' },
    repoToStudy: null,
    interviewQuestions: [{ question: `Explain ${node.title}.`, lookFor: 'Clarity.' }],
    searchQueries: [node.title], doneWhen: ['You can explain it'], pitfalls: ['Skipping practice'],
  });
}
