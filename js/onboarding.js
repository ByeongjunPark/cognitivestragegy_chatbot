/* 첫 진입·온보딩 (WP4-1·4-2, 전문가1·2·3·7).
   index.html 본문 스크립트의 전역(authTab, pin, clearPin, PICS, DB, modal, modalHTML, show, $)을 호출 시점에 쓴다. */

// 🔶 연구진 결정(WP4-2): 사용법 영상·슬라이드 주소. 비어 있으면 안내 마지막 장에서 숨긴다.
const GUIDE_LINKS = { video: '', slides: '' };

// 그림 이름(글자로도 보여 주기 — 접근성·기억 돕기)
const PIC_NAMES = { '🍎':'사과','🍌':'바나나','🍇':'포도','🍓':'딸기','🍉':'수박','🥕':'당근','🐶':'강아지','🐱':'고양이','🐰':'토끼','🦁':'사자','🐼':'판다','🐢':'거북이','🚀':'로켓','🚗':'자동차','⚽':'축구공','🎈':'풍선','📚':'책','🎸':'기타','🌈':'무지개','⭐':'별','🍕':'피자','🎨':'팔레트','🔑':'열쇠','🧭':'나침반' };
const picNames = list => list.map(p => PIC_NAMES[p] || p).join(' → ');

/* ---------- 그림 비밀번호: 알고 쓰게, 두 번 확인, 잊어도 복구 (WP4-1) ---------- */
let _signupFirst = null;
function paintPinHelp(){
  const box = document.getElementById('pin-help'); if(!box) return;
  const isSignup = typeof authTab !== 'undefined' && authTab === 'signup';
  const chosen = (typeof reels !== 'undefined') ? reels.filter(Boolean) : [];
  const names = chosen.length ? `<div class="pin-names">고른 그림: <b>${esc(picNames(chosen))}</b></div>` : '';
  box.innerHTML = isSignup
    ? `<div class="callout warn pin-warn"><b>그림 4개는 나만의 비밀번호예요. 꼭 기억해요!</b><br>${_signupFirst ? '확인하려고 <b>같은 그림 4개를 같은 순서로 한 번 더</b> 골라 주세요.' : '다음에 들어올 때 같은 그림을 같은 순서로 골라야 해요.'}</div>${names}`
    : names;
  // "잊어버렸어요"는 그림 위가 아니라 [들어가기] 버튼 아래에 둔다(로그인 탭에서만)
  let f = document.getElementById('btn-forgot');
  if(!f){ const go = document.getElementById('auth-go'); if(go){ go.insertAdjacentHTML('afterend', '<button type="button" class="head-link forgot-link" id="btn-forgot">그림 비밀번호를 잊어버렸어요</button>'); f = document.getElementById('btn-forgot'); f.onclick = openForgot; } }
  if(f) f.hidden = isSignup;
}
function openForgot(){
  const nick = (document.getElementById('au-nick').value || '').trim();
  modalHTML('그림 비밀번호를 잊어버렸어요', `<div class="stack" style="gap:8px">
    <p>괜찮아요. 선생님이 새 그림 비밀번호로 바꿔 줄 수 있어요.</p>
    <ol style="margin:0;padding-left:18px;line-height:1.7"><li>선생님께 <b>내 공부방 이름</b>을 알려 드려요.</li><li>선생님이 새 그림 4개를 정해 알려 줘요.</li><li>여기 [이미 만들었어요]에서 이름과 새 그림 4개로 들어와요. 지난 공부 기록은 그대로 있어요.</li></ol>
    ${nick ? `<div class="kv"><span>내 공부방 이름</span><b id="forgot-nick">${esc(nick)}</b></div><button type="button" class="btn btn-sm" id="btn-copy-nick">이름 복사하기</button>` : '<p class="hint">위 칸에 내 공부방 이름을 먼저 적으면 복사할 수 있어요.</p>'}
  </div>`);
  const c = document.getElementById('btn-copy-nick');
  if(c) c.onclick = async ()=>{ try{ await navigator.clipboard.writeText(nick); c.textContent = '복사했어요 ✓'; }catch(e){ c.textContent = '복사가 안 돼요 — 직접 적어 주세요'; } };
}
// 가입: 첫 번째 고르기 → 같은 그림을 한 번 더 → 같아야 가입(두 번 다르면 처음부터)
document.addEventListener('click', e=>{
  const go = e.target.closest && e.target.closest('#auth-go');
  if(!go || typeof authTab === 'undefined' || authTab !== 'signup') return;
  if(!pinReady() || !document.getElementById('au-nick').value.trim()) return; // 원래 안내에 맡긴다
  if(!_signupFirst){
    e.stopImmediatePropagation(); e.preventDefault();
    _signupFirst = reels.slice(); clearPin(); paintPinHelp();
    return;
  }
  if(_signupFirst.join('') !== reels.join('')){
    e.stopImmediatePropagation(); e.preventDefault();
    _signupFirst = null; clearPin(); paintPinHelp();
    modal('그림이 달라요', '처음 고른 그림과 순서가 달라요. 처음부터 다시 그림 4개를 골라 주세요.');
    return;
  }
  window._justSignedUp = reels.slice(); _signupFirst = null; // 같으면 원래 가입 처리로 넘긴다
}, true);
function showPinCard(list, nick){
  modalHTML('내 비밀번호 카드', `<div class="stack" style="gap:8px"><div class="pin-card" id="pin-card"><div class="pc-nick">${esc(nick)}</div><div class="pc-pics">${list.join(' ')}</div><div class="pc-names">${esc(picNames(list))}</div></div>
    <p class="hint">이 카드는 나만 보이게 잘 보관해요. 그림 이름도 같이 기억하면 좋아요.</p>
    <div class="row"><button type="button" class="btn btn-sm" id="pc-save">그림으로 저장</button><button type="button" class="btn btn-sm btn-ghost" id="pc-print">인쇄</button><button type="button" class="btn btn-sm btn-primary" id="pc-next">다음: 사용 안내 보기 →</button></div></div>`, { hideOk:true });
  document.getElementById('pc-next').onclick = ()=>{ try{ localStorage.setItem(guideKey(), '1'); }catch(e){} openGuide(0); };
  document.getElementById('pc-print').onclick = ()=>window.print();
  document.getElementById('pc-save').onclick = ()=>{
    const cv = document.createElement('canvas'); cv.width = 520; cv.height = 260; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0,0,520,260); g.fillStyle = '#111'; g.font = 'bold 22px sans-serif'; g.fillText(nick + ' 의 그림 비밀번호', 24, 44);
    g.font = '64px sans-serif'; g.fillText(list.join(' '), 24, 140); g.font = '20px sans-serif'; g.fillText(picNames(list), 24, 200);
    const a = document.createElement('a'); a.download = '그림비밀번호.png'; a.href = cv.toDataURL('image/png'); a.click();
  };
}

