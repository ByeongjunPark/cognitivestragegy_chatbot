/* 수업 모드·원문 근거·응답 품질·진행 표시 런타임(index.html의 전역 session·$·esc·callLLM을 호출 시점에 쓴다).
   순수 로직은 js/lib/*.js에 있고, 여기는 화면·세션과 맞닿는 경계 코드다. */

/* ---------- 모드 (WP2-1) ---------- */
function currentMode(){
  if(typeof session!=='undefined' && session && session.mode) return session.mode;
  let stored = null; try{ stored = localStorage.getItem('classMode'); }catch(e){}
  return CS.resolveMode(location.search, stored);
}
function cfg(){ return CS.modeCfg(currentMode()); }
function capNow(){ return CS.CAP[CS.capBand(session && session.ctx && session.ctx.grade)]; }
function uiBandNow(){ return CS.uiBand(session && session.ctx ? session.ctx.grade : ($('#st-band') && $('#st-band').value)); }
function flag(type, text, extra){
  if(!session) return;
  (session.flags = session.flags || []).push(Object.assign({ type, text: String(text||'').slice(0,300), at: new Date().toISOString(), phase: session.phase }, extra||{}));
}
function aiTurnCount(){ return session ? session.turns.filter(t=>t.role==='ai').length : 0; }
function effSupport(){ return CS.effectiveSupport(session.support, session.helpBoost, aiTurnCount()); }

/* ---------- 교육과정 원문 RAG ---------- */
const RAG_BAND_ID = { '초등학교 3~4학년':'e34', '초등학교 5~6학년':'e56', '중학교 1~3학년':'m', '고등학교 1학년':'h1' };
let _rag = { key:null, index:null, source:null };
function ragKeyFor(band, subjKey){ return (RAG_BAND_ID[band]||'x') + '__' + subjKey; }
// 세션의 성취기준이 속한 과목 원문 색인을 불러온다. 파일을 못 읽으면(파일로 직접 열기 등) 성취기준 데이터로 색인한다.
async function ensureRag(){
  if(!session || !session.ctx) return null;
  const band = session.ctx.band, subjKey = session.ctx.subjKey || session.ctx.subject;
  const key = ragKeyFor(band, subjKey);
  if(_rag.key===key && _rag.index) return _rag.index;
  let chunks = null, source = 'pdf';
  try{ const r = await fetch('data/rag/' + encodeURIComponent(key) + '.json'); if(r.ok) chunks = await r.json(); }catch(e){}
  if(!chunks){ source = 'data'; chunks = CS.chunksFromStandards(((CURRICULUM_STANDARDS[band]||{})[subjKey])||[], subjKey, band); }
  _rag = { key, index: CS.buildIndex(chunks), source };
  return _rag.index;
}
function ragCodes(){ return [session.ctx.code, ...((session.ctx.extraStds||[]).map(e=>e.code))].filter(Boolean); }
function ragResults(query, k){
  if(!_rag.index || !session) return [];
  const q = [session.ctx.std, query||''].join(' ');
  return CS.retrieve(_rag.index, q, { k: k||4, codes: ragCodes() });
}
function ragContext(query, k, maxChars){ return CS.contextBlock(ragResults(query, k), maxChars||800); }

