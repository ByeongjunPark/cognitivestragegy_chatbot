// 로그인한 사용자의 학습 데이터 읽기(GET) / 통째로 저장(PUT)
// 인증은 HttpOnly 쿠키 'sess' (HMAC 서명 토큰) 로만 확인한다.
import { ready, kvGet, kvSet, readToken, getCookie } from './_store.js';

export default async function handler(req, res) {
  const r = ready();
  if (!r.store || !r.secret) {
    res.status(500).json({ error: '서버 저장소가 설정되지 않았습니다.' });
    return;
  }

  const nick = readToken(getCookie(req, 'sess'));
  if (!nick) { res.status(401).json({ error: '로그인이 필요합니다.' }); return; }
  const dKey = 'data:' + nick;

  try {
    if (req.method === 'GET') {
      let data = null;
      try { data = JSON.parse(await kvGet(dKey)); } catch (e) { data = null; }
      if (!data || !Array.isArray(data.sessions)) {
        data = { nickname: nick, created: new Date().toISOString(), sessions: [] };
      }
      res.status(200).json({ nickname: nick, data });
      return;
    }

    if (req.method === 'PUT' || req.method === 'POST') { // POST 는 navigator.sendBeacon 용
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
      if (!body || typeof body !== 'object' || !Array.isArray(body.sessions)) {
        res.status(400).json({ error: 'sessions 배열을 가진 객체가 필요합니다.' });
        return;
      }
      const doc = JSON.stringify({
        nickname: nick,
        created: body.created || new Date().toISOString(),
        sessions: body.sessions
      });
      if (doc.length > 1_500_000) { res.status(413).json({ error: '데이터가 너무 큽니다.' }); return; }
      await kvSet(dKey, doc);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(502).json({ error: '저장소 오류: ' + String(e.message || e) });
  }
}
