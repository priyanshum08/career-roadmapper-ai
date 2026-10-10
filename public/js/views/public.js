import { h } from '../ui.js';
import { api } from '../api.js';
import { mount } from '../main.js';
import { roadmapScreen } from './roadmap.js';

export async function publicView(token) {
  mount(h('div', { class: 'page' }, h('p', { class: 'muted' }, 'Loading shared route…')), { chrome: false, wide: true });
  try {
    const { roadmap } = await api.publicGet(token);
    return roadmapScreen({ roadmap: { ...roadmap, id: token, shareToken: null }, readOnly: true });
  } catch (err) {
    mount(h('div', { class: 'page narrow' }, h('h1', {}, 'This route is not available'), h('p', {}, err.message), h('a', { class: 'btn primary', href: '/', 'data-link': true }, 'Go to Summit')), { chrome: false });
  }
}