/* ---------- 응답 품질 파이프라인 (WP1-3·1-4·2-5·3-1·3-3) ---------- */
// 위젯이 실제로 붙는 kind
const WIDGET_KINDS = new Set(['prior-pick','strategy-pick','struct-offer','reason-pick','help-pick','change-reason-pick']);
function qualityIssues(text, opts){
  const o = opts||{}; const issues = [];
  const subj = session && session.ctx && session.ctx.subject;
  if(CS.looksBroken(text, { allowEnglish: subj==='영어' }).broken) issues.push('broken');
  if(CS.hasBannedProbe(text)) issues.push('probe');
  if(CS.termViolations(text, subj).length) issues.push('term');
  if(!o.suffix && CS.countQuestions(text) > 1) issues.push('multi-q');
  if(CS.toneProfile(text).banmal > 0) issues.push('tone');
  return issues;
}
function retryWarning(issues){
  const w = [];
  if(issues.includes('broken')) w.push('문장이 어색하거나 끊긴 곳이 있었다. 맞춤법에 맞는 자연스러운 문장으로 다시 써라');
  if(issues.includes('probe')) w.push('"왜 그렇게 말했어?"처럼 따지는 질문을 썼다. "어떤 점 때문에 그렇게 생각했어요?"처럼 부드럽게 물어라');
  if(issues.includes('term')) w.push('교과 용어 규칙을 어겼다: ' + CS.termRuleText(session.ctx.subject));
  if(issues.includes('multi-q')) w.push('질문을 2개 이상 했다. 질문은 딱 1개만');
  if(issues.includes('tone')) w.push('반말이 섞였다. 처음부터 끝까지 해요체로만');
  return w.length ? ' (고쳐야 할 점: ' + w.join(' / ') + '.)' : '';
}
// LLM 문장 → 학생 화면 문장. 순서: 용어 교정 → 해요체 → 추궁형 완화 → (질문 1개·분량 상한) → 위젯 일치
function finalizeAiText(text, o){
  const subj = session.ctx.subject;
  let t = String(text||'').trim();
  const tv = CS.termViolations(t, subj); if(tv.length){ flag('term', t, { rules: tv.map(v=>v.id) }); t = CS.fixTerms(t, subj); }
  if(CS.toneProfile(t).banmal){ t = CS.toHaeyo(t); if(CS.toneProfile(t).banmal) flag('tone', t); }
  if(CS.hasBannedProbe(t)){ flag('probe', t); t = CS.softenProbes(t); }
  const cap = capNow();
  // 위젯 일치 검사는 LLM이 쓴 부분에만 한다(코드가 붙이는 고정 안내는 실제 화면 요소를 가리킨다)
  const widgetCheck = (x, fb) => { if(!WIDGET_KINDS.has(o.passKind) && CS.needsWidget(x)){ flag('widget', x); return CS.neutralizeWidgetRef(x, fb); } return x; };
  if(o.suffix){
    t = CS.splitSentences(t).filter(x=>!CS.isQuestion(x)).join(' ').trim(); // 고정 질문은 코드가 붙인다 — LLM 부분의 질문은 모두 뺀다
    // 고정 문구도 분량에 들어간다: LLM 부분은 (상한 - 고정 문구 문장 수)만큼만(최소 1문장)
    const sufN = CS.splitSentences(o.suffix).length;
    t = CS.capSentences(t, { sentences: Math.max(1, cap.sentences - sufN), chars: Math.max(50, cap.chars - o.suffix.length) });
    if(CS.needsWidget(t)){ flag('widget', t); t = CS.splitSentences(t).filter(x=>!CS.needsWidget(x)).join(' '); }
    t = (t ? t + ' ' : '') + o.suffix;
  } else {
    t = CS.keepOneQuestion(t);
    t = CS.capSentences(t, o.reveal ? { sentences: cap.sentences+3, chars: cap.chars*2 } : cap);
    t = widgetCheck(t, o.fallbackAsk || CS.COPY.neutralAsk);
  }
  if(CS.looksBroken(t, { allowEnglish: subj==='영어' }).broken){
    flag('broken', t);
    t = o.suffix ? o.suffix : ('알려 줘서 고마워요. ' + (o.fallbackAsk || CS.COPY.neutralAsk));
  }
  return t;
}
// 사실 검수(WP3-3): 원문 근거에 비추어 사실 오류가 있는지 temperature 0으로 따로 확인한다(과목별 켜기·끄기).
async function verifyFacts(text){
  const on = (cfg().verify||{})[session.ctx.subject];
  if(!on) return { ok:true, skipped:true };
  const facts = CS.splitSentences(text).filter(s=>!CS.isQuestion(s) && s.length>=12);
  if(!facts.length) return { ok:true, skipped:true };
  const ev = ragContext(facts.join(' '), 4, 900);
  try{
    const raw = await callLLM([
      { role:'system', content:'너는 초중등 교과 내용 검수자다. 반드시 순수 JSON만 출력한다. 근거 원문과 일반적인 교과 지식에 비추어 명백한 사실 오류나 교과 용어 오용(예: 고도는 높다/낮다, 길이는 길다/짧다)만 잡는다. 표현이 쉬울 뿐인 것은 오류가 아니다.' },
      { role:'user', content:`[교육과정 원문 근거]\n${ev||'-'}\n[용어 규칙] ${CS.termRuleText(session.ctx.subject)||'-'}\n[검수할 답변] ${facts.join(' ')}\n{"ok":true,"issue":"오류가 있으면 무엇이 틀렸는지 한 문장, 없으면 빈 문자열"}` }
    ], { temperature:0, json:true });
    const j = parseJSON(raw);
    return { ok: j.ok!==false, issue: String(j.issue||'') };
  }catch(e){ return { ok:true, skipped:true }; }
}

/* ---------- 반응 구조·예상 밖 답변 (WP3-1·3-7) ---------- */
function lastTypedText(){
  const t = [...session.turns].reverse().find(x=>x.role==='me' || x.role==='ai');
  return t && t.role==='me' && t.src==='typed' ? String(t.text||'') : '';
}
function reactionAddon(o){
  const said = lastTypedText(); if(!said) return '';
  session.reactIdx = (session.reactIdx||0) + 1;
  let add = ' ' + CS.buildReactionInstr(session.reactIdx);
  if(o && o.suffix) add += ' 이번 턴은 질문을 하지 말고 ①②만 한다(질문은 화면이 따로 붙인다).';
  const kind = CS.classifyOffScript(said, session.scope||[]);
  if(kind && session.phase!=='prep'){ add += ' ' + CS.OFFSCRIPT_POLICY[kind]; (session.offScript = session.offScript||[]).push({ kind, at:new Date().toISOString() }); }
  // (WP3-4) 수학 풀이를 단계로 썼으면 처음 어긋난 단계 하나만 짚는다
  if(session.ctx.subject==='수학' && CS.parseSteps(said).length >= 2) add += ' 학습자가 풀이를 단계로 나눠 썼다. 처음으로 어긋난 단계 하나만 "○단계"라고 짚고 그 까닭을 한 문장으로 말하라. 정답이나 바른 풀이 전체는 주지 마라. 모든 단계가 맞으면 어느 단계를 잘했는지 구체적으로 칭찬하라.';
  // 대표 오개념 방향이면 정답 대신 반례 질문(WP3-2)
  const mis = (session.ctx.misconceptions||[]);
  if(mis.length && !(o && o.suffix)) add += ` 학습자의 말이 다음 대표 오개념 쪽이면 정답을 말하지 말고, 그 생각이 맞지 않는 반례를 떠올리게 하는 질문 1개로 반응하라: ${mis.map(m=>'"'+m+'"').join(', ')}.`;
  return add;
}

