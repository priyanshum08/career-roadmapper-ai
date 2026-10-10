import { h } from '../ui.js';
import { api } from '../api.js';
import { app, mount } from '../main.js';
import { navigate } from '../router.js';

const EXAMPLES = ['Full Stack Developer at a climate tech startup', 'UI/UX Designer for fintech apps', 'Data Analyst at a healthcare company', 'DevOps Engineer at a gaming studio'];
const STAGES = [
  'Surveying the summit: what this exact job asks for',
  'Finding the entry-level and in-between roles people really take',
  'Picking the certifications that are worth the time',
  'Choosing side projects that prove the skills',
  'Plotting the trail and checking it fits your hours',
];

export function createView() {
  const qs = new URLSearchParams(location.search);
  const goal = h('input', { id: 'goal', class: 'input xl', value: qs.get('goal') || '', placeholder: 'e.g. Full Stack Developer at a climate tech startup', maxlength: 160, required: true, autocomplete: 'off', 'aria-describedby': 'goal-hint goal-err' });
  const goalErr = h('p', { class: 'field-error', id: 'goal-err', 'aria-live': 'polite' });
  const hours = range('hours', 10, 1, 40, 1);
  const months = range('months', 6, 1, 24, 1);
  const bg = h('textarea', { id: 'bg', class: 'input', rows: 3, maxlength: 400, placeholder: 'e.g. Final-year CSE student. Comfortable with Python and basic HTML. One small Flask project.' });
  const known = h('input', { id: 'known', class: 'input', maxlength: 200, placeholder: 'e.g. Git, Python, SQL basics (comma separated)' });
  const errBox = h('div', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn primary lg', type: 'submit' }, 'Generate my route');

  const aiNote = !app.config.aiConfigured
    ? h('div', { class: 'callout warn', role: 'note' }, h('strong', {}, 'No AI provider is configured. '), 'Add an API key to the .env file and restart the server. See the README.')
    : app.config.mock ? h('div', { class: 'callout warn', role: 'note' }, h('strong', {}, 'Mock mode. '), 'Roadmaps are placeholders for UI development, not real AI output.') : null;

  const form = h('form', { class: 'create-form', novalidate: true, onsubmit: onSubmit },
    h('div', { class: 'field' },
      h('label', { for: 'goal', class: 'big-label' }, 'What is the dream job?'),
      h('p', { class: 'hint', id: 'goal-hint' }, 'The more specific, the better the route: add the company type, industry or team.'),
      goal, goalErr,
      h('div', { class: 'chips' }, EXAMPLES.map((g) => h('button', { type: 'button', class: 'chip', onclick: () => { goal.value = g; goal.focus(); } }, g)))),
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, h('label', { for: 'hours' }, 'Time you can give each week'), hours.wrap),
      h('div', { class: 'field' }, h('label', { for: 'months' }, 'Months until you want to be hired'), months.wrap)),
    h('p', { class: 'budget', id: 'budget', 'aria-live': 'polite' }),
    h('div', { class: 'field' }, h('label', { for: 'bg' }, 'Where are you starting from? ', h('span', { class: 'opt' }, 'optional')), bg),
    h('div', { class: 'field' }, h('label', { for: 'known' }, 'Skills you already have ', h('span', { class: 'opt' }, 'optional')), known),
    errBox,
    h('div', { class: 'row gap center' }, submit, h('span', { class: 'muted small' }, 'Takes about 20 to 60 seconds.')));

  const budget = form.querySelector('#budget');
  const upd = () => { budget.textContent = `That is about ${Math.round(hours.input.value * months.input.value * 4.345)} hours of focused work in total.`; };
  hours.input.addEventListener('input', upd); months.input.addEventListener('input', upd); upd();

  const loader = h('div', { class: 'loader', hidden: true, role: 'status', 'aria-live': 'polite' });
  mount(h('div', { class: 'page narrow' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Plot a new route'), h('p', { class: 'sub' }, 'Start from the end. Summit works out the way back.'))),
    aiNote, form, loader));
  goal.focus();

  async function onSubmit(e) {
    e.preventDefault();
    goalErr.textContent = ''; errBox.hidden = true; goal.removeAttribute('aria-invalid');
    if (goal.value.trim().length < 4) { goalErr.textContent = 'Describe your dream job in a few words.'; goal.setAttribute('aria-invalid', 'true'); goal.focus(); return; }
    submit.disabled = true; form.setAttribute('aria-busy', 'true');
    let i = 0; loader.hidden = false; form.hidden = true;
    const paint = () => loader.replaceChildren(
      h('div', { class: 'spinner', 'aria-hidden': 'true' }),
      h('h2', {}, 'Plotting your route'),
      h('p', { class: 'stage' }, STAGES[i % STAGES.length]),
      h('ol', { class: 'stage-list', 'aria-hidden': 'true' }, STAGES.map((t, n) => h('li', { class: n < i % STAGES.length ? 'done' : n === i % STAGES.length ? 'now' : '' }, t))));
    paint(); const timer = setInterval(() => { if (i < STAGES.length - 1) i++; paint(); }, 7000);
    try {
      const { roadmap } = await api.generate({ goal: goal.value, hoursPerWeek: hours.input.value, months: months.input.value, background: bg.value, knownSkills: known.value });
      clearInterval(timer); navigate(`/r/${roadmap.id}`);
    } catch (err) {
      clearInterval(timer);
      loader.hidden = true; form.hidden = false; submit.disabled = false; form.removeAttribute('aria-busy');
      errBox.textContent = err.message; errBox.hidden = false; errBox.scrollIntoView({ block: 'center' });
    }
  }
}

function range(id, value, min, max, step) {
  const out = h('output', { for: id }, String(value));
  const input = h('input', { id, type: 'range', min, max, step, value, class: 'slider' });
  input.addEventListener('input', () => { out.textContent = input.value; });
  const unit = id === 'hours' ? ' h / week' : ' months';
  const o2 = h('span', { class: 'range-val' }, out, unit);
  return { input, wrap: h('div', { class: 'range' }, input, o2) };
}