/* ---------- 첫 사용 둘러보기: iorad식 실제 화면 가리키기 투어 (WP4-2) ----------
   요청사항(20번째 피드백) "여전히 허접하다, iorad처럼 실제 화면을 가리키면서 해 달라" —
   모달 안의 작은 미리보기 대신, 진짜 화면(홈/시작) 위에 반투명 막을 깔고 설명할 실제
   요소만 뚫어 보이게(스포트라이트) 가리키며 설명한다. 아직 세션이 없어 실제로 보여줄 수
   없는 대화·성찰 단계는 실제 클래스를 그대로 쓴 작은 예시 창(.gd-frame)으로 보여준다.
   사용자가 준 목차(1.메인화면/2.배울 것 정하기/3.대화 과정/4.성찰하기, 가나다라 하위
   항목)를 그대로 13단계로 옮겼다. */
const TOUR_STEPS = [
  { sec:'', t:'내 공부방에 온 걸 환영해요', b:'여기서 AI와 함께 공부하고, 내가 어떻게 공부했는지 돌아봐요. 화면을 하나씩 직접 짚어가며 보여줄게요.' },
  { sec:'1-가', t:'공부 내역 보기', screen:'home', el:()=>{ const s = document.getElementById('sess-list'); return s && s.closest('.widget'); },
    b:'지난 공부 기록이에요. 눌러서 그날 나눈 이야기와 점수를 다시 볼 수 있어요.' },
  { sec:'1-나', t:'나의 성장 보기', screen:'home', el:()=>document.querySelector('.widget.growth'),
    b:'공부 방법·공부 전후·질문 실력·스스로 점검, 네 가지 탭으로 내가 쌓아온 기록을 그래프로 봐요.' },
  { sec:'1-다', t:'디지털 배지 보기', screen:'home', el:()=>document.getElementById('home-badges'),
    b:'끝까지 하기·도움 줄이기처럼 메타인지 행동을 하면 포인트가 쌓여 배지를 모을 수 있어요. 눌러서 어떻게 모으는지 봐요.' },
  { sec:'2-가', t:'공부 방식 · 학교급 · 배울 것 정하기', screen:'start', el:()=>{ const m = document.getElementById('st-mode'); return m && m.closest('.card'); },
    b:'수업시간모드(학교급별 시간 제한)와 자유모드 중 고르고, 학교급을 고르면 학년·과목이 그 학교급만 나와요. "오늘 공부하고 싶은 것"을 내 말로 적으면 맞는 내용을 찾아 줘요.' },
  { sec:'2-나', t:'AI와 할 일 나누기', screen:'start', el:()=>document.getElementById('tb-details'),
    b:'이 공부에서 AI가 맡을 일과 내가 할 일을 미리 정해요. 막대를 밀어서 비율을 바꿀 수 있어요.' },
  { sec:'3-가', t:'아는 것 확인하기', mock:`<div class="gd-frame-body"><div class="msg ai"><div class="av">AI</div><div class="bubble">분모가 다른 분수를 더할 때, 먼저 뭘 해야 할까?</div></div>
      <textarea class="textarea" rows="2" readonly placeholder="아는 만큼 적어보기">통분을 먼저 해야 할 것 같아요.</textarea></div>`,
    b:'시험이 아니에요. 지금 아는 만큼 적어요. 몰라도 "모르겠어요"라고 쓰면 돼요.' },
  { sec:'3-나', t:'스스로 점검하기', mock:`<div class="gd-frame-body"><div class="lv3-row"><span class="lv3-lab">이해 점검</span><span class="lv3-bar l1"><i style="width:58%"></i></span><b class="lv3-txt">해 보는 중이에요</b></div>
      <div class="msg ai" style="margin-top:8px"><div class="av">AI</div><div class="bubble">헷갈리는 부분이 있다면 어디야?</div></div></div>`,
    b:'헷갈리는 곳을 짚고, 어떤 방법으로 공부하는지, 전에 배운 것과 어떻게 이어지는지 스스로 짚어봐요.' },
  { sec:'3-다', t:'공부 방법 고르기', mock:`<div class="gd-frame-body"><button type="button" class="strat-card is-selected" style="width:100%">
      <div class="sc-top"><span class="sc-check">✓</span><span class="sc-name">🗂️ 표·그림으로 정리하기</span></div>
      <div class="sc-desc">표나 마인드맵으로 짜임새 있게 정리해요</div>
      <div class="sc-when">이럴 때 좋아요 · 여러 정보가 뒤섞여서 헷갈릴 때</div></button></div>`,
    b:'5가지 방법 중 하나 이상 골라요. 오늘 내용에 잘 맞는 방법엔 안내 배지가 붙어요.' },
  { sec:'3-라', t:'방법대로 해 보기', mock:`<div class="gd-frame-body"><div class="msg ai"><div class="av">AI</div><div class="bubble">분모가 다른 분수 두 개를 표에 정리해볼래?</div></div>
      <div class="msg me"><div class="av">나</div><div class="bubble">1/3이랑 1/4을 써볼게</div></div>
      <div class="row" style="margin-top:8px"><button type="button" class="stuck">막혔어요</button><button type="button" class="msg-act">이 말 판단하기</button></div></div>`,
    b:'고른 방법으로 실제 과업을 해 봐요. 막히면 [막혔어요]로 도움을 고르고, AI 말은 [이 말 판단하기]로 내가 직접 판단해요.' },
  { sec:'4-가', t:'돌아보기 — AI위임 성찰 · 프롬프트 성찰', mock:`<div class="gd-frame-body"><div class="msg me"><div class="av">나</div><div class="bubble">1/3이랑 1/4을 써볼게</div></div>
      <div class="tl-tags" style="max-width:220px;margin:6px 0 10px"><button type="button" class="on">🧠 내가 생각</button><button type="button">🤖 AI에게 맡김</button></div>
      <div class="field-label" style="margin-bottom:4px">내 질문 — 자세함</div><div class="understand-pick" style="flex-direction:row;max-width:220px"><button type="button" class="u-chip">1</button><button type="button" class="u-chip is-selected">2</button><button type="button" class="u-chip">3</button></div></div>`,
    b:'내가 한 말마다 "내가 생각했는지·AI에게 맡겼는지" 표시하고(AI위임 성찰), 내가 쓴 질문의 자세함·이어짐·분명함도 스스로 매겨요(프롬프트 성찰).' },
  { sec:'4-나', t:'혼자 풀어보기', mock:`<div class="gd-frame-body"><div class="msc-row"><span>공부 전</span><span class="bar"><i style="width:48%"></i></span><b>48점</b></div>
      <div class="msc-row"><span>혼자 풀 때</span><span class="bar"><i style="width:80%"></i></span><b>80점</b></div></div>`,
    b:'대화를 마친 뒤, AI 없이 비슷한 문제를 혼자 풀어봐요. 공부 전 점수와 나란히 비교해서 얼마나 늘었는지 봐요.' },
  { sec:'4-다', t:'최종 성찰', mock:`<div class="gd-frame-body"><label class="field-label" for="gd-mock-journal">최종 성찰 — AI 없이 혼자 풀어본 결과를 보면서 적어요</label>
      <textarea class="textarea" id="gd-mock-journal" rows="2" readonly>처음엔 통분이 헷갈렸는데, 표로 정리하면서 알게 됐어요.</textarea></div>`,
    b:'AI 사용 이후 혼자 풀어본 결과를 보면서, 어려웠던 점과 새롭게 알게 된 점을 한 문장 이상 적어요. 이게 오늘 공부의 마지막 단계예요.' }
];
let _tourIdx = 0;
let _tourResize = null;
function guideFrameHTML(mock){
  if(!mock) return '';
  return `<div class="gd-frame"><div class="gd-frame-bar"><span class="gd-frame-dot"></span><span class="gd-frame-dot"></span><span class="gd-frame-dot"></span></div>${mock}</div>`;
}
function closeTour(){
  document.querySelectorAll('.tour-dim,.tour-hole,.tour-card').forEach(e=>e.remove());
  if(_tourResize){ window.removeEventListener('resize', _tourResize); _tourResize = null; }
}
function renderTour(i){
  closeTour();
  _tourIdx = Math.max(0, Math.min(TOUR_STEPS.length-1, i||0));
  const step = TOUR_STEPS[_tourIdx];
  if(step.screen){
    const active = document.querySelector('.screen.is-active');
    if(!active || active.dataset.screen !== step.screen) show(step.screen);
  }
  const total = TOUR_STEPS.length;
  document.body.insertAdjacentHTML('beforeend', '<div class="tour-dim"></div>');
  const card = document.createElement('div'); card.className = 'tour-card' + (step.mock ? ' wide' : '');
  card.innerHTML = `${step.sec?`<div class="tour-badge">${esc(step.sec)}</div>`:''}<h4>${esc(step.t)}</h4>${guideFrameHTML(step.mock)}<p>${esc(step.b)}</p>
    <div class="row" style="justify-content:space-between">
      <button type="button" class="btn btn-sm btn-ghost" id="tour-skip">건너뛰기</button>
      <span class="row" style="gap:8px">${_tourIdx>0?'<button type="button" class="btn btn-sm" id="tour-prev">← 이전</button>':''}${_tourIdx<total-1?`<button type="button" class="btn btn-sm btn-primary" id="tour-next">다음 (${_tourIdx+1}/${total}) →</button>`:'<button type="button" class="btn btn-sm btn-primary" id="tour-practice">연습해 보기</button>'}</span>
    </div>`;
  document.body.appendChild(card);
  const target = step.el ? step.el() : null;
  if(target){
    document.body.insertAdjacentHTML('beforeend', '<div class="tour-hole"></div>');
    const hole = document.querySelector('.tour-hole');
    const place = ()=>{
      const r = target.getBoundingClientRect(), pad = 6;
      hole.style.left = (r.left-pad)+'px'; hole.style.top = (r.top-pad)+'px';
      hole.style.width = (r.width+pad*2)+'px'; hole.style.height = (r.height+pad*2)+'px';
      const vw = window.innerWidth, vh = window.innerHeight;
      const cardH = card.offsetHeight || 180;
      let top = r.bottom + pad + 12;
      if(top + cardH > vh - 10) top = Math.max(10, r.top - pad - cardH - 12);
      const left = Math.min(Math.max(10, r.left), vw - card.offsetWidth - 10);
      card.style.top = top+'px'; card.style.left = left+'px';
    };
    place();
    target.scrollIntoView({ block:'center', behavior:'smooth' });
    setTimeout(place, 260); // 스크롤 끝난 뒤 위치 다시 맞춤
    _tourResize = place;
    window.addEventListener('resize', _tourResize);
  } else {
    card.classList.add('centered');
  }
  const on = (id, fn)=>{ const el = document.getElementById(id); if(el) el.onclick = fn; };
  on('tour-skip', closeTour);
  on('tour-prev', ()=>renderTour(_tourIdx-1));
  on('tour-next', ()=>renderTour(_tourIdx+1));
  on('tour-practice', ()=>{ closeTour(); startPractice(); });
}
function openGuide(i){ renderTour(i); }
function guideKey(){ return 'guideSeen:' + (DB && DB.currentUser || ''); }
function guideNeverKey(){ return 'guideNever:' + (DB && DB.currentUser || ''); }
// 요청사항(19번째 피드백): "다음부터 묻지 않기"(영구)만 있었는데, 지금 당장은 보기 귀찮지만
// 나중엔 다시 보고 싶을 수 있다 — "일주일 동안 안 보기"(스누즈)를 따로 둔다.
function guideSnoozeKey(){ return 'guideSnoozeUntil:' + (DB && DB.currentUser || ''); }
// 로그인할 때마다 짧게 묻는다. '다음부터 묻지 않기'를 고르면 그 계정에서는 다시 묻지 않는다.
function maybeAutoGuide(){
  if(!DB || !DB.currentUser) return;
  let never = null; try{ never = localStorage.getItem(guideNeverKey()); }catch(e){}
  if(never) return;
  let snoozeUntil = 0; try{ snoozeUntil = +localStorage.getItem(guideSnoozeKey()) || 0; }catch(e){}
  if(snoozeUntil && Date.now() < snoozeUntil) return;
  modalHTML('사용 방법을 볼까요?', `<div class="stack" style="gap:14px"><p style="margin:0">처음이거나 헷갈리면 짧은 안내를 봐요.</p>
    <label style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--muted)"><input type="checkbox" id="gd-never"> 다음부터 묻지 않기</label>
    <div class="row" style="justify-content:space-between">
      <button type="button" class="head-link" id="gd-snooze">일주일 동안 안 보기</button>
      <span class="row" style="gap:8px"><button type="button" class="btn btn-sm btn-ghost" id="gd-no">바로 시작할게요</button><button type="button" class="btn btn-sm btn-primary" id="gd-yes">안내 보기</button></span>
    </div></div>`, { hideOk:true });
  const remember = ()=>{ const c = document.getElementById('gd-never'); if(c && c.checked){ try{ localStorage.setItem(guideNeverKey(), '1'); }catch(e){} } };
  document.getElementById('gd-no').onclick = ()=>{ remember(); document.getElementById('scrim').classList.remove('open'); };
  document.getElementById('gd-yes').onclick = ()=>{ remember(); openGuide(0); };
  document.getElementById('gd-snooze').onclick = ()=>{ try{ localStorage.setItem(guideSnoozeKey(), String(Date.now() + 7*24*60*60*1000)); }catch(e){} document.getElementById('scrim').classList.remove('open'); };
}
function startPractice(){
  window._practiceMode = true;
  show('start');
  const b = document.getElementById('practice-banner'); if(b) b.hidden = false;
}
function stopPractice(){ window._practiceMode = false; const b = document.getElementById('practice-banner'); if(b) b.hidden = true; }

document.addEventListener('DOMContentLoaded', ()=>{
  const slots = document.getElementById('slots');
  if(slots && !document.getElementById('pin-help')) slots.insertAdjacentHTML('beforebegin', '<div id="pin-help"></div>');
  const tabs = document.getElementById('auth-tabs'); if(tabs) tabs.addEventListener('click', ()=>{ _signupFirst = null; setTimeout(paintPinHelp, 0); });
  const pal = document.getElementById('palette'); if(pal) pal.addEventListener('click', ()=>setTimeout(paintPinHelp, 0));
  ['btn-stop','btn-clear-pin'].forEach(id=>{ const el = document.getElementById(id); if(el) el.addEventListener('click', ()=>setTimeout(paintPinHelp, 0)); });
  paintPinHelp();
  // 홈의 [연습해 보기]
  const ns = document.getElementById('btn-new-session');
  if(ns && !document.getElementById('btn-practice')){
    ns.insertAdjacentHTML('afterend', '<button class="btn btn-lg btn-ghost" id="btn-practice" title="연습 기록은 성장 그래프에 들어가지 않아요">연습해 보기</button>');
    document.getElementById('btn-practice').onclick = startPractice;
    ns.addEventListener('click', stopPractice, true);
  }
});
