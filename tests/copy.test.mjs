import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { CS, ROOT } from './_load.mjs';

test('WP4-3 안내 문구 3벌은 같은 키를 갖고(누락 0), 초저 안내 평균 30자 이하', () => {
  const keys = b => Object.keys(CS.UI_COPY[b]).sort();
  assert.deepEqual(keys('초저'), keys('초고'));
  assert.deepEqual(keys('초저'), keys('중고'));
  const todo = Object.entries(CS.UI_COPY['초저']).filter(([k]) => k.startsWith('todo.')).map(([, v]) => v.length);
  assert.ok(todo.reduce((a, b) => a + b, 0) / todo.length <= 30);
});

test('WP1-4 고정 문구 사전은 모두 해요체(반말 0건)', () => {
  const walk = (v, out) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(x => walk(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, out)); return out; };
  const strs = walk(CS.COPY, []).filter(s => /[가-힣]/.test(s) && s.length > 6);
  const bad = strs.flatMap(s => CS.splitSentences(s)).filter(s => CS.sentenceTone(s) === 'banmal');
  assert.deepEqual(bad, []);
});

test('WP3-7 반응 방식 4종이 차례로 돌고, 모두 "인정 1문장 + 질문 1개 + 추궁 금지" 구조를 갖는다', () => {
  const seen = [0, 1, 2, 3].map(i => CS.buildReactionInstr(i));
  CS.REACTION_STYLES.forEach((st, i) => assert.ok(seen[i].includes(st.instr)));
  assert.equal(new Set(seen).size, 4);
  assert.equal(CS.buildReactionInstr(4), seen[0]);
  seen.forEach(s => { assert.ok(/질문은 딱 1개/.test(s)); assert.ok(/왜 그렇게 말했어/.test(s)); });
  const p = CS.pickVaried(['a', 'b', 'c'], 1); assert.notEqual(p.i, 1);
});

test('WP2-8 정리 도구 7종 모두 설명 한 줄', async () => {
  const src = fs.readFileSync(ROOT + '/js/class-ui.js', 'utf8');
  for (const t of ['table', 'mindmap', 'compare', 'chain', 'drill', 'retrieval', 'checklist']) assert.ok(new RegExp(`\\b${t}:\\s*'[^']{10,}'`).test(src), t);
});

test('WP2-7 교육과정 코드 숨기기·학생용 낱말', () => {
  assert.equal(CS.hideCodes('[6과13-02] 계절에 따른 남중 고도'), '계절에 따른 남중 고도');
  assert.equal(CS.hideCodes('[10공수1-01-02] 다항식'), '다항식');
  assert.equal(CS.toStudentWords('성취기준과 잔여물 확인'), '오늘 배울 내용과 혼자 풀어보기');
});

test('RAG: 원문 색인에서 남중 고도 질문의 근거가 해당 성취기준 원문으로 잡힌다', () => {
  const f = ROOT + '/data/rag/e56__과학.json';
  if (!fs.existsSync(f)) return;
  const idx = CS.buildIndex(JSON.parse(fs.readFileSync(f, 'utf8')));
  const r = CS.retrieve(idx, '여름에 남중 고도가 높으면 낮의 길이는?', { k: 3, codes: ['6과13-02'] });
  assert.ok(r.length >= 2);
  assert.ok(r.some(x => (x.chunk.codes || [x.chunk.code]).includes('6과13-02')));
  assert.ok(r.some(x => /교육부 고시/.test((x.chunk.src || {}).doc || '')), '원문 출처 표시');
  assert.ok(CS.contextBlock(r, 400).length <= 420);
});

test('RAG: 기본 말뭉치(데이터) 조각 만들기·검색', () => {
  const ch = CS.chunksFromStandards([{ code: 'X-01', name: '이름', concept: '해설 문장' }, { code: 'X-02', name: '둘' }], '과학', 'b');
  assert.equal(ch.length, 3);
  assert.equal(CS.retrieve(CS.buildIndex(ch), '해설 문장', { k: 1 })[0].chunk.kind, '해설');
});

