import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { CS, ROOT } from './_load.mjs';
const fx = JSON.parse(fs.readFileSync(ROOT + '/tests/fixtures/broken-sentences.json', 'utf8'));

test('WP1-4 looksBroken: 깨진 문장 10개는 모두 잡고, 정상 문장 10개는 하나도 잡지 않는다', () => {
  fx.broken.forEach(s => assert.equal(CS.looksBroken(s).broken, true, s));
  fx.normal.forEach(s => assert.equal(CS.looksBroken(s).broken, false, s + ' ' + CS.looksBroken(s).reasons));
});

test('WP1-4 해요체 변환: 흔한 반말 종결을 해요체로, 호칭 "너/네가"는 뺀다', () => {
  const cases = [
    ['좋아, 바로 해 보자.', '좋아, 바로 해 봐요.'],
    ['네가 먼저 해 볼래?', '먼저 해 볼래요?'],
    ['이건 분모야.', '이건 분모예요.'],
    ['그럼 어떻게 될까?', '그럼 어떻게 될까요?'],
    ['잘 짚었어.', '잘 짚었어요.'],
    ['이유도 말해 줘.', '이유도 말해 줘요.'],
    ['그건 중요한 거야.', '그건 중요한 거예요.']
  ];
  cases.forEach(([a, b]) => assert.equal(CS.toHaeyo(a), b));
  assert.equal(CS.toneProfile('좋아요. 다시 해 봐요?').banmal, 0);
  assert.equal(CS.isMixedTone('좋아요. 다시 해 봐.'), true);
});

test('WP2-5 학년군 상한: 문장·글자 수를 넘지 않고, 마지막 질문은 지킨다', () => {
  const long = '좋아요, 잘했어요. 분모를 같게 만들었네요. 통분은 중요해요. 최소공배수를 찾았어요. 계산도 맞았어요. 그럼 다음에는 무엇을 해 볼까요?';
  for (const band of ['lo', 'mid', 'hi']) {
    const cap = CS.CAP[band];
    const out = CS.capSentences(long, cap);
    assert.ok(CS.splitSentences(out).length <= cap.sentences, band + ': ' + out);
    assert.ok(out.length <= Math.round(cap.chars * 1.15), band + ' 길이 ' + out.length);
    assert.ok(/무엇을 해 볼까요\?$/.test(out), '질문 유지: ' + out);
    assert.equal(CS.overCap(out, cap), false);
  }
  assert.equal(CS.capBand('초등학교 3학년'), 'lo');
  assert.equal(CS.capBand('초등학교 6학년'), 'mid');
  assert.equal(CS.capBand('중학교 2학년'), 'hi');
});

test('WP2-5 질문은 1개만(마지막 질문을 남김)', () => {
  const t = '어떻게 생각해요? 좋은 시도예요. 그럼 분모는 몇일까요?';
  assert.equal(CS.countQuestions(CS.keepOneQuestion(t)), 1);
  assert.ok(CS.keepOneQuestion(t).endsWith('분모는 몇일까요?'));
});

test('WP1-3 "아래에서 골라" 문구 → 위젯 필요 판정과 중립 문구 대체', () => {
  ['아래에서 하나 골라 줄래요?', '아래 카드에서 방법을 골라 봐요.', '위에 있는 버튼을 눌러 줘요.', '보기 중에서 하나 선택해 봐요.'].forEach(s => assert.equal(CS.needsWidget(s), true, s));
  ['어떤 방법이 좋을까요?', '분모를 골고루 나눠요.', '아래로 내려가면 값이 작아져요.'].forEach(s => assert.equal(CS.needsWidget(s), false, s));
  const out = CS.neutralizeWidgetRef('좋아요. 아래에서 하나 골라 줄래요?', '어떻게 생각하는지 말해 줄래요?');
  assert.equal(CS.needsWidget(out), false);
  assert.ok(out.includes('좋아요.') && out.endsWith('말해 줄래요?'));
});

test('WP3-1 추궁형 질문 금지 목록과 부드러운 대체', () => {
  const banned = ['왜 그렇게 말했어?', '왜 그렇게 생각했니?', '왜 그랬어?', '그 이유가 뭐야?', '진짜 그렇게 생각해?'];
  banned.forEach(s => assert.equal(CS.hasBannedProbe(s), true, s));
  ['어떤 점 때문에 그렇게 생각했어요?', '그렇게 생각한 까닭을 골라 볼래요?', '왜 분모를 같게 해야 할까요?'].forEach(s => assert.equal(CS.hasBannedProbe(s), false, s));
  assert.equal(CS.hasBannedProbe(CS.softenProbes('좋아요. 왜 그렇게 말했어?')), false);
  assert.ok(CS.hasAck('좋은 생각이에요. 어떤 점 때문에 그런지 알려 줄래요?'));
});

