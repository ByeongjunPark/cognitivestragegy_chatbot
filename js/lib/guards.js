/* AI 응답 방어선(순수 함수). 전문가 평가 WP1-3·1-4·1-6·2-5·3-1·3-3·3-5 대응.
   LLM이 만든 문장은 완전히 통제할 수 없으므로, 학생 화면에 닿기 전에 코드가 검사·교정한다.
   브라우저: window.CS.*, node 테스트: globalThis.CS.* */
(function (root) {
  const CS = root.CS = root.CS || {};

  /* ---------- 문장 나누기·분량 상한 (WP2-5) ---------- */
  function splitSentences(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return [];
    return (t.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g) || [t]).map(s => s.trim()).filter(Boolean);
  }
  const isQuestion = s => /[?？]\s*["'”’)]*$/.test(s);
  function countQuestions(text) { return splitSentences(text).filter(isQuestion).length; }

  // 질문은 1개만(마지막 질문을 남긴다 — 반응 구조의 끝이 질문이므로).
  function keepOneQuestion(text) {
    const ss = splitSentences(text);
    const qIdx = ss.map((s, i) => isQuestion(s) ? i : -1).filter(i => i >= 0);
    if (qIdx.length <= 1) return ss.join(' ');
    const last = qIdx[qIdx.length - 1];
    return ss.filter((s, i) => !isQuestion(s) || i === last).join(' ');
  }

  // 학년군 상한: 문장 수·글자 수. 마지막 질문은 지키고 앞 문장부터 채운다.
  function capSentences(text, cap) {
    const ss = splitSentences(text);
    if (!ss.length) return '';
    const maxS = Math.max(1, cap.sentences), maxC = Math.max(40, cap.chars);
    const lastQ = [...ss].reverse().find(isQuestion);
    const body = ss.filter(s => s !== lastQ);
    const out = [];
    let len = lastQ ? lastQ.length + 1 : 0;
    const room = lastQ ? maxS - 1 : maxS;
    for (const s of body) {
      if (out.length >= room) break;
      if (len + s.length + 1 > maxC && out.length >= (lastQ ? 0 : 1)) break;
      out.push(s); len += s.length + 1;
    }
    if (lastQ) out.push(lastQ);
    let res = out.join(' ').trim();
    if (res.length > Math.round(maxC * 1.5)) { // 한 문장이 지나치게 길면 낱말 경계에서 자른다
      const cut = res.slice(0, maxC);
      res = cut.slice(0, Math.max(cut.lastIndexOf(' '), Math.round(maxC * 0.6))).trim() + '…';
    }
    return res;
  }
  function overCap(text, cap) {
    const ss = splitSentences(text);
    return ss.length > cap.sentences || String(text || '').length > Math.round(cap.chars * 1.15);
  }

  /* ---------- "아래에서 골라"와 위젯 일치 (WP1-3) ---------- */
  const WIDGET_REF = /((아래|밑|위)(에서|의|에\s*있는|쪽|에\s*나온|\s*카드|\s*버튼)?[^.!?]{0,18}(골라|고르|선택|눌러|누르))|((카드|버튼|보기|선택지)[을를에서]*\s*[^.!?]{0,8}(골라|고르|선택해|눌러|누르))/;
  function needsWidget(text) { return WIDGET_REF.test(String(text || '')); }
  // 위젯이 붙지 않는 말에서 화면을 가리키는 문장을 빼고, 비면 중립 문구로 바꾼다.
  function neutralizeWidgetRef(text, fallback) {
    const ss = splitSentences(text);
    const kept = ss.filter(s => !WIDGET_REF.test(s));
    let out = kept.join(' ').trim();
    if (!out || !kept.some(isQuestion)) out = (out ? out + ' ' : '') + (fallback || '어떻게 생각하는지 편하게 말해 줄래요?');
    return out.trim();
  }

  /* ---------- 말투: 해요체 통일 (WP1-4) ---------- */
  const POLITE_END = /(요|니다|니까|세요|죠|시오)\s*[.!?…~]*["'”’)]*$/;
  const BANMAL_END = /(어|아|야|지|자|래|봐|줘|게|네|니|냐|군|구나|거든|잖아|해|돼|까|걸|다고|라고|렴|단다|란다|해라|하렴)\s*[.!?…~]*["'”’)]*$/;
  function sentenceTone(s) {
    const t = String(s || '').trim().replace(/[\s"'”’)\]]+$/, '');
    if (!/[가-힣]/.test(t)) return 'none';
    if (POLITE_END.test(t)) return 'polite';
    if (/다\s*[.!]*$/.test(t)) return 'plain';   // 한다체(서술) — 해요체와 섞이면 어색하지만 반말은 아님
    if (BANMAL_END.test(t)) return 'banmal';
    return 'none';
  }
  function toneProfile(text) {
    const p = { polite: 0, banmal: 0, plain: 0, none: 0 };
    splitSentences(text).forEach(s => { p[sentenceTone(s)]++; });
    return p;
  }
  const isMixedTone = text => { const p = toneProfile(text); return p.polite > 0 && p.banmal > 0; };

  // 흔한 반말 종결어미를 해요체로 바꾼다(보수적: 확실한 꼴만). 바꾸지 못한 반말은 남기고 호출자가 판단한다.
  const HAEYO_RULES = [
    [/거야(\s*[.!?]*)$/, '거예요$1'], [/이야(\s*[.!?]*)$/, '이에요$1'], [/([가-힣])야(\s*[.!]*)$/, '$1예요$2'],
    [/잖아(\s*[.!?]*)$/, '잖아요$1'], [/거든(\s*[.!?]*)$/, '거든요$1'], [/구나(\s*[.!]*)$/, '군요$1'],
    [/([가-힣])니(\s*\?)$/, '$1나요$2'], [/([가-힣])냐(\s*\?)$/, '$1나요$2'],
    [/해\s*보자(\s*[.!]*)$/, '해 봐요$1'], [/보자(\s*[.!]*)$/, '봐요$1'], [/하자(\s*[.!]*)$/, '해요$1'], [/가자(\s*[.!]*)$/, '가요$1'],
    [/(래|까|게|걸|네|지)(\s*[.!?~]*)$/, '$1요$2'],
    [/(봐|줘|해|돼|어|아|워|와|져|켜|쳐|려|여|혀|겨|셔)(\s*[.!?~]*)$/, '$1요$2']
  ];
  function sentenceToHaeyo(s) {
    let t = String(s);
    if (sentenceTone(t) !== 'banmal') return t;
    const tail = (t.match(/["'”’)\]]+$/) || [''])[0];
    let core = tail ? t.slice(0, -tail.length) : t;
    for (const [re, rep] of HAEYO_RULES) { if (re.test(core)) { core = core.replace(re, rep); break; } }
    return core + tail;
  }
  // 반말 호칭 제거(해요체에서는 "너/네가"로 부르지 않는다). "네가"는 '네(yes)'와 헷갈리지 않는 꼴만.
  function dropBanmalPronouns(t) {
    return String(t)
      .replace(/(^|[\s,])(너는|너도|너가|네가|니가)\s+/g, '$1')
      .replace(/(^|[\s,])너의\s+/g, '$1')
      .replace(/(^|[\s,])너한테\s+/g, '$1')
      .replace(/(^|[\s,])(너랑|너와)\s+/g, '$1');
  }
  function toHaeyo(text) {
    const ss = splitSentences(dropBanmalPronouns(text));
    return ss.map(sentenceToHaeyo).join(' ').replace(/\s+([.,!?])/g, '$1').trim();
  }

  /* ---------- 비문·깨진 문장 감지 (WP1-4) ---------- */
  const BROKEN_PATTERNS = [
    /알고\s*배는/, /배는\s*거(야|예요)/, /어떤\s*것이\s*알고/,
    /(을를|를을|은는|는은|에서에서|으로으로)(?=[\s.,!?]|$)/,      // 확실한 조사 겹침만("길이가"·"풀이가"는 정상)
    /너가/, /�/,
    /([가-힣])\1\1/,                                    // 같은 음절 세 번(하하하·요요요)
    /(^|\s)([가-힣]{2,})\s+\2(?=[\s.,!?]|$)/,           // 같은 낱말 두 번 연달아
    /[가-힣][Ѐ-ӿ぀-ヿ一-鿿]|[Ѐ-ӿ぀-ヿ一-鿿][가-힣]/, // 한글+러시아·일본·한자 혼입
    /[ㄱ-ㅎㅏ-ㅣ]{2,}/,                                  // 낱자 모음·자음 덩어리
    /[가-힣]\s*[{}<>|\\^~`]{1,}\s*[가-힣]/               // 문장 중간 이상 기호
  ];
  function looksBroken(text, opts) {
    const t = String(text || '');
    const reasons = [];
    BROKEN_PATTERNS.forEach((re, i) => { if (re.test(t)) reasons.push('p' + i); });
    if (!(opts && opts.allowEnglish) && /[가-힣]\s?[a-zA-Z]{3,}\s?[가-힣]/.test(t) && !/(AI|OK|PPT|TV)/.test(t)) reasons.push('english-mix');
    const trimmed = t.trim();
    if (trimmed && !/[.!?…요다죠까)"'”’\]]$/.test(trimmed)) reasons.push('cut');
    return { broken: reasons.length > 0, reasons };
  }

  /* ---------- 추궁형 질문 금지 (WP3-1) ---------- */
  const BANNED_PROBES = [
    /왜\s*(그렇게|그런|이렇게|저렇게)\s*(말했|말한|말해|생각했|생각한|했|한|썼|쓴|답했|골랐|대답했)[^.!?]*[?？]/,
    /왜\s*그랬(어|니|냐|어요)\s*[?？]/,
    /왜\s*(말|생각|대답)\s*했(어|니|냐)\s*[?？]/,
    /(그|그게|무슨)\s*이유가\s*뭐(야|니|냐)\s*[?？]/,
    /(뭐|무엇)\s*때문(이야|이냐|이니)\s*[?？]/,
    /(정말|진짜)\s*그렇게\s*생각(해|하니|하냐)\s*[?？]/,
    /이게\s*맞(다고|는다고)\s*생각(해|하니|하냐)\s*[?？]/
  ];
  const SOFT_PROBE = '어떤 점 때문에 그렇게 생각했는지 알려 줄래요?';
  function hasBannedProbe(text) { return BANNED_PROBES.some(re => re.test(String(text || ''))); }
  function softenProbes(text) {
    return splitSentences(text).map(s => BANNED_PROBES.some(re => re.test(s)) ? SOFT_PROBE : s).join(' ');
  }

  // 반응 턴의 인정·공감 문장 유무(WP3-1 수용 기준 휴리스틱)
  const ACK_RE = /(좋아요|좋은|좋네요|잘했|잘\s*했|잘\s*짚|잘\s*떠올|잘\s*찾|멋져요|멋진|훌륭|맞아요|맞게|그렇군요|그랬군요|그렇게\s*생각했군요|라고\s*했네요|라고\s*했군요|라고\s*했어요|고마워요|알려\s*줘서|말해\s*줘서|떠올렸|짚었|시도했|해\s*봤네요|해\s*냈|열심히|대단|정확|꼼꼼|차근차근|좋은\s*생각|좋은\s*질문|괜찮아요|충분히)/;
  const hasAck = text => ACK_RE.test(String(text || ''));

  /* ---------- 예상 밖 답변 분류 (WP3-1) ---------- */
  function classifyOffScript(text, scopeTokens) {
    const t = String(text || '').trim();
    const c = t.replace(/\s/g, '');
    if (!c) return 'odd';
    if (/^(몰라|모르겠|모름|잘\s*모르|글쎄|모르겟|몰라요|모르겠어요)/.test(t) || /^(몰라|모르겠)/.test(c)) return 'dontknow';
    if (/(싫어|안\s*할래|귀찮|하기\s*싫|그만|재미없|안\s*해)/.test(t)) return 'refuse';
    if (/(ㅋㅋ|ㅎㅎ|ㅋ{2,}|장난|메롱|똥|방구)/.test(t)) return 'joke';
    if (/^[^가-힣a-zA-Z0-9]+$/.test(c) || (c.length <= 2 && !/^(네|응|ㅇㅇ|예|맞아|아니)$/.test(c))) return 'odd';
    const offWords = /(게임|유튜브|점심|급식|배고파|떡볶이|축구|아이돌|롤|마크|친구랑|놀고\s*싶)/;
    if (offWords.test(t) && !(scopeTokens && inScope(t, scopeTokens))) return 'chitchat';
    if (/[?？]\s*$/.test(t) || /(뭐야|뭔데|무슨\s*뜻|어떻게\s*해|알려\s*줘)/.test(t)) return 'question';
    return null;
  }
  const OFFSCRIPT_POLICY = {
    dontknow: '학습자가 "모르겠다"고 했다. 괜찮다고 짧게 안심시키고, 지금 질문을 더 작은 한 걸음으로 쪼갠 쉬운 질문 1개만 해라(정답은 주지 마라).',
    refuse: '학습자가 하기 싫다는 마음을 보였다. 그 마음을 한 문장으로 인정하고, 아주 작은 한 걸음(한 낱말이나 고르기 정도)만 제안하라. 탓하거나 설득을 길게 하지 마라.',
    joke: '학습자가 장난스럽게 답했다. 가볍게 한 마디로 웃으며 받아 주고, 바로 한 문장으로 공부 이야기로 돌아와 질문 1개를 해라.',
    chitchat: '학습자가 공부와 다른 이야기를 했다. 그 이야기를 한 마디로 다정하게 받아 준 뒤, 그 소재를 오늘 내용과 잇는 질문 1개로 자연스럽게 돌아와라.',
    question: '학습자가 질문을 했다. 학습자의 질문을 먼저 존중해 짧게 답하거나 단서를 주고(정답·풀이를 통째로 주지 말 것), 그다음 할 일로 이어라.',
    odd: '학습자의 답이 짧거나 뜻을 알기 어렵다. 탓하지 말고, 무엇을 말하려 했는지 고를 수 있게 쉬운 질문 1개로 다시 물어라.'
  };

  /* ---------- 교과 용어 규칙 (WP3-3) ---------- */
  const SWAP_HIGH = { '커요': '높아요', '커': '높아', '크고': '높고', '크게': '높게', '크다': '높다', '큰': '높은', '크': '높', '작아요': '낮아요', '작아': '낮아', '작고': '낮고', '작게': '낮게', '작다': '낮다', '작은': '낮은', '작': '낮' };
  const SWAP_LONG = { '높아요': '길어요', '높아': '길어', '높고': '길고', '높게': '길게', '높다': '길다', '높은': '긴', '높': '길', '낮아요': '짧아요', '낮아': '짧아', '낮고': '짧고', '낮게': '짧게', '낮다': '짧다', '낮은': '짧은', '낮': '짧' };
  const SWAP_MANY = { '높아요': '많아요', '높아': '많아', '높고': '많고', '높다': '많다', '높은': '많은', '높': '많', '낮아요': '적어요', '낮아': '적어', '낮고': '적고', '낮다': '적다', '낮은': '적은', '낮': '적' };
  const swapper = map => (m, head, word) => {
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    const k = keys.find(x => word.startsWith(x));
    return k ? head + map[k] + word.slice(k.length) : m;
  };
  const TERM_RULES = {
    과학: [
      { id: 'altitude', re: /((?:남중\s*)?(?:태양\s*)?고도\s*(?:가|는|이|도)?\s*)((?:커|크|큰|작)[가-힣]*)/g, swap: SWAP_HIGH, rule: '고도(남중 고도·태양 고도)는 "높다/낮다"로 말한다' },
      { id: 'temperature', re: /((?:기온|온도|체온|수온)\s*(?:이|은|가|도)?\s*)((?:커|크|큰|작)[가-힣]*)/g, swap: SWAP_HIGH, rule: '기온·온도는 "높다/낮다"로 말한다' },
      { id: 'length', re: /((?:그림자\s*(?:의\s*)?길이|그림자|낮\s*(?:의\s*)?길이|밤\s*(?:의\s*)?길이)\s*(?:가|는|이|도)?\s*)((?:높|낮)[가-힣]*)/g, swap: SWAP_LONG, rule: '길이(그림자·낮의 길이)는 "길다/짧다"로 말한다' }
    ],
    수학: [
      { id: 'length', re: /((?:변의\s*)?길이\s*(?:가|는|이|도)?\s*)((?:높|낮)[가-힣]*)/g, swap: SWAP_LONG, rule: '길이는 "길다/짧다"로 말한다' }
    ],
    사회: [
      { id: 'population', re: /(인구\s*(?:가|는|도)?\s*)((?:높|낮)[가-힣]*)/g, swap: SWAP_MANY, rule: '인구는 "많다/적다"로 말한다(인구 밀도는 "높다/낮다")' }
    ]
  };
  function termViolations(text, subject) {
    const rules = TERM_RULES[subject] || [];
    const t = String(text || '');
    const out = [];
    rules.forEach(r => { r.re.lastIndex = 0; let m; while ((m = r.re.exec(t))) out.push({ id: r.id, match: m[0], rule: r.rule }); });
    return out;
  }
  function fixTerms(text, subject) {
    let t = String(text || '');
    (TERM_RULES[subject] || []).forEach(r => { r.re.lastIndex = 0; t = t.replace(r.re, swapper(r.swap)); });
    return t;
  }
  const termRuleText = subject => (TERM_RULES[subject] || []).map(r => r.rule).join(' / ');

  /* ---------- 낱말 처리·정답 단서 노출 (WP1-6) ---------- */
  function tokenizeKo(s) { return (String(s || '').toLowerCase().match(/[가-힣a-zA-Z0-9]{2,}/g) || []); }
  const PARTICLE = /(으로써|으로서|에서는|에게서|이라고|으로|에서|에게|까지|부터|처럼|보다|이다|이며|하고|라고|이나|은|는|이|가|을|를|의|에|와|과|도|만|로)$/;
  const STOP = new Set(['것', '수', '등', '때', '그', '이', '저', '무엇', '어떤', '어떻게', '왜', '다음', '중', '가장', '알맞은', '옳은', '고르', '고르세요', '골라', '쓰세요', '써', '보세요', '설명', '설명하세요', '문제', '정답', '보기', '있는', '하는', '되는', '하기', '해요', '입니다', '있어요', '친구', '내용', '이유', '자기', '말로', '같은', '다른', '두', '한', '세', '네']);
  function stem(w) { let x = String(w); for (let i = 0; i < 2; i++) x = x.replace(PARTICLE, ''); return x; }
  function contentTokens(s) { return [...new Set(tokenizeKo(s).map(stem).filter(w => w.length >= 2 && !STOP.has(w)))]; }
  const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  function leaksAnswer(items) {
    const list = Array.isArray(items) ? items : [];
    const leaks = [];
    list.forEach((it, i) => {
      const ownQ = norm(it.q);
      const answerText = it.type === 'mcq' ? it.key : (it.rubric && it.rubric.full);
      if (!answerText) return;
      const keyN = norm(answerText);
      const distinct = contentTokens(answerText).filter(tok => !ownQ.includes(tok) && tok.length >= (it.type === 'mcq' ? 2 : 3));
      list.forEach((other, j) => {
        if (i === j) return;
        const oq = norm(other.q), oo = norm((other.options || []).join(' '));
        // 정답 문구 그대로가 다른 문항 본문에 있거나, 충분히 긴 정답 문구가 다른 문항 선택지에 들어 있으면 노출
        if (it.type === 'mcq' && keyN.length >= 2 && (oq.includes(keyN) || (keyN.length >= 4 && oo.includes(keyN)))) {
          leaks.push({ from: i, to: j, token: answerText, kind: 'phrase' }); return;
        }
        const hit = distinct.find(tok => oq.includes(tok));
        if (hit) leaks.push({ from: i, to: j, token: hit, kind: 'token' });
      });
    });
    return leaks;
  }

  /* ---------- 탐구 범위 가이드 (WP3-5) ---------- */
  function scopeTokensFrom(std, concept, goal) {
    const counts = new Map();
    [std, concept, goal].forEach((s, w) => contentTokens(s).forEach(tok => counts.set(tok, (counts.get(tok) || 0) + (w === 0 ? 2 : 1))));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(e => e[0]).slice(0, 14);
  }
  function inScope(text, scopeTokens) {
    const toks = contentTokens(text);
    return toks.some(w => (scopeTokens || []).some(k => k.length >= 2 && (w.startsWith(k) || k.startsWith(w))));
  }
  // 범위 판정은 "충분히 내용 있는 말"에만 한다(짧은 대답·감탄은 판정하지 않음).
  function scopeVerdict(text, scopeTokens) {
    const toks = contentTokens(text);
    if (toks.length < 2 || !(scopeTokens || []).length) return 'skip';
    return inScope(text, scopeTokens) ? 'in' : 'out';
  }

  /* ---------- 학습 목표 좁히기 (WP3-2) ---------- */
  function isBroadGoal(text) {
    const t = String(text || '').trim();
    const c = t.replace(/\s/g, '');
    if (c.length < 8) return true;
    if (/^(수학|과학|사회|국어|영어|도덕|공부|숙제|시험|문제|그냥|아무거나|다)(공부|하기|요|이요|요\.|를?\s*잘|를?\s*공부)*/.test(c) && contentTokens(t).length <= 2) return true;
    return contentTokens(t).length <= 1;
  }

  /* ---------- 수학 풀이 단계 (WP3-4) ---------- */
  function parseSteps(text) {
    const t = String(text || '');
    // 단계 구분은 " / "(앞뒤 띄움)·줄바꿈·다음 "N단계" — 분수의 "/"는 자르지 않는다
    const tagged = [...t.matchAll(/(\d+)\s*단계\s*[:：)]\s*([\s\S]+?)(?=\s+\/\s+|\n|\s*\d+\s*단계\s*[:：)]|$)/g)].map(m => m[2].trim()).filter(Boolean);
    if (tagged.length >= 2) return tagged;
    const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
    return lines.length >= 2 ? lines : [];
  }
  function formatSteps(steps) { return steps.map((s, i) => `${i + 1}단계: ${s}`).join('\n'); }

  Object.assign(CS, {
    splitSentences, isQuestion, countQuestions, keepOneQuestion, capSentences, overCap,
    WIDGET_REF, needsWidget, neutralizeWidgetRef,
    sentenceTone, toneProfile, isMixedTone, toHaeyo, sentenceToHaeyo, dropBanmalPronouns,
    BROKEN_PATTERNS, looksBroken,
    BANNED_PROBES, SOFT_PROBE, hasBannedProbe, softenProbes, hasAck,
    classifyOffScript, OFFSCRIPT_POLICY,
    TERM_RULES, termViolations, fixTerms, termRuleText,
    tokenizeKo, contentTokens, stem, leaksAnswer,
    scopeTokensFrom, inScope, scopeVerdict, isBroadGoal, parseSteps, formatSteps
  });
})(typeof window !== 'undefined' ? window : globalThis);
