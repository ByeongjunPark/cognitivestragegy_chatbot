// 공용 저장소·인증 헬퍼 (파일명 '_' 접두사라 Vercel 라우트로 노출되지 않음)
// Redis(TCP, REDIS_URL) 로 사용자 계정과 학습 데이터를 영속 저장한다.
import crypto from 'node:crypto';
import { createClient } from 'redis';

export const SECRET = process.env.AUTH_SECRET || '';
export function ready() {
  return { store: !!process.env.REDIS_URL, secret: !!SECRET };
}

// ---------- Redis 연결 (웜 인스턴스 간 재사용) ----------
let _client = null;
let _connecting = null;
async function client() {
  if (_client && _client.isOpen) return _client;
  if (!_connecting) {
    _client = createClient({
      url: process.env.REDIS_URL,
      socket: { reconnectStrategy: (r) => Math.min(r * 50, 800) }
    });
    _client.on('error', (e) => console.error('[redis]', e && e.message));
    _connecting = _client.connect().catch((e) => { _connecting = null; throw e; });
  }
  await _connecting;
  return _client;
}

export const kvGet = async (k) => (await client()).get(k);
export const kvSet = async (k, v) => (await client()).set(k, v);
export const kvSetNX = async (k, v) => (await client()).set(k, v, { NX: true }); // 'OK' | null
export const kvDel = async (k) => (await client()).del(k);

// ---------- 그림 비밀번호 해시 (Node 내장 crypto만 사용) ----------
export function hashPin(pin, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.pbkdf2Sync(String(pin), s, 120000, 32, 'sha256').toString('hex');
  return { h, s };
}
export function verifyPin(pin, salt, hash) {
  const { h } = hashPin(pin, salt);
  const a = Buffer.from(h);
  const b = Buffer.from(String(hash || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- 세션 토큰 (상태 없는 HMAC 서명) ----------
const b64u = (s) => Buffer.from(s).toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url').toString('utf8');

export function makeToken(nickname, days = 90) {
  const exp = Date.now() + days * 864e5;
  const head = b64u(nickname) + '.' + exp;
  const sig = crypto.createHmac('sha256', SECRET).update(head).digest('base64url');
  return head + '.' + sig;
}
export function readToken(tok) {
  if (!tok || !SECRET) return null;
  const p = String(tok).split('.');
  if (p.length !== 3) return null;
  const head = p[0] + '.' + p[1];
  const expect = crypto.createHmac('sha256', SECRET).update(head).digest('base64url');
  const a = Buffer.from(p[2]);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() > Number(p[1])) return null;
  try { return unb64u(p[0]); } catch (e) { return null; }
}

// ---------- 쿠키 ----------
export function setCookie(name, val, maxAge) {
  const parts = [`${name}=${val}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'];
  parts.push(maxAge === 0 ? 'Max-Age=0' : `Max-Age=${maxAge || 7776000}`);
  return parts.join('; ');
}
export function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
