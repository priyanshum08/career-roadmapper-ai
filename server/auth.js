import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_MS = 30 * 24 * 3600 * 1000;
const COOKIE = 'sm_session';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, saltHex, keyHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const key = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

export function validateSignup({ name, email, password }) {
  const errors = {};
  name = String(name ?? '').trim();
  email = String(email ?? '').trim().toLowerCase();
  password = String(password ?? '');
  if (name.length < 2 || name.length > 60) errors.name = 'Enter your name (2 to 60 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) errors.email = 'Enter a valid email address.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (password.length > 200) errors.password = 'Password is too long.';
  return { errors, clean: { name, email, password } };
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)')
    .run(sha(token), userId, Date.now() + SESSION_MS);
  return token;
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token));
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function getSessionToken(req) {
  return parseCookies(req.headers.cookie)[COOKIE];
}

export function userFromRequest(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.id, u.name, u.email, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`
  ).get(sha(token));
  if (!row) return null;
  if (row.expires_at < Date.now()) { destroySession(token); return null; }
  return { id: row.id, name: row.name, email: row.email };
}

export function sessionCookie(req, token) {
  const secure = process.env.COOKIE_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https';
  const base = `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${token ? SESSION_MS / 1000 : 0}`;
  return secure ? `${base}; Secure` : base;
}

// Simple in-memory fixed-window rate limiter.
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return { ok: b.count <= max, retryAfter: Math.ceil((b.reset - now) / 1000) };
}
