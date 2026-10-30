/* 수업 모드·분량·간격 설정을 한 곳에 모은다(전문가 평가 WP2-1·2-5·2-6, 하드코딩 금지).
   브라우저에서는 window.CS.MODE_CFG, node 테스트에서는 globalThis.CS.MODE_CFG 로 쓴다.
   숫자는 초기 제안값이며 phaseTimes(WP0-3) 측정으로 보정한다. */
(function (root) {
  const CS = root.CS = root.CS || {};

  // 🔶 연구진 결정(WP2-1): 기본 모드 = 한 차시(40분). ?mode=full 또는 교사 링크로 바꾼다.
  const DEFAULT_MODE = 'class40';

  const MODE_CFG = Object.freeze({
    class40: Object.freeze({
      label: '한 차시(40분)',
      // 사전·사후는 같은 유형·같은 개수(원리13 평행 문항). 선다 1 + 서술 1.
      diagTags: Object.freeze(['예시', '설명']),
      metaOneScreen: true,          // 스스로 점검: 한 화면에 평소 공부법 + 이해·전략·연결 3행(구별 유지, 원리7)
      checkpoint: Object.freeze({ minGap: 6, maxPerSession: 2 }),
      exploreTurnCap: 8,            // 탐구 대화 약 8턴 뒤 마무리를 권한다(막지는 않는다). 시범 운용 1차: 10턴이면 초등 타자 속도로 약 49분 → 8턴으로 보정
      reflectOneScreen: true,       // 되짚기 가·나를 한 화면에, 서술은 1개만 필수
      required: Object.freeze({ reflectTags: false, promptRatings: false, reflectNotes: 1, checkpointReasonText: false }),
      budgetMin: Object.freeze({ start: 5, activate: 4, meta: 4, pick: 3, explore: 15, reflect: 5, residual: 4 }),
      verify: Object.freeze({ 과학: true, 사회: false, 수학: false })
    }),
    full: Object.freeze({
      label: '자세히(전체)',
      diagTags: Object.freeze(['기억', '예시', '설명', '적용']),
      metaOneScreen: false,
      checkpoint: Object.freeze({ minGap: 1, maxPerSession: 99 }), // 기존 동작(당기면 바로 다음 턴)
      exploreTurnCap: 0,            // 0 = 제한 없음(기존 동작)
      reflectOneScreen: false,
      required: Object.freeze({ reflectTags: true, promptRatings: true, reflectNotes: 2, checkpointReasonText: false }),
      budgetMin: Object.freeze({ start: 5, activate: 8, meta: 8, pick: 4, explore: 25, reflect: 10, residual: 10 }),
      verify: Object.freeze({ 과학: true, 사회: false, 수학: false })
    })
  });

  // WP2-5: 학년군별 AI 응답 상한(문장 수·글자 수). 학년 문자열 → 군.
  const CAP = Object.freeze({
    lo:  Object.freeze({ sentences: 2, chars: 120, label: '초등 3~4학년' }),
    mid: Object.freeze({ sentences: 3, chars: 180, label: '초등 5~6학년' }),
    hi:  Object.freeze({ sentences: 4, chars: 260, label: '중·고등학생' })
  });
  function capBand(grade) {
    const g = String(grade || '');
    if (/중학|고등/.test(g)) return 'hi';
    if (/[5-6]\s*학년|5~6|5-6/.test(g)) return 'mid';
    if (/[3-4]\s*학년|3~4|3-4/.test(g)) return 'lo';
    return 'mid';
  }
  // 학년 → 안내 문구 3벌 키(WP4-3)
  function uiBand(grade) {
    const b = capBand(grade);
    return b === 'lo' ? '초저' : b === 'mid' ? '초고' : '중고';
  }

  function resolveMode(search, stored) {
    let q = null;
    try { q = new URLSearchParams(search || '').get('mode'); } catch (e) { q = null; }
    if (q && MODE_CFG[q]) return q;
    if (stored && MODE_CFG[stored]) return stored;
    return DEFAULT_MODE;
  }
  function modeCfg(mode) { return MODE_CFG[mode] || MODE_CFG[DEFAULT_MODE]; }

  // 진행 단계(WP2-2). 화면·상태 → 단계 키. 모드가 바뀌어도 단계 수는 같다.
  const STEPS = Object.freeze([
    { k: 'start',    t: '배울 것 정하기',   budget: 'start' },
    { k: 'activate', t: '아는 것 확인',     budget: 'activate' },
    { k: 'meta',     t: '스스로 점검',      budget: 'meta' },
    { k: 'pick',     t: '공부 방법 고르기', budget: 'pick' },
    { k: 'explore',  t: '방법대로 해 보기', budget: 'explore' },
    { k: 'reflect',  t: '돌아보기',         budget: 'reflect' },
    { k: 'residual', t: '혼자 풀어보기',    budget: 'residual' },
    { k: 'journal',  t: '마지막 글',        budget: null }
  ]);
  function remainingMinutes(mode, stepKey, elapsedInStepMs) {
    const cfg = modeCfg(mode);
    const i = STEPS.findIndex(s => s.k === stepKey);
    if (i < 0) return null;
    let min = 0;
    for (let k = i; k < STEPS.length; k++) {
      const b = STEPS[k].budget ? cfg.budgetMin[STEPS[k].budget] : 1;
      if (k === i) min += Math.max(0, b - (elapsedInStepMs || 0) / 60000);
      else min += b;
    }
    return Math.max(1, Math.round(min));
  }

  Object.assign(CS, { DEFAULT_MODE, MODE_CFG, CAP, capBand, uiBand, resolveMode, modeCfg, STEPS, remainingMinutes });
})(typeof window !== 'undefined' ? window : globalThis);
