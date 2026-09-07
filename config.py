import os
from pathlib import Path
from dotenv import load_dotenv

# .env 파일 경로 지정 및 로드
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

def get_config(key: str, default: str = "") -> str:
    """로컬 .env 및 Streamlit Cloud Secrets에서 환경변수 로드"""
    # 1. Streamlit Secrets 우선 확인 (클라우드 배포 시)
    try:
        import streamlit as st
        if hasattr(st, "secrets") and key in st.secrets:
            return str(st.secrets[key])
    except Exception:
        pass
    # 2. 로컬 .env 환경변수 확인
    return os.getenv(key, default)

# Upstage Solar API 설정
UPSTAGE_API_KEY = get_config("UPSTAGE_API_KEY", "")
UPSTAGE_BASE_URL = get_config("UPSTAGE_BASE_URL", "https://api.upstage.ai/v1")
UPSTAGE_MODEL = get_config("UPSTAGE_MODEL", "solar-pro")
UPSTAGE_REASONING_EFFORT = get_config("UPSTAGE_REASONING_EFFORT", "medium")

# 메타인지 챗봇 기본 설정
APP_TITLE = "메타인지 & 인간-AI 성찰 촉진 챗봇"
APP_SUBTITLE = "초중등 학습자의 자기조절학습 및 비판적 AI 협력 역량 함양"

# 13개 설계원리 명칭 목록
PRINCIPLES = {
    1: "비계의 적응적 지원 감소 원리 (Fading)",
    2: "학습자 선택권 및 최종판단 보존의 원리",
    3: "대화과정의 기록 및 시각화의 원리",
    4: "학습 목표 및 교과 맥락 설정의 원리",
    5: "학습자-AI 간 과업 범위 분담 명확화의 원리",
    6: "교과 내용지식 사전 활성화 및 점검의 원리",
    7: "메타인지적 지식 점검의 원리 (이해/전략/연결)",
    8: "인지 전략 계획 수립의 원리 (시연/정교화/조직화/비판적사고 등)",
    9: "학습 과정 모니터링 기반 인지 전략 조정의 원리",
    10: "AI 기반 응답 검증 및 수용 여부 판단의 원리",
    11: "학습자-AI 간 역할 및 위임 성찰의 원리",
    12: "AI와의 상호작용 및 질문 궤적 성찰의 원리",
    13: "교과 내용지식 및 인지 전략 변화 성찰의 원리"
}

# 주요 인지 전략 정의
COGNITIVE_STRATEGIES = {
    "시연(Rehearsal)": "핵심 개념, 공식, 어휘를 소리 내어 읽거나 반복 암기하며 머릿속에 각인하는 전략",
    "정교화(Elaboration)": "새로운 지식을 이미 알고 있는 지식이나 일상 경험에 빗대어 설명하고 예시를 만드는 전략",
    "조직화(Organization)": "개념들 간의 관계를 마인드맵, 표, 계층 구조도로 요약·분류하여 구조화하는 전략",
    "비판적 사고(Critical Thinking)": "AI의 답변이나 정보의 근거를 따져보고, 반례를 찾아보며 스스로 검증하는 전략",
    "이해 점검(Comprehension Monitoring)": "자신이 어디까지 이해했고 어느 부분에서 막혔는지 질문을 던져 점검하는 전략"
}
