import re
import json
from datetime import datetime
from typing import List, Dict, Any

class SessionManager:
    """초중등 학습자의 메타인지 및 인간-AI 상호작용 성찰을 관리하는 세션 매니저"""

    def __init__(self):
        self.reset_session()

    def reset_session(self):
        """세션 초기화"""
        self.session_data = {
            # 시스템 공통
            "created_at": datetime.now().isoformat(),
            "scaffolding_level": "High",  # 원리 1: High -> Medium -> Low (점진적 페이딩)
            "interaction_count": 0,
            
            # 1단계: 대화 준비 (학습 맥락 및 사전지식 점검)
            "context": {
                "subject": "",                # 교과목
                "unit": "",                   # 단원
                "learning_goal": "",          # 원리 4: 학습 목표
                "task_description": "",       # 원리 4: 학습 과제
                "ai_role_mode": "",           # 원리 5: AI 과업 분담
                "prior_knowledge": "",        # 원리 6: 교과 내용 사전지식 활성화
                "prior_understanding_score": None, # 원리 6: 사전 이해도 (1~5점)
                "metacog_understanding": "",  # 원리 7: 이해 질문 응답
                "metacog_strategy": "",       # 원리 7: 전략 질문 응답
                "metacog_connection": "",     # 원리 7: 연결 질문 응답
            },
            
            # 2단계: 대화 과정 (인지 전략 조절 지원)
            "current_strategy": "정교화(Elaboration)",  # 원리 8: 인지 전략
            "strategy_reason": "",                     # 원리 8: 전략 선택 근거
            "strategy_history": [],                    # 원리 9: 전략 변경 및 모니터링 기록
            "messages": [],                            # 대화 내역 (원리 3, 10)
            
            # 3단계: 대화 종결 및 성찰 (대화 이후)
            "reflection": {
                "role_delegation_notes": "",      # 원리 11: 주도권 및 AI 위임 성찰
                "prompt_trajectory_notes": "",    # 원리 12: 프롬프트 궤적 및 개선점 성찰
                "transfer_task_prompt": "",       # 원리 13: AI 소거 유사 과업 문제
                "transfer_task_answer": "",       # 원리 13: 학습자 직접 해결 답변
                "post_understanding_score": None, # 원리 13: 사후 이해도 (1~5점)
                "cognitive_growth_notes": "",     # 원리 13: 인지 전략 발전도 성찰
            }
        }

    # --- 원리 3: 개인정보 비식별화 ---
    @staticmethod
    def anonymize_text(text: str) -> str:
        """이름, 전화번호, 주민번호, 이메일 등 개인정보 비식별화 처리"""
        if not text:
            return ""
        # 전화번호 마스킹 (010-XXXX-XXXX 등)
        text = re.sub(r'01[016789]-?\d{3,4}-?\d{4}', '[전화번호 보호]', text)
        # 이메일 마스킹
        text = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[이메일 보호]', text)
        # 주민등록번호 형태 마스킹
        text = re.sub(r'\d{6}-[1-4]\d{6}', '[주민번호 보호]', text)
        return text

    # --- 대화 메시지 관리 (원리 1, 3, 10, 11) ---
    def add_user_message(self, content: str, delegation_type: str = "learner_directed") -> int:
        """
        학습자 메시지 추가
        delegation_type: 'learner_directed' (주도적 탐구) vs 'ai_delegated' (단순 답 요구/위임)
        """
        self.session_data["interaction_count"] += 1
        msg_id = len(self.session_data["messages"])
        
        # 원리 1: 대화 진행 정도에 따른 적응적 스캐폴딩 페이딩
        turn_count = len([m for m in self.session_data["messages"] if m["role"] == "user"])
        if turn_count >= 5 and self.session_data["scaffolding_level"] == "High":
            self.session_data["scaffolding_level"] = "Medium"
        elif turn_count >= 10 and self.session_data["scaffolding_level"] == "Medium":
            self.session_data["scaffolding_level"] = "Low"

        self.session_data["messages"].append({
            "id": msg_id,
            "role": "user",
            "content": self.anonymize_text(content),
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "delegation_type": delegation_type  # 원리 11용 질문 성향 분류
        })
        return msg_id

    def add_ai_message(self, content: str, reasoning: str = None) -> int:
        """AI 응답 추가 및 원리 10 검증 필드 초기화"""
        msg_id = len(self.session_data["messages"])
        self.session_data["messages"].append({
            "id": msg_id,
            "role": "assistant",
            "content": content,
            "reasoning": reasoning,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "scaffolding_level": self.session_data["scaffolding_level"],
            # 원리 10: 학생의 AI 산출물 검증 상태
            "verification": {
                "status": "미검증",  # 수용(Accept) / 수정필요(Modify) / 의문(Question) / 미검증
                "comment": "",
                "is_critical": False
            }
        })
        return msg_id

    def update_verification(self, msg_id: int, status: str, comment: str):
        """원리 10: AI 산출물에 대한 학습자의 비판적 검증 및 수용 여부 코멘트 기록"""
        for msg in self.session_data["messages"]:
            if msg.get("id") == msg_id and msg.get("role") == "assistant":
                msg["verification"] = {
                    "status": status,
                    "comment": self.anonymize_text(comment),
                    "is_critical": status in ["수정필요", "의문"]
                }
                break

    # --- 원리 8 & 9: 인지 전략 설정 및 모니터링 변경 ---
    def change_strategy(self, new_strategy: str, reason: str):
        old_strategy = self.session_data["current_strategy"]
        self.session_data["current_strategy"] = new_strategy
        self.session_data["strategy_history"].append({
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "from": old_strategy,
            "to": new_strategy,
            "reason": reason
        })

    # --- 원리 11: 주도권 vs 위임 질문 통계 계산 ---
    def get_delegation_stats(self) -> Dict[str, Any]:
        user_msgs = [m for m in self.session_data["messages"] if m["role"] == "user"]
        total = len(user_msgs)
        if total == 0:
            return {"total": 0, "learner_directed": 0, "ai_delegated": 0, "learner_ratio": 0.0}
        
        learner_directed = sum(1 for m in user_msgs if m.get("delegation_type") == "learner_directed")
        ai_delegated = total - learner_directed
        return {
            "total": total,
            "learner_directed": learner_directed,
            "ai_delegated": ai_delegated,
            "learner_ratio": round((learner_directed / total) * 100, 1)
        }

    # --- 원리 12: 비판적 검증 통계 계산 ---
    def get_verification_stats(self) -> Dict[str, Any]:
        ai_msgs = [m for m in self.session_data["messages"] if m["role"] == "assistant"]
        total = len(ai_msgs)
        if total == 0:
            return {"total": 0, "accepted": 0, "questioned": 0, "unverified": 0}
        
        accepted = sum(1 for m in ai_msgs if m.get("verification", {}).get("status") == "수용")
        questioned = sum(1 for m in ai_msgs if m.get("verification", {}).get("status") in ["수정필요", "의문"])
        unverified = sum(1 for m in ai_msgs if m.get("verification", {}).get("status") == "미검증")
        return {
            "total": total,
            "accepted": accepted,
            "questioned": questioned,
            "unverified": unverified
        }

    # --- 원리 3: 세션 데이터 JSON 내보내기 ---
    def export_json(self) -> str:
        return json.dumps(self.session_data, ensure_ascii=False, indent=2)
