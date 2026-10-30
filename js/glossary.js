/* 학생용 용어 사전(WP2-7)과 학년군별 안내 문구 3벌(WP4-3).
   교사 화면(teacher.html)·CSV에는 원래 용어를 그대로 둔다. */
(function (root) {
  const CS = root.CS = root.CS || {};

  // 학생 화면에 직접 보이면 안 되는 낱말 → 쉬운 말
  const STUDENT_TERMS = Object.freeze({
    '성취기준': '오늘 배울 내용',
    '잔여물 확인': '혼자 풀어보기',
    '정리판': '정리 도구',
    '활동판': '정리 도구',
    '지원강도': '도움 크기',
    '위임': 'AI에게 맡김',
    '메타인지': '내 공부 돌아보기',
    '비계': 'AI 도움',
    '스캐폴딩': 'AI 도움',
    '전이': '다른 문제에 써 보기',
    '사전 진단': '공부 전 확인',
    '사후 진단': '혼자 풀 때 확인',
    '주도 비율': '누가 먼저 했는지',
    '루브릭': '확인 기준',
    '보정도': '자신감과 결과 비교'
  });
  const FORBIDDEN_STUDENT_WORDS = Object.keys(STUDENT_TERMS);
  // [6사01-01], [9과12-03], [10공수1-01-02] 같은 교육과정 코드
  const CODE_RE = /\[\s*\d{1,2}[가-힣A-Za-z]{1,4}\d{0,2}\s*-\s*\d{2}(?:\s*-\s*\d{2})?\s*\]/g;
  function hideCodes(s) { return String(s || '').replace(CODE_RE, '').replace(/\s{2,}/g, ' ').trim(); }
  function toStudentWords(s) {
    let t = String(s || '');
    Object.entries(STUDENT_TERMS).forEach(([k, v]) => { t = t.split(k).join(v); });
    return hideCodes(t);
  }

  // 처음 보는 낱말에 붙이는 ⓘ 한 문장 설명
  const TERM_INFO = Object.freeze({
    '공부 방법': '공부할 때 쓰는 나만의 방법이에요. 예: 표로 정리하기, 예시 떠올리기.',
    'AI 도움 크기': 'AI가 힌트를 얼마나 자세히 주는지예요. 잘 이해할수록 조금씩 줄어요.',
    '스스로 점검': '내가 어디를 알고 어디가 헷갈리는지 스스로 살펴보는 거예요.',
    '아는 것 확인': '공부 전에 지금 얼마나 아는지 가볍게 풀어 보는 문제예요. 시험이 아니에요.',
    '혼자 풀어보기': 'AI 없이 비슷한 문제를 풀어서 배운 게 얼마나 남았는지 보는 거예요.',
    '정리 도구': '표·마인드맵처럼 생각을 정리하는 판이에요. 칸을 내가 직접 채워요.',
    'AI와 할 일 나누기': '오늘 공부에서 내가 먼저 할 일과 AI가 도와줄 일을 정하는 거예요.',
    '판단하기': 'AI가 한 말이 맞는지, 받아들일지를 내가 정해서 표시하는 거예요.',
    '돌아보기': '공부가 끝난 뒤 내가 어떻게 공부했는지 다시 보는 거예요.'
  });

  // 학년군 3벌(초저=초3~4, 초고=초5~6, 중고). 같은 키를 가져야 한다(테스트로 확인).
  const UI_COPY = Object.freeze({
    초저: Object.freeze({
      'todo.auth': '이름과 그림 4개로 들어가요.',
      'todo.home': '[새 공부 시작하기]를 눌러요.',
      'todo.start': '오늘 배우고 싶은 것을 적어요.',
      'todo.activate': '문제를 아는 만큼 풀어요.',
      'todo.priorscore': '자신 있는 만큼 그림을 골라요.',
      'todo.meta': '내 공부 습관을 골라요.',
      'todo.pick': '공부 방법을 골라요.',
      'todo.reason': '고른 까닭을 골라요.',
      'todo.explore': 'AI가 낸 일을 내가 먼저 해요.',
      'todo.reflectA': '내가 한 말을 살펴봐요.',
      'todo.reflectB': '내가 한 질문을 살펴봐요.',
      'todo.reflectOne': '내 말을 보고 한 줄 써요.',
      'todo.residual': 'AI 없이 혼자 풀어요.',
      'todo.journal': '새로 안 것을 한 줄 써요.',
      'slider.left': '내가 해요',
      'slider.mid': '같이 해요',
      'slider.right': 'AI가 해줘요',
      'preset.ai': 'AI가 많이 도와줘요',
      'preset.half': '같이 해요',
      'preset.me': '내가 먼저 해 볼래요'
    }),
    초고: Object.freeze({
      'todo.auth': '부를 이름과 그림 비밀번호 4개로 들어가요.',
      'todo.home': '지난 기록을 보거나 [새 공부 시작하기]를 눌러요.',
      'todo.start': '오늘 공부하고 싶은 것을 내 말로 적고 [딱 맞는 내용 찾기]를 눌러요.',
      'todo.activate': '지금 아는 만큼 문제를 풀어요. 시험이 아니에요.',
      'todo.priorscore': '이 주제에 얼마나 자신 있는지 하나 골라요.',
      'todo.meta': '평소 공부 습관과 헷갈리는 곳을 골라 보거나 적어요.',
      'todo.pick': '오늘 쓸 공부 방법을 하나 이상 골라요.',
      'todo.reason': '그 방법을 고른 까닭을 고르거나 적어요.',
      'todo.explore': 'AI가 낸 할 일을 고른 방법으로 먼저 해 보고, AI 말은 내가 판단해요.',
      'todo.reflectA': '내 말 중 내가 생각한 것과 AI에게 맡긴 것을 표시해요.',
      'todo.reflectB': '내가 쓴 질문을 골라 얼마나 잘 물었는지 매겨요.',
      'todo.reflectOne': '내 말과 질문을 살펴보고, 다음엔 어떻게 할지 한 문장을 써요.',
      'todo.residual': 'AI 없이 비슷한 문제를 혼자 풀어요.',
      'todo.journal': '어려웠던 점이나 새로 알게 된 점을 한 문장 써요.',
      'slider.left': '내가 맡아요',
      'slider.mid': '반반',
      'slider.right': 'AI가 맡아요',
      'preset.ai': 'AI가 많이 도와줘요',
      'preset.half': '같이 해요',
      'preset.me': '내가 먼저 해 볼래요'
    }),
    중고: Object.freeze({
      'todo.auth': '별명과 그림 비밀번호 4개로 로그인해요.',
      'todo.home': '지난 기록·성장 그래프를 보거나 새 공부를 시작해요.',
      'todo.start': '공부하고 싶은 주제를 적으면 맞는 학습 내용을 찾아 줘요.',
      'todo.activate': '사전 확인 문제를 아는 만큼 풀어요. 결과는 나중에 혼자 풀 때와 비교해요.',
      'todo.priorscore': '이 주제에 대한 자신감을 하나 골라요.',
      'todo.meta': '평소 공부법과 이해·방법·연결 상태를 점검해요.',
      'todo.pick': '오늘 적용할 공부 방법을 하나 이상 골라요.',
      'todo.reason': '그 방법을 고른 까닭을 고르거나 적어요.',
      'todo.explore': 'AI가 낸 과업을 고른 방법으로 먼저 수행하고, AI 피드백은 직접 판단해요.',
      'todo.reflectA': '내 발화 중 스스로 생각한 것과 AI에게 맡긴 것을 구분해요.',
      'todo.reflectB': '내 질문을 골라 구체성·논리성·명시성을 스스로 매겨요.',
      'todo.reflectOne': '대화와 질문을 돌아보고 다음 공부 계획을 한 문장으로 써요.',
      'todo.residual': 'AI 없이 평행 문제를 풀어 공부 전과 비교해요.',
      'todo.journal': '어려웠던 점이나 새로 알게 된 점을 기록해요.',
      'slider.left': '내가 맡아요',
      'slider.mid': '반반',
      'slider.right': 'AI가 맡아요',
      'preset.ai': 'AI가 많이 도와줘요',
      'preset.half': '같이 해요',
      'preset.me': '내가 먼저 해 볼래요'
    })
  });
  function uiCopy(band, key) { const b = UI_COPY[band] || UI_COPY['초고']; return b[key] != null ? b[key] : (UI_COPY['초고'][key] || ''); }

  Object.assign(CS, { STUDENT_TERMS, FORBIDDEN_STUDENT_WORDS, CODE_RE, hideCodes, toStudentWords, TERM_INFO, UI_COPY, uiCopy });
})(typeof window !== 'undefined' ? window : globalThis);
