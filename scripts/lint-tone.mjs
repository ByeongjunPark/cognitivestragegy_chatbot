// 말투 정적 점검(WP1-4): 학생에게 직접 보이는 고정 문구에서 반말 종결·비표준어('너가')를 찾는다.
// 대상: pushAi/pushNote/modal/modalHTML의 문자열 인자, suffix:, placeholder=, tone.js COPY, glossary.js UI_COPY, 화면 HTML 본문.
// LLM에게 주는 지시문(한다체)은 대상이 아니다. 사용: npm run lint:tone  (결과가 0건이어야 한다)
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['js/tone.js', 'js/glossary.js', 'js/lib/guards.js']) await import(pathToFileURL(path.join(ROOT, f)).href);
const CS = globalThis.CS;

const files = ['index.html', 'js/class-ui.js', 'js/onboarding.js', 'js/math-input.js'];
const found = [];
const strLit = String.raw`(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|` + '`((?:[^`\\\\]|\\\\.)*)`)';
const callRe = new RegExp(String.raw`\b(pushAi|pushNote|modal|modalHTML)\(\s*` + strLit, 'g');
const suffixRe = new RegExp(String.raw`\bsuffix\s*:\s*` + strLit, 'g');
const phRe = /placeholder="([^"]+)"/g;
function check(file, line, text, where){
  const t = String(text).replace(/\$\{[^}]*\}/g, '○').replace(/<[^>]+>/g, ' ');
  if (!/[가-힣]/.test(t)) return;
  if (/너가/.test(t)) found.push({ file, line, where, kind: '비표준어(너가)', text: t.slice(0, 90) });
  CS.splitSentences(t).forEach(s => { if (CS.sentenceTone(s) === 'banmal') found.push({ file, line, where, kind: '반말', text: s.slice(0, 90) }); });
}
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const lineOf = i => src.slice(0, i).split('\n').length;
  for (const re of [callRe, suffixRe]) { re.lastIndex = 0; let m; while ((m = re.exec(src))) check(f, lineOf(m.index), m[2] || m[3] || m[4] || m[5] || '', re === callRe ? m[1] : 'suffix'); }
  // "예: …" 자리표시는 학생 자신의 말 예시라 말투 점검에서 뺀다
  phRe.lastIndex = 0; let m; while ((m = phRe.exec(src))) if (!/^예[:：]/.test(m[1].trim())) check(f, lineOf(m.index), m[1], 'placeholder');
  if (f === 'index.html') {
    // 화면 HTML 본문(스크립트·스타일·주석 제외)
    const body = src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, m2 => '\n'.repeat((m2.match(/\n/g) || []).length));
    body.split('\n').forEach((ln, i) => { const txt = ln.replace(/<[^>]+>/g, ' ').trim(); if (txt) check(f, i + 1, txt, 'html'); });
  }
}
const walk = (v, out, k) => { if (typeof v === 'string') out.push([k, v]); else if (v && typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, out, k + '.' + kk)); return out; };
walk(CS.COPY, [], 'COPY').forEach(([k, v]) => check('js/tone.js', 0, v, k));
walk(CS.UI_COPY, [], 'UI_COPY').forEach(([k, v]) => check('js/glossary.js', 0, v, k));
if (!found.length) { console.log('lint:tone — 반말·비표준어 0건'); process.exit(0); }
found.forEach(x => console.log(`${x.file}:${x.line} [${x.where}] ${x.kind}: ${x.text}`));
console.log(`lint:tone — ${found.length}건`);
process.exit(process.argv.includes('--strict') ? 1 : 0);
