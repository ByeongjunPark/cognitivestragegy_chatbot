// 교육과정 원문 RAG 색인 생성기.
// 입력 ① curriculum_standards.js(성취기준 1,491개 + 일부 해설 — 기본 말뭉치)
//      ② (있으면) 교육부 고시 별책·해설서 PDF에서 뽑은 텍스트(extract-pdf.mjs 결과 JSON) 폴더
// 출력 data/rag/<학년군>__<과목>.json  — 브라우저가 공부를 시작할 때 그 과목 파일만 불러온다.
// 사용: node tools/curriculum-rag/build-index.mjs [--pdf-json <폴더>] [--out data/rag]
// 원문 조각 종류: standard(성취기준 문장) · 해설(성취기준 해설) · 고려사항(성취기준 적용 시 고려 사항, 단원 단위)
//               · 탐구활동 · 원문(성격·목표·내용 체계·교수학습·평가 등 나머지 본문)
// 고시문은 저작권법 제7조(보호받지 못하는 저작물: 법령·고시 등)에 해당한다. PDF 자체는 저장소에 넣지 않는다.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.resolve(ROOT, args.out || 'data/rag');

// ---------- 기본 말뭉치 ----------
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'curriculum_standards.js'), 'utf8').replace('const CURRICULUM_STANDARDS', 'globalThis.CURRICULUM_STANDARDS'), ctx);
const CUR = ctx.CURRICULUM_STANDARDS;
const BAND_ID = { '초등학교 3~4학년': 'e34', '초등학교 5~6학년': 'e56', '중학교 1~3학년': 'm', '고등학교 1학년': 'h1' };
const codeHome = new Map(); // code → { band, subject, area, name, concept }
for (const band of Object.keys(CUR)) for (const subject of Object.keys(CUR[band])) for (const it of CUR[band][subject]) codeHome.set(it.code, { band, subject, ...it });

// ---------- PDF 텍스트 정리·조각내기 ----------
const CODE = /\[\s*(\d{1,2}[가-힣A-Za-z0-9()·]{1,14}-\d{2}(?:-\d{2})?)\s*\]/g;
function clean(t) {
  return String(t)
    .replace(/Ö/g, '÷')
    .replace(/\)\s*_\s*\(/g, ')×(')
    .replace(/[∼〜]/g, '~')
    .replace(/[ \t]+/g, ' ');
}
const NOISE = [/^\d{1,3}$/, /교사용\s*지도서/, /^(공통 교육과정|선택 중심 교육과정|과학과 교육과정|수학과 교육과정|국어과 교육과정|사회과 교육과정|영어과 교육과정)$/];
function pageLines(pg) { return clean(pg.text).split('\n').map(s => s.trim()).filter(s => s && !NOISE.some(re => re.test(s))); }

