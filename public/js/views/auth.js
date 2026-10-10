import { h, s } from '../ui.js';
import { api, ApiError } from '../api.js';
import { app, mount, logoMark } from '../main.js';
import { navigate } from '../router.js';

export function authView(mode) {
  const isReg = mode === 'register';
  const next = new URLSearchParams(location.search).get('next');
  const errBox = h('div', { class: 'form-error', role: 'alert', hidden: true });
  const fields = {};

  const field = (name, label, type, props = {}) => {
    const hint = h('p', { class: 'field-error', id: `${name}-err`, 'aria-live': 'polite' });
    const input = h('input', { id: name, name, type, class: 'input', required: true, 'aria-describedby': `${name}-err`, ...props });
    fields[name] = { input, hint };
    const wrap = h('div', { class: 'field' }, h('label', { for: name }, label), input, hint);
    if (name === 'password') {
      const toggle = h('button', { type: 'button', class: 'pw-toggle', 'aria-pressed': 'false', onclick: () => {
        const show = input.type === 'password'; input.type = show ? 'text' : 'password';
        toggle.textContent = show ? 'Hide' : 'Show'; toggle.setAttribute('aria-pressed', String(show));
      } }, 'Show');
      wrap.insertBefore(h('div', { class: 'pw-wrap' }, input, toggle), hint);
    }
    return wrap;
  };

  const submit = h('button', { class: 'btn primary lg block', type: 'submit' }, isReg ? 'Create account' : 'Log in');
  const form = h('form', { class: 'auth-form', novalidate: true, onsubmit: onSubmit },
    isReg && field('name', 'Your name', 'text', { autocomplete: 'name', maxlength: 60 }),
    field('email', 'Email', 'email', { autocomplete: 'email', inputmode: 'email' }),
    field('password', isReg ? 'Password' : 'Password', 'password', { autocomplete: isReg ? 'new-password' : 'current-password' }),
    isReg && h('p', { class: 'hint' }, 'At least 8 characters. We store only a salted hash, never the password itself.'),
    errBox, submit);

  async function onSubmit(e) {
    e.preventDefault();
    for (const f of Object.values(fields)) { f.hint.textContent = ''; f.input.removeAttribute('aria-invalid'); }
    errBox.hidden = true;
    const body = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.input.value]));
    // quick client checks (the server re-validates)
    const local = {};
    if (isReg && body.name.trim().length < 2) local.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email.trim())) local.email = 'Enter a valid email address.';
    if (!body.password || (isReg && body.password.length < 8)) local.password = isReg ? 'Use at least 8 characters.' : 'Enter your password.';
    if (Object.keys(local).length) return showErrors(local);
    submit.disabled = true; submit.textContent = isReg ? 'Creating account…' : 'Logging in…';
    try {
      const { user } = await (isReg ? api.register(body) : api.login(body));
      app.user = user;
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.extra.fields) showErrors(err.extra.fields);
      else { errBox.textContent = err.message; errBox.hidden = false; }
      submit.disabled = false; submit.textContent = isReg ? 'Create account' : 'Log in';
    }
  }
  function showErrors(map) {
    let first = true;
    for (const [k, msg] of Object.entries(map)) {
      const f = fields[k]; if (!f) continue;
      f.hint.textContent = msg; f.input.setAttribute('aria-invalid', 'true');
      if (first) { f.input.focus(); first = false; }
    }
  }

  const art = s('svg', { class: 'auth-art', viewBox: '0 0 400 600', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid slice' },
    s('use', { href: '/img/contours.svg#c' }),
    s('path', { d: 'M60 540 C140 470 90 420 190 380 S 160 250 260 210 S 250 110 320 70', class: 'trail', pathLength: 100 }),
    s('g', { transform: 'translate(320,70)', class: 'trail-flag' }, s('path', { d: 'M0 0V-50', stroke: '#F8FAF8', 'stroke-width': 4, 'stroke-linecap': 'round' }), s('path', { d: 'M2 -50h34l-10 12 10 12H2z', fill: '#F0A202' })));

  mount(h('div', { class: 'auth' },
    h('section', { class: 'auth-main' },
      h('a', { class: 'brand', href: '/', 'data-link': true }, logoMark(30), h('span', {}, 'Summit')),
      h('div', { class: 'auth-card' },
        h('h1', {}, isReg ? 'Create your account' : 'Welcome back'),
        h('p', { class: 'sub' }, isReg ? 'Save your routes, track progress and pick up where you left off.' : 'Log in to see your saved routes.'),
        form,
        h('p', { class: 'switch' }, isReg ? 'Already have an account? ' : 'New to Summit? ',
          h('a', { href: isReg ? `/login${location.search}` : `/register${location.search}`, 'data-link': true }, isReg ? 'Log in' : 'Create an account')))),
    h('aside', { class: 'auth-side' }, art,
      h('blockquote', {}, h('p', {}, '“Learn React and build a portfolio” is not a route. A route has names, dates and a first step.'), h('footer', {}, 'The idea behind Summit'))),
  ), { chrome: false });
  setTimeout(() => (isReg ? fields.name : fields.email).input.focus(), 50);
}
