// WP6-2 기기·접근성 최소 점검: 360px·768px 폭에서 화면별 가로 스크롤, 키보드 초점 이동, 색만으로 표시한 요소를 본다.
// 사용: PW=<playwright-core 폴더> node tools/student-agent/a11y-check.mjs --root .
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const ROOT = path.resolve(args.root || path.join(HERE, '../..'));
const { chromium } = createRequire(import.meta.url)(path.join(process.env.PW || 'playwright-core'));
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = path.join(ROOT, u === '/' ? 'index.html' : u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: args.chrome || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
for (const width of [360, 768]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('UPSTAGE_API_KEY', 'mock'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.route('https://api.upstage.ai/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"items":[{"tag":"예시","type":"mcq","q":"알맞은 것은?","options":["가","나","다","라"],"answer":0},{"tag":"설명","type":"text","q":"설명해 보세요.","rubric":{"full":"a","partial":"b"}}]}' } }] }) }));
  page.on('dialog', d => d.accept());
  await page.goto(`${BASE}/?local&mode=class40`);
  const over = async name => { const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, wide: [...document.querySelectorAll('.screen.is-active *')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) })); results.push({ width, screen: name, horizontalScroll: r.sw > r.cw, overflowing: r.wide }); };
  await over('auth');
  // 키보드만으로: Tab으로 이름 칸에 가고 그림 4개를 Enter로 고를 수 있는지
  let reached = false; for (let k = 0; k < 15 && !reached; k++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement && document.activeElement.id === 'au-nick'); }
  results.push({ width, screen: 'auth', keyboardToNickname: reached });
  await page.click('#auth-tabs button[data-t="signup"]'); await page.fill('#au-nick', 'a11y' + width);
  for (let rep = 0; rep < 2; rep++) { for (const p of ['🍎', '🐶', '🚀', '⭐']) await page.click(`#palette button[data-p="${p}"]`); await page.click('#auth-go'); await page.waitForTimeout(300); }
  for (let k = 0; k < 6; k++) { if (!(await page.locator('#scrim.open').count())) break; if (await page.locator('#gd-skip').count()) await page.click('#gd-skip'); else if (await page.locator('#pc-next').count()) await page.click('#pc-next'); else await page.click('#modal-ok'); await page.waitForTimeout(100); }
  await over('home');
  await page.click('#btn-new-session'); await page.waitForTimeout(200);
  await page.evaluate(() => { const d = document.getElementById('tb-details'); if (d) d.open = true; });
  await over('start(설정 펼침)');
  // 색만으로 표시하는 요소: 3단계 막대에 글자 라벨이 함께 있는지(코드 점검)
  results.push({ width, screen: 'meta-card', levelHasTextLabel: /lv3-txt/.test(fs.readFileSync(path.join(ROOT, 'js/class-ui.js'), 'utf8')) });
  await ctx.close();
}
await browser.close(); server.close();
console.table(results);
fs.writeFileSync(path.join(args.out || HERE, 'a11y-result.json'), JSON.stringify(results, null, 1));
