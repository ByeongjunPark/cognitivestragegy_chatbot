// 회원가입 / 로그인 / 로그아웃 — 그림 비밀번호 잠금 계정
import {
  ready, kvGet, kvSet, kvSetNX,
  hashPin, verifyPin, makeToken, setCookie
} from './_store.js';

const NICK_RE = /^[\p{L}\p{N} _.\-]{1,16}$/u;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const r = ready();
  if (!r.store || !r.secret) {
    res.status(500).json({ error: '서버 저장소(Redis) 또는 AUTH_SECRET 환경변수가 설정되지 않았습니다.' });
    return;
  }

  const body = req.body || {};
  const mode = body.mode;

  if (mode === 'logout') {
    res.setHeader('Set-Cookie', setCookie('sess', '', 0));
    res.status(200).json({ ok: true });
    return;
  }

  const nickname = String(body.nickname || '').trim();
  const pin = String(body.pin || '');
  if (!NICK_RE.test(nickname)) { res.status(400).json({ error: '닉네임은 1~16자여야 합니다.' }); return; }
  if (pin.length < 2 || pin.length > 64) { res.status(400).json({ error: '그림 비밀번호가 올바르지 않습니다.' }); return; }

  const uKey = 'user:' + nickname;
  const dKey = 'data:' + nickname;

  try {
    if (mode === 'signup') {
      const { h, s } = hashPin(pin);
      const rec = JSON.stringify({ h, s, created: new Date().toISOString() });
      const ok = await kvSetNX(uKey, rec); // 원자적: 닉네임이 비어 있을 때만
      if (ok !== 'OK') { res.status(409).json({ error: '이미 있는 닉네임입니다. 로그인 탭을 쓰거나 다른 닉네임을 고르세요.' }); return; }
      const data = { nickname, created: new Date().toISOString(), sessions: [] };
      await kvSet(dKey, JSON.stringify(data));
      res.setHeader('Set-Cookie', setCookie('sess', makeToken(nickname)));
      res.status(200).json({ nickname, data });
      return;
    }

    if (mode === 'login') {
      const raw = await kvGet(uKey);
      if (!raw) { res.status(404).json({ error: '가입되지 않은 닉네임입니다. 회원가입 탭을 먼저 이용하세요.' }); return; }
      const rec = JSON.parse(raw);
      if (!verifyPin(pin, rec.s, rec.h)) { res.status(401).json({ error: '그림 비밀번호가 일치하지 않습니다.' }); return; }
      let data = null;
      try { data = JSON.parse(await kvGet(dKey)); } catch (e) { data = null; }
      if (!data || !Array.isArray(data.sessions)) data = { nickname, created: rec.created, sessions: [] };
      res.setHeader('Set-Cookie', setCookie('sess', makeToken(nickname)));
      res.status(200).json({ nickname, data });
      return;
    }

    res.status(400).json({ error: 'mode 는 signup | login | logout 이어야 합니다.' });
  } catch (e) {
    res.status(502).json({ error: '저장소 오류: ' + String(e.message || e) });
  }
}
