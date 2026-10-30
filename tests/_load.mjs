// 브라우저 전역(window.CS)용 파일을 node에서 불러온다(globalThis.CS)
import { pathToFileURL } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
for (const f of ['js/mode-config.js', 'js/tone.js', 'js/glossary.js', 'js/lib/guards.js', 'js/lib/scoring.js', 'js/lib/rag.js']) {
  await import(pathToFileURL(path.join(decodeURIComponent(root), f)).href);
}
export const CS = globalThis.CS;
export const ROOT = decodeURIComponent(root);