test('WP3-1 예상 밖 답변 분류', () => {
  assert.equal(CS.classifyOffScript('몰라'), 'dontknow');
  assert.equal(CS.classifyOffScript('하기 싫어'), 'refuse');
  assert.equal(CS.classifyOffScript('ㅋㅋㅋ 메롱'), 'joke');
  assert.equal(CS.classifyOffScript('오늘 급식 떡볶이였어', ['분수', '통분']), 'chitchat');
  assert.equal(CS.classifyOffScript('통분이 뭐야?'), 'question');
  assert.equal(CS.classifyOffScript('분모를 같게 했어요'), null);
});

test('WP3-3 교과 용어 규칙: 남중 고도 픽스처(높다·낮다, 길다·짧다)', () => {
  const nj = JSON.parse(fs.readFileSync(ROOT + '/tests/fixtures/science-namjung.json', 'utf8'));
  nj.synthetic.forEach(c => {
    assert.equal(CS.termViolations(c.text, '과학').length, c.violations, c.text);
    const fixed = CS.fixTerms(c.text, '과학');
    assert.equal(fixed, c.fixed);
    assert.equal(CS.termViolations(fixed, '과학').length, 0, fixed);
  });
});

test('WP1-6 정답 단서 노출 검사: 노출 5개 / 비노출 5개', () => {
  const mk = (q, key, opts) => ({ type: 'mcq', q, key, options: opts || [key, '가', '나', '다'] });
  const tx = (q, full) => ({ type: 'text', q, rubric: { full, partial: '' } });
  const leaking = [
    [mk('분모가 다른 분수를 더할 때 먼저 하는 일은?', '통분'), tx('통분을 하는 까닭을 설명하세요.', '분모를 같게 해야 크기를 더할 수 있다')],
    [mk('남중 고도가 가장 높은 계절은?', '여름'), mk('여름에 낮의 길이는 어떤가요?', '길다')],
    [mk('광합성이 일어나는 곳은?', '엽록체'), tx('엽록체에서 일어나는 일을 쓰세요.', '빛에너지로 양분을 만든다')],
    [tx('통분하는 방법을 설명하세요.', '최소공배수로 분모를 같게 만든다'), mk('최소공배수를 이용하는 계산은?', '통분')],
    [mk('4·19 혁명이 일어난 해는?', '1960년'), tx('1960년에 일어난 일의 의미를 쓰세요.', '독재에 맞선 민주주의 운동')]
  ];
  const clean = [
    [mk('분모가 다른 분수를 더할 때 먼저 하는 일은?', '통분'), tx('3/4과 1/6의 합을 구하는 과정을 설명하세요.', '분모를 12로 맞춘다')],
    [mk('남중 고도가 가장 높은 계절은?', '여름'), mk('그림자가 가장 짧을 때는 언제인가요?', '정오 무렵')],
    [mk('식물이 양분을 만드는 과정은?', '광합성'), tx('잎이 초록색인 까닭을 쓰세요.', '엽록소가 있다')],
    // (주의) "삼각형 세 각의 합" + "사각형 = 삼각형 두 개"는 실제 풀이 단서라 노출로 잡히는 게 맞다 — 겹치지 않는 문항으로 둔다
    [mk('삼각형 세 각의 합은?', '180도'), tx('직사각형의 넓이를 구하는 방법을 쓰세요.', '가로와 세로를 곱한다')],
    [mk('민주주의의 뜻으로 알맞은 것은?', '국민이 주인인 정치'), tx('선거가 중요한 까닭을 쓰세요.', '대표를 뽑아 뜻을 전한다')]
  ];
  leaking.forEach((set, i) => assert.ok(CS.leaksAnswer(set).length > 0, '노출 ' + i));
  clean.forEach((set, i) => assert.equal(CS.leaksAnswer(set).length, 0, '비노출 ' + i + ' ' + JSON.stringify(CS.leaksAnswer(set))));
});

test('WP3-5 탐구 범위 판정(LLM 없이 낱말 일치)', () => {
  const scope = CS.scopeTokensFrom('계절에 따른 태양의 남중 고도와 낮의 길이 사이의 관계를 자료에 근거하여 추론할 수 있다.', '', '');
  assert.equal(CS.scopeVerdict('여름에 남중 고도가 왜 높아요?', scope), 'in');
  assert.equal(CS.scopeVerdict('어제 축구 경기 결과 알려줘', scope), 'out');
  assert.equal(CS.scopeVerdict('응', scope), 'skip');
});

test('WP3-2 넓은 학습 목표 판정', () => {
  assert.equal(CS.isBroadGoal('수학'), true);
  assert.equal(CS.isBroadGoal('과학 공부'), true);
  assert.equal(CS.isBroadGoal('분모가 다른 분수를 더하는 방법을 알고 싶어요'), false);
});

test('WP3-4 풀이 단계 파싱', () => {
  assert.deepEqual(CS.parseSteps('1단계: 2/3=8/12 / 2단계: 1/4=3/12 / 3단계: 11/12'), ['2/3=8/12', '1/4=3/12', '11/12']);
  assert.deepEqual(CS.parseSteps('그냥 답은 11/12'), []);
});
