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
   요청사항(20·21번째 피드백) "iorad처럼 실제 화면을 가리켜라", "7번부터는 왜 작은 예시
   카드로만 나오냐, 실제 채팅창을 mock data로 보여줘야지" — 대화·성찰 단계도 더 이상
   작은 예시 창이 아니라, 진짜 #chat/#reflect/#residual 화면 위에 그대로 띄운다. 아직
   실제로 공부한 적이 없으니 "이미 대화를 좀 나눈 상태"를 흉내 낸 가짜 세션(buildMockSession)
   하나를 만들어 session 전역변수에 잠깐 끼워 넣고, 그 화면이 쓰는 진짜 렌더 함수
   (renderStream/enterReflect/enterResidual)로 그린다 — 다른 특수 카드(활성화 퀴즈
   결과·스스로 점검 결과·방법 고르기)와 완전히 같은 모양이 된다. 투어가 끝나면 원래
   session으로 되돌린다(실제 공부를 시작한 적이 없으면 보통 null). */
let _mockSession = null;
function buildMockSession(){
  const now = Date.now();
  return {
    id:'tour-mock', startedAt:new Date(now-20*60000).toISOString(), endedAt:null,
    mode:'class40', diagTags:['기억','예시','설명','적용'], appVersion:'tour',
    phaseTimes:null, flags:[], helpRequests:[], scoreReports:[], errorReports:[], skipped:{},
    isSample:true, practice:true, classDurationMin:null,
    ctx:{ stdConfirmedAt:new Date(now-20*60000).toISOString(), grade:'초등학교 5학년', band:'초등학교 5~6학년', subject:'수학', subjKey:'수학', code:'TOUR', std:'분수의 덧셈과 뺄셈', area:'수와 연산', concept:'분모가 다른 분수는 통분한 뒤 더하거나 뺀다.', extraStds:[] },
    goal:'분수를 그림으로 나타내면서 더하는 방법을 알고 싶어요', wonder:'',
    prior:{ score:4, items:[
      { id:'p0', tag:'기억', type:'text', q:'통분이 뭔지 떠올려서 써 보세요.', a:'분모를 같게 만드는 거요', score:70, note:'' },
      { id:'p1', tag:'적용', type:'text', q:'1/3과 1/4을 통분해 보세요.', a:'4/12랑 3/12', score:60, note:'' }
    ], diagScore:62, diagFeedback:'기억하고 있는 것도 있고 아직 헷갈리는 것도 있어요.' },
    meta:{ usualMethod:'문제를 여러 번 풀어봐요', raw:'', u:'', s:'', c:'', score:55,
      scoreDetail:{ understand:67, strategy:33, connect:67 }, scoreVersion:'v2-subind',
      indLabels:null, indicators:{ understand:{s:1,r:1,c:0}, strategy:{s:0,r:1,c:0}, connect:{s:1,r:1,c:0} },
      scoreEvidence:{ understand:'분모가 다를 때 헷갈려요', strategy:'문제를 많이 풀면 될 것 같아요', connect:'전에 배운 분수 크기 비교랑 비슷해요' },
      feedback:'헷갈리는 곳을 더 구체적으로 짚어보면 좋아요.', gradeFailed:false, calib:null, step:3, reasked:{} },
    strategies:['organization'], strategyLabel:'🗂️ 표·그림으로 정리하기', strategyReason:'여러 정보가 헷갈려서', strategyChangeLog:[], stratTurnIdx:0, stratDone:{}, stratRounds:{ organization:1 },
    taskBlocks:{}, fixedToggle:{},
    support:'mid', supportStart:'high',
    acceptStreak:0, holdStreak:0, cpHighStreak:0, stuckCount:1,
    phase:'explore', prepStep:'init', awaitPick:null, pendingActivation:false,
    cycleIdx:2, cycleNow:'apply', cycleStarted:true,
    checkpointInterval:4, checkpointForceSoon:false, lowUnderstandFlag:false,
    checkpoints:[{ turnId:'t2', score:4, reason:'표로 정리하니 알 것 같아요', at:new Date(now-5*60000).toISOString() }],
    turnsSinceCheckpoint:0, pendingCheckpoint:false,
    retrievalQueue:[], turnsSinceRetrieval:0,
    turns:[
      { id:'t1', role:'ai', text:'"표로 정리하기" 방법으로 해보자. 분모가 다른 분수 두 개를 표에 정리해볼래?', phase:'explore', kind:null, support:'mid', judge:null, comment:'', structOffer:null },
      { id:'t2', role:'me', text:'1/3이랑 1/4을 표에 써볼게', phase:'explore', delegate:false, initiative:'self', src:'typed' },
      { id:'t3', role:'ai', text:'좋아, 통분한 결과를 표 칸에 채워볼래? 어떤 낱말을 넣을지는 네가 정해.', phase:'explore', kind:null, support:'mid', judge:'accept', comment:'', structOffer:null }
    ],
    reflect:{ note:'', noteA:'', tags:{ t2:'self' }, step:'delegate', promptRatings:[
      { turnId:'t2', text:'1/3이랑 1/4을 표에 써볼게', specificity:4, logic:3, clarity:4 }
    ] },
    residual:{ started:true, items:[
      { id:'r0', tag:'기억', type:'text', q:'(사전 1번과 같은 종류) 통분이 뭔지 다시 떠올려 써 보세요.', a:'분모를 같게 만드는 거예요', e:'', c:80, score:85, correct:true, note:'', strategyId:null },
      { id:'r1', tag:'적용', type:'text', q:'(사전 2번과 같은 종류) 1/2과 1/5을 통분해 보세요.', a:'5/10이랑 2/10', e:'', c:80, score:80, correct:true, note:'', strategyId:'organization' }
    ], result:null, postScore:null, judge:null, comment:'', journal:'' }
  };
}
// 각 단계 직전에 가짜 세션을 그 단계에 맞는 모양으로 살짝 바꾼다(활성화 퀴즈는 "이미
// 답한 결과" 화면을, 혼자 풀어보기는 "푸는 중"과 "결과 나온 뒤" 두 가지를 보여줘야 한다).
const TOUR_SETUPS = {
  activate(s){ s.turns = [{ id:'aq1', role:'note', kind:'activate-quiz', answered:true }]; },
  meta(s){ s.turns = [{ id:'ms1', role:'note', kind:'meta-score', text:'', meta:Object.assign({}, s.meta.scoreDetail, { feedback:s.meta.feedback }) }]; },
  pick(s){ pendingStrategyPick = ['organization']; strategyPickMode = 'initial';
    s.turns = [{ id:'sp1', role:'ai', text:'좋아, 오늘은 어떤 방법으로 공부해볼까?', phase:'explore', kind:'strategy-pick', support:'mid', judge:null, comment:'', structOffer:null, pickDone:false }]; },
  apply(s){ /* buildMockSession()의 기본 대화(turns)를 그대로 쓴다 */ },
  reflect(s){ /* 기본 reflect.tags/promptRatings를 그대로 쓴다 */ },
  residualDoing(s){ s.residual = Object.assign({}, s.residual, { result:null, postScore:null, journal:'' }); },
  residualDone(s){ s.residual = Object.assign({}, s.residual, {
    result:{ selfExplain:{ level:'높음', note:'표로 정리한 걸 떠올려서 설명했어요.' }, metacogBrier:0.08, transfer:{ applied:true, note:'표로 정리하는 방법을 그대로 썼어요.' } },
    postScore:82, journal:'처음엔 통분이 헷갈렸는데, 표로 정리하면서 알게 됐어요.'
  }); }
};
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
  { sec:'3-가', t:'아는 것 확인하기', mockScreen:'chat', mockSetup:'activate', el:()=>{ const all=document.querySelectorAll('#stream .msg.note'); return all[all.length-1]; },
    b:'시험이 아니에요. 지금 아는 만큼 적어요. 몰라도 "모르겠어요"라고 쓰면 돼요. 결과는 맞다·틀리다가 아니라 참고만 해요.' },
  { sec:'3-나', t:'스스로 점검하기', mockScreen:'chat', mockSetup:'meta', el:()=>{ const all=document.querySelectorAll('#stream .msg.note'); return all[all.length-1]; },
    b:'헷갈리는 곳을 짚고, 어떤 방법으로 공부하는지, 전에 배운 것과 어떻게 이어지는지 스스로 짚어봐요.' },
  { sec:'3-다', t:'공부 방법 고르기', mockScreen:'chat', mockSetup:'pick', el:()=>{ const all=document.querySelectorAll('#stream .msg.ai'); return all[all.length-1]; },
    b:'5가지 방법 중 하나 이상 골라요. 오늘 내용에 잘 맞는 방법엔 안내 배지가 붙어요.' },
  { sec:'3-라', t:'방법대로 해 보기', mockScreen:'chat', mockSetup:'apply', el:()=>document.getElementById('btn-stuck'),
    b:'고른 방법으로 실제 과업을 해 봐요. 막히면 [막혔어요]로 도움을 고르고, AI 말은 [이 말 판단하기]로 내가 직접 판단해요.' },
  { sec:'4-가', t:'돌아보기 — AI위임 성찰 · 프롬프트 성찰', mockScreen:'reflect', mockSetup:'reflect', el:()=>document.querySelector('.tl-tags'),
    b:'내가 한 말마다 "내가 생각했는지·AI에게 맡겼는지" 표시하고(AI위임 성찰), 내가 쓴 질문의 자세함·이어짐·분명함도 스스로 매겨요(프롬프트 성찰).' },
  { sec:'4-나', t:'혼자 풀어보기', mockScreen:'residual', mockSetup:'residualDoing', el:()=>document.getElementById('res-items'),
    b:'대화를 마친 뒤, AI 없이 비슷한 문제를 혼자 풀어봐요. 공부 전 점수와 나란히 비교해서 얼마나 늘었는지 봐요.' },
  { sec:'4-다', t:'최종 성찰', mockScreen:'residual', mockSetup:'residualDone', el:()=>document.getElementById('res-journal'),
    b:'AI 사용 이후 혼자 풀어본 결과를 보면서, 어려웠던 점과 새롭게 알게 된 점을 한 문장 이상 적어요. 이게 오늘 공부의 마지막 단계예요.' }
];
let _tourIdx = 0;
let _tourResize = null;
let _tourSessionBackup;
let _tourHasBackup = false;
// DOM(막·구멍·설명카드)만 지운다 — 단계를 넘길 때마다 매번 부른다(투어 자체를 끝내는 건 아님).
function clearTourDom(){
  document.querySelectorAll('.tour-dim,.tour-hole,.tour-card').forEach(e=>e.remove());
  if(_tourResize){ window.removeEventListener('resize', _tourResize); _tourResize = null; }
}
// 투어를 완전히 끝낸다 — 가짜 세션이 있었으면 원래 session(보통 null)으로 되돌리고 홈으로.
// 버그 수정: 예전엔 session이 원래 null이었던 경우("아직 공부 시작 전")와 "아직 안 쓴 값"을
// 똑같이 undefined로 구분해서, 단계를 한 번만 넘겨도 이게 "투어 끝"으로 오인돼 매번 홈으로
// 튕겨 나갔다 — 원래 값을 _tourHasBackup(불리언)으로 따로 표시해 구분한다.
function closeTour(){
  clearTourDom();
  if(_tourHasBackup){ session = _tourSessionBackup; _tourSessionBackup = undefined; _tourHasBackup = false; show('home'); }
}
function renderTour(i){
  clearTourDom();
  // 방어적으로 한 번 더: 투어가 떠 있는 동안은 이 팝업(#scrim)이 항상 닫혀 있어야 한다.
  const scrim = document.getElementById('scrim'); if(scrim) scrim.classList.remove('open');
  _tourIdx = Math.max(0, Math.min(TOUR_STEPS.length-1, i||0));
  const step = TOUR_STEPS[_tourIdx];
  if(step.mockScreen){
    if(!_tourHasBackup){ _tourSessionBackup = (typeof session!=='undefined') ? session : null; _tourHasBackup = true; }
    // 단계마다 "기본 대화" 위에 그 단계에 맞는 모양(활성화 퀴즈 결과, 방법 고르기 카드 등)을
    // 새로 얹는다 — 매번 새로 만들어야 이전 단계가 바꿔 둔 turns/residual이 안 섞인다.
    _mockSession = buildMockSession();
    TOUR_SETUPS[step.mockSetup](_mockSession);
    session = _mockSession;
    show(step.mockScreen);
  } else if(step.screen){
    if(_tourHasBackup){ session = _tourSessionBackup; _tourSessionBackup = undefined; _tourHasBackup = false; }
    const active = document.querySelector('.screen.is-active');
    if(!active || active.dataset.screen !== step.screen) show(step.screen);
  }
  const total = TOUR_STEPS.length;
  document.body.insertAdjacentHTML('beforeend', '<div class="tour-dim"></div>');
  const card = document.createElement('div'); card.className = 'tour-card';
  card.innerHTML = `${step.sec?`<div class="tour-badge">${esc(step.sec)}</div>`:''}<h4>${esc(step.t)}</h4><p>${esc(step.b)}</p>
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
  // 버그 수정(요청사항 21번째 피드백): "안내 보기"를 눌러도 이 팝업(#scrim)이 안 닫혀서
  // 투어 스포트라이트 뒤에 이 팝업이 그대로 깔려 보였다 — 투어를 시작하기 전에 꼭 닫는다.
  document.getElementById('gd-yes').onclick = ()=>{ remember(); document.getElementById('scrim').classList.remove('open'); openGuide(0); };
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