/* ---------- 진행 상태·남은 시간·할 일 한 줄 (WP2-2) ---------- */
function stepKeyNow(){
  const scr = currentScreen && currentScreen();
  if(scr==='start') return 'start';
  if(!session) return null;
  if(scr==='chat'){
    if(session.phase==='prep') return session.prepStep==='meta' ? 'meta' : 'activate';
    return session.cycleStarted ? 'explore' : 'pick';
  }
  if(scr==='reflect') return 'reflect';
  if(scr==='residual') return session.residual && session.residual.result ? 'journal' : 'residual';
  return null;
}
function todoKeyNow(){
  const scr = currentScreen && currentScreen();
  if(['auth','home','start'].includes(scr)) return 'todo.'+scr;
  if(!session) return null;
  if(scr==='chat'){
    if(session.phase==='prep') return session.prepStep==='meta' ? 'todo.meta' : session.prepStep==='priorscore' ? 'todo.priorscore' : 'todo.activate';
    if(!session.cycleStarted) return session.prepStep==='reason' ? 'todo.reason' : 'todo.pick';
    return 'todo.explore';
  }
  if(scr==='reflect') return cfg().reflectOneScreen ? 'todo.reflectOne' : (session.reflect.step==='prompt' ? 'todo.reflectB' : 'todo.reflectA');
  if(scr==='residual') return session.residual && session.residual.result ? 'todo.journal' : 'todo.residual';
  return null;
}
const TODO_REQUIRED = { 'todo.meta':'선택 많음', 'todo.priorscore':'필수', 'todo.activate':'필수', 'todo.pick':'필수', 'todo.reason':'필수', 'todo.explore':'필수', 'todo.reflectOne':'필수 1개', 'todo.reflectA':'필수', 'todo.reflectB':'필수', 'todo.residual':'필수', 'todo.journal':'필수', 'todo.start':'필수' };
function paintTodo(){
  document.body.classList.toggle('mode-class40', currentMode()==='class40'); // 한 차시 모드: 카드 보조 설명 줄이기
  const scr = currentScreen && currentScreen(); if(!scr) return;
  const key = todoKeyNow(); const box = document.querySelector(`.screen[data-screen="${scr}"] .todo-line`);
  if(!box) return;
  if(!key){ box.hidden = true; return; }
  const band = uiBandNow();
  const step = stepKeyNow(); const c = cfg();
  const st = CS.STEPS.find(s=>s.k===step);
  const est = st && st.budget ? `약 ${c.budgetMin[st.budget]}분` : '';
  const req = TODO_REQUIRED[key];
  box.hidden = false;
  box.innerHTML = `<b>여기서 할 일</b> <span class="todo-text">${esc(CS.uiCopy(band, key))}</span>${est?` <span class="todo-est">${est}</span>`:''}${req?` <span class="${/필수/.test(req)?'req-tag':'opt-tag'}">${esc(req)}</span>`:''}${band==='초저' && window.speechSynthesis ? ` <button type="button" class="head-link todo-speak" aria-label="안내 읽어 주기">🔊 읽어 주기</button>`:''}`;
}
function progressLine(){
  if(!session && currentScreen()!=='start') return '';
  const step = stepKeyNow(); if(!step) return '';
  const i = CS.STEPS.findIndex(s=>s.k===step);
  const times = session && session.phaseTimes ? CS.phaseMs(session.phaseTimes, Date.now()) : {};
  const rem = CS.remainingMinutes(currentMode(), step, times[step] || 0);
  return `<div class="pb-progress" aria-live="polite"><b>지금 ${i+1} / ${CS.STEPS.length}단계</b> · ${esc(CS.STEPS[i].t)} · 남은 시간 약 ${rem}분 <span class="pb-mode">${esc(cfg().label)}</span></div>`;
}

/* ---------- 단계별 소요시간 (WP0-3) ---------- */
let _phaseKey = null, _startEnteredAt = null;
function trackPhase(){
  const key = stepKeyNow();
  const now = Date.now();
  if(currentScreen()==='start' && !_startEnteredAt) _startEnteredAt = now;
  if(!session || key===_phaseKey) return;
  if(!session.phaseTimes){
    session.phaseTimes = {};
    if(_startEnteredAt) session.phaseTimes.start = { enteredAt:_startEnteredAt, leftAt: now, ms: now - _startEnteredAt, visits:1 };
  }
  const from = _phaseKey && _phaseKey!=='start' ? _phaseKey : (session.phaseTimes[_phaseKey]&&_phaseKey!=='start' ? _phaseKey : null);
  session.phaseTimes = CS.phaseSwitch(session.phaseTimes, from, key && key!=='start' ? key : null, now);
  _phaseKey = key;
}
// 이어하기·화면 떠남: 열린 구간을 닫아 두면 새로고침 뒤에도 합산이 맞는다
function closePhase(){ if(session && session.phaseTimes && _phaseKey) { session.phaseTimes = CS.phaseLeave(session.phaseTimes, _phaseKey, Date.now()); _phaseKey = null; } }
window.addEventListener('pagehide', closePhase);

