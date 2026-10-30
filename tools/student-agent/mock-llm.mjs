// 결함 주입 모의 LLM — Upstage 키 없이 챗봇 전체 흐름과 "코드 방어선"을 점검하기 위한 것.
// 실제 평가·관찰에서 나온 결함(반말 섞임, 추궁형 질문, 위젯 없는 "아래에서 골라", 비문, 장문, 질문 여러 개,
// 마크다운 목록, 교과 용어 오류, 영어 낱말 섞임, 지시문 유출)을 faultRate 확률로 일부러 섞는다.
// 재생성 요청(경고·고쳐야 할 점이 붙은 호출)에는 fixRate 확률로만 깨끗하게 답한다(실제 모델처럼 불완전하게).
// 실제 모델 품질 확인은 run.mjs(--url + UPSTAGE_API_KEY)로 따로 한다.

export function makeRng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const FAULTS = {
  banmal: t => t + ' 그럼 이제 다음 걸 해 보자. 잘 따라오고 있어.',
  probe: t => t.replace(/[^.!?]*\?\s*$/, '').trim() + ' 왜 그렇게 말했어?',
  widget: t => t + ' 아래에서 하나 골라 봐.',
  broken: t => t + ' 너는 어떤 것이 알고 배는 거야?',
  long: t => t.replace(/[^.!?]*\?\s*$/, '').trim() + ' 이 내용은 정말 중요해요. 교과서에서도 여러 번 나와요. 생활 속에서도 자주 볼 수 있어요. 예를 들어 여러 상황에서 쓰여요. 친구들도 많이 헷갈려해요. 그래서 천천히 알아봐야 해요. 그럼 어떻게 생각해요?',
  multiQ: t => t + ' 그리고 이건 어떻게 생각해요? 또 다른 예도 떠오르나요?',
  markdown: t => t + '\n1. **첫째** 핵심 정리\n2. **둘째** 예시 정리\n3. **셋째** 마무리',
  english: t => t.replace(/요\./, '요. 이 cards 를 잘 봐요.'),
  metaLeak: t => '(학습자가 답변 후 유도) ' + t,
  term: t => t + ' 여름에는 남중 고도가 커서 그림자가 짧아요.'
};
const FAULT_KEYS = Object.keys(FAULTS);

function lastUser(messages) { const u = [...messages].reverse().find(m => m.role === 'user'); return u ? String(u.content) : ''; }
function tailInstr(messages) { const t = [...messages].reverse().find(m => m.role === 'system' && /이번 턴 지시/.test(m.content)); return t ? String(t.content) : String(messages[0].content).split('[이번 지시]').pop(); }
const isRetry = messages => messages.some(m => m.role === 'system' && /(고쳐야 할 점|\(경고:|사실 검수에서 이런 문제)/.test(m.content));
const snippet = s => String(s || '').replace(/^\[[^\]]+\]\s*/, '').replace(/[.?!]+$/, '').slice(0, 18);

