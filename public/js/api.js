export class ApiError extends Error {
  constructor(message, status, extra) { super(message); this.status = status; this.extra = extra || {}; }
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method, credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}

export const api = {
  config: () => request('GET', '/api/config'),
  me: () => request('GET', '/api/me'),
  register: (b) => request('POST', '/api/auth/register', b),
  login: (b) => request('POST', '/api/auth/login', b),
  logout: () => request('POST', '/api/auth/logout', {}),
  list: () => request('GET', '/api/roadmaps'),
  get: (id) => request('GET', `/api/roadmaps/${id}`),
  generate: (b) => request('POST', '/api/roadmaps/generate', b),
  remove: (id) => request('DELETE', `/api/roadmaps/${id}`),
  saveProgress: (id, progress) => request('PUT', `/api/roadmaps/${id}/progress`, { progress }),
  replan: (id, b) => request('POST', `/api/roadmaps/${id}/replan`, b),
  advice: (id, nodeId, refresh = false) => request('POST', `/api/roadmaps/${id}/nodes/${nodeId}/advice`, { refresh }),
  share: (id, enabled) => request('POST', `/api/roadmaps/${id}/share`, { enabled }),
  publicGet: (token) => request('GET', `/api/public/${token}`),
};
