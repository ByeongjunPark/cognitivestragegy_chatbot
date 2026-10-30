import test from 'node:test';
import assert from 'node:assert/strict';
import { CS } from './_load.mjs';

const BLOCKS = [
  { id: 'find_ref', label: '필요한 자료 찾아주기', fixed: 'ai', toggleDefault: true },
  { id: 'reflect_method', label: '내가 어떻게 공부하는지 돌아보기', fixed: 'me' },
  { id: 'define_problem', label: '문제가 뭔지 명확히 정하기', fixed: null, def: 50 },
  { id: 'explain_result', label: '내가 만든 것 설명하기', fixed: null, def: 50 },
  { id: 'draft_first', label: '과제 초안 먼저 써보기', fixed: null, def: 30 }
];

test('WP1-1 슬라이더: 값 → 라벨 → 요약 → 시스템 프롬프트 aiTasks 세 경로가 같은 담당을 말한다', () => {
  for (const v of [0, 20, 40, 50, 60, 80, 100]) {
    const vals = { define_problem: v, explain_result: 50, draft_first: 30 };
    const sp = CS.taskSplit(BLOCKS, vals, {});
    const label = CS.sliderLabel(v);
    assert.equal(sp.aiMore.some(x => x.includes('문제가 뭔지')), v >= 50, 'summary v=' + v);
    assert.equal(sp.aiTasks.some(x => x.includes('뭔지')), v >= 50, 'prompt v=' + v);
    if (v !== 50) assert.equal(/^AI/.test(label), v >= 50, 'label v=' + v + ' ' + label);
  }
  assert.equal(CS.sliderLabel(100), 'AI가 많이');   // 오른쪽 끝 = AI (화면 라벨 오른쪽 "AI가 맡아요"와 일치)
  assert.equal(CS.sliderLabel(0), '내가 많이');
});

test('WP1-1 프리셋 3종이 값과 요약에 그대로 반영되고, 개별 조정이 가능하다', () => {
  for (const [k, v] of Object.entries(CS.PRESETS)) {
    const vals = CS.applyPreset(BLOCKS, { define_problem: 50, explain_result: 50, draft_first: 30 }, k);
    assert.ok(['define_problem', 'explain_result', 'draft_first'].every(id => vals[id] === v));
    assert.equal(CS.presetOf(BLOCKS, vals), k);
    assert.equal(CS.taskSplit(BLOCKS, vals, {}).aiMore.length, v >= 50 ? 3 : 0);
    assert.equal(CS.presetOf(BLOCKS, Object.assign({}, vals, { draft_first: 10 })), null);
  }
});

test('WP1-1 저장된 세션 하위 호환: 값이 없으면(옛 기록) AI 담당으로 읽던 규칙 그대로', () => {
  assert.ok(CS.taskSplit(BLOCKS, {}, {}).aiTasks.some(x => x.includes('뭔지')));
});

test('WP1-2 metaScoreView: 모든 화면이 같은 값을 보고, 채점 실패는 0이 아니라 null', () => {
  const meta = { scoreDetail: { understand: 33, strategy: 67, connect: 100 }, indicators: { understand: { s: 1, r: 0, c: 0 }, strategy: { s: 1, r: 1, c: 0 }, connect: { s: 1, r: 1, c: 1 } } };
  const a = CS.metaScoreView(meta), b = CS.metaScoreView(JSON.parse(JSON.stringify(meta)));
  assert.deepEqual(a, b);
  assert.deepEqual(a.axes.map(x => x.score), [33, 67, 100]);
  assert.deepEqual(a.axes.map(x => x.level), [1, 1, 2]);
  assert.equal(a.avg, 67);
  assert.equal(a.axes[0].indicators.filter(x => x.on).length, 1);
  const failed = CS.metaScoreView({ answers: { understand: '몰라' }, gradeFailed: true });
  assert.equal(failed.ok, false); assert.equal(failed.failed, true); assert.equal(failed.avg, null);
  const cv = CS.calibView({ confPct: 75, diag: 88, gap: -13 });
  assert.ok(cv.text.includes('사전 확인 문제') && !cv.text.includes('스스로 점검'));
});

test('WP1-2 3단계 라벨은 판정이 아니라 행동 서술', () => {
  assert.deepEqual(CS.LEVEL_LABELS, ['아직 낯설어요', '해 보는 중이에요', '잘 짚었어요']);
  assert.equal(CS.level3(null), null);
  assert.equal(CS.level3(0), 0); assert.equal(CS.level3(33), 1); assert.equal(CS.level3(67), 1); assert.equal(CS.level3(100), 2);
});

