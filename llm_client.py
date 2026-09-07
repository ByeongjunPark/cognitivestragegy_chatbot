import os
from typing import Dict, Any, Tuple, Optional
from openai import OpenAI
import config

class UpstageLLMClient:
    """Upstage Solar API 기반 메타인지 스캐폴딩 LLM 클라이언트"""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or config.UPSTAGE_API_KEY
        self.base_url = config.UPSTAGE_BASE_URL
        self.model = model or config.UPSTAGE_MODEL
        self.reasoning_effort = config.UPSTAGE_REASONING_EFFORT

        if not self.api_key:
            self.client = None
        else:
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )

    def is_configured(self) -> bool:
        return bool(self.client and self.api_key)

    def build_system_prompt(self, session_data: Dict[str, Any]) -> str:
        """13개 설계원리가 완벽히 주입된 적응형 시스템 프롬프트 생성"""
        ctx = session_data.get("context", {})
        scaffolding = session_data.get("scaffolding_level", "High")
        strategy = session_data.get("current_strategy", "정교화(Elaboration)")
        strategy_reason = session_data.get("strategy_reason", "이해를 깊이 있게 하기 위함")

        # 스캐폴딩 레벨에 따른 비계 지원 수준 (원리 1: 점진적 페이딩)
        scaffolding_instructions = {
            "High": """
- [스캐폴딩 수준: 높음(초기 단계)]
  * 학습자가 개념에 친숙해지도록 친절한 안내와 구체적인 예시, 단계별 안내 질문을 제공하세요.
  * 단, 정답을 직접 알려주지 말고, 학습자가 답을 떠올릴 수 있는 힌트와 질문을 건네세요.
""",
            "Medium": """
- [스캐폴딩 수준: 중간(도약 단계)]
  * 직접적인 힌트의 양을 줄이고, 학습자가 개념 간의 관계를 스스로 연결해볼 수 있도록 반문하세요.
  * "네가 방금 설명한 것에서 어떤 규칙을 찾을 수 있을까?"처럼 자기 설명(Self-Explanation)을 유도하세요.
""",
            "Low": """
- [스캐폴딩 수준: 낮음(독립 단계 - 비계 소거)]
  * AI의 개입을 최소화하세요. 직접적인 힌트를 주지 마세요.
  * 학습자가 스스로 문제 해결의 적절성을 평가하고 검증할 수 있도록 유도하는 메타인지적 질문만 짧게 던지세요.
"""
        }.get(scaffolding, "")

        prompt = f"""당신은 초·중등 학습자의 '메타인지(Metacognition)' 신장과 '인간-AI 협력적 성찰'을 돕는 교육 전문 AI 튜터 '소크라-봇'입니다.
학습자가 스스로 배움의 주도권을 쥐고 성장할 수 있도록 다음의 [핵심 설계 원리]를 철저히 준수하여 응답하세요.

[현재 학습 맥락 (원리 4, 5, 6, 7)]
- 과목 및 단원: {ctx.get('subject', '미지정')} / {ctx.get('unit', '미지정')}
- 학습 목표: {ctx.get('learning_goal', '스스로 핵심 원리 탐구')}
- 해결할 과제: {ctx.get('task_description', '과제 진행')}
- 학습자가 지정한 AI의 역할: {ctx.get('ai_role_mode', '조력자 및 소크라테스식 질문자')}
- 학습자의 사전 지식 수준: 5점 만점 중 {ctx.get('prior_understanding_score', 3)}점
- 사전 활성화 지식: {ctx.get('prior_knowledge', '기본 개념 학습 희망')}
- 현재 집중 중인 인지 전략(원리 8): [{strategy}] (선택 이유: {strategy_reason})

[지켜야 할 핵심 행동 수칙]
1. (원리 1: 비계의 적응적 지원 감소) 
   {scaffolding_instructions}
2. (원리 2: 학습자 선택권 및 최종판단 보존)
   * 정답이나 최종 결론을 당신(AI)이 대신 내려주지 마세요.
   * 결정권은 항상 학습자에게 있음을 상기시키고, "이 방법과 저 방법 중 무엇을 먼저 시도해볼래?"와 같이 선택권을 제시하세요.
3. (원리 8 & 9: 인지 전략 조절 촉진)
   * 학습자가 선택한 인지 전략([{strategy}])을 실제로 실천할 수 있도록 유도하세요.
   * 예: 정교화 전략이면 "이것을 네 일상생활의 경험이나 네 방식대로 비유해서 설명해볼래?"
   * 예: 조직화 전략이면 "지금까지 나온 핵심 키워드 3개를 표나 마인드맵 순서로 묶어볼까?"
   * 예: 비판적 사고 전략이면 "방금 AI가 설명한 것에서 혹시 오류나 반례가 될 만한 상황은 없을까?"
4. (원리 10: 비판적 검증 유도)
   * 당신의 응답 끝에는 가끔 "내가 제시한 설명에 부족한 점이나 더 궁금한 점은 없니?"라고 물어 비판적 검토를 장려하세요.
5. 어투: 초중등 학습자 눈높이에 맞춘 다정하고 격려하는 한국어 존댓말을 사용하세요.
"""
        return prompt.strip()

    def generate_response(self, session_data: Dict[str, Any], user_input: str) -> Tuple[str, Optional[str]]:
        """
        Upstage Solar API를 호출하여 AI 응답과 reasoning을 반환합니다.
        반환값: (답변 텍스트, 추론 과정 reasoning 또는 None)
        """
        if not self.is_configured():
            return "⚠️ Upstage API 키가 설정되지 않았습니다. .env 파일에 올바른 UPSTAGE_API_KEY를 입력해 주세요.", None

        system_prompt = self.build_system_prompt(session_data)
        
        # 메시지 히스토리 구축
        messages = [{"role": "system", "content": system_prompt}]
        for msg in session_data.get("messages", []):
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # 최신 사용자 질문 추가
        messages.append({"role": "user", "content": user_input})

        try:
            # 1차 시도: reasoning_effort 파라미터 포함 호출
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    reasoning_effort=self.reasoning_effort
                )
            except Exception:
                # reasoning_effort 미지원 모델일 경우 fallback
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages
                )

            choice = response.choices[0].message
            content = choice.content or ""
            reasoning = getattr(choice, "reasoning", None)
            
            return content, reasoning

        except Exception as e:
            return f"❌ Upstage API 호출 중 오류가 발생했습니다: {str(e)}", None

    def generate_transfer_task(self, session_data: Dict[str, Any]) -> str:
        """원리 13: 대화 종결 후 AI 없이 풀어볼 유사 수준의 전이 과업(Transfer Task) 생성"""
        if not self.is_configured():
            return "기본 전이 과업: 오늘 학습한 핵심 개념을 AI의 도움 없이 나만의 언어로 요약하고, 실생활 문제에 적용해보세요."

        ctx = session_data.get("context", {})
        task_prompt = f"""
당신은 학습 평가 전문가입니다.
학습자가 오늘 공부한 내용:
- 과목/단원: {ctx.get('subject')} / {ctx.get('unit')}
- 학습 목표: {ctx.get('learning_goal')}
- 다룬 주제: {ctx.get('task_description')}

학습자가 AI의 도움을 전혀 받지 않고 스스로 자신의 이해도를 점검할 수 있는 '유사한 수준의 새로운 적용 과제(문제) 1개'를 출제해주세요.
문제와 함께 학습자가 생각해볼 착안점을 친절하게 제시해주세요.
"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": task_prompt}]
            )
            return response.choices[0].message.content or ""
        except Exception:
            return "오늘 학습한 핵심 원리를 떠올리며, 새로운 예시 상황 1가지를 직접 만들고 이를 해결하는 풀이 과정을 스스로 적어보세요."
