// 교육과정 원문 PDF → 쪽 번호가 붙은 텍스트(JSON). 개발용 도구라 pdfjs-dist는 저장소 의존성에 넣지 않는다.
// 사용: PDFJS=<pdfjs-dist 폴더> node tools/curriculum-rag/extract-pdf.mjs <입력.pdf> <출력.json>
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const [, , inPdf, outJson] = process.argv;
if (!inPdf || !outJson) { console.error('사용: node extract-pdf.mjs <입력.pdf> <출력.json>'); process.exit(1); }
const base = process.env.PDFJS || path.resolve('node_modules/pdfjs-dist');
const pdfjs = await import(pathToFileURL(path.join(base, 'legacy/build/pdf.mjs')).href);
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(inPdf)), useSystemFonts: true, verbosity: 0 }).promise;
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  // 같은 줄(y가 비슷)끼리 모으고 줄바꿈으로 잇는다
  const lines = []; let cur = null;
  for (const it of tc.items) {
    if (!('str' in it)) continue;
    const y = Math.round(it.transform[5]);
    if (!cur || Math.abs(cur.y - y) > 3) { cur = { y, s: '' }; lines.push(cur); }
    cur.s += (cur.s && it.str && !/\s$/.test(cur.s) && it.hasEOL === false && /^[가-힣A-Za-z0-9(]/.test(it.str) && it.transform[4] - (cur.x || 0) > 2 ? '' : '') + it.str;
    cur.x = it.transform[4] + (it.width || 0);
  }
  pages.push({ page: p, text: lines.map(l => l.s.trim()).filter(Boolean).join('\n') });
}
fs.writeFileSync(outJson, JSON.stringify({ source: path.basename(inPdf), numPages: doc.numPages, pages }, null, 0));
console.log(`${path.basename(inPdf)}: ${doc.numPages}쪽 → ${outJson}`);
