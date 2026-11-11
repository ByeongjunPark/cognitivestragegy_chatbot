/* 점수 표시 정규화·슬라이더 해석·발화 출처·소요시간·성장 기록 템플릿(순수 함수).
   학생 화면·내 공부방이 모두 이 함수를 거쳐 같은 값을 보여 준다(WP1-2).
   브라우저: window.CS.*, node(tests/*.mjs): globalThis.CS.* */
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
    const failed = !!(m.gradeFailed || (!d && !m.skipped && (m.answers || m.raw)));
    if (!d) return { ok: false, failed, skipped: !!m.skipped, axes: [], avg: null, avgLevel: null };
    const axes = META_AXES.map(a => {
      const score = d[a.k] == null ? null : round(+d[a.k]);
      const ind = m.indLabels && m.indLabels[a.k] ? m.indLabels[a.k].map(x => ({ label: String(x.label), on: !!x.on }))
        : I && I[a.k] ? ['s', 'r', 'c'].map((x, i) => ({ label: a.ind[i], on: !!I[a.k][x] })) : [];
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

  /* ---------- 스스로 점검 v3: 응답 내용이 아니라 수행으로 재는 점수 ----------
     이해 점검 = 아는 것 확인 문항마다 고른 자신감(맞을 것 같다/모르겠다)이 실제 채점 결과와 맞은 비율(모니터링 정확도)
     방법 알기 = 상황 2개에 알맞은 공부 방법을 고른 비율(조건적 지식)
     연결 짓기 = 오늘 내용의 바탕 개념을 고르기(1) + 같은 점을 개념에 맞게 말하기(1) */
  function metaTaskScore(input) {
    const inp = input || {};
    const items = (inp.items || []).map((it, i) => ({ it, i })).filter(x => x.it && x.it.conf != null && x.it.score != null);
    const agree = items.map(x => (+x.it.conf === 1) === (+x.it.score >= 50));
    const understand = items.length ? round(agree.filter(Boolean).length / items.length * 100) : null;
    const sc = inp.scenarios || [];
    const sOk = sc.map(x => x.pick != null && x.pick === x.key);
    const strategy = sc.length ? round(sOk.filter(Boolean).length / sc.length * 100) : null;
    const c = inp.connect || {};
    const hasOpt = Array.isArray(c.options) && c.key != null;
    const pickOk = hasOpt && c.pick != null && +c.pick === +c.key;
    let connect;
    if (hasOpt) connect = c.relOk == null ? (pickOk ? 50 : 0) : round(((pickOk ? 1 : 0) + (c.relOk ? 1 : 0)) / 2 * 100);
    else connect = c.relOk == null ? null : (c.relOk ? 100 : 0);
    return {
      detail: { understand, strategy, connect },
      indLabels: {
        understand: items.map((x, j) => ({ label: `${x.i + 1}번 ${+x.it.conf === 1 ? '자신 있음' : '헷갈림'} → ${+x.it.score >= 50 ? '맞음' : '아직'}`, on: agree[j] })),
        strategy: sc.map((x, j) => ({ label: x.short || `상황 ${j + 1}`, on: sOk[j] })),
        connect: hasOpt ? [{ label: '이어지는 것 고르기', on: pickOk }, { label: '같은 점 말하기', on: !!c.relOk }] : [{ label: '이어지는 것과 같은 점 말하기', on: !!c.relOk }]
      }
    };
  }

  /* ---------- 지난 공부와 이어 주기 ----------
     지난 공부에서 남긴 것(다짐 한 문장, 어려웠던 점, 다음 계획, 궁금했던 것, 점수 변화)을 골라 다음 공부의 시작·대화에 잇는다.
     같은 과목 기록이 있으면 그것을, 없으면 가장 최근 기록을 쓴다. 비교·평가 없이 내 기록만. */
  function prevLink(sessions, subject) {
    const S = (sessions || []).filter(x => !x.incomplete && !x.practice && !x.isSample && x.ctx)
      .sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')));
    if (!S.length) return null;
    const same = S.filter(x => subject && x.ctx.subject === subject);
    const s = (same.length ? same : S)[(same.length ? same : S).length - 1];
    const evs = (s.tasks || []).flatMap(t => t.evals || []);
    const last = evs[evs.length - 1] || null;
    const errs = evs.map(e => e.errorType).filter(e => e && e !== '특별한 착오 없음');
    const r = s.reflect || {};
    return {
      id: s.id || null, date: String(s.startedAt || '').slice(0, 10), subject: s.ctx.subject, subjKey: s.ctx.subjKey || s.ctx.subject, code: s.ctx.code || '', grade: s.ctx.grade || '', area: s.ctx.area || '',
      std: s.ctx.std, goal: s.goal || '', sameSubject: !!same.length,
      strategies: (s.strategies || []).slice(), promise: String(r.note || r.noteA || '').trim(), journal: String((s.residual && s.residual.journal) || '').trim(),
      hard: last && last.missing && last.missing[0] ? String(last.missing[0]) : '', errorType: errs[errs.length - 1] || '',
      plan: s.nextPlan || null, planWhy: s.nextPlanWhy || '', wonder: s.wonder || '',
      pre: s.prior && s.prior.diagScore != null ? s.prior.diagScore : null, post: s.residual && s.residual.postScore != null ? s.residual.postScore : null,
      postDeferred: !!(s.residualDeferred && !(s.residual && s.residual.result))
    };
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
  const PRESETS = Object.freeze({ ai: 80, half: 50, me: 20 }); // 막대가 10 단위로 움직이므로 프리셋도 10 단위
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

  /* ---------- 점검 결과 → 전략 조정 (WP5-3 재설계, 전문가5 "점검 결과를 전략 조정과 재시도로") ----------
     해 보기 동안 방법별 과업 진단(성공 기준 충족 수준·착오 유형)을 근거로, 계속할지·바꿀지 추천과 까닭을 낸다.
     고르는 것은 학습자(원리2). 착오 유형 → 그 착오를 다루는 방법(Weinstein & Mayer 분류). */
  const ERR_TO_STRAT = {
    '개념을 잘못 이해함': ['elaboration', 'critical'],
    '비슷한 낱말·개념을 헷갈림': ['organization', 'elaboration'],
    '순서·단계를 헷갈림': ['organization', 'rehearsal'],
    '근거가 부족함': ['critical', 'elaboration'],
    '일부를 빠뜨림': ['monitoring', 'organization'],
    '계산·표기 실수': ['monitoring', 'rehearsal']
  };
  const ERR_KID = {
    '개념을 잘못 이해함': '뜻을 다르게 이해한 곳이 있었어요',
    '비슷한 낱말·개념을 헷갈림': '비슷한 것끼리 헷갈린 곳이 있었어요',
    '순서·단계를 헷갈림': '순서를 헷갈린 곳이 있었어요',
    '근거가 부족함': '까닭(근거)이 부족한 곳이 있었어요',
    '일부를 빠뜨림': '빠뜨린 곳이 있었어요',
    '계산·표기 실수': '작은 실수가 있었어요',
    '전략을 쓰지 않고 답만 씀': '방법을 쓰지 않고 답만 쓴 적이 있었어요'
  };
  const STRAT_PURPOSE = {
    rehearsal: '안 보고 떠올리며 기억을 다지는 방법이에요',
    elaboration: '아는 것·예와 이어서 뜻을 잡는 방법이에요',
    organization: '표나 그림으로 나누어 짜임새를 보는 방법이에요',
    critical: '근거를 따져 보는 방법이에요',
    monitoring: '빠뜨린 곳이 없는지 스스로 확인하는 방법이에요'
  };
  const LV_KID = ['아직 많이 남음', '일부 해냄', '대부분 해냄'];
  function strategyReview(sess) {
    const S = sess || {};
    const used = (S.strategies || []).slice();
    const per = used.map(id => {
      const evs = (S.tasks || []).filter(t => t.stratId === id).flatMap(t => t.evals || []);
      const last = evs[evs.length - 1] || null;
      return { id, n: evs.length, levels: evs.map(e => e.level), flow: evs.map(e => LV_KID[e.level] || '-').join(' → '), fix: last && last.missing && last.missing[0] || '' };
    });
    const evAll = (S.tasks || []).flatMap(t => (t.evals || []).map(e => Object.assign({ stratId: t.stratId }, e)));
    const avg = evAll.length ? evAll.reduce((a, e) => a + e.level, 0) / evAll.length / 2 * 100 : null;
    const cnt = {};
    evAll.forEach(e => { if (e.errorType && e.errorType !== '특별한 착오 없음') cnt[e.errorType] = (cnt[e.errorType] || 0) + 1; });
    const err = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || null;
    const bestUsed = per.slice().sort((a, b) => (b.levels.reduce((x, y) => x + y, 0) / (b.n || 1)) - (a.levels.reduce((x, y) => x + y, 0) / (a.n || 1)))[0];
    let rec = null, reason = '', keep = false;
    if (!evAll.length) {
      rec = used[0] || null; keep = !!rec;
      reason = '이번엔 과업을 끝까지 해 본 결과가 없어요. 같은 방법으로 한 번 더 해 보면 맞는지 알 수 있어요.';
    } else if (avg >= 75 || !err) {
      rec = bestUsed ? bestUsed.id : null; keep = true;
      reason = '과업을 대부분 해냈어요. 나에게 잘 맞는 방법이에요.';
    } else if (err === '전략을 쓰지 않고 답만 씀') {
      rec = bestUsed ? bestUsed.id : null; keep = true;
      reason = `${ERR_KID[err]}. 같은 방법을 끝까지 써 보면 효과를 알 수 있어요.`;
    } else {
      const cands = ERR_TO_STRAT[err] || [];
      rec = cands.find(id => !used.includes(id)) || cands[0] || null;
      keep = used.includes(rec);
      reason = `${ERR_KID[err] || '헷갈린 곳이 있었어요'}. ${rec && STRAT_PURPOSE[rec] ? STRAT_PURPOSE[rec].replace(/이에요$/, '이라 도움이 돼요') : ''}`.trim();
    }
    return { per, avg: avg == null ? null : Math.round(avg), err, rec, keep, reason };
  }

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
    sliderLabel, isAiSide, taskSplit, PRESETS, applyPreset, presetOf, metaTaskScore, strategyReview, prevLink,
    srcOf, isTypedTurn, migrateTurnsSrc,
    phaseEnter, phaseLeave, phaseSwitch, phaseMs, totalMs, median,
    effectiveSupport, startBoost, weakAxis, nextPlanCandidates, growthCard
  });
})(typeof window !== 'undefined' ? window : globalThis);
