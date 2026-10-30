// 가상 학생 시범 운용(키 없이) — 로컬 서버 + 결함 주입 모의 LLM + 대본형 학생 페르소나로 앱 전체를 끝까지 사용하고,
// 전문가 평가 지적 항목별 지표를 자동 집계한다. 같은 학생·같은 모의 LLM으로 개선 전(원본 커밋) 코드도 돌려 비교할 수 있다.
// 사용: PW=<playwright-core 폴더> node tools/student-agent/pilot.mjs --root . [--label after] [--mode class40] [--persona all] [--scenario all] [--seed 7] [--out <폴더>]
//      --chrome <chrome.exe 경로>(기본: 시스템 Chrome)  --resume-test(첫 실행에서 새로고침 뒤 이어하기 점검)
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import { mockLLM, makeRng } from './mock-llm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const ROOT = path.resolve(args.root || path.join(HERE, '../..'));
const LABEL = args.label || 'after';
const MODE = args.mode || 'class40';
const SEED = +(args.seed || 7);
const OUT = path.resolve(args.out || path.join(HERE, 'results', 'pilot-' + LABEL + '-' + MODE));
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.PW || 'playwright-core'));
// 분석기는 늘 "개선 후" 라이브러리를 쓴다(개선 전 코드도 같은 잣대로 잰다)
for (const f of ['js/mode-config.js', 'js/tone.js', 'js/glossary.js', 'js/lib/guards.js', 'js/lib/scoring.js']) await import(pathToFileURL(path.join(HERE, '../..', f)).href);
const CS = globalThis.CS;

const PERSONAS = {
  average: { label: '보통형', correct: 0.7, conf: 3, read: 250, type: 25 },
  struggling: { label: '이해 부족형', correct: 0.35, conf: 4, read: 220, type: 22 },
  lowgrade: { label: '초3 저학년형', correct: 0.4, conf: 3, read: 150, type: 12 },
  disengaged: { label: '딴짓형', correct: 0.3, conf: 3, read: 250, type: 25 }
};
const SCEN = {
  math: { grade: '초등학교 5학년', subject: '수학', goal: '분모가 다른 분수끼리 더하는 방법을 잘 하고 싶어요', talk: ['분모를 같게 만든 다음에 분자끼리 더하면 될 것 같아요', '통분할 때 최소공배수를 찾으면 돼요?', '2/3+1/4는 8/12+3/12라서 11/12예요', '분모끼리도 더하면 안 되나요?', '그림으로 그려 보니까 크기가 달라서 바로 못 더해요'] },
  social: { grade: '초등학교 6학년', subject: '사회', goal: '4·19 혁명과 6월 민주 항쟁이 민주주의 발전에 어떤 의미가 있는지 알고 싶어요', talk: ['4·19 혁명은 학생들이 부정 선거에 맞선 일이에요', '시민들이 직접 나서서 민주주의를 지킨 거 같아요', '6월 민주 항쟁으로 대통령을 직접 뽑게 됐어요', '두 사건 모두 국민이 주인이라는 걸 보여 줘요', '요즘 선거랑도 이어지는 것 같아요'] },
  science_namjung: { grade: '초등학교 6학년', subject: '과학', goal: '계절에 따라 태양의 남중 고도와 낮의 길이가 어떻게 달라지는지 알고 싶어요', talk: ['여름에는 해가 높이 떠서 더운 것 같아요', '남중 고도가 높으면 그림자가 짧아져요', '겨울에는 낮의 길이가 짧아요', '지구 자전축이 기울어져서 그런가요?', '태양 고도 측정기로 재 보면 알 수 있어요'] },
  math_equation: { grade: '중학교 1학년', subject: '수학', goal: '일차방정식을 풀이 단계에 따라 푸는 방법을 알고 싶어요', talk: ['양변에 같은 수를 더해도 등식이 성립해요', '1단계: 2x+3=11 / 2단계: 2x=8 / 3단계: x=4', '이항하면 부호가 바뀌어요', '1단계: 3x-5=10 / 2단계: 3x=5 / 3단계: x=5/3', '검산해 보니까 맞는 것 같아요'] }
};
const persona = args.persona && args.persona !== 'all' ? String(args.persona).split(',') : Object.keys(PERSONAS);
const scenario = args.scenario && args.scenario !== 'all' ? String(args.scenario).split(',') : Object.keys(SCEN);

// ---------- 정적 서버 ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: args.chrome || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

