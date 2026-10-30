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