/* ---------- 내 진단 보기 (WP5-2) ---------- */
function openMyDiagnosis(){
  if(!session) return;
  const scr = currentScreen();
  const body = (typeof levelSummaryHTML==='function' && levelSummaryHTML()) || '';
  const pre = session.prior && session.prior.diagScore!=null ? `<div class="kv"><span>사전 확인 문제</span><b>${session.prior.diagScore}점</b></div>` : '<div class="kv"><span>사전 확인 문제</span><b>아직 안 했어요</b></div>';
  const cps = (session.checkpoints||[]).map(c=>c.score);
  const cp = cps.length ? `<div class="kv"><span>이해도 체크</span><b>${cps.join(' → ')} (5점 만점)</b></div>` : '<div class="kv"><span>이해도 체크</span><b>아직 안 했어요</b></div>';
  const strat = `<div class="kv"><span>쓰고 있는 방법</span><b>${esc(session.strategyLabel||'아직 안 골랐어요')}</b></div>`;
  const note = scr==='residual' ? '<p class="hint">혼자 풀어보기 문제의 정답과 풀이는 다 낸 뒤에 볼 수 있어요.</p>' : '';
  modalHTML('지금까지 내 진단', `<div class="stack" style="gap:8px">${pre}${!session.meta.scoreDetail ? '<div class="kv"><span>스스로 점검</span><b>'+(session.meta.gradeFailed?'이번엔 채점하지 못했어요':'아직 안 했어요')+'</b></div>' : ''}${body}${cp}${strat}${note}</div>`);
}

/* ---------- 칩 위젯 (WP2-4·3-1·3-6): 선택지를 먼저, "직접 쓰기"는 마지막 ---------- */
function choiceChipsHTML(list, group){
  return `<div class="inline-pick chip-list" data-pick="choice" data-group="${esc(group)}">` +
    list.map(v=>`<button type="button" class="chip" data-v="${esc(v)}">${esc(v)}</button>`).join('') +
    (group==='help' ? '' : `<button type="button" class="chip chip-write" data-write="1">✏️ 직접 쓸래요</button>`) + `</div>`;
}

/* ---------- 스스로 점검 카드 (WP1-2) — 숫자 대신 3단계 막대 + 하위 지표 체크 ---------- */
function levelBarHTML(a){
  const w = a.level==null ? 0 : [22, 58, 100][a.level];
  return `<div class="lv3-row"><span class="lv3-lab">${esc(a.label)}</span><span class="lv3-bar l${a.level==null?'x':a.level}" role="img" aria-label="${esc(a.label)}: ${esc(a.levelLabel)}"><i style="width:${w}%"></i></span><b class="lv3-txt">${esc(a.levelLabel)}</b></div>` +
    (a.indicators.length ? `<div class="msc-ind">${a.indicators.map(x=>`<span class="${x.on?'on':''}">${x.on?'✓':'·'} ${esc(x.label)}</span>`).join('')}</div>` : '');
}
function metaCardInner(meta){
  const v = CS.metaScoreView(meta);
  const head = `<div class="msc-title">스스로 점검 결과 <span class="hint" style="font-weight:500">(내가 말한 내용을 살펴본 거예요 · 맞다·틀리다가 아니에요)</span></div>`;
  const usual = session && session.meta.usualMethod ? `<div class="msc-note"><b>평소 공부법:</b> ${esc(session.meta.usualMethod)}</div>` : '';
  const body = v.ok ? v.axes.map(levelBarHTML).join('') : `<p class="msc-note">이번엔 채점하지 못했어요. 내가 쓴 답은 그대로 남아 있고, 선생님이 볼 수 있어요.</p>`;
  const fb = meta.feedback ? `<div class="msc-note">${esc(meta.feedback)}</div>` : '';
  const reported = session && (session.scoreReports||[]).length;
  const report = `<div class="msc-foot"><button type="button" class="head-link score-report-btn">${reported ? '알려 줘서 고마워요 ✓' : '이 결과가 이상하면 알려 주기'}</button></div>`;
  return head + usual + body + fb + report;
}
document.addEventListener('click', e=>{
  const b = e.target.closest && e.target.closest('.score-report-btn'); if(!b || !session) return;
  if((session.scoreReports||[]).length) return;
  (session.scoreReports = session.scoreReports||[]).push({ at:new Date().toISOString(), scoreDetail: session.meta.scoreDetail||null, indicators: session.meta.indicators||null, answers: session.meta.answers||null });
  flag('score-report', '학생이 스스로 점검 결과가 이상하다고 알림');
  pushNote('알려 줘서 고마워요. 선생님 화면에 전달돼요. 어떤 점이 이상했는지 채팅에 적어도 좋아요.');
});

