/* 점수 표시 정규화·슬라이더 해석·발화 출처·소요시간·성장 기록 템플릿(순수 함수).
   학생 화면·내 공부방·교사 화면·CSV가 모두 이 함수를 거쳐 같은 값을 보여 준다(WP1-2).
   브라우저: window.CS.*, node·서버(api/teacher.js): globalThis.CS.* */
(function (root) {
  const CS = root.CS = root.CS || {};

  /* ---------- 스스로 점검(메타) 점수 정규화 (WP1-2) ---------- */
  const META_AXES = [
    { k: 'understand', label: '이해 점검', short: '이해', ind: ['헷갈리는 곳을 짚었어요', '까닭을 말했어요', '언제·어떻게 확인할지 말했어요'] },
    { k: 'strategy', label: '방법 알기', short: '방법', ind: ['구체적인 방법을 말했어요', '고른 까닭을 말했어요', '언제 쓰고 막히면 무엇으로 바꿀지 말했어요'] },
    { k: 'connect', label: '연결 짓기', short: '연결', ind: ['이어지는 예·개념을 들었어요', '같은 점을 밝혔어요', '다른 점·한계까지 짚었어요'] }
  ];
  // 판정 라벨이 아니라 "지금 한 행동"을 서술하는 3단계(불변조건 7)
  const LEVEL_LABELS = ['아직 낯설어요', '해 보는 중이에요', '잘 짚었어요'];
  function level3(score) {
    if (score == null || !Number.isFinite(+score)) return null;
    const s = +score;
    // 하위 지표 0개=아직 낯설어요, 1~2개(33·67)=해 보는 중이에요, 3개(100)=잘 짚었어요
    return s < 17 ? 0 : s < 84 ? 1 : 2;
  }
  function round(n) { return Math.round(n); }
  function metaScoreView(meta) {
    const m = meta || {};
    const d = m.scoreDetail || null;
    const I = m.indicators || null;
    const failed = !!(m.gradeFailed || (!d && (m.answers || m.raw)));
    if (!d) return { ok: false, failed, axes: [], avg: null, avgLevel: null };
    const axes = META_AXES.map(a => {
      const score = d[a.k] == null ? null : round(+d[a.k]);
      const ind = I && I[a.k] ? ['s', 'r', 'c'].map((x, i) => ({ label: a.ind[i], on: !!I[a.k][x] })) : [];
      const lv = level3(score);
      return { k: a.k, label: a.label, short: a.short, score, level: lv, levelLabel: lv == null ? '이번엔 채점하지 못했어요' : LEVEL_LABELS[lv], indicators: ind, quote: (m.scoreEvidence || {})[a.k] || '' };
    });
    const vals = axes.map(x => x.score).filter(x => x != null);
    const avg = vals.length ? round(vals.reduce((p, c) => p + c, 0) / vals.length) : null;
    return { ok: true, failed: false, axes, avg, avgLevel: level3(avg) };
  }
  // 사전 확인 문제(객관)와 자신감(주관) 비교 문장 — 스스로 점검 결과와 다른 이름·자리로 보인다(WP1-2 ③)
  function calibView(c) {
    if (!c) return null;
    const tone = Math.abs(c.gap) <= 20 ? 'match' : c.gap > 20 ? 'over' : 'under';
    const text = tone === 'match' ? '공부 전에 고른 자신감과 "사전 확인 문제" 결과가 비슷해요.'
      : tone === 'over' ? '공부 전에 고른 자신감이 "사전 확인 문제" 결과보다 높았어요. 안다고 느낀 부분을 한 번 더 확인해 봐요.'
        : '"사전 확인 문제" 결과가 공부 전에 고른 자신감보다 좋았어요. 생각보다 많이 알고 있어요.';
    return { tone, text, confPct: c.confPct, diag: c.diag };
  }

  /* ---------- 역할분담 슬라이더 (WP1-1) — 데이터 의미: 값 ≥ 50 = AI가 맡음(하위 호환) ---------- */
  function sliderLabel(v) {
    if (v >= 70) return 'AI가 많이';
    if (v >= 55) return 'AI가 조금 더';
    if (v > 45) return '반반';
    if (v >= 30) return '내가 조금 더';
    return '내가 많이';
  }
  const isAiSide = v => v == null || +v >= 50;
  function taskSplit(blocks, values, toggles) {
    const tb = values || {}, tg = toggles || {};
    const short = l => String(l).replace(/^(내가 |AI가 )/, '');
    const movable = blocks.filter(b => !b.fixed);
    return {
      aiMore: movable.filter(b => isAiSide(tb[b.id])).map(b => short(b.label)),
      meMore: movable.filter(b => !isAiSide(tb[b.id])).map(b => short(b.label)),
      aiAlways: blocks.filter(b => b.fixed === 'ai').map(b => short(b.label) + (tg[b.id] === false ? '(내가 먼저)' : '')),
      meAlways: blocks.filter(b => b.fixed === 'me').map(b => short(b.label)),
      // sysPrompt용(라벨 첫 낱말 제거 규칙은 기존 코드와 같음)
      aiTasks: blocks.filter(b => b.fixed === 'ai' || (!b.fixed && isAiSide(tb[b.id]))).map(b => b.label.replace(/^\S+\s/, '')),
      meTasks: blocks.filter(b => b.fixed === 'me' || (!b.fixed && tb[b.id] != null && !isAiSide(tb[b.id]))).map(b => b.label.replace(/^\S+\s/, ''))
    };
  }
  const PRESETS = Object.freeze({ ai: 80, half: 50, me: 25 });
  function applyPreset(blocks, values, preset) {
    const v = PRESETS[preset];
    if (v == null) return Object.assign({}, values);
    const out = Object.assign({}, values);
    blocks.filter(b => !b.fixed).forEach(b => { out[b.id] = v; });
    return out;
  }
  function presetOf(blocks, values) {
    const vals = blocks.filter(b => !b.fixed).map(b => values[b.id]);
    return Object.keys(PRESETS).find(k => vals.every(v => v === PRESETS[k])) || null;
  }

  /* ---------- 발화 출처 (WP1-5) ---------- */
  // src: 'typed'(학생이 직접 씀) | 'button'(버튼이 대신 보냄) | 'system'
  function srcOf(t, autoRe) {
    if (!t || t.role !== 'me') return null;
    if (t.src) return t.src;
    return (t.auto || (autoRe && autoRe.test(String(t.text || '').trim()))) ? 'button' : 'typed';
  }
  const isTypedTurn = (t, autoRe) => srcOf(t, autoRe) === 'typed';
  function migrateTurnsSrc(turns, autoRe) {
    return (turns || []).map(t => (t && t.role === 'me' && !t.src) ? Object.assign({}, t, { src: srcOf(t, autoRe) }) : t);
  }

  /* ---------- 단계별 소요시간 (WP0-3) ---------- */
  function phaseEnter(times, key, now) {
    const prev = (times || {})[key] || { enteredAt: null, leftAt: null, ms: 0, visits: 0 };
    return Object.assign({}, times, { [key]: Object.assign({}, prev, { enteredAt: now, leftAt: null, visits: (prev.visits || 0) + 1 }) });
  }
  function phaseLeave(times, key, now) {
    const prev = (times || {})[key];
    if (!prev || prev.enteredAt == null || prev.leftAt != null) return Object.assign({}, times);
    const add = Math.max(0, now - prev.enteredAt);
    return Object.assign({}, times, { [key]: Object.assign({}, prev, { leftAt: now, ms: (prev.ms || 0) + add }) });
  }
  function phaseSwitch(times, fromKey, toKey, now) {
    let t = Object.assign({}, times || {});
    if (fromKey === toKey) return t;
    if (fromKey) t = phaseLeave(t, fromKey, now);
    if (toKey) t = phaseEnter(t, toKey, now);
    return t;
  }
  function phaseMs(times, now) {
    const out = {};
    Object.entries(times || {}).forEach(([k, v]) => { out[k] = (v.ms || 0) + (v.enteredAt != null && v.leftAt == null && now ? Math.max(0, now - v.enteredAt) : 0); });
    return out;
  }
  const totalMs = (times, now) => Object.values(phaseMs(times, now)).reduce((a, b) => a + b, 0);
  function median(arr) {
    const v = (arr || []).filter(x => Number.isFinite(x)).slice().sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /* ---------- 도움 한 단계 더 (WP3-6) — 영구 변경 없이 2턴만 ---------- */
  const SUPPORT_ORDER = ['low', 'mid', 'high'];
  function effectiveSupport(support, boost, aiTurnCount) {
    if (!boost || aiTurnCount >= boost.untilAiTurn) return support;
    const i = SUPPORT_ORDER.indexOf(support);
    return SUPPORT_ORDER[Math.min(SUPPORT_ORDER.length - 1, (i < 0 ? 2 : i) + 1)];
  }
  function startBoost(aiTurnCount, turns) { return { fromAiTurn: aiTurnCount, untilAiTurn: aiTurnCount + (turns || 2) }; }

  /* ---------- 다음엔 이렇게 (WP5-3) ---------- */
  const NEXT_PLAN = {
    activate: ['rehearsal', 'monitoring'],
    understand: ['monitoring', 'elaboration'],
    strategy: ['organization', 'monitoring'],
    connect: ['elaboration', 'organization'],
    none: ['critical', 'elaboration']
  };
  function weakAxis(prior, meta) {
    const s = {};
    if (prior && prior.diagScore != null) s.activate = prior.diagScore;
    const d = meta && meta.scoreDetail;
    if (d) ['understand', 'strategy', 'connect'].forEach(k => { if (d[k] != null) s[k] = d[k]; });
    const e = Object.entries(s).sort((a, b) => a[1] - b[1]);
    return e.length && e[0][1] < 70 ? e[0][0] : 'none';
  }
  const nextPlanCandidates = (prior, meta) => NEXT_PLAN[weakAxis(prior, meta)].slice();

  /* ---------- 이번 공부 한눈에 (WP5-1) — 템플릿 문장, LLM 호출 없음 ---------- */
  function growthCard(s, band, stratLabel, autoRe) {
    const S = s || {};
    const easy = band === '초저';
    const strategies = (S.strategies || []).map(id => stratLabel(id)).filter(Boolean);
    const changes = (S.strategyChangeLog || []).length;
    const method = strategies.length
      ? (easy ? `"${strategies.join('", "')}" 방법으로 공부했어요.` : `"${strategies.join('", "')}" 방법을 썼어요.`) + (changes ? (easy ? ` 중간에 ${changes}번 바꿨어요.` : ` 공부하다가 방법을 ${changes}번 바꿔 봤어요.`) : '')
      : (easy ? '아직 방법을 고르지 않았어요.' : '이번에는 방법을 고르기 전에 멈췄어요.');
    const cps = (S.checkpoints || []).map(c => c.score).filter(x => x != null);
    const stuck = S.stuckCount || 0;
    const evals = (S.tasks || []).flatMap(t => t.evals || []);
    const lastEval = evals.length ? evals[evals.length - 1].level : null;
    let struggle;
    if (cps.length >= 2) {
      const a = cps[0], b = cps[cps.length - 1];
      struggle = b > a ? (easy ? `이해했다는 느낌이 ${a}점에서 ${b}점으로 올라갔어요.` : `이해도 체크가 ${a}점에서 ${b}점으로 올라갔어요.`)
        : b < a ? (easy ? `이해했다는 느낌이 ${a}점에서 ${b}점이 됐어요. 헷갈린 곳을 다시 봐요.` : `이해도 체크가 ${a}점에서 ${b}점으로 내려갔어요. 어디서 헷갈렸는지 대화에서 찾아봐요.`)
          : (easy ? `이해했다는 느낌이 ${a}점으로 같았어요.` : `이해도 체크가 ${a}점으로 비슷했어요.`);
    } else if (cps.length === 1) struggle = `이해도 체크는 한 번 했고 ${cps[0]}점이었어요.`;
    else struggle = '이해도 체크는 아직 안 했어요.';
    if (stuck) struggle += lastEval != null && lastEval >= 1 ? ` "막혔어요"를 ${stuck}번 누른 뒤 다시 해 봤어요.` : ` "막혔어요"를 ${stuck}번 눌렀어요.`;
    const mine = (S.turns || []).filter(t => t.role === 'me' && srcOf(t, autoRe) === 'typed');
    const tags = (S.reflect && S.reflect.tags) || {};
    const selfN = mine.filter(t => tags[t.id] ? tags[t.id] === 'self' : !t.delegate).length;
    const aiN = mine.length - selfN;
    const help = (S.helpRequests || []).length;
    const sup = { high: '많이', mid: '보통', low: '조금' };
    const startSup = S.supportStart || 'high', endSup = S.support || startSup;
    let aiHelp = mine.length ? (easy ? `내가 먼저 생각한 말 ${selfN}개, AI에게 맡긴 말 ${aiN}개예요.` : `내가 주도한 말 ${selfN}개, AI에게 맡긴 말 ${aiN}개였어요.`) : '아직 내가 보낸 말이 없어요.';
    if (help) aiHelp += ` 도움을 더 달라고 ${help}번 했어요.`;
    aiHelp += startSup !== endSup ? ` AI 도움은 "${sup[startSup]}"에서 "${sup[endSup]}"으로 줄었어요.` : ` AI 도움은 "${sup[endSup]}"으로 이어졌어요.`;
    return { method, struggle, aiHelp };
  }

  Object.assign(CS, {
    META_AXES, LEVEL_LABELS, level3, metaScoreView, calibView,
    sliderLabel, isAiSide, taskSplit, PRESETS, applyPreset, presetOf,
    srcOf, isTypedTurn, migrateTurnsSrc,
    phaseEnter, phaseLeave, phaseSwitch, phaseMs, totalMs, median,
    effectiveSupport, startBoost, weakAxis, nextPlanCandidates, growthCard
  });
})(typeof window !== 'undefined' ? window : globalThis);
