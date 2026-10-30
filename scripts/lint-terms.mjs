// 학생 화면 금지어·교육과정 코드 점검(WP2-7). 교사 화면(teacher.html)·주석·LLM 지시문은 대상이 아니다.
// 대상: index.html 화면 HTML 본문, pushAi/pushNote/modal 문자열, 학생용 사전(tone.js·glossary.js UI_COPY), class-ui/onboarding 화면 문자열.
// 사용: npm run lint:terms  (결과가 0건이어야 한다)
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['js/tone.js', 'js/glossary.js']) await import(pathToFileURL(path.join(ROOT, f)).href);
const CS = globalThis.CS;
const BAD = CS.FORBIDDEN_STUDENT_WORDS.filter(w => !['위임', '전이'].includes(w)); // 짧은 낱말은 오탐이 많아 아래 정규식으로 따로 본다
const BAD_RE = new RegExp(BAD.join('|') + '|(?<![가-힣])위임(?![가-힣])|(?<![가-힣])전이(?![가-힣])');
const CODE_RE = /\[\s*\d{1,2}[가-힣A-Za-z]{1,4}\d{0,2}\s*-\s*\d{2}(?:\s*-\s*\d{2})?\s*\]/;
const found = [];
function check(file, line, text, where){
  const t = String(text).replace(/\$\{[^}]*\}/g, '○');
  const m = t.match(BAD_RE); if (m) found.push({ file, line, where, kind: '금지어 "' + m[0] + '"', text: t.trim().slice(0, 90) });
  if (CODE_RE.test(t)) found.push({ file, line, where, kind: '교육과정 코드', text: t.trim().slice(0, 90) });
}
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const body = src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, m => '\n'.repeat((m.match(/\n/g) || []).length));
body.split('\n').forEach((ln, i) => { const txt = ln.replace(/<[^>]+>/g, ' ').trim(); if (txt) check('index.html', i + 1, txt, 'html'); });
for (const f of ['index.html', 'js/class-ui.js', 'js/onboarding.js']) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const re = /\b(pushAi|pushNote|modal|modalHTML)\(\s*(?:'([^'\n]*)'|`([^`]*)`)/g; let m;
  while ((m = re.exec(s))) check(f, s.slice(0, m.index).split('\n').length, m[2] || m[3] || '', m[1]);
}
const walk = (v, out, k) => { if (typeof v === 'string') out.push([k, v]); else if (v && typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, out, k + '.' + kk)); return out; };
walk(CS.COPY, [], 'COPY').concat(walk(CS.UI_COPY, [], 'UI_COPY')).forEach(([k, v]) => check('사전', 0, v, k));
if (!found.length) { console.log('lint:terms — 학생 화면 금지어·교육과정 코드 0건'); process.exit(0); }
found.forEach(x => console.log(`${x.file}:${x.line} [${x.where}] ${x.kind}: ${x.text}`));
console.log(`lint:terms — ${found.length}건`);
process.exit(process.argv.includes('--strict') ? 1 : 0);
