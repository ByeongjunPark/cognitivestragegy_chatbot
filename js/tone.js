/* 말투 상수와 학생에게 나가는 고정 문구 사전(WP1-4). 질문 문장은 코드가 소유한다.
   🔶 연구진 결정: AI와 안내 문구 모두 부드러운 해요체로 통일(TONE='haeyo').
   반말로 되돌리려면 TONE='banmal'로 바꾸고 COPY_BANMAL을 채운다(현재는 해요체 문구로 대체). */
(function (root) {
  const CS = root.CS = root.CS || {};
  const TONE = 'haeyo';

  function toneRule() {
    return TONE === 'haeyo'
      ? '말투: 부드러운 해요체("~해요", "~해 볼까요?", "~할래요?")로만 말합니다. 반말("~해", "~야", "~할래?")과 섞지 마세요. "너", "네가" 같은 호칭은 쓰지 말고 바로 말을 건네세요.'
      : '말투: 친근한 반말로만 말합니다. 존댓말과 섞지 마세요.';
  }
  const toneShort = () => (TONE === 'haeyo' ? '해요체' : '반말');

  const COPY = {
    // 스스로 점검(원리7): 이해·전략·연결 질문은 구별을 유지하고, "이유"는 '어떤 점 때문에'로 부드럽게 묻는다(WP3-1).
    scaffoldQ: {
      // 한 문장 질문(학년군 분량 상한 안에 반응 1문장 + 질문 1문장이 들어가게, 시범 운용 1차 보정)
      understand: '아직 확신이 안 서는 곳이 어디이고, 어떤 점 때문에 헷갈리는지 알려 줄래요?',
      strategy: '이 내용은 어떤 순서로 공부하면 좋을 것 같고, 그렇게 느낀 까닭은 무엇인가요?',
      connect: '이 내용을 전에 배운 것이나 생활과 이어 보면, 어떤 같은 점이나 예가 떠올라요?'
    },
    metaReask: {
      // 예시는 질문이 아니라 안내 문장으로(앞의 되묻기 질문과 합쳐 "질문 1개"를 지킨다)
      usual: '예를 들어 "교과서를 두 번 읽어요", "문제를 많이 풀어요"처럼 하나만 말하면 돼요.',
      understand: '예를 들어 "○○는 알겠는데 왜 그렇게 되는지는 헷갈려요"처럼 말하면 돼요.',
      strategy: '예를 들어 "먼저 뜻을 읽고, 그다음 예를 찾아볼래요"처럼 순서를 말하면 돼요.',
      connect: '예를 들어 "지난번에 배운 ○○랑 비슷해요"나 "집에서 ○○할 때랑 같아요"처럼 말하면 돼요.'
    },
    reaskLead: '조금만 더 자세히 말해 줄래요? ',
    priorPickSuffix: '지금 이 주제에 얼마나 자신 있는지 아래 다섯 개 중에서 하나 골라 줄래요?',
    priorPickRetry: '자신감은 아래 다섯 개 그림 버튼 중에서 하나를 눌러 골라 주세요.',
    metaStartSuffix: '이제 스스로 점검을 해 봐요. 먼저, 이런 내용은 평소에 보통 어떻게 공부해요?',
    metaNextLead: '이제 조금 더 구체적으로 스스로 점검해 봐요. ',
    metaDone: '이해·방법·연결 질문을 모두 나눠 봤어요. 더 이야기해도 좋고, 준비됐으면 아래 [다음으로]를 눌러 주세요.',
    strategyPickIntro: '스스로 점검 결과를 위에 정리했어요. 내 생각과 맞는지 한번 살펴봐요. 이제 아래 카드에서 오늘 쓸 공부 방법을 하나 이상 골라 주세요(여러 개 함께 써도 돼요).',
    strategyReasonQ: '그 방법을 고른 까닭이 뭐예요? 아래에서 고르거나 직접 써 주세요.',
    strategyChangeQ: '방법을 바꾸고 싶었던 까닭을 아래에서 고르거나 직접 써 줄래요?',
    fallbackTailTask: '그럼 이번 할 일을 먼저 해 볼래요?',
    fallbackTailNoTask: '지금까지 이야기한 걸 내 말로 한번 정리해 볼래요?',
    taskDumpFallback: '그 부분은 먼저 생각을 들려줄래요?',
    neutralAsk: '어떻게 생각하는지 편하게 말해 줄래요?',
    directiveLeads: ['좋아요, 바로 해 봐요.', '그럼 이번엔 이렇게 해 봐요.', '자, 이번 할 일이에요.', '한 걸음씩 해 봐요.'],
    aiError: 'AI가 잠깐 대답을 못 했어요. 방금 한 말을 한 번 더 보내 줄래요?',
    // 이해도 체크포인트(원리9): 이유는 칩 1번 + 선택 서술(WP2-6)
    cpQuestion: '지금까지 내용을 얼마나 확실히 이해했다고 느껴요?',
    cpReasonLabel: '어떤 점 때문에 그렇게 골랐어요? 하나 누르거나 직접 써요',
    cpReasonChips: ['예시가 떠올라서', '비슷한 문제를 해 봐서', '설명을 들으니 이해돼서', '아직 헷갈리는 곳이 있어서', '잘 모르겠어서'],
    cpAfterLow: '알려 줘서 고마워요. 다음 설명은 더 쉬운 말과 예시로 다시 해 볼게요.',
    cpAfterMid: '알려 줘서 고마워요. 헷갈리는 부분을 한 번 더 짚으면서 이어 가요.',
    cpAfterHigh: '좋아요, 다음 단계로 가요. 잘 이해하고 있으면 AI 도움이 조금 줄어들 수 있어요.',
    // 방법 고른 까닭 칩(WP3-1: "이유" → "까닭" + 선택지)
    reasonChips: ['오늘 내용에 잘 맞아 보여서', '전에 해 봤는데 도움이 돼서', '추천 표시를 보고', '재미있어 보여서'],
    changeReasonChips: ['지금 방법이 잘 안 맞아서', '다른 방법도 해 보고 싶어서', '막혀서 바꿔 보고 싶어서'],
    // 막혔어요 → 도움 종류 고르기(WP3-6)
    helpPickQ: '어떤 도움이 필요해요? 하나 골라 주세요.',
    helpKinds: [
      { k: 'hint', label: '작은 힌트', instr: '첫 걸음에 쓸 아주 작은 단서 1개만 준다' },
      { k: 'direction', label: '방향만', instr: '어느 쪽으로 생각하면 좋을지 방향만 한 문장으로 알려 준다(단서·풀이는 주지 않는다)' },
      { k: 'example', label: '예시 하나', instr: '지금 과업과 비슷하지만 다른 소재의 짧은 예시 하나를 보여 준다(지금 과업의 답은 주지 않는다)' }
    ],
    helpBoostNote: '앞으로 두 번은 AI가 조금 더 자세히 도와줘요. 그다음엔 원래대로 돌아가요.',
    wonderQ: '오늘 공부하다가 더 궁금해진 게 있나요? 한 가지만 남겨 두면 다음 공부에서 이어 갈 수 있어요.',
    greetPlanLead: '내가 먼저 해 보기로 한 일: '
  };

  // WP3-1·WP3-7: 반응 턴 구조 고정 + 반응 방식 순환(다채로운 상호작용, 전문가7)
  const REACTION_STYLES = [
    { k: 'mirror', t: '되돌려 말하기', instr: '학습자가 한 말의 핵심 한 조각을 학습자의 낱말 그대로 되돌려 말한다' },
    { k: 'summarize', t: '정리해 주기', instr: '학습자가 지금까지 말한 생각을 한 줄로 정리해 준다(새 내용을 더하지 않는다)' },
    { k: 'check', t: '이해 확인', instr: '학습자가 말한 내용 중 하나를 학습자 스스로 확인해 보게 한다(정답 여부를 대신 판정하지 않는다)' },
    { k: 'praise', t: '칭찬', instr: '학습자가 실제로 한 행동(시도·설명·연결)을 구체적으로 칭찬한다' }
  ];
  function buildReactionInstr(styleIdx) {
    const st = REACTION_STYLES[((styleIdx || 0) % REACTION_STYLES.length + REACTION_STYLES.length) % REACTION_STYLES.length];
    return `[반응 순서] ① ${st.instr}. ② 그 말에서 잘한 점이나 마음을 구체적으로 인정하는 한 문장. ③ 질문은 딱 1개. ` +
      `"왜 그렇게 말했어?", "왜 그랬어?"처럼 따지는 말투는 쓰지 말고, 까닭이 궁금하면 "어떤 점 때문에 그렇게 생각했어요?"처럼 부드럽게 묻는다. 예상과 다른 답이어도 탓하지 말고 자연스럽게 받아 이어 간다.`;
  }
  function pickVaried(list, lastIdx) {
    if (!list.length) return { i: -1, v: '' };
    if (list.length === 1) return { i: 0, v: list[0] };
    let i = Math.floor(Math.random() * list.length);
    if (i === lastIdx) i = (i + 1) % list.length;
    return { i, v: list[i] };
  }

  Object.assign(CS, { TONE, toneRule, toneShort, COPY, REACTION_STYLES, buildReactionInstr, pickVaried });
})(typeof window !== 'undefined' ? window : globalThis);