test('전문가 평가 재검증: 학생 화면 버튼 이름에 추궁형 표현("왜 이렇게 말했어?" 등)이 없다', () => {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const labels = [...html.matchAll(/<button[^>]*>([^<]{1,40})<\/button>/g)].map(m => m[1].trim());
  const banned = ['왜 이렇게 말했어', '왜 그렇게 말했어', '왜 그랬어', '그 이유가 뭐야'];
  labels.forEach(l => banned.forEach(b => assert.ok(!l.includes(b), `${l} ← ${b}`)));
  assert.ok(/explain-btn"[^>]*>이 말의 까닭 보기</.test(html));
});

test('맞춤 표 틀: 자리표시 머리글·일본어 낱말을 걸러 내고, 첫 칸 항목·칸별 안내·보기 줄을 담는다', () => {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const a = html.indexOf('const KO_ONLY'), b = html.indexOf('async function requestStructured');
  assert.ok(a > 0 && b > a);
  const mk = new Function('kTypeOf', html.slice(a, b) + '; return { normalizeTablePayload, cleanKo };');
  const { normalizeTablePayload } = mk(() => 'causal');
  // 자리표시 머리글 → 내용 성격별 기본 머리글
  let p = normalizeTablePayload({ headers: ['열1', '열2', '열3'], bank: ['더하기', 'リットル', '덜어 내기'] });
  assert.deepEqual(p.headers, ['원인', '결과', '까닭']);
  assert.deepEqual(p.bank, ['더하기', '덜어 내기']);
  // 맞춤 틀: 머리글·첫 칸 항목·안내 질문·보기 줄
  p = normalizeTablePayload({ headers: ['상황', '식', '계산 방법'], rowLabels: ['물 3컵에 2컵 더 붓기', '물 5컵에서 1컵 덜기'], hints: ['어떤 상황인가요?', '식으로 나타내 볼까요?', '어떻게 계산했나요?'], example: ['사과 2개에 1개 더 받기', '2 + 1', '2에서 1만큼 이어 세기'] });
  assert.deepEqual(p.headers, ['상황', '식', '계산 방법']);
  assert.equal(p.labelRows, 2);
  assert.equal(p.rows[0][0], '물 3컵에 2컵 더 붓기');
  assert.equal(p.rows[0][1], '');
  assert.equal(p.rows.length >= 3, true);
  assert.equal(p.hints[1], '식으로 나타내 볼까요?');
  assert.equal(p.example.length, 3);
  // 칸 수가 안 맞는 보기는 버린다
  assert.equal(normalizeTablePayload({ headers: ['가', '나'], example: ['하나'] }).example, null);
});

test('정리 도구는 드롭다운 목록으로 열리고(.qa-menu), 정리 도구는 버튼으로 열고, 저절로 펼치는 건 표·그림으로 정리하기를 고른 경우뿐이다(원리2)', () => {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  assert.ok(html.includes('class="qa-menu"'));
  // 저절로 펼치는 건 학습자가 '표·그림으로 정리하기'를 직접 고른 경우뿐이다
  const autos = [...html.matchAll(/requestStructured\([^)]*\{ auto:true \}\)/g)];
  assert.equal(autos.length, 1);
  assert.ok(/strat\.id==='organization'[\s\S]{0,300}auto:true/.test(html));
});

test('채팅 목록은 칩을 눌러 다시 그릴 때 스크롤을 맨 아래로 튕기지 않는다', () => {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const i = html.indexOf('function renderStream()');
  const body = html.slice(i, i + 3000);
  assert.ok(body.includes('wasNear') && body.includes('prevTop'));
});

test('안내 구체화: "오늘 배울 이 내용을" 같은 막연한 말을 오늘 목표 낱말로 바꾸고 조사를 맞춘다', () => {
  const t = '직육면체와 정육면체의 겉넓이';
  assert.equal(CS.concretize('그럼 오늘 배울 이 내용을 내 말로 먼저 설명해 볼래요?', t), '그럼 “직육면체와 정육면체의 겉넓이”를 내 말로 먼저 설명해 볼래요?');
  assert.equal(CS.concretize('이 내용은 어떤 순서로 공부하면 좋을까요?', '분수의 덧셈'), '“분수의 덧셈”은 어떤 순서로 공부하면 좋을까요?');
  assert.equal(CS.concretize('이 부분이 헷갈려요?', '일차방정식'), '“일차방정식”이 헷갈려요?');
  assert.equal(CS.concretize('이 내용에 대해 말해 줘요', '들이'), '“들이”에 대해 말해 줘요');
  assert.equal(CS.concretize('이 내용을 말해요', ''), '이 내용을 말해요');
  assert.ok(/구체적인 낱말/.test(CS.directiveRule()));
});

test('WP3-4 수학 기호 팔레트에 사칙·각·원주율 기호가 있다(전문가 6 재검증)', () => {
  const src = fs.readFileSync(ROOT + '/js/math-input.js', 'utf8');
  for (const sym of ['×', '÷', '±', 'π', '∠', '△']) assert.ok(src.includes(`s:'${sym}'`), sym);
});
