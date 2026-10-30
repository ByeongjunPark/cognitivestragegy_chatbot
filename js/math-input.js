/* 수학 입력 (WP3-4, 전문가6 "풀이 과정·정답에 수식 입력, 단계별 피드백").
   외부 의존성 없이 유니코드 기호로 입력한다(🔶 MathLive·KaTeX 도입은 연구진 선택 사항). */
const MATH_SYMBOLS = [
  { s:'( )/( )', t:'분수 틀 — 괄호 안에 분자/분모' }, { s:'²', t:'제곱' }, { s:'³', t:'세제곱' }, { s:'√( )', t:'제곱근' },
  { s:'≤', t:'작거나 같다' }, { s:'≥', t:'크거나 같다' }, { s:'≠', t:'같지 않다' }, { s:'=', t:'같다' },
  { s:'(', t:'여는 괄호' }, { s:')', t:'닫는 괄호' }, { s:'°', t:'도(각도)' }, { s:'…', t:'줄임' }
];
// 지금 쓰는 칸(마지막으로 누른 칸)에 기호를 넣는다 — 채팅·풀이 단계·혼자 풀기 칸 모두
function insertAtCursor(el, text){
  if(!el) return;
  const a = el.selectionStart != null ? el.selectionStart : el.value.length, b = el.selectionEnd != null ? el.selectionEnd : a;
  el.value = el.value.slice(0, a) + text + el.value.slice(b);
  const pos = a + (text.indexOf('( )') >= 0 ? text.indexOf('( )') + 1 : text.length);
  el.focus(); try{ el.setSelectionRange(pos, pos); }catch(e){}
  el.dispatchEvent(new Event('input', { bubbles:true }));
}
function mathPaletteHTML(){
  return MATH_SYMBOLS.map(m=>`<button type="button" class="sym-btn" data-sym="${esc(m.s)}" title="${esc(m.t)}">${esc(m.s)}</button>`).join('');
}
// 풀이 단계 입력: 한 줄에 한 단계, [+ 단계 추가], 보내면 "1단계: … / 2단계: …" 꼴로 대화에 들어간다
function openStepEditor(){
  const box = document.getElementById('step-editor'); if(!box) return;
  box.hidden = false;
  if(!box.querySelector('.step-in')) addStepRow(); addStepRow();
  box.querySelector('.step-in').focus();
}
function addStepRow(){
  const list = document.getElementById('step-list'); if(!list) return;
  const n = list.children.length + 1;
  list.insertAdjacentHTML('beforeend', `<div class="step-row"><span class="step-n">${n}단계</span><input class="input step-in" placeholder="이 단계에서 한 계산이나 생각" /></div>`);
}
function sendSteps(){
  const steps = [...document.querySelectorAll('#step-list .step-in')].map(x=>x.value.trim()).filter(Boolean);
  if(steps.length < 1) return;
  const inp = document.getElementById('chat-input');
  inp.value = CS.formatSteps(steps).replace(/\n/g, ' / ');
  document.getElementById('step-list').innerHTML = ''; document.getElementById('step-editor').hidden = true;
  sendChat();
}
document.addEventListener('DOMContentLoaded', ()=>{
  const pal = document.getElementById('math-symbols');
  if(pal){
    pal.insertAdjacentHTML('beforeend', mathPaletteHTML() + `<button type="button" class="sym-btn step-open" title="한 줄에 한 단계씩 풀이를 써요">✎ 풀이 단계로 쓰기</button>`);
    pal.insertAdjacentHTML('afterend', `<div id="step-editor" class="step-editor" hidden><div class="hint">한 줄에 한 단계씩 써요. AI는 처음 어긋난 단계 하나만 짚어 줘요(정답은 주지 않아요).</div><div id="step-list"></div>
      <div class="row"><button type="button" class="btn btn-sm btn-ghost" id="step-add">+ 단계 추가</button><button type="button" class="btn btn-sm btn-ghost" id="step-cancel">닫기</button><span class="filler"></span><button type="button" class="btn btn-sm btn-primary" id="step-send">풀이 보내기</button></div></div>`);
    document.getElementById('step-add').onclick = addStepRow;
    document.getElementById('step-cancel').onclick = ()=>{ document.getElementById('step-editor').hidden = true; };
    document.getElementById('step-send').onclick = sendSteps;
  }
});
// 기호 버튼(채팅·혼자 풀기 공통): 마지막으로 누른 칸에 넣는다. 기존 채팅창 기호 처리보다 먼저 받는다.
document.addEventListener('click', e=>{
  const so = e.target.closest && e.target.closest('.step-open'); if(so){ e.stopImmediatePropagation(); openStepEditor(); return; }
  const b = e.target.closest && e.target.closest('.sym-btn'); if(!b) return;
  e.stopImmediatePropagation();
  const target = (typeof micTarget === 'function' && micTarget()) || document.getElementById('chat-input');
  insertAtCursor(target, b.dataset.sym);
}, true);
