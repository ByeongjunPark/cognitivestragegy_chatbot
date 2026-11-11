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

/* ---------- 첫 사용 둘러보기 6장 + 연습해 보기 (WP4-2) ----------
   요청사항(19번째 피드백) "글만 있어 허접하다, 실제 UI를 보여줘야" — 카드마다 그 단계의
   실제 화면을 작은 창(.gd-frame)으로 보여준다. 진짜 쓰는 클래스(.msg/.bubble/.chip 등)를
   그대로 가져다 쓰므로 실제 화면과 똑같이 보인다(안 눌리는 예시일 뿐). */
const GUIDE_CARDS = [
  { t:'내 공부방에 온 걸 환영해요', b:'여기서 AI와 함께 공부하고, 내가 어떻게 공부했는지 돌아봐요. 로그인할 때마다 이 안내를 다시 볼지 물어봐요.' },
  { t:'1. 배울 것 정하기', b:'오늘 공부하고 싶은 것을 내 말로 적어요. 예시 문장을 눌러도 돼요. [AI와 할 일 나누기]에서 내가 먼저 할 일과 AI가 도와줄 일을 정해요.',
    mock:`<div class="gd-frame-body"><div class="mode-row" style="margin-bottom:9px"><span class="chip mode-chip is-selected">수업시간모드</span><span class="chip mode-chip">자유모드</span></div>
      <textarea class="textarea" rows="2" readonly>분수를 그림으로 나타내면서 더하는 방법을 알고 싶어요</textarea>
      <button type="button" class="btn btn-sm btn-accent" style="margin-top:9px">딱 맞는 내용 찾기</button></div>` },
  { t:'2. 아는 것 확인 · 스스로 점검', b:'시험이 아니에요. 지금 아는 만큼 풀고, 헷갈리는 곳을 골라요. 모르면 "모르겠어요"라고 써도 괜찮아요.',
    mock:`<div class="gd-frame-body"><div class="msg ai"><div class="av">AI</div><div class="bubble">분모가 다른 분수를 더할 땐 어떻게 해야 할까?</div></div>
      <div class="understand-pick" style="margin-top:10px"><button type="button" class="u-chip is-selected"><span class="u-emoji">🙂</span><span>맞을 것 같아요</span></button><button type="button" class="u-chip"><span class="u-emoji">🤔</span><span>잘 모르겠어요</span></button></div></div>` },
  { t:'3. 방법 고르고 해 보기', b:'공부 방법을 고르면 AI가 할 일을 줘요. 내가 먼저 해 보고, 막히면 [막혔어요]를 눌러 필요한 도움을 골라요. AI 말은 [이 말 판단하기]로 내가 판단해요.',
    mock:`<div class="gd-frame-body"><div class="msg ai"><div class="av">AI</div><div class="bubble">"표로 정리하기" 방법으로 해보자. 분모가 다른 분수 두 개를 표에 써볼래?</div></div>
      <div class="msg me"><div class="av">나</div><div class="bubble">1/3이랑 1/4을 써볼게</div></div>
      <div class="row" style="margin-top:8px"><button type="button" class="stuck">막혔어요</button><button type="button" class="msg-act">이 말 판단하기</button></div></div>` },
  { t:'4. 돌아보기 · 혼자 풀어보기', b:'내가 한 말과 질문을 살펴보고 한 문장을 써요. 마지막엔 AI 없이 비슷한 문제를 풀어 공부 전과 비교해요.',
    mock:`<div class="gd-frame-body"><div class="msg me"><div class="av">나</div><div class="bubble">1/3이랑 1/4을 써볼게</div></div>
      <div class="tl-tags" style="max-width:220px;margin:6px 0 10px"><button type="button" class="on">🧠 내가 생각</button><button type="button">🤖 AI에게 맡김</button></div>
      <textarea class="textarea" rows="2" readonly>통분할 때 분모를 맞추는 게 헷갈렸는데, 표로 써보니 알겠다.</textarea></div>` },
  { t:'5. 내 공부방에서 성장 보기', b:'공부할 때마다 쓴 방법, 어려움을 푼 과정, AI 도움을 받은 정도가 쌓여요. 처음이면 [연습해 보기]로 먼저 해 봐도 좋아요(연습 기록은 성장 그래프에 안 들어가요).',
    mock:`<div class="gd-frame-body"><div class="strat-row"><span class="emoji" aria-hidden="true">🗂️</span><span class="lab">표·그림으로 정리하기</span><span class="track" aria-hidden="true"><i style="width:80%"></i></span><span class="num">4</span></div>
      <div class="strat-row"><span class="emoji" aria-hidden="true">🧐</span><span class="lab">따져서 살펴보기</span><span class="track" aria-hidden="true"><i style="width:40%"></i></span><span class="num">2</span></div></div>` }
];
let _guideIdx = 0;
function guideFrameHTML(mock){
  if(!mock) return '';
  return `<div class="gd-frame"><div class="gd-frame-bar"><span class="gd-frame-dot"></span><span class="gd-frame-dot"></span><span class="gd-frame-dot"></span></div>${mock}</div>`;
}
function openGuide(i){
  _guideIdx = Math.max(0, Math.min(GUIDE_CARDS.length-1, i||0));
  const c = GUIDE_CARDS[_guideIdx];
  const links = _guideIdx === GUIDE_CARDS.length-1 && (GUIDE_LINKS.video || GUIDE_LINKS.slides)
    ? `<p>${GUIDE_LINKS.video ? `<a href="${esc(GUIDE_LINKS.video)}" target="_blank" rel="noopener">사용법 영상 보기</a> ` : ''}${GUIDE_LINKS.slides ? `<a href="${esc(GUIDE_LINKS.slides)}" target="_blank" rel="noopener">사용법 슬라이드 보기</a>` : ''}</p>` : '';
  modalHTML(`${c.t} (${_guideIdx+1}/${GUIDE_CARDS.length})`, `<div class="stack" style="gap:10px">${guideFrameHTML(c.mock)}<p style="margin:0">${esc(c.b)}</p>${links}
    <div class="row" style="justify-content:space-between"><button type="button" class="btn btn-sm btn-ghost" id="gd-skip">건너뛰기</button>
    <span class="row" style="gap:8px">${_guideIdx>0?'<button type="button" class="btn btn-sm" id="gd-prev">← 이전</button>':''}${_guideIdx<GUIDE_CARDS.length-1?'<button type="button" class="btn btn-sm btn-primary" id="gd-next">다음 →</button>':'<button type="button" class="btn btn-sm btn-primary" id="gd-practice">연습해 보기</button>'}</span></div></div>`, { hideOk:true });
  const close = ()=>document.getElementById('scrim').classList.remove('open');
  const on = (id, fn)=>{ const el = document.getElementById(id); if(el) el.onclick = fn; };
  on('gd-skip', close); on('gd-prev', ()=>openGuide(_guideIdx-1)); on('gd-next', ()=>openGuide(_guideIdx+1));
  on('gd-practice', ()=>{ close(); startPractice(); });
}
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