async function runOne(pid, sid, idx) {
  const P = PERSONAS[pid], S = SCEN[sid];
  const rng = makeRng(SEED * 97 + idx * 13 + 1);
  const llmLog = [], state = {}, act = [], errors = [];
  const cfg = { faultRate: +(args.fault || 0.35), fixRate: +(args.fix || 0.6), metaFail: pid === 'disengaged' ? 0.5 : 0.05, verifyFail: 0.03 };
  const ctx = await browser.newContext({ viewport: { width: +(args.width || 1100), height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('UPSTAGE_API_KEY', 'mock'); localStorage.setItem('micNotice', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => d.accept());
  await page.route('https://api.upstage.ai/**', async route => {
    let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
    const content = mockLLM(body.messages || [], rng, cfg, llmLog, state);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  const ev = (fn, a) => page.evaluate(fn, a);
  const idle = async () => { try { await page.waitForFunction(() => typeof busy !== 'undefined' && !busy && !document.querySelector('#pending'), null, { timeout: 30000 }); } catch (e) { errors.push('idle timeout'); } await page.waitForTimeout(120); };
  let lastLen = 0;
  const stepNow = () => ev(() => { const scr = (document.querySelector('.screen.is-active') || {}).dataset?.screen; if (typeof session === 'undefined' || !session) return scr; if (scr === 'chat') return session.phase === 'prep' ? (session.prepStep === 'meta' ? 'meta' : 'activate') : (session.cycleStarted ? 'explore' : 'pick'); if (scr === 'residual') return session.residual && session.residual.result ? 'journal' : 'residual'; return scr; });
  const note = async (kind, typed) => {
    const len = await ev(() => (document.querySelector('.screen.is-active') || document.body).innerText.length);
    const read = Math.max(0, len - lastLen); lastLen = len;
    act.push({ step: await stepNow(), kind, read, typed: typed || 0, clicks: kind === 'type' ? 1 : 1 });
  };
  const click = async (sel, i) => { const l = page.locator(sel); if (!(await l.count())) return false; await l.nth(i || 0).click({ timeout: 5000 }).catch(() => {}); await note('click'); return true; };
  const fill = async (sel, text, i) => { const l = page.locator(sel); if (!(await l.count())) return false; await l.nth(i || 0).fill(text).catch(() => {}); await l.nth(i || 0).dispatchEvent('input').catch(() => {}); await note('type', text.length); return true; };
  const closeModals = async () => { for (let k = 0; k < 8; k++) { if (!(await page.locator('#scrim.open').count())) return; if (await page.locator('#gd-skip').count()) await page.click('#gd-skip'); else if (await page.locator('#pc-next').count()) await page.click('#pc-next'); else await page.click('#modal-ok').catch(() => {}); await page.waitForTimeout(150); } };
  const say = k => { const pool = S.talk; if (pid === 'disengaged' && k % 3 === 1) return ['그냥 답 알려줘', '배고파 급식 뭐야', 'ㅋㅋ 몰라'][k % 3]; if (pid === 'lowgrade') return ['몰라', '이거 맞아?', pool[k % pool.length].slice(0, 12)][k % 3]; if (pid === 'struggling' && k % 2) return ['잘 모르겠어요', pool[3]][k % 2]; return pool[k % pool.length]; };

  // ---- 들어가기 ----
  await page.goto(`${BASE}/?local&mode=${MODE}`);
  await page.click('#auth-tabs button[data-t="signup"]');
  await page.fill('#au-nick', `${pid}-${sid}`.slice(0, 16));
  const pics = ['🍎', '🐶', '🚀', '⭐'];
  for (const p of pics) await page.click(`#palette button[data-p="${p}"]`);
  await page.click('#auth-go'); await page.waitForTimeout(300);
  if (await ev(() => typeof reels !== 'undefined' && reels.every(v => !v))) { for (const p of pics) await page.click(`#palette button[data-p="${p}"]`); await page.click('#auth-go'); }
  await page.waitForFunction(() => document.querySelector('.screen.is-active')?.dataset.screen === 'home', null, { timeout: 10000 }).catch(() => errors.push('home not reached'));
  await closeModals();
  // ---- 시작 ----
  await page.click('#btn-new-session'); await page.waitForTimeout(200); await closeModals();
  await page.selectOption('#st-band', S.grade).catch(() => {});
  await page.selectOption('#st-subject', { label: S.subject }).catch(async () => { await page.selectOption('#st-subject', S.subject).catch(() => {}); });
  await page.waitForTimeout(100);
  await fill('#st-topic', S.goal);
  await click('#st-match-btn'); await idle();
  if (await page.locator('.narrow-pick').count()) await click('.narrow-pick');
  await page.waitForFunction(() => typeof stPicks !== 'undefined' && stPicks.length > 0, null, { timeout: 10000 }).catch(() => errors.push('no std pick'));
  await click('#st-go'); await idle();
  // ---- 대화 ----
  let typedN = 0, guard = 0, resumed = false;
  // 학생은 마무리 권유(한 차시 상한)가 나오면 끝낸다. 상한이 없는 모드·개선 전 코드는 8턴 이야기한다.
  const exploreTarget = +(args.turns || 8);
  while (guard++ < 140) {
    await idle(); await closeModals();
    const st = await ev(() => ({ phase: session.phase, prep: session.prepStep, cyc: !!session.cycleStarted, quiz: !!document.querySelector('.aq-submit'), cp: !!document.querySelector('.checkpoint-card .cp-submit'), mf: !!document.querySelector('.mf-submit'), strat: !!document.querySelector('[data-confirm-strategy]') && !session.cycleStarted && session.prepStep !== 'reason', choice: document.querySelectorAll('[data-pick="choice"] .chip:not(.chip-write)').length, prior: !!document.querySelector('[data-pick="prior"]') && session.prepStep === 'priorscore', next: !(document.querySelector('#btn-prep-next') || {}).hidden, fade: !!document.querySelector('.fade-accept'), rr: !!document.querySelector('.rr-reveal, .rr-done'), metaStep: session.meta.step || 0 }));
    if (st.quiz) {
      const n = await page.locator('.aq-mcq').count();
      for (let i = 0; i < n; i++) { const opts = page.locator('.aq-mcq').nth(i).locator('.choice'); await opts.nth(rng() < P.correct ? 0 : 1 + Math.floor(rng() * 3)).click(); await note('click'); }
      const tn = await page.locator('.aq-a').count();
      for (let i = 0; i < tn; i++) await fill('.aq-a', pid === 'lowgrade' ? '몰라요' : '분모를 같게 맞춰야 더할 수 있어요', i);
      await click('.aq-submit'); continue;
    }
    if (st.prior) { await click('[data-pick="prior"] .u-chip', P.conf - 1); continue; }
    if (st.mf) {
      const rows = page.locator('.meta-form .mf-row');
      for (let r = 0; r < await rows.count(); r++) { const chips = rows.nth(r).locator('.mf-chip'); await chips.nth(Math.floor(rng() * (await chips.count()))).click(); await note('click'); if (pid === 'average' && r > 0) await fill('.meta-form .mf-text', '분모가 다를 때 헷갈려요', r); }
      await click('.mf-submit'); continue;
    }
    if (st.cp) {
      await click('.checkpoint-card .u-chip', pid === 'struggling' ? 1 : 3);
      if (await page.locator('.cp-rchip').count()) await click('.cp-rchip', Math.floor(rng() * 3)); else await fill('.checkpoint-card .cp-reason', '예시가 떠올라서 조금 알 것 같아요');
      await click('.checkpoint-card .cp-submit'); continue;
    }
    if (st.fade) { await click(pid === 'struggling' ? '.fade-decline' : '.fade-accept'); continue; }
    if (st.rr) { if (await page.locator('.rr-attempt').count()) await fill('.rr-attempt', '분모를 같게 해요'); if (!(await click('.rr-reveal'))) await click('.rr-done'); else await click('.rr-done'); continue; }
    if (st.phase === 'prep' && st.prep === 'meta') {
      if (st.next && st.metaStep >= 3) { await click('#btn-prep-next'); continue; }
      const ans = pid === 'lowgrade' ? '몰라' : ['문제를 많이 풀어요', '분모가 다를 때 통분하는 단계가 헷갈려요 왜냐하면 최소공배수가 어려워서요', '먼저 그림으로 그리고 계산해 볼래요', '피자를 나눌 때랑 비슷해요'][Math.min(3, st.metaStep)];
      await fill('#chat-input', ans); await click('#chat-send'); continue;
    }
    if (st.strat) { await click('.strat-card', Math.floor(rng() * 3)); await click('[data-confirm-strategy]'); continue; }
    if (!st.cyc && st.prep === 'reason') { if (st.choice) await click('[data-pick="choice"] .chip:not(.chip-write)', 0); else { await fill('#chat-input', '오늘 내용에 잘 맞아 보여서요'); await click('#chat-send'); } continue; }
    if (st.cyc) {
      if (st.choice) { await click('[data-pick="choice"] .chip:not(.chip-write)', 0); continue; } // 도움 종류·바꾼 까닭 칩
      if (typedN >= exploreTarget) break;
      if (await ev(() => !!session.capNoted)) break; // 한 차시 상한 안내가 나오면 마무리
      if (typedN === 3 && await page.locator('#btn-stuck:not([hidden])').count()) { await click('#btn-stuck'); typedN++; continue; }
      if (typedN === 5 && await page.locator('#btn-help-boost:not([hidden])').count()) { await click('#btn-help-boost'); }
      if (typedN === 4 && idx === 0 && args['resume-test'] && !resumed) { resumed = true; await page.reload(); await page.waitForTimeout(800); await closeModals(); if (await click('#draft-resume')) await idle(); }
      const t = say(typedN);
      await fill('#chat-input', t); await click('#chat-send'); typedN++;
      continue;
    }
    if (st.phase === 'prep' && ['greet', 'activate', 'init'].includes(st.prep)) { await page.waitForTimeout(200); continue; }
    errors.push('stuck state ' + JSON.stringify(st)); break;
  }
  await idle();
  // 스스로 점검 결과 카드에 학생에게 보인 글(척도가 섞이는지·숫자가 보이는지 점검)
  const metaCardText = await ev(() => { const c = [...document.querySelectorAll('#stream .meta-score-card')].find(x => /스스로 점검 결과/.test(x.textContent)); return c ? c.textContent : ''; /* 접힌 카드도 읽는다 */ });
  const chatTurns = await ev(() => session.turns.map(t => ({ role: t.role, kind: t.kind || null, text: t.text || '', src: t.src || null, phase: t.phase, structured: !!t.structured, reveal: /풀이 공개 턴/.test(t.instr || ''), instr: (t.instr || '').slice(0, 120) })));
  const hscroll = {}; const measure = async k => { hscroll[k] = await ev(() => { const cw = document.documentElement.clientWidth; if (document.documentElement.scrollWidth <= cw) return false; return [...document.querySelectorAll('.screen.is-active *')].filter(e => e.getBoundingClientRect().right > cw + 1).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + [...e.classList].join('.')).slice(0, 4); }); };
  await measure('chat');
  // ---- 돌아보기 ----
  await click('#chat-finish'); await page.waitForTimeout(300); await closeModals();
  const oneScreen = await ev(() => !document.querySelector('#reflect-step-a').hidden && !document.querySelector('#reflect-step-b').hidden);
  await measure('reflect');
  const reflectPrompts = await ev(() => [...document.querySelectorAll('#prompt-list .pp-text')].map(x => x.textContent));
  // 돌아보기 "내 말 표시하기" 목록에 표시 버튼이 붙은 말(학생 발화로 다뤄지는 것)
  const reflectTaggable = await ev(() => [...document.querySelectorAll('.tl-card.tl-me')].filter(c => c.querySelector('.tl-tags')).map(c => (c.querySelector('.txt') || {}).textContent || ''));
  if (!oneScreen) {
    if (await page.locator('.tl-tags button').count()) await click('.tl-tags button', 0);
    await fill('#in-reflect-a', '나는 계산이 헷갈릴 때 AI에게 맡겼어요. 다음엔 먼저 풀어 볼래요.');
    await click('#reflect-next-a'); await page.waitForTimeout(200);
    if (await page.locator('.pp-head').count()) { await click('.pp-head', 0); for (const d of ['specificity', 'logic', 'clarity']) await click(`.prompt-rate [data-dim="${d}"][data-n="3"]`); }
  } else if (pid === 'average' && await page.locator('.tl-tags button').count()) await click('.tl-tags button', 0);
  if (await page.locator('.np-chip').count() && pid !== 'disengaged') await click('.np-chip', 0);
  if (pid === 'average' && await page.locator('#in-wonder').count()) await fill('#in-wonder', '겨울에는 왜 해가 일찍 질까요?');
  await fill('#in-reflect', pid === 'lowgrade' ? '다음엔 내가 먼저 해 볼래요.' : '분모를 같게 하는 이유를 물었을 때 도움이 됐어요. 다음엔 헷갈리는 곳을 먼저 말할래요.');
  await click('#reflect-next-b'); await page.waitForTimeout(300);
  // ---- 혼자 풀어보기 ----
  await click('#res-start'); await idle();
  await page.waitForFunction(() => session.residual.items && session.residual.items.length > 0 && document.querySelector('#res-submit'), null, { timeout: 15000 }).catch(() => errors.push('residual items'));
  const resCount = await ev(() => session.residual.items.length);
  for (let i = 0; i < resCount; i++) {
    const mcq = page.locator(`.res-mcq .choice[data-i="${i}"]`);
    if (await mcq.count()) { await mcq.nth(rng() < P.correct ? 0 : 1).click(); await note('click'); }
    else if (await page.locator(`.res-a[data-i="${i}"]`).count()) await fill(`.res-a[data-i="${i}"]`, '분모를 같게 맞춘 다음 더해요');
    else { const cells = page.locator(`.res-cell[data-i="${i}"]`); for (let c = 0; c < Math.min(2, await cells.count()); c++) await cells.nth(c).fill('통분'); const cm = page.locator(`.res-cmp[data-i="${i}"]`); for (let c = 0; c < await cm.count(); c++) await cm.nth(c).fill('분모를 같게 해요'); }
    if (await page.locator(`.res-e[data-i="${i}"]`).count()) await fill(`.res-e[data-i="${i}"]`, '크기를 같게 맞춰야 해서요');
  }
  await click('#res-submit'); await idle();
  await page.waitForFunction(() => !!session.residual.result, null, { timeout: 15000 }).catch(() => errors.push('no residual result'));
  await click('#res-judge .choice[data-v="accept"]');
  await fill('#res-journal', '처음엔 통분이 어려웠는데 이제 분모를 같게 하는 까닭을 알게 됐어요.');
  await measure('residual');
  const revealBeforeFinish = await ev(() => { const r = document.querySelector('#res-reveal'); return r ? r.innerText.length : -1; });
  await click('#res-finish'); await page.waitForTimeout(300); await closeModals();
  // ---- 기록 수집 ----
  const out = await ev(() => { const acc = DB.accounts[DB.currentUser]; const s = acc.sessions[acc.sessions.length - 1] || (acc.draft && acc.draft.session); return { session: s, homeTurns: (document.querySelector('#agg-turns') || {}).textContent }; });
  // 학생 화면의 스스로 점검 카드 표시(개선 후: 3단계 이름, 개선 전: 숫자)
  await ctx.close();
  return { pid, sid, label: LABEL, mode: MODE, errors, llmLog, act, chatTurns, reflectPrompts, reflectTaggable, metaCardText, oneScreen, hscroll, resCount, revealBeforeFinish, ...out };
}

// ---------- 지표 ----------
const AUTO_TEXT = /^\(.+\)$|^다 했어|^다시 고쳤어|^지금 막혔어|방법으로 해\s?볼게|가 필요해요\.$|^(오늘 내용에 잘 맞아 보여서|전에 해 봤는데 도움이 돼서|추천 표시를 보고|재미있어 보여서|지금 방법이 잘 안 맞아서|다른 방법도 해 보고 싶어서|막혀서 바꿔 보고 싶어서)$/;
function metrics(r) {
  const band = CS.capBand(SCEN[r.sid].grade), cap = CS.CAP[band];
  const ai = r.chatTurns.filter(t => t.role === 'ai' && t.text && !t.structured);
  const shown = ai.filter(t => !t.reveal);
  const sent = ai.flatMap(t => CS.splitSentences(t.text));
  const reacting = r.chatTurns.map((t, i) => (t.role === 'ai' && t.text && r.chatTurns[i - 1] && r.chatTurns[i - 1].role === 'me' && (r.chatTurns[i - 1].src === 'typed' || !r.chatTurns[i - 1].src)) ? t : null).filter(Boolean);
  const WIDGET = new Set(['prior-pick', 'strategy-pick', 'struct-offer', 'reason-pick', 'help-pick', 'change-reason-pick']);
  const s = r.session || {};
  const injected = r.llmLog.filter(l => l.type === 'chat' && l.faults && l.faults.length).length;
  const actBy = {};
  r.act.forEach(a => { const k = a.step || '?'; actBy[k] = actBy[k] || { read: 0, typed: 0, clicks: 0 }; actBy[k].read += a.read; actBy[k].typed += a.typed; actBy[k].clicks += a.clicks; });
  const P = PERSONAS[r.pid];
  const estMin = Object.fromEntries(Object.entries(actBy).map(([k, v]) => [k, Math.round((v.read / P.read + v.typed / P.type + v.clicks * 3 / 60 + 0) * 10) / 10]));
  const totalEst = Math.round(Object.values(estMin).reduce((a, b) => a + b, 0) * 10) / 10;
  const mv = CS.metaScoreView(s.meta || {});
  return {
    persona: r.pid, scenario: r.sid, version: r.label, mode: r.mode, errors: r.errors.length,
    ai_turns: ai.length,
    over_cap_rate: shown.length ? Math.round(shown.filter(t => CS.overCap(t.text, cap)).length / shown.length * 1000) / 10 : 0,
    tone_mix: ai.filter(t => CS.toneProfile(t.text).banmal > 0).length,
    banned_probe: ai.filter(t => CS.hasBannedProbe(t.text)).length,
    widgetless_choose: ai.filter(t => CS.needsWidget(t.text) && !WIDGET.has(t.kind) && !/\[다음으로\]/.test(t.text)).length,
    broken: ai.filter(t => CS.looksBroken(t.text, {}).broken).length,
    multi_question: ai.filter(t => CS.countQuestions(t.text) > 1).length,
    markdown: ai.filter(t => /\*\*|^\s*\d+\.\s/m.test(t.text)).length,
    term_violation: r.sid === 'science_namjung' ? ai.filter(t => CS.termViolations(t.text, '과학').length).length : 0,
    ack_rate: reacting.length ? Math.round(reacting.filter(t => CS.hasAck(t.text)).length / reacting.length * 100) : null,
    auto_misclassified: r.reflectPrompts.filter(x => AUTO_TEXT.test(String(x).trim())).length + (r.reflectTaggable || []).filter(x => AUTO_TEXT.test(String(x).trim())).length,
    // 한 카드 안에 "스스로 점검" 점수와 다른 척도(사전 확인 점수)가 같은 숫자 꼴로 섞여 보이는지
    score_scale_mixed: /실제 확인 결과\(\d+\)/.test(r.metaCardText || '') && /\d+점/.test(r.metaCardText || '') ? 1 : 0,
    meta_numbers_to_student: /\d+\s*점/.test(r.metaCardText || '') ? 1 : 0,
    checkpoints: (s.checkpoints || []).length,
    pre_items: (s.prior && s.prior.items || []).length, post_items: r.resCount,
    meta_failed_shown_as_zero: !mv.ok && s.meta && s.meta.score === 0 ? 1 : 0,
    phase_times_filled: s.phaseTimes ? Object.keys(s.phaseTimes).length : 0,
    phase_total_min_recorded: s.phaseTimes ? Math.round(CS.totalMs(s.phaseTimes, null) / 600) / 100 : null,
    est_user_min: totalEst, est_by_step: estMin,
    typed_chars: r.act.reduce((a, x) => a + x.typed, 0), clicks: r.act.reduce((a, x) => a + x.clicks, 0),
    flags: (s.flags || []).reduce((o, f) => (o[f.type] = (o[f.type] || 0) + 1, o), {}),
    injected_fault_turns: injected,
    skipped: Object.keys(s.skipped || {}).filter(k => s.skipped[k]).length
  };
}

const rows = [];
let idx = 0;
for (const pid of persona) for (const sid of scenario) {
  const t0 = Date.now();
  let r;
  try { r = await runOne(pid, sid, idx++); } catch (e) { r = { pid, sid, label: LABEL, mode: MODE, errors: ['crash: ' + e.message], llmLog: [], act: [], chatTurns: [], reflectPrompts: [], resCount: 0 }; }
  const m = metrics(r);
  rows.push(m);
  fs.writeFileSync(path.join(OUT, `${pid}-${sid}.json`), JSON.stringify({ metrics: m, run: r }, null, 1));
  console.log(`[${LABEL}/${MODE}] ${pid}-${sid} ${Math.round((Date.now() - t0) / 1000)}s · AI ${m.ai_turns} · 상한초과 ${m.over_cap_rate}% · 말투 ${m.tone_mix} · 추궁 ${m.banned_probe} · 위젯없는안내 ${m.widgetless_choose} · 비문 ${m.broken} · 오류 ${m.errors}`);
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(rows, null, 1));
await browser.close(); server.close();
console.log('결과:', OUT);