/* ---------- 한 차시 모드: 스스로 점검 한 화면 (WP2-1·2-4, 원리7 세 질문 구별 유지) ---------- */
const META_FORM_ROWS = [
  { k:'usual', title:'평소에 이런 내용은 어떻게 공부해요?', chips:['교과서를 여러 번 읽어요','문제를 많이 풀어요','중요한 걸 정리해요','외울 때까지 반복해요','설명을 들으며 이해해요'], ph:'다른 방법이면 직접 써요(선택)' },
  { k:'understand', title:'이해 — 아직 확신이 안 서는 곳은 어디예요?', chips:['낱말 뜻이 헷갈려요','푸는 순서가 헷갈려요','왜 그렇게 되는지가 헷갈려요','어디가 헷갈리는지 잘 모르겠어요','지금은 다 알 것 같아요'], ph:'어느 부분인지, 어떤 점 때문인지 한 줄(선택)' },
  { k:'strategy', title:'방법 — 이 내용은 어떤 순서로 공부하면 좋을까요?', chips:['먼저 뜻을 읽고 예를 찾아요','문제를 풀며 확인해요','그림·표로 정리해요','반복해서 외워요','친구에게 설명하듯 말해 봐요'], ph:'그 방법이 좋겠다고 느낀 까닭 한 줄(선택)' },
  { k:'connect', title:'연결 — 전에 배운 것이나 생활과 이어지는 게 있나요?', chips:['전에 배운 것과 비슷해요','생활 속 예가 떠올라요','다른 과목과 이어져요','아직 잘 모르겠어요'], ph:'무엇과 어떤 점이 같은지 한 줄(선택)' }
];
function metaFormValid(f){ return META_FORM_ROWS.every(r=>{ const v = (f||{})[r.k]||{}; return !!(v.chip || (v.text||'').trim().length>=2); }); }
function metaFormHTML(t){
  const f = t.form || {};
  if(t.answered) return `<div class="meta-score-card"><div class="msc-title">스스로 점검 (한 화면) — 냈어요</div>${META_FORM_ROWS.map(r=>{ const v=f[r.k]||{}; return `<div class="msc-note"><b>${esc(r.title.split(' — ')[0])}:</b> ${esc([v.chip,v.text].filter(Boolean).join(' · ')||'-')}</div>`; }).join('')}</div>`;
  return `<div class="paper meta-form" data-tid="${t.id}"><div class="tab">스스로 점검 — 줄마다 하나씩 고르고, 하고 싶으면 한 줄 더 써요</div><div class="body stack">` +
    META_FORM_ROWS.map(r=>{ const v = f[r.k]||{};
      return `<div class="mf-row"><label class="field-label">${esc(r.title)} <span class="req-tag">하나 고르기</span></label>
        <div class="chip-list">${r.chips.map(c=>`<button type="button" class="chip mf-chip ${v.chip===c?'is-selected':''}" data-k="${r.k}" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <input class="input mf-text" data-k="${r.k}" placeholder="${esc(r.ph)}" value="${esc(v.text||'')}" maxlength="120" /></div>`; }).join('') +
    `</div><div style="text-align:right;padding:0 16px 16px"><button type="button" class="btn btn-sm btn-primary mf-submit" ${metaFormValid(f)?'':'disabled'}>다 골랐어요</button></div></div>`;
}
function pushMetaForm(){
  session.turns.push({ id:uid(), role:'note', kind:'meta-form', answered:false, form:{} });
  session.pendingMetaForm = true; renderStream(); syncComposeLock();
}
document.addEventListener('click', async e=>{
  const ch = e.target.closest && e.target.closest('.mf-chip');
  if(ch && session){ const t = session.turns.find(x=>x.kind==='meta-form' && !x.answered); if(!t) return;
    const cur = (t.form[ch.dataset.k]||{}); t.form = Object.assign({}, t.form, { [ch.dataset.k]: Object.assign({}, cur, { chip: cur.chip===ch.dataset.v ? null : ch.dataset.v }) });
    renderStream(); return; }
  const sb = e.target.closest && e.target.closest('.mf-submit');
  if(sb && session && !busy){ const t = session.turns.find(x=>x.kind==='meta-form' && !x.answered); if(!t || !metaFormValid(t.form)) return;
    const txt = k => { const v = t.form[k]||{}; return anonymize([v.chip, (v.text||'').trim()].filter(Boolean).join('. ')); };
    t.answered = true; session.pendingMetaForm = false;
    session.meta.usualMethod = txt('usual');
    session.meta.answers = { understand: txt('understand'), strategy: txt('strategy'), connect: txt('connect') };
    session.meta.raw = [txt('understand'), txt('strategy'), txt('connect')].join(' / ');
    session.meta.step = SCAFFOLD_ORDER.length; session.meta.form = t.form;
    renderStream(); prepNext();
  }
});
document.addEventListener('input', e=>{
  const it = e.target.closest && e.target.closest('.mf-text'); if(!it || !session) return;
  const t = session.turns.find(x=>x.kind==='meta-form' && !x.answered); if(!t) return;
  const cur = t.form[it.dataset.k]||{}; t.form = Object.assign({}, t.form, { [it.dataset.k]: Object.assign({}, cur, { text: it.value }) });
  const b = document.querySelector('.mf-submit'); if(b) b.disabled = !metaFormValid(t.form);
});

/* ---------- 탐구 범위 가이드·자료 카드·대표 오개념 (WP3-2·3-5) ---------- */
function initSessionExtras(){
  if(!session || session._extrasInit) return; session._extrasInit = true;
  session.scope = CS.scopeTokensFrom(session.ctx.std, session.ctx.concept, session.goal);
  // 대표 오개념 1~2개: 원문 근거 안에서만, temperature 0 (실패해도 대화는 그대로)
  ensureRag().then(()=>{
    const ev = ragContext(session.ctx.std, 4, 700);
    return callLLM([
      { role:'system', content:'너는 초중등 교과 교육 전문가다. 반드시 순수 JSON만 출력한다.' },
      { role:'user', content:`성취기준: ${session.ctx.std} (${session.ctx.grade||session.ctx.band} ${session.ctx.subject})\n교육과정 원문 근거: ${ev||'-'}\n이 내용을 배우는 학생들이 흔히 갖는 대표 오개념 1~2개를 학생이 실제로 말할 법한 한 문장으로 써라. 원문 범위 밖 내용은 쓰지 마라.\n{"misconceptions":["...","..."]}` }
    ], { temperature:0, json:true });
  }).then(raw=>{ const j = parseJSON(raw); if(Array.isArray(j.misconceptions)) session.ctx.misconceptions = j.misconceptions.slice(0,2).map(x=>String(x).slice(0,80)); })
    .catch(()=>{});
}
function paintScope(){
  const box = $('#scope-panel'); if(!box || !session) return;
  const toks = (session.scope||[]).filter(t=>t.length>=2).slice(0,8);
  box.hidden = !toks.length;
  $('#scope-list').innerHTML = toks.map(t=>`<span class="chip">${esc(t)}</span>`).join('');
}
function scopeNudge(text){
  const v = CS.scopeVerdict(text, session.scope||[]);
  (session.scopeLog = session.scopeLog||[]).push({ v, at:new Date().toISOString() });
  if(v!=='out') return;
  const typed = session.turns.filter(t=>t.role==='me' && t.src==='typed').length;
  if(session._scopeNotedAt!=null && typed - session._scopeNotedAt < 4) return;
  session._scopeNotedAt = typed;
  setTimeout(()=>pushNote('오늘 탐구 범위와 조금 다른 이야기 같아요. 궁금하면 이야기해도 괜찮아요. 위의 [오늘 탐구 범위]에서 오늘 다루는 낱말을 볼 수 있어요.'), 0);
}
// 사회·국어 등: 과업 시작 때 짧은 자료 카드. 교육과정 원문 조각을 150자 이내로 그대로 보여 준다(새 사실을 만들지 않음).
function maybePushSourceCard(){
  if(!session || session._sourceCard || !['사회','국어','과학'].includes(session.ctx.subject)) return;
  const rs = ragResults(session.ctx.std + ' ' + (session.goal||''), 6).filter(r=>['해설','고려사항','탐구활동','원문'].includes(r.chunk.kind) && (r.chunk.codes||[r.chunk.code]).some(c=>ragCodes().includes(c)));
  const pick = rs[0] || ragResults(session.ctx.std, 1)[0];
  if(!pick) return;
  session._sourceCard = true;
  const txt = pick.chunk.text.length > 150 ? pick.chunk.text.slice(0,148).replace(/\s\S*$/,'') + '…' : pick.chunk.text;
  session.turns.push({ id:uid(), role:'note', kind:'source-card', text: CS.hideCodes(txt), src: pick.chunk.src || {} });
  renderStream();
}
function sourceCardHTML(t){
  const s = t.src||{};
  return `<div class="meta-score-card source-card"><div class="msc-title">오늘 공부 자료 — 교육과정 원문에서</div><div class="msc-note" style="font-size:13.5px;color:var(--ink)">${esc(t.text)}</div><div class="hint" style="font-size:11px">출처: ${esc(s.doc||'2022 개정 교육과정')}${s.page?` ${s.page}쪽`:''}</div></div>`;
}

/* ---------- 다음엔 이렇게 (WP5-3) ---------- */
function paintNextPlan(){
  const box = $('#np-list'); if(!box || !session) return;
  const ids = CS.nextPlanCandidates(session.prior, session.meta);
  const weak = CS.weakAxis(session.prior, session.meta);
  const why = { activate:'공부 전 확인 문제에서 아직 낯선 곳이 있었어요.', understand:'헷갈리는 곳을 짚는 게 아직 어려웠어요.', strategy:'이 내용에 맞는 방법을 정하는 게 아직 어려웠어요.', connect:'다른 것과 이어 보는 게 아직 어려웠어요.', none:'이번 공부를 바탕으로 해 볼 만한 방법이에요.' }[weak];
  $('#np-why').textContent = why + ' 이 중 하나를 고르면 다음 공부를 시작할 때 미리 골라 둘게요(바꿔도 돼요).';
  box.innerHTML = ids.map(id=>{ const s = STRATS.find(x=>x.id===id); if(!s) return ''; return `<button type="button" class="chip np-chip ${session.nextPlan===id?'is-selected':''}" data-id="${id}">${s.emoji} ${esc(s.label)}</button>`; }).join('');
  const w = $('#in-wonder'); if(w && !w.value) w.value = session.wonder || '';
}
document.addEventListener('click', e=>{
  const b = e.target.closest && e.target.closest('.np-chip'); if(!b || !session) return;
  session.nextPlan = session.nextPlan===b.dataset.id ? null : b.dataset.id; paintNextPlan();
});
// 지난 공부에서 고른 "다음엔 이 방법" — 새 공부의 방법 고르기 카드에 미리 선택해 둔다
function lastNextPlan(){
  const acc = account(); if(!acc) return [];
  const prev = (acc.sessions||[]).filter(s=>!s.isSample && s.nextPlan).slice(-1)[0];
  return prev && STRATS.some(x=>x.id===prev.nextPlan) ? [prev.nextPlan] : [];
}
function lastWonder(){
  const acc = account(); if(!acc) return '';
  const prev = (acc.sessions||[]).filter(s=>!s.isSample && s.wonder).slice(-1)[0];
  return prev ? prev.wonder : '';
}

/* ---------- 학습 목표 입력 돕기 (WP3-2, 전문가1 "좁혀 가는 장치·예시 문장") ---------- */
function goalExampleSentences(){
  const band = bandOf($('#st-band').value), subj = $('#st-subject').value;
  const pool = subj ? ((CURRICULUM_STANDARDS[band]||{})[subj]||[]) : Object.values(CURRICULUM_STANDARDS[band]||{}).flat();
  if(!pool.length) return [];
  // 날마다 바뀌되 같은 날엔 같은 예시(새로고침마다 흔들리지 않게)
  const seed = new Date().toISOString().slice(0,10).split('-').reduce((a,b)=>a*31+(+b),7);
  const picks = [0,1,2].map(k=>pool[(seed*(k+3)+k*97) % pool.length]);
  const core = it => String(it.name).replace(/(할 수 있다|한다|하다|이해한다|안다|설명한다|탐구한다)\.?$/,'').replace(/[을를]\s*$/,'').trim();
  return [...new Set(picks.map(it=>`${trim(core(it),34)}에 대해 알고 싶어요`))];
}
function paintGoalHelpers(){
  const box = $('#st-goal-help'); if(!box) return;
  const w = lastWonder();
  const ex = goalExampleSentences();
  box.innerHTML = (w ? `<button type="button" class="chip goal-ex" data-v="${esc(w)}">💭 지난번에 궁금했던 것: ${esc(trim(w,40))}</button>` : '') +
    ex.map(s=>`<button type="button" class="chip goal-ex" data-v="${esc(s)}">${esc(s)}</button>`).join('');
}
// 넓은 입력이면 바로 고르지 않고 "이 중에서 어느 쪽이 궁금해요?"로 2~3개 좁혀 되묻는다
function narrowGoalChoices(cands){
  const box = $('#st-narrow'); if(!box) return false;
  const top = cands.slice(0,3); if(top.length < 2) return false;
  box.hidden = false;
  box.innerHTML = `<p class="field-label" style="margin:0 0 6px">이 중에서 어느 쪽이 궁금해요?</p><div class="chip-list">${top.map(c=>`<button type="button" class="chip narrow-pick" data-code="${esc(c.code)}">${esc(c.name)}</button>`).join('')}</div>`;
  return true;
}
document.addEventListener('click', e=>{
  const g = e.target.closest && e.target.closest('.goal-ex');
  if(g){ $('#st-topic').value = g.dataset.v; $('#st-topic').focus(); return; }
  const np = e.target.closest && e.target.closest('.narrow-pick');
  if(np){
    const band = bandOf($('#st-band').value);
    const it = Object.entries(CURRICULUM_STANDARDS[band]||{}).flatMap(([k,arr])=>arr.map(x=>Object.assign({}, x, { subjKey:k }))).find(x=>x.code===np.dataset.code);
    if(!it) return;
    stPicks = [it]; $('#st-subject').value = it.subjKey; $('#st-narrow').hidden = true;
    if(!$('#st-topic').value.trim() || CS.isBroadGoal($('#st-topic').value)) $('#st-topic').value = `${trim(it.name,50)}`;
    fillStartStds();
  }
});

/* ---------- 수업 방식 고르기 (WP2-1): 교사 링크 ?mode= 가 있으면 그 값, 없으면 지난 선택, 기본은 한 차시 ---------- */
function paintModeToggle(){
  const box = $('#st-mode'); if(!box) return;
  const m = currentMode(); const locked = !!new URLSearchParams(location.search).get('mode');
  box.innerHTML = `<span class="field-label" style="margin:0">공부 방식</span>` + Object.entries(CS.MODE_CFG).map(([k,v])=>
    `<button type="button" class="chip mode-chip ${m===k?'is-selected':''}" data-mode="${k}" ${locked && m!==k ? 'disabled title="선생님이 정한 방식이에요"' : ''}>${esc(v.label)}</button>`).join('') +
    `<span class="hint" style="margin:0">${m==='class40' ? '문제·점검을 줄여 40분 안에 끝내요' : '모든 단계를 자세히 해요(시간이 더 걸려요)'}</span>`;
}
document.addEventListener('click', e=>{
  const b = e.target.closest && e.target.closest('.mode-chip'); if(!b || b.disabled) return;
  try{ localStorage.setItem('classMode', b.dataset.mode); }catch(_){}
  paintModeToggle();
});

/* ---------- 서술 칸 옆 마이크 (WP2-4) ---------- */
document.addEventListener('click', e=>{
  const b = e.target.closest && e.target.closest('.mic-for'); if(!b) return;
  e.preventDefault(); e.stopPropagation();
  const f = b.dataset.for ? document.getElementById(b.dataset.for) : document.querySelector(b.dataset.forSel);
  if(!f) return;
  micField = f; f.focus();
  if(typeof micLang!=='undefined' && session && session.ctx) micLang = session.ctx.subject==='영어' && f.id==='chat-input' ? micLang : 'ko-KR';
  toggleMic();
}, true);
document.addEventListener('DOMContentLoaded', ()=>{ if(!(window.SpeechRecognition || window.webkitSpeechRecognition)) document.body.classList.add('no-sr'); });

/* ---------- 정리 도구 직관성 (보완 G1, 전문가4 "정리판 기능의 직관적 파악이 어렵다") ---------- */
// 버튼만 있던 정리 도구에 "무엇을 · 어떻게"를 한 줄로 붙인다. 칸은 학습자가 채우고 AI는 재료만 준다(원리2·8).
const STRUCT_HELP = {
  table:     '표: 낱말과 뜻(또는 특징)을 칸에 직접 채워요. AI는 재료 낱말만 줘요.',
  mindmap:   '마인드맵: 가운데 낱말과 관련 낱말을 끌어서 놓고 선으로 이어요.',
  compare:   '비교표: 두 가지를 나란히 놓고 같은 점·다른 점을 내가 써요.',
  chain:     '순서 사슬: 일이 일어나는 순서대로 카드를 담아요.',
  drill:     '반복 연습 체크: 연습한 것에 하나씩 표시해요.',
  retrieval: '떠올리기 연습: 안 보고 먼저 쓰고, 그다음 정답을 확인해요.',
  checklist: '아는지 체크: 항목마다 "알아요/헷갈려요"를 눌러요.'
};
function structHelp(type){ return STRUCT_HELP[type] || ''; }

/* ---------- 이번 공부 한눈에 (WP5-1, 전문가1 "방법·어려움 해결 과정·AI 도움 정도를 함께") ---------- */
function glanceCardHTML(s){
  if(!s || !s.ctx) return '';
  const band = CS.uiBand(s.ctx.grade);
  const g = CS.growthCard(s, band, id => (STRATS.find(x=>x.id===id)||{}).label, AUTO_ME_RE);
  const info = k => `<button type="button" class="info-i" data-info="${esc(k)}" aria-label="${esc(k)} 설명">ⓘ</button>`;
  return `<div class="widget glance"><div class="widget-head"><span class="badge-ic c-green"></span><div><h4>이번 공부 한눈에</h4><small>${esc(s.ctx.subject)} · ${esc(trim(s.ctx.std,36))} · ${esc((s.startedAt||'').slice(0,10))}</small></div></div>
    <div class="glance-row"><b>쓴 공부 방법 ${info('공부 방법')}</b><p>${esc(g.method)}</p></div>
    <div class="glance-row"><b>어려움을 풀어 간 과정</b><p>${esc(g.struggle)}</p></div>
    <div class="glance-row"><b>AI 도움을 받은 정도 ${info('AI 도움 크기')}</b><p>${esc(g.aiHelp)}</p></div>
    ${s.wonder ? `<div class="glance-row"><b>더 궁금해진 것</b><p>${esc(s.wonder)}</p></div>` : ''}
  </div>`;
}
document.addEventListener('click', e=>{
  const b = e.target.closest && e.target.closest('.info-i'); if(!b) return;
  modal(b.dataset.info, CS.TERM_INFO[b.dataset.info] || '');
});
function openDraftDiagnosis(){
  const acc = account(); if(!acc || !acc.draft) return;
  const keep = session; session = acc.draft.session;
  try{ openMyDiagnosis(); } finally { session = keep; }
}
document.addEventListener('click', e=>{ if(e.target.closest && e.target.closest('.my-diag-btn')) openMyDiagnosis(); });

/* ---------- 안내문 분량 (WP2-5): 60자 넘는 안내는 첫 문장 + 자세히 보기 ---------- */
function noteBubbleHTML(text){
  const t = String(text||'');
  if(t.length <= 60) return `<div class="bubble">${esc(t)}</div>`;
  const ss = CS.splitSentences(t); const first = ss[0] || t.slice(0,60);
  const rest = t.slice(t.indexOf(first) + first.length).trim();
  return rest ? `<div class="bubble">${esc(first)} <details class="note-more"><summary>자세히 보기</summary>${esc(rest)}</details></div>` : `<div class="bubble">${esc(t)}</div>`;
}
/* ---------- 초등 저학년 읽어 주기 (WP4-3) ---------- */
document.addEventListener('click', e=>{
  const b = e.target.closest && e.target.closest('.todo-speak'); if(!b || !window.speechSynthesis) return;
  const txt = (b.closest('.todo-line').querySelector('.todo-text')||{}).textContent || '';
  const u = new SpeechSynthesisUtterance(txt); u.lang = 'ko-KR'; u.rate = 0.95;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
});

/* ---------- 보조 출력(성찰 질문·설명·패턴 분석)도 같은 말투·추궁형·비문 방어선 (WP1-4·3-1) ---------- */
function polishAux(raw){
  let t = stripMarkdown(String(raw||'')).trim();
  t = CS.softenProbes(CS.toHaeyo(t));
  if(CS.looksBroken(t).broken){ flag('broken', t); }
  return CS.hideCodes(t);
}