function chatReply(messages, rng, cfg, log) {
  const instr = tailInstr(messages);
  const sys = String(messages[0].content);
  const subject = (sys.match(/성취기준: [^\n]*\((?:[^\n]*?)\s(국어|수학|사회|과학|영어)/) || [])[1] || '';
  const said = lastUser(messages);
  const noQ = /질문하지 마|질문하지 말고|새로운 질문을 던지지 마/.test(instr);
  let body;
  if (/인사하고/.test(instr)) body = '안녕하세요! 오늘은 이 내용을 쉬운 말로 함께 알아봐요. 먼저 지금 얼마나 알고 있는지 가볍게 살펴볼게요.';
  else if (/과업: "/.test(instr)) { const task = (instr.match(/과업: "([^"]+)"/) || [])[1] || '이번 할 일'; body = `좋아요, 시작해 봐요. ${task.replace(/[.?!]+$/, '')}을 해 봐요.`; }
  else if (/풀이 공개 턴/.test(instr)) body = '먼저 분모를 같게 맞추고, 분자끼리 더해요. 그래서 답은 이렇게 나와요. 이건 AI가 보여 준 풀이라 맞는지는 직접 판단해 봐요. 방금 풀이를 내 말로 한 문장으로 다시 설명해 볼래요?';
  else {
    const plain = said && !/^\[|^\(|방법으로/.test(said.trim());
    const ack = plain ? `"${snippet(said)}"라고 했네요. 잘 짚었어요.` : '좋아요, 고마워요.';
    const q = noQ ? '' : ' 그럼 어떤 점이 가장 헷갈렸는지 알려 줄래요?';
    body = ack + q;
  }
  const retry = isRetry(messages);
  if (retry && rng() < cfg.fixRate) { log.push({ type: 'chat', retry: true, faults: [] }); return body; }
  let out = body; const used = [];
  if (rng() < cfg.faultRate) {
    const n = rng() < 0.3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      let key = FAULT_KEYS[Math.floor(rng() * FAULT_KEYS.length)];
      if (key === 'term' && subject !== '과학') key = 'banmal';
      if (used.includes(key)) continue;
      used.push(key); out = FAULTS[key](out);
    }
  }
  log.push({ type: 'chat', retry, faults: used });
  return out;
}

function itemsJSON(messages, rng, state) {
  const u = lastUser(messages);
  const tags = [...u.matchAll(/"tag":"(기억|예시|설명|적용)"/g)].map(m => m[1]);
  const T = tags.length ? tags : ['기억', '예시', '설명', '적용'];
  const post = /평행 문항/.test(u);
  const leakFirst = !post && !state.leakDone && rng() < 0.5; // 처음 출제의 절반은 일부러 정답 단서를 겹치게
  const items = T.map((tag, i) => (tag === '기억' || tag === '예시')
    ? { tag, type: 'mcq', q: post ? `[평행] ${tag} 문항: 알맞은 것을 골라요.` : `${tag} 문항: 다음 중 알맞은 것은?`, options: ['통분', '약분', '곱셈', '나눗셈'], answer: 0 }
    : { tag, type: 'text', q: leakFirst ? `통분을 하는 까닭을 ${tag === '설명' ? '설명해' : '적용해'} 보세요.` : `${post ? '[평행] ' : ''}${tag} 문항: 자기 말로 써 보세요.`, rubric: { full: '분모를 같게 맞춰야 더할 수 있다는 까닭', partial: '분모를 같게 한다' } });
  if (leakFirst) state.leakDone = true;
  return JSON.stringify({ items });
}

export function mockLLM(messages, rng, cfg, log, state) {
  const sys = String(messages[0] && messages[0].content || '');
  const u = lastUser(messages);
  if (/문항 출제자/.test(sys)) { log.push({ type: 'items' }); return itemsJSON(messages, rng, state); }
  if (/^너는 채점 보조자/.test(sys)) { const n = (u.match(/"level":1/g) || []).length || 1; return JSON.stringify({ items: Array.from({ length: n }, () => ({ level: rng() < 0.4 ? 2 : rng() < 0.7 ? 1 : 0, note: '분모를 같게 한다는 점을 썼어요.' })) }); }
  if (/메타인지 지식 평가 보조자/.test(sys)) {
    if (rng() < (cfg.metaFail || 0)) return '채점을 못 했어요';
    const b = () => (rng() < 0.55 ? 1 : 0);
    return JSON.stringify({ understand: { quote: '헷갈려요', s: b(), r: b(), c: b() }, strategy: { quote: '정리해요', s: b(), r: b(), c: 0 }, connect: { quote: '비슷해요', s: b(), r: b(), c: 0 }, note: '스스로 잘 살펴봤어요.' });
  }
  if (/교육과정 내용 분석가/.test(sys)) return JSON.stringify({ kType: 'procedure', why: '방법을 순서대로 익히는 내용이에요.' });
  if (/성취기준 매칭 보조자/.test(sys)) { const c = (u.match(/\n([^\s|]+) \|/) || [])[1]; return JSON.stringify({ codes: c ? [c] : [] }); }
  if (/인지전략 과업 설계자/.test(sys)) { state.task = (state.task || 0) + 1; return JSON.stringify({ task: `방금 이야기한 내용을 표로 정리해 봐요(${state.task}번째)`, target: '핵심 개념', form: '표', criteria: ['핵심 낱말을 썼다', '까닭을 썼다'], commonErrors: ['순서를 헷갈림'] }); }
  if (/학습 과업 진단 보조자/.test(sys)) return JSON.stringify({ met: ['핵심 낱말'], missing: rng() < 0.5 ? ['까닭'] : [], errorType: '근거가 부족함', level: rng() < 0.5 ? 1 : 2, strategyUsed: true });
  if (/교과 내용 검수자/.test(sys)) { const bad = /고도[가는이]?\s*(커|크|작)|길이[가는]?\s*(높|낮)/.test(u) || rng() < (cfg.verifyFail || 0); log.push({ type: 'verify', bad }); return JSON.stringify({ ok: !bad, issue: bad ? '고도는 높다·낮다로 말해야 해요.' : '' }); }
  if (/교과 교육 전문가/.test(sys)) return JSON.stringify({ misconceptions: ['분모끼리도 더하면 된다', '큰 수가 항상 더 크다'] });
  if (/자기설명·전략 사용 평가 보조자/.test(sys)) return JSON.stringify({ selfExplain: { level: '보통', note: '까닭을 일부 썼어요.' }, transfer: { applied: true, note: '표를 썼어요.' } });
  if (/성찰 질문 보조자/.test(sys)) { const f = rng() < cfg.faultRate; log.push({ type: 'aux', faults: f ? ['banmal'] : [] }); return f ? '그때 왜 AI한테 맡겼어? 다음엔 어떻게 해 볼래?' : '그때 AI에게 맡긴 까닭을 떠올려 볼래요?'; }
  if (/학습 패턴|공부 패턴/.test(sys + u)) return '표로 정리하는 방법을 자주 썼어요.';
  if (/설명 보기|왜 이 말이 나왔는지|산출 과정/.test(sys + u)) return '앞에서 한 말을 바탕으로 다음 할 일을 알려 준 거예요.';
  return chatReply(messages, rng, cfg, log);
}