// PDF 줄바꿈이 낱말 가운데를 자르는 경우("태/양계")를 문서 안 낱말 사전으로 되붙인다.
const bare = w => w.replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9]+$/g, '');
function vocabOf(lines) { const v = new Map(); lines.forEach(l => l.s.split(/\s+/).forEach(w => { const b = bare(w); if (b) v.set(b, (v.get(b) || 0) + 1); })); v.prefix = new Set(); for (const w of v.keys()) for (let i = 2; i <= w.length; i++) v.prefix.add(w.slice(0, i)); return v; }
function joinParts(parts, vocab) {
  let out = '';
  for (const p of parts) {
    if (!out) { out = p; continue; }
    const a = out.split(/\s+/).pop(), b = p.split(/\s+/)[0];
    const glued = bare(a + b);
    const mid = /[가-힣]$/.test(bare(a)) && /^[가-힣]/.test(bare(b)) && !/[.!?,)」』’”]$/.test(a);
    out += (mid && (vocab.prefix.has(glued) && glued.length >= 3) && (bare(a).length === 1 || (vocab.get(bare(a)) || 0) <= 1 || (vocab.get(bare(b)) || 0) <= 1)) ? p : ' ' + p;
  }
  return out;
}
// 한 줄씩 읽으며 상태 기계로 나눈다. 줄 끝이 문장 중간이면 다음 줄과 잇는다.
function parsePdf(doc) {
  const docName = doc.title || doc.source.replace(/\.pdf$/i, '');
  const lines = [];
  for (const pg of doc.pages) for (const l of pageLines(pg)) lines.push({ s: l, page: pg.page });
  const vocab = vocabOf(lines);
  const chunks = [];
  let mode = 'body', unitCodes = [], unitTitle = '', buf = null, bodyBuf = [], bodyPage = null, section = '';
  const flushBuf = () => {
    if (!buf) return;
    const text = joinParts(buf.parts, vocab).replace(/\s+/g, ' ').trim();
    if (text.length >= 8) chunks.push({ ...buf.meta, text, src: { doc: docName, page: buf.page } });
    buf = null;
  };
  const flushBody = () => {
    const text = joinParts(bodyBuf, vocab).replace(/\s+/g, ' ').trim();
    if (text.length >= 40) {
      // 원문 본문은 400자 안팎으로 자른다
      for (let i = 0; i < text.length; i += 380) {
        const piece = text.slice(i, i + 420);
        const codes = [...new Set([...piece.matchAll(CODE)].map(m => m[1]))];
        chunks.push({ kind: '원문', code: codes[0] || null, codes, section, text: piece, src: { doc: docName, page: bodyPage } });
      }
    }
    bodyBuf = []; bodyPage = null;
  };
  for (const { s, page } of lines) {
    const unit = s.match(/^\((\d{1,2})\)\s*([가-힣A-Za-z·⋅ ,]{2,30})$/);
    if (unit) { flushBuf(); flushBody(); unitTitle = unit[2].trim(); unitCodes = []; mode = 'unit'; continue; }
    // 수학 원문의 소단원 제목("5 분수의 곱셈과 나눗셈")은 앞 성취기준 문장에 붙지 않게 끊는다
    if (/^\d{1,2}\s+[가-힣A-Za-z ()·⋅,]{2,24}$/.test(s) && !/[.다]$/.test(s)) { flushBuf(); unitTitle = s.replace(/^\d+\s+/, ''); continue; }
    if (/^\(가\)\s*성취기준\s*해설/.test(s)) { flushBuf(); flushBody(); mode = '해설'; continue; }
    if (/^\(나\)\s*성취기준\s*적용\s*시\s*고려\s*사항/.test(s)) { flushBuf(); flushBody(); mode = '고려사항'; continue; }
    if (/^<\s*탐구\s*활동\s*>/.test(s)) { flushBuf(); mode = '탐구활동'; buf = { meta: { kind: '탐구활동', code: unitCodes[0] || null, codes: unitCodes.slice(), unit: unitTitle }, parts: [], page }; continue; }
    const std = s.match(/^\[\s*(\d{1,2}[가-힣A-Za-z0-9()·]{1,14}-\d{2}(?:-\d{2})?)\s*\]\s*(.*)$/);
    if (std && mode !== '해설' && mode !== '고려사항') {
      flushBuf(); flushBody();
      if (mode !== 'unit') { mode = 'unit'; unitCodes = []; }
      unitCodes.push(std[1]);
      buf = { meta: { kind: 'standard', code: std[1], codes: [std[1]], unit: unitTitle }, parts: [std[2]], page };
      continue;
    }
    if (/^[•·]/.test(s) && (mode === '해설' || mode === '고려사항' || mode === '탐구활동')) {
      if (mode === '탐구활동') { buf.parts.push(s.replace(/^[•·]\s*/, '')); continue; }
      flushBuf();
      const body = s.replace(/^[•·]\s*/, '');
      const own = [...body.matchAll(CODE)].map(m => m[1]);
      if (mode === '해설') buf = { meta: { kind: '해설', code: own[0] || unitCodes[0] || null, codes: own.length ? own : unitCodes.slice(), unit: unitTitle }, parts: [body.replace(CODE, '').trim()], page };
      else buf = { meta: { kind: '고려사항', code: unitCodes[0] || null, codes: unitCodes.slice(), unit: unitTitle }, parts: [body], page };
      continue;
    }
    if (buf && mode !== 'body') { buf.parts.push(s); continue; }
    // 단원 밖 본문: 큰 제목이면 절 이름을 기억한다
    if (/^(\d\.|[가-하]\.)\s*\S/.test(s) && s.length <= 40) { flushBody(); section = s; }
    if (mode !== 'body') { mode = 'body'; }
    if (bodyPage == null) bodyPage = page;
    bodyBuf.push(s);
  }
  flushBuf(); flushBody();
  return chunks;
}

