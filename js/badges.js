/* 디지털 배지 8종 — 메타인지·자기주도학습 행동(끝까지 하기, 내 이해 알아차리기, 방법 고르기, 혼자 해내기,
   도움 줄이기, 생각 먼저 쓰기, 질문 다듬기, 점검 뒤 다시 도전)에 포인트를 준다. 점수·순위 비교는 하지 않는다(내 기록만).
   계산(computeBadges)은 화면 없이 동작하는 순수 함수라 node 테스트에서도 쓴다. 화면 부분은 브라우저에서만. */
(function (root) {
  const CS = root.CS = root.CS || {};

  const BADGES = [
    { id: 'finish', emoji: '🧭', name: '끝까지 탐험대', c1: '#6ee7b7', c2: '#059669', goal: 3,
      what: '공부를 처음부터 돌아보기까지 끝까지 해낸 탐험가에게 주는 배지예요.',
      how: '공부 하나를 끝까지 마치면 1포인트',
      tip: '돌아보기와 혼자 풀어보기까지 마치면 포인트가 쌓여요.' },
    { id: 'monitor', emoji: '🔍', name: '마음 돋보기 탐정', c1: '#93c5fd', c2: '#2563eb', goal: 8,
      what: '내가 아는지 모르는지 정확히 알아차리는 힘(메타인지)을 가진 탐정 배지예요.',
      how: '문제를 풀고 고른 “맞을 것 같아요 / 잘 모르겠어요”가 실제 결과와 맞으면 1포인트',
      tip: '답을 낸 뒤 “정말 맞을까?” 한 번 더 따져 보고 골라 봐요.' },
    { id: 'strategy', emoji: '🎒', name: '공부 방법 수집가', c1: '#fde68a', c2: '#d97706', goal: 4,
      what: '여러 가지 공부 방법을 써 보며 나에게 맞는 방법을 찾는 수집가 배지예요.',
      how: '처음 써 보는 공부 방법이 생길 때마다 1포인트',
      tip: '다음 공부에서는 아직 안 써 본 방법을 골라 봐요.' },
    { id: 'solo', emoji: '🦸', name: '혼자서도 척척 히어로', c1: '#f9a8d4', c2: '#db2777', goal: 3,
      what: 'AI 도움 없이도 배운 것을 해내는 히어로 배지예요.',
      how: '혼자 풀어보기 점수가 공부 전보다 같거나 오르면 1포인트',
      tip: '혼자 풀어보기 전에 오늘 배운 것을 한 번 떠올려 봐요.' },
    { id: 'fade', emoji: '🪜', name: '스스로 사다리', c1: '#c4b5fd', c2: '#7c3aed', goal: 3,
      what: 'AI 도움을 조금씩 줄이며 스스로 한 칸씩 올라가는 배지예요.',
      how: '“AI 도움을 줄여볼까요?”에서 [줄여볼래요]를 고르면 1포인트',
      tip: '잘 이해했다는 신호가 쌓이면 줄여 보자는 제안이 나와요.' },
    { id: 'selfFirst', emoji: '✍️', name: '생각 먼저 작가', c1: '#fdba74', c2: '#ea580c', goal: 20,
      what: 'AI에게 맡기기 전에 내 생각을 먼저 쓰는 작가 배지예요.',
      how: 'AI에게 맡기지 않고 내 생각을 먼저 쓴 말 하나마다 1포인트',
      tip: '“답 알려 줘” 대신 “나는 ○○라고 생각해요”로 시작해 봐요.' },
    { id: 'question', emoji: '🪄', name: '질문 마법사', c1: '#67e8f9', c2: '#0891b2', goal: 3,
      what: '자세하고 분명한 질문으로 AI와 잘 대화하는 마법사 배지예요.',
      how: '돌아보기에서 자세함·이어짐·분명함을 모두 4점 이상 준 내 질문 하나마다 1포인트',
      tip: '헷갈리는 곳을 먼저 말하고 물어보면 질문이 좋아져요.' },
    { id: 'retry', emoji: '🛡️', name: '다시 도전 용사', c1: '#fca5a5', c2: '#dc2626', goal: 3,
      what: '점검 결과를 보고 공부 방법을 바꾸거나 다음 계획을 세우는 용사 배지예요.',
      how: '공부 방법을 바꾸거나, 돌아보기에서 다음 공부 방법을 정하면 1포인트',
      tip: '돌아보기 끝의 “다음엔 어떤 방법으로 할까요?”에서 골라 봐요.' }
  ];

  const ids = s => Array.isArray(s.strategies) ? s.strategies : (s.strategy ? [s.strategy] : []);
  const typedMine = (s, autoRe) => (s.turns || []).filter(t => t.role === 'me' && (CS.srcOf ? CS.srcOf(t, autoRe) === 'typed' : t.src === 'typed'));

  // 공부 하나에서 배지별로 얻은 포인트(방법 수집가만 누적 고유 개수라 따로 센다)
  function pointsOf(s, autoRe) {
    const items = (s.prior && s.prior.items) || [];
    const post = (s.residual && s.residual.items) || [];
    const agreePre = items.filter(it => it.conf != null && it.score != null && ((+it.conf === 1) === (it.score >= 50))).length;
    const agreePost = post.filter(it => it.c != null && it.score != null && ((it.c >= 50) === (it.score >= 50))).length;
    const pre = s.prior && s.prior.diagScore, ps = s.residual && s.residual.postScore;
    const tags = (s.reflect && s.reflect.tags) || {};
    const ratings = (s.reflect && s.reflect.promptRatings) || [];
    return {
      finish: 1,
      monitor: agreePre + agreePost,
      solo: ps != null && (pre == null || ps >= pre) ? 1 : 0,
      fade: (s.turns || []).filter(t => t.kind === 'fade-propose' && t.accepted).length,
      selfFirst: typedMine(s, autoRe).filter(t => tags[t.id] ? tags[t.id] === 'self' : !t.delegate).length,
      question: ratings.filter(r => ['specificity', 'logic', 'clarity'].every(k => r[k] != null && r[k] >= 4)).length,
      retry: (s.strategyChangeLog || []).length + (s.nextPlan ? 1 : 0)
    };
  }

  // sessions: 끝낸 공부(시간 순). 결과: 배지마다 { cur, goal, earned, earnedAt }
  function computeBadges(sessions, autoRe) {
    const S = (sessions || []).slice().sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')));
    const sum = {}; const at = {}; const seen = new Set();
    BADGES.forEach(b => { sum[b.id] = 0; });
    S.forEach(s => {
      const p = pointsOf(s, autoRe);
      ids(s).forEach(id => seen.add(id));
      Object.keys(p).forEach(k => { sum[k] += p[k]; });
      sum.strategy = seen.size;
      BADGES.forEach(b => { if (!at[b.id] && sum[b.id] >= b.goal) at[b.id] = String(s.startedAt || '').slice(0, 10) || '-'; });
    });
    return BADGES.map(b => ({ id: b.id, cur: Math.min(sum[b.id], b.goal), raw: sum[b.id], goal: b.goal, earned: sum[b.id] >= b.goal, earnedAt: at[b.id] || null }));
  }
  Object.assign(CS, { BADGES, computeBadges });

  if (typeof document === 'undefined') return;

  /* ---------------- 화면 ---------------- */
  const esc2 = t => (typeof esc === 'function' ? esc(t) : String(t));
  function medalHTML(b, st, big) {
    const pct = Math.round(st.cur / st.goal * 100);
    return `<span class="bdg-medal ${st.earned ? 'on' : ''} ${big ? 'big' : ''}" style="--c1:${b.c1};--c2:${b.c2};--p:${pct}">
      <span class="bdg-ribbon" aria-hidden="true"></span><span class="bdg-ring" aria-hidden="true"></span>
      <span class="bdg-face" aria-hidden="true"><em>${b.emoji}</em></span>${st.earned ? '<span class="bdg-star" aria-hidden="true">★</span>' : ''}</span>`;
  }
  function badgeState() {
    const acc = typeof account === 'function' ? account() : null;
    const S = acc ? (acc.sessions || []).filter(s => !s.incomplete && !s.practice && !s.isSample) : [];
    return computeBadges(S, typeof AUTO_ME_RE !== 'undefined' ? AUTO_ME_RE : undefined);
  }
  function seenKey() { return 'badgeSeen:' + ((typeof DB !== 'undefined' && DB.currentUser) || ''); }
  root.renderBadges = function renderBadges() {
    const anchor = document.getElementById('home-glance'); if (!anchor) return;
    let box = document.getElementById('home-badges');
    if (!box) { box = document.createElement('div'); box.id = 'home-badges'; anchor.insertAdjacentElement('afterend', box); }
    const st = badgeState(); const n = st.filter(x => x.earned).length;
    box.innerHTML = `<div class="widget bdg-widget"><div class="widget-head"><span class="bdg-head-ic" aria-hidden="true">🏅</span><div><h4>내 배지</h4><small>${n} / ${BADGES.length}개 모았어요 · 눌러서 얻는 방법 보기</small></div></div>
      <div class="bdg-grid">${BADGES.map((b, i) => { const s = st[i];
        return `<button type="button" class="bdg ${s.earned ? 'on' : ''}" data-bdg="${b.id}" aria-label="${esc2(b.name)} ${s.earned ? '얻음' : `${s.cur} / ${s.goal} 포인트`}">
          ${medalHTML(b, s)}<span class="bdg-name">${esc2(b.name)}</span>
          <span class="bdg-prog">${s.earned ? '얻었어요!' : `<i><s style="width:${Math.round(s.cur / s.goal * 100)}%"></s></i>${s.cur}/${s.goal}`}</span></button>`; }).join('')}</div></div>`;
    // 새로 얻은 배지는 한 번 축하
    let seen = []; try { seen = JSON.parse(localStorage.getItem(seenKey()) || '[]'); } catch (e) {}
    const fresh = st.filter(x => x.earned && !seen.includes(x.id));
    if (fresh.length) {
      try { localStorage.setItem(seenKey(), JSON.stringify(st.filter(x => x.earned).map(x => x.id))); } catch (e) {}
      if (seen.length || fresh.length < BADGES.length) setTimeout(() => openBadge(fresh[0].id, true), 400);
    }
  };
  function openBadge(id, celebrate) {
    const i = BADGES.findIndex(b => b.id === id); if (i < 0) return;
    const b = BADGES[i], s = badgeState()[i];
    const pct = Math.round(s.cur / s.goal * 100);
    if (typeof modalHTML !== 'function') return;
    modalHTML(celebrate ? '새 배지를 얻었어요!' : '내 배지', `<div class="bdg-pop" style="--c1:${b.c1};--c2:${b.c2}">
      ${celebrate ? '<div class="bdg-confetti" aria-hidden="true">🎉 ✨ 🎊 ✨ 🎉</div>' : ''}
      ${medalHTML(b, s, true)}
      <div class="bdg-pop-name">${esc2(b.name)}</div>
      <p class="bdg-pop-what">${esc2(b.what)}</p>
      <div class="bdg-pop-box"><b>얻는 방법</b><span>${esc2(b.how)}</span></div>
      <div class="bdg-pop-box"><b>${s.earned ? `🎉 ${esc2(s.earnedAt || '')}에 얻었어요` : `얻으려면 ${s.goal}포인트가 필요해요`}</b>
        <span class="bdg-pop-bar"><i style="width:${pct}%"></i></span>
        <span class="bdg-pop-num">지금 <b>${s.raw}</b>포인트 ${s.earned ? '' : `· 앞으로 <b>${s.goal - s.cur}</b>포인트`}</span></div>
      ${s.earned ? '' : `<p class="bdg-pop-tip">💡 ${esc2(b.tip)}</p>`}
    </div>`);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.bdg[data-bdg]'); if (!b) return;
    openBadge(b.dataset.bdg, false);
  });
})(typeof window !== 'undefined' ? window : globalThis);
