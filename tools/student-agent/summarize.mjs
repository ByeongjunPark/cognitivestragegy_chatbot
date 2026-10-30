// 시범 운용 결과(pilot.mjs의 summary.json 여러 개)를 하나의 비교 표(마크다운·JSON)로 모은다.
// 사용: node tools/student-agent/summarize.mjs <결과폴더1> <결과폴더2> ... [--out report.md]
import fs from 'fs';
import path from 'path';
const argv = process.argv.slice(2);
const outI = argv.indexOf('--out');
const out = outI >= 0 ? argv[outI + 1] : null;
const dirs = argv.filter((x, i) => !x.startsWith('--') && (outI < 0 || i !== outI + 1));
const M = [
  ['ai_turns', 'AI 말 수(회당)', 'mean'], ['over_cap_rate', '학년군 분량 상한 초과율(%)', 'mean'], ['tone_mix', '반말이 섞인 AI 말(회당)', 'mean'],
  ['banned_probe', '추궁형 질문(회당)', 'mean'], ['widgetless_choose', '선택지 없는 "골라" 안내(회당)', 'mean'], ['broken', '비문 의심 문장(회당)', 'mean'],
  ['multi_question', '한 번에 질문 2개 이상(회당)', 'mean'], ['markdown', '마크다운 목록 노출(회당)', 'mean'], ['term_violation', '교과 용어 위반(과학, 회당)', 'mean'],
  ['ack_rate', '학생 말 뒤 인정·공감 포함률(%)', 'mean'], ['auto_misclassified', '버튼이 보낸 문장이 돌아보기에서 학생 발화로 분류(회당)', 'mean'],
  ['score_scale_mixed', '스스로 점검 카드에 다른 척도 점수 혼재(비율)', 'mean'], ['meta_numbers_to_student', '스스로 점검 숫자 점수 학생 노출(비율)', 'mean'],
  ['checkpoints', '이해도 체크포인트(회당)', 'mean'], ['pre_items', '사전 문항 수', 'mean'], ['post_items', '사후 문항 수', 'mean'],
  ['typed_chars', '학생이 친 글자 수(회당)', 'mean'], ['clicks', '누른 횟수(회당)', 'mean'], ['est_user_min', '사람 기준 추정 소요(분)', 'median'],
  ['phase_times_filled', '단계 소요시간 기록 칸 수', 'mean'], ['errors', '화면 오류(회당)', 'mean'], ['injected_fault_turns', '모의 LLM이 결함을 넣은 턴(회당)', 'mean']
];
const agg = (rows, k, how) => { const v = rows.map(r => r[k]).filter(x => typeof x === 'number'); if (!v.length) return null; if (how === 'median') { const s = v.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; } return Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100; };
const cols = dirs.map(d => { const rows = JSON.parse(fs.readFileSync(path.join(d, 'summary.json'), 'utf8')); return { name: rows[0] ? `${rows[0].version}/${rows[0].mode}` : path.basename(d), rows }; });
const lines = [`| 지표 | ${cols.map(c => c.name + ` (n=${c.rows.length})`).join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`];
for (const [k, label, how] of M) lines.push(`| ${label} | ${cols.map(c => { const v = agg(c.rows, k, how); return v == null ? '-' : v; }).join(' | ')} |`);
// 단계별 추정 시간(중앙값)
const steps = ['start', 'activate', 'meta', 'pick', 'explore', 'reflect', 'residual', 'journal'];
lines.push('', `| 단계별 추정 소요(분, 중앙값) | ${cols.map(c => c.name).join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`);
for (const s of steps) lines.push(`| ${s} | ${cols.map(c => { const v = c.rows.map(r => (r.est_by_step || {})[s]).filter(x => typeof x === 'number').sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : '-'; }).join(' | ')} |`);
// 방어선 작동(개선 후에서만 의미 있음)
lines.push('', `| 방어선이 고쳐서 내보낸 횟수(회당 평균) | ${cols.map(c => c.name).join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`);
const ftypes = [...new Set(cols.flatMap(c => c.rows.flatMap(r => Object.keys(r.flags || {}))))];
for (const f of ftypes) lines.push(`| ${f} | ${cols.map(c => Math.round(c.rows.reduce((a, r) => a + ((r.flags || {})[f] || 0), 0) / c.rows.length * 100) / 100).join(' | ')} |`);
const md = lines.join('\n');
console.log(md);
if (out) fs.writeFileSync(out, md + '\n');