// ---------- 합치기 ----------
const byFile = new Map(); // fileId → chunks
function homeOf(code) {
  const h = code && codeHome.get(code);
  if (h) return { band: h.band, subject: h.subject };
  return null;
}
function push(fileKey, c) { if (!byFile.has(fileKey)) byFile.set(fileKey, []); byFile.get(fileKey).push(c); }
const fileKeyOf = (band, subject) => `${BAND_ID[band] || 'x'}__${subject}`;

const pdfHas = new Set(); // code|kind  (원문에 해설이 있으면 기존 데이터의 해설은 넣지 않는다)
let pdfCount = 0, pdfDocs = [];
if (args['pdf-json']) {
  const dir = path.resolve(args['pdf-json']);
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json') && !x.endsWith('.meta.json'))) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const meta = fs.existsSync(path.join(dir, f.replace(/\.json$/, '.meta.json'))) ? JSON.parse(fs.readFileSync(path.join(dir, f.replace(/\.json$/, '.meta.json')), 'utf8')) : {};
    doc.title = meta.title || doc.source;
    const chunks = parsePdf(doc);
    pdfDocs.push({ file: f, title: doc.title, pages: doc.numPages, chunks: chunks.length });
    // 단원 밖 원문(성격·내용 체계 등)은 그 문서가 다루는 과목·학년군 모두에 넣는다
    const homes = new Set();
    chunks.forEach(c => (c.codes || []).forEach(code => { const h = homeOf(code); if (h) homes.add(fileKeyOf(h.band, h.subject)); }));
    chunks.forEach(c => {
      const keys = new Set((c.codes || []).map(homeOf).filter(Boolean).map(h => fileKeyOf(h.band, h.subject)));
      if (!keys.size) homes.forEach(k => keys.add(k));
      keys.forEach(k => push(k, { ...c, id: `${f}:${pdfCount++}` }));
      if (c.kind === '해설' && c.code) pdfHas.add(c.code + '|해설');
      if (c.kind === 'standard' && c.code) pdfHas.add(c.code + '|standard');
    });
  }
}
for (const [code, h] of codeHome) {
  const key = fileKeyOf(h.band, h.subject);
  if (!pdfHas.has(code + '|standard')) push(key, { id: code + ':std', kind: 'standard', code, codes: [code], unit: h.area || '', text: h.name, src: { doc: '2022 개정 교육과정 성취기준(데이터)' } });
  if (h.concept && !pdfHas.has(code + '|해설')) push(key, { id: code + ':exp', kind: '해설', code, codes: [code], unit: h.area || '', text: h.concept, src: { doc: '성취기준 해설(데이터)' } });
}

fs.mkdirSync(OUT, { recursive: true });
const manifest = { builtAt: new Date().toISOString(), pdfDocs, files: {} };
for (const [key, chunks] of byFile) {
  fs.writeFileSync(path.join(OUT, key + '.json'), JSON.stringify(chunks));
  const kinds = {}; chunks.forEach(c => { kinds[c.kind] = (kinds[c.kind] || 0) + 1; });
  manifest.files[key] = { chunks: chunks.length, kinds };
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`색인 ${byFile.size}개 파일 → ${OUT}`);
pdfDocs.forEach(d => console.log(` 원문: ${d.title} (${d.pages}쪽, 조각 ${d.chunks})`));