test('WP1-5 발화 출처: 버튼 경로 5종은 되짚기 목록에서 빠지고, 직접 입력은 들어간다', () => {
  const AUTO = /^\(.+\)$|^다 했어\. 봐줄래\?$|^다시 고쳤어\. 이제 어때\?$|^지금 막혔어\. 어디서 막혔는지 같이 점검해줘\.$|^".+" 방법으로 해볼게\.$/;
  const turns = [
    { role: 'me', text: '(표로 정리하기)', src: 'button' },
    { role: 'me', text: '다 했어요. 봐 줄래요?', src: 'button' },
    { role: 'me', text: '지금 막혔어요.', src: 'button' },
    { role: 'me', text: '"표로 정리하기" 방법으로 해 볼게요.', src: 'button' },
    { role: 'me', text: '오늘 내용에 잘 맞아 보여서', src: 'button' },
    { role: 'me', text: '분모를 같게 하면 되나요?', src: 'typed' }
  ];
  assert.deepEqual(turns.filter(t => CS.isTypedTurn(t, AUTO)).map(t => t.text), ['분모를 같게 하면 되나요?']);
  const old = [{ role: 'me', text: '다 했어. 봐줄래?' }, { role: 'me', text: '통분이 뭐야?' }, { role: 'ai', text: 'x' }];
  const mig = CS.migrateTurnsSrc(old, AUTO);
  assert.deepEqual(mig.map(t => t.src), ['button', 'typed', undefined]);
  assert.notEqual(mig[0], old[0]);
});

test('WP0-3 단계별 소요시간: 들어오고 나가며 합산, 다시 들어오면 누적', () => {
  let t = {};
  t = CS.phaseSwitch(t, null, 'activate', 0);
  t = CS.phaseSwitch(t, 'activate', 'meta', 60000);
  t = CS.phaseSwitch(t, 'meta', 'activate', 90000);
  t = CS.phaseSwitch(t, 'activate', 'explore', 120000);
  const ms = CS.phaseMs(t, 150000);
  assert.equal(ms.activate, 90000); assert.equal(ms.meta, 30000); assert.equal(ms.explore, 30000);
  assert.equal(CS.totalMs(t, 150000), 150000);
  assert.equal(CS.median([3, 1, 2]), 2); assert.equal(CS.median([]), null);
});

test('WP3-6 한 단계 더 도와줘: 2턴만 올리고 3턴째에 원래 단계로', () => {
  const boost = CS.startBoost(5, 2);
  assert.equal(CS.effectiveSupport('low', boost, 5), 'mid');
  assert.equal(CS.effectiveSupport('low', boost, 6), 'mid');
  assert.equal(CS.effectiveSupport('low', boost, 7), 'low');
  assert.equal(CS.effectiveSupport('high', boost, 5), 'high');
});

test('WP2-1 모드: 한 차시는 선다 1 + 서술 1, 시간 예산 40분 이내', () => {
  const c = CS.modeCfg('class40');
  assert.deepEqual(c.diagTags, ['예시', '설명']);
  assert.equal(CS.resolveMode('?mode=full', null), 'full');
  assert.equal(CS.resolveMode('', 'full'), 'full');
  assert.equal(CS.resolveMode('', null), 'class40');
  assert.ok(Object.values(c.budgetMin).reduce((a, b) => a + b, 0) <= 40);
});

test('WP5-1 이번 공부 한눈에: 데이터가 비어도 깨지지 않고, 학년군별 문장', () => {
  const empty = CS.growthCard({}, '초저', () => '', null);
  assert.ok(empty.method && empty.struggle && empty.aiHelp);
  const s = { strategies: ['organization'], strategyChangeLog: [{}], checkpoints: [{ score: 2 }, { score: 4 }], stuckCount: 1, tasks: [{ evals: [{ level: 1 }] }],
    turns: [{ id: 'a', role: 'me', src: 'typed' }, { id: 'b', role: 'me', src: 'typed', delegate: true }, { id: 'c', role: 'me', src: 'button' }], helpRequests: [{}], supportStart: 'high', support: 'mid', reflect: { tags: {} } };
  const g1 = CS.growthCard(s, '초저', () => '표로 정리하기', null), g2 = CS.growthCard(s, '중고', () => '표로 정리하기', null);
  assert.ok(g1.struggle.includes('2점에서 4점'));
  assert.ok(g2.aiHelp.includes('주도한 말 1개'));
  assert.notEqual(g1.method, g2.method);
});

test('WP5-3 다음엔 이렇게: 약한 축에 맞춘 방법 2개', () => {
  const ids = CS.nextPlanCandidates({ diagScore: 90 }, { scoreDetail: { understand: 100, strategy: 100, connect: 33 } });
  assert.equal(ids.length, 2); assert.ok(ids.includes('elaboration'));
});
