import sys
import io
from pathlib import Path

# 콘솔 출력 UTF-8 인코딩 설정
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# 모듈 경로 추가
sys.path.append(str(Path(__file__).resolve().parent))

from config import UPSTAGE_API_KEY, UPSTAGE_MODEL
from llm_client import UpstageLLMClient
from session_manager import SessionManager

print(f"Testing Upstage API with model: {UPSTAGE_MODEL}")
print(f"API Key present: {bool(UPSTAGE_API_KEY)}")

session_mgr = SessionManager()
session_mgr.session_data["context"]["subject"] = "과학"
session_mgr.session_data["context"]["unit"] = "빛과 렌즈"
session_mgr.session_data["context"]["learning_goal"] = "볼록렌즈의 굴절 원리 이해"
session_mgr.session_data["current_strategy"] = "정교화(Elaboration)"

client = UpstageLLMClient()

test_question = "선생님, 돋보기로 햇빛을 모으면 왜 한 점으로 모이나요?"
print(f"\nUser Input: {test_question}")

response, reasoning = client.generate_response(session_mgr.session_data, test_question)

print("\n--- AI Response ---")
print(response)

if reasoning:
    print("\n--- AI Reasoning ---")
    print(reasoning)

print("\n[SUCCESS] Upstage API Test completed successfully!")
