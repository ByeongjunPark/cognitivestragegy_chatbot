/* 교육과정 원문 RAG(검색 증강) — 브라우저 안 BM25 검색(외부 API·임베딩 없음).
   근거: 성취기준의 약 40%가 해설 없이 문장 하나뿐이고(예: 6과13-02 남중 고도), 전문가3이 지적한 교과 오류가
   바로 근거가 비어 있는 성취기준에서 나왔다. 원문(성취기준·해설·적용 시 고려 사항·내용 체계)을 조각으로 색인해
   대화·문항 출제·사실 검수·자료 카드·근거 창에 출처와 함께 넣는다(WP3-3·3-5 확장, 원리10 출처).
   색인 파일: data/rag/<학년군>__<과목>.json  (tools/curriculum-rag/build-index.mjs 로 생성)
   조각 모양: { id, code, kind:'standard'|'해설'|'고려사항'|'내용체계'|'원문', text, src:{ doc, page } } */
(function (root) {
  const CS = root.CS = root.CS || {};

  // 한국어 색인어: 조사를 뗀 낱말 + 한글 2글자 묶음(형태소 분석기 없이 어미·조사 변화에 강하게)
  const PARTICLE = /(으로써|으로서|에서는|에게서|이라고|으로|에서|에게|까지|부터|처럼|보다|이다|이며|하고|라고|이나|은|는|이|가|을|를|의|에|와|과|도|만|로)$/;
  function terms(text) {
    const words = String(text || '').toLowerCase().match(/[가-힣a-z0-9]+/g) || [];
    const out = [];
    words.forEach(w => {
      let s = w; for (let i = 0; i < 2; i++) s = s.replace(PARTICLE, '');
      if (s.length >= 2) out.push(s);
      if (/^[가-힣]+$/.test(s) && s.length >= 3) for (let i = 0; i + 2 <= s.length; i++) out.push('§' + s.slice(i, i + 2));
    });
    return out;
  }

  function buildIndex(chunks) {
    const docs = (chunks || []).map(c => {
      const tf = new Map();
      terms(c.text + ' ' + (c.code || '')).forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
      let len = 0; tf.forEach(v => { len += v; });
      return { c, tf, len };
    });
    const df = new Map();
    docs.forEach(d => d.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
    const avgLen = docs.length ? docs.reduce((a, d) => a + d.len, 0) / docs.length : 1;
    return { docs, df, N: docs.length, avgLen };
  }

  // opts: { k, codes(이번 공부 성취기준 — 가산점), kinds(허용 종류), minScore }
  function retrieve(index, query, opts) {
    const o = opts || {};
    if (!index || !index.N) return [];
    const q = [...new Set(terms(query))];
    const k1 = 1.2, b = 0.75;
    const codes = new Set(o.codes || []);
    const scored = index.docs.map(d => {
      if (o.kinds && !o.kinds.includes(d.c.kind)) return null;
      let s = 0;
      q.forEach(t => {
        const f = d.tf.get(t); if (!f) return;
        const n = index.df.get(t) || 0;
        const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / index.avgLen));
      });
      if (codes.has(d.c.code)) s = s * 1.5 + 2;   // 지금 공부하는 성취기준의 원문을 먼저
      return s > 0 ? { chunk: d.c, score: s } : null;
    }).filter(Boolean);
    scored.sort((a, b2) => b2.score - a.score);
    const out = [], seen = new Set();
    for (const r of scored) {
      if (o.minScore != null && r.score < o.minScore) break;
      const key = r.chunk.code + '|' + r.chunk.kind + '|' + r.chunk.text.slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key); out.push(r);
      if (out.length >= (o.k || 4)) break;
    }
    return out;
  }

  // 프롬프트에 넣을 근거 블록(출처 표시 포함, 길이 제한)
  function citeLabel(c) {
    const src = c.src || {};
    return `[${c.code || '-'}·${c.kind}${src.doc ? '·' + src.doc : ''}${src.page ? ' p.' + src.page : ''}]`;
  }
  function contextBlock(results, maxChars) {
    const lim = maxChars || 900;
    let out = '', used = 0;
    for (const r of results) {
      const line = `${citeLabel(r.chunk)} ${r.chunk.text}`.replace(/\s+/g, ' ').trim();
      if (used + line.length > lim) { if (!out) out = line.slice(0, lim); break; }
      out += (out ? '\n' : '') + line; used += line.length + 1;
    }
    return out;
  }

  // 기존 curriculum_standards.js 데이터(성취기준 문장 + 해설)를 조각으로 바꾼다 — 원문 PDF 색인이 없을 때의 기본 말뭉치.
  function chunksFromStandards(list, subject, band) {
    const out = [];
    (list || []).forEach(it => {
      out.push({ id: it.code + ':std', code: it.code, subject, band, kind: 'standard', text: `${it.area ? '[' + it.area + '] ' : ''}${it.name}`, src: { doc: '2022 개정 교육과정 성취기준' } });
      if (it.concept) out.push({ id: it.code + ':exp', code: it.code, subject, band, kind: '해설', text: it.concept, src: { doc: '성취기준 해설' } });
    });
    return out;
  }

  // 사실 검수용: 응답 문장 중 근거 조각과 겹치는 낱말이 거의 없는 "사실 진술"을 찾는다(LLM 검수 전 값싼 1차 거름).
  function groundingRatio(text, results) {
    const t = new Set(terms(text).filter(x => !x.startsWith('§')));
    if (!t.size) return 1;
    const ev = new Set(); results.forEach(r => terms(r.chunk.text).forEach(x => { if (!x.startsWith('§')) ev.add(x); }));
    let hit = 0; t.forEach(x => { if (ev.has(x)) hit++; });
    return hit / t.size;
  }

  Object.assign(CS, { ragTerms: terms, buildIndex, retrieve, contextBlock, citeLabel, chunksFromStandards, groundingRatio });
})(typeof window !== 'undefined' ? window : globalThis);
