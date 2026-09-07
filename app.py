import streamlit as st
import pandas as pd
import plotly.express as px
import json
from datetime import datetime

import config
from session_manager import SessionManager
from llm_client import UpstageLLMClient

# --- 페이지 설정 ---
st.set_page_config(
    page_title="메타인지 & 인간-AI 성찰 챗봇",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- 세션 상태 초기화 ---
if "session_mgr" not in st.session_state:
    st.session_state.session_mgr = SessionManager()

if "llm_client" not in st.session_state:
    st.session_state.llm_client = UpstageLLMClient()

if "active_step" not in st.session_state:
    st.session_state.active_step = "대화 준비"

session_data = st.session_state.session_mgr.session_data
llm = st.session_state.llm_client

# --- 헤더 영역 ---
st.title("🧠 초중등 메타인지 & 인간-AI 협력 성찰 챗봇")
st.caption("초중등 학습자의 자기조절학습과 AI 리터러시를 위한 13대 설계원리 기반 대화형 시스템")

# --- 사이드바: 전략 모니터링 및 시스템 컨트롤 ---
with st.sidebar:
    st.header("⚙️ 인지 전략 & 비계 컨트롤")

    # API 상태 안내
    if llm.is_configured():
        st.success("🟢 Upstage Solar API 연결됨")
        st.caption(f"모델: `{config.UPSTAGE_MODEL}` | 추론: `{config.UPSTAGE_REASONING_EFFORT}`")
    else:
        st.error("🔴 API 키 미설정")
        st.info("프로젝트 폴더의 `.env` 파일에 `UPSTAGE_API_KEY`를 설정해주세요.")

    st.markdown("---")

    # 단계 빠른 전환
    st.subheader("📌 학습 단계")
    step_options = ["대화 준비", "대화 과정", "종결 및 성찰"]
    st.session_state.active_step = st.radio(
        "현재 진행 단계 선택",
        step_options,
        index=step_options.index(st.session_state.active_step)
    )

    st.markdown("---")

    # 원리 1: 비계의 적응적 지원 감소 (Fading)
    st.subheader("🪜 비계 지원 수준 (원리 1)")
    current_scaffold = session_data.get("scaffolding_level", "High")
    scaffold_colors = {"High": "🟢 높음 (친절한 가이드)", "Medium": "🟡 중간 (자기설명 유도)", "Low": "🔴 낮음 (독립적 탐구)"}
    st.write(f"현재 비계: **{scaffold_colors.get(current_scaffold, current_scaffold)}**")
    
    new_scaffold = st.select_slider(
        "비계 수준 직접 조절",
        options=["High", "Medium", "Low"],
        value=current_scaffold,
        format_func=lambda x: {"High": "높음", "Medium": "중간", "Low": "낮음(비계 소거)"}[x]
    )
    if new_scaffold != current_scaffold:
        session_data["scaffolding_level"] = new_scaffold
        st.rerun()

    st.markdown("---")

    # 원리 8 & 9: 현재 인지 전략 모니터링 및 변경
    st.subheader("🎯 현재 적용 인지 전략 (원리 8/9)")
    current_strat = session_data.get("current_strategy", "정교화(Elaboration)")
    st.info(f"**{current_strat}**\n\n{config.COGNITIVE_STRATEGIES.get(current_strat, '')}")

    with st.expander("🔄 전략 변경 및 점검 (원리 9)"):
        strat_options = list(config.COGNITIVE_STRATEGIES.keys())
        new_strat = st.selectbox("바꿀 인지 전략 선택", strat_options, index=strat_options.index(current_strat))
        change_reason = st.text_input("전략 변경 사유", placeholder="예: 개념이 헷갈려서 표로 정리(조직화)하고 싶음")
        if st.button("전략 변경 적용"):
            if change_reason.strip():
                st.session_state.session_mgr.change_strategy(new_strat, change_reason)
                st.success(f"전략이 '{new_strat}'(으)로 변경되었습니다!")
                st.rerun()
            else:
                st.warning("전략 변경 사유를 입력해주세요.")

    st.markdown("---")
    
    # 원리 3: 데이터 내보내기
    st.subheader("💾 학습 기록 다운로드 (원리 3)")
    json_str = st.session_state.session_mgr.export_json()
    st.download_button(
        label="📥 비식별화 학습 데이터 (JSON)",
        data=json_str,
        file_name=f"metacog_learning_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
        mime="application/json"
    )

# --- 탭 구성 (메인 화면) ---
tab_prep, tab_dialogue, tab_reflect = st.tabs([
    "1️⃣ 대화 준비 (맥락 & 사전지식)",
    "2️⃣ 대화 과정 (인지전략 & 스캐폴딩)",
    "3️⃣ 종결 및 성찰 (역할·궤적·전이)"
])

# ==============================================================================
# 1단계: 대화 준비 (원리 4, 5, 6, 7)
# ==============================================================================
with tab_prep:
    st.subheader("📝 대화 준비: 학습 목표 및 사전 지식 점검")
    st.caption("AI와 대화를 시작하기 전, 무엇을 배울지 명확히 하고 나의 사전 지식을 점검해 봅니다.")

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### 🎯 원리 4: 학습 목표 및 과제 설정")
        subject = st.text_input("과목명", value=session_data["context"]["subject"] or "과학", placeholder="예: 과학, 사회, 수학")
        unit = st.text_input("단원명 / 주제", value=session_data["context"]["unit"] or "빛과 렌즈", placeholder="예: 빛과 렌즈, 시장경제의 이해")
        learning_goal = st.text_area("오늘의 학습 목표", value=session_data["context"]["learning_goal"] or "볼록렌즈와 오목렌즈를 통과하는 빛의 굴절 원리를 이해하고 일상생활 쓰임새를 설명할 수 있다.", height=80)
        task_desc = st.text_area("해결할 구체적 과제", value=session_data["context"]["task_description"] or "볼록렌즈로 돋보기를 만들 때 물체가 왜 거꾸로 보이다가 똑바로 보이는지 원리 파악하기", height=80)

    with col2:
        st.markdown("#### 🤝 원리 5: 학습자-AI 역할 분담")
        ai_role = st.selectbox(
            "AI의 역할 설정",
            [
                "조력자 및 소크라테스식 질문자 (답 대신 질문과 힌트 제공)",
                "동료 탐구자 (서로 의견을 나누며 반론 제기)",
                "점검자 (내가 설명한 내용을 듣고 빈틈 짚어주기)"
            ],
            index=0
        )
        st.markdown("#### 🔍 원리 6: 사전 내용지식 활성화")
        prior_score = st.slider("이 주제에 대해 내가 이미 알고 있는 수준 (사전 이해도)", 1, 5, session_data["context"]["prior_understanding_score"])
        prior_know = st.text_area("이미 알고 있는 관련 개념이나 경험", value=session_data["context"]["prior_knowledge"] or "돋보기로 햇빛을 모아 종이를 태워본 적이 있고, 안경을 쓰면 글씨가 잘 보인다는 것을 안다.", height=80)

    st.markdown("---")
    st.markdown("#### 🧠 원리 7: 메타인지적 지식 사전 점검")
    col_a, col_b, col_c = st.columns(3)
    with col_a:
        q_under = st.text_area("이해 질문: 이 주제에서 가장 중요한 핵심 개념은 무엇일까?", value=session_data["context"]["metacog_understanding"], height=90, placeholder="예: 빛이 서로 다른 물질을 통과할 때 꺾이는 '굴절' 현상")
    with col_b:
        q_strat = st.text_area("전략 질문: 이 내용을 잘 배우기 위해 어떤 인지 전략을 쓸까?", value=session_data["context"]["metacog_strategy"], height=90, placeholder="예: 빛의 경로를 그림으로 직접 그려보며 조직화하기")
    with col_c:
        q_conn = st.text_area("연결 질문: 지난 시간에 배운 지식이나 내 경험과 어떻게 연결될까?", value=session_data["context"]["metacog_connection"], height=90, placeholder="예: 거울에서 빛이 반사되던 현상과 렌즈의 굴절 현상 비교")

    st.markdown("#### 🎯 원리 8: 인지 전략 계획 수립")
    col_s1, col_s2 = st.columns([1, 2])
    with col_s1:
        selected_strat = st.selectbox("시작할 인지 전략 선택", list(config.COGNITIVE_STRATEGIES.keys()), index=1)
    with col_s2:
        strat_reason = st.text_input("이 인지 전략을 선택한 이유", value=session_data.get("strategy_reason") or "나만의 말로 바꾸어 설명해보면 진짜 이해했는지 알 수 있을 것 같아서")

    if st.button("🚀 대화 준비 완료하고 2단계 대화 시작하기", type="primary", use_container_width=True):
        session_data["context"]["subject"] = subject
        session_data["context"]["unit"] = unit
        session_data["context"]["learning_goal"] = learning_goal
        session_data["context"]["task_description"] = task_desc
        session_data["context"]["ai_role_mode"] = ai_role
        session_data["context"]["prior_understanding_score"] = prior_score
        session_data["context"]["prior_knowledge"] = prior_know
        session_data["context"]["metacog_understanding"] = q_under
        session_data["context"]["metacog_strategy"] = q_strat
        session_data["context"]["metacog_connection"] = q_conn
        session_data["current_strategy"] = selected_strat
        session_data["strategy_reason"] = strat_reason
        
        st.session_state.active_step = "대화 과정"
        st.success("대화 준비가 저장되었습니다! 2단계 대화 탭으로 이동합니다.")
        st.rerun()

# ==============================================================================
# 2단계: 대화 과정 (원리 1, 2, 8, 9, 10)
# ==============================================================================
with tab_dialogue:
    st.subheader("💬 대화 과정: 인지 전략 조절 & 비판적 상호작용")
    
    # 상단 요약 바
    c_info1, c_info2, c_info3 = st.columns(3)
    c_info1.metric("현재 주제", f"{session_data['context'].get('subject', '미정')} > {session_data['context'].get('unit', '미정')}")
    c_info2.metric("활성화 전략 (원리 8)", session_data.get('current_strategy', '정교화'))
    c_info3.metric("비계 수준 (원리 1)", session_data.get('scaffolding_level', 'High'))

    st.markdown("---")

    # 대화 메시지 렌더링
    messages = session_data.get("messages", [])
    if not messages:
        st.info("👋 대화가 아직 시작되지 않았습니다. 아래 입력창에 첫 질문이나 생각을 적어보세요!\n(예: '빛이 렌즈를 통과할 때 왜 꺾이는지 궁금해요.')")

    for idx, msg in enumerate(messages):
        if msg["role"] == "user":
            with st.chat_message("user", avatar="🧑‍🎓"):
                badge = "🌟 주도적 탐구" if msg.get("delegation_type") == "learner_directed" else "🤖 AI 위임 질문"
                st.caption(f"{msg.get('timestamp')} | {badge}")
                st.write(msg["content"])
        elif msg["role"] == "assistant":
            with st.chat_message("assistant", avatar="🦉"):
                st.caption(f"{msg.get('timestamp')} | 비계 지원: {msg.get('scaffolding_level')}")
                
                # Upstage 모델의 추론(Reasoning) 표시
                if msg.get("reasoning"):
                    with st.expander("🔍 AI의 생각 과정 (Reasoning 과정 살펴보기)"):
                        st.markdown(f"```text\n{msg['reasoning']}\n```")

                st.write(msg["content"])

                # --- 원리 10: AI 산출물 비판적 검증 및 수용 여부 판단 패널 ---
                ver = msg.get("verification", {})
                current_status = ver.get("status", "미검증")
                
                with st.expander(f"🛡️ 원리 10: AI 답변 비판적 검증 (현재 상태: {current_status})", expanded=(current_status == "미검증")):
                    v_col1, v_col2 = st.columns([1, 2])
                    with v_col1:
                        v_status = st.radio(
                            "나의 판단",
                            ["수용 (타당함)", "의문 (확인 필요)", "수정필요 (오류/부족)"],
                            key=f"v_status_{idx}",
                            index=["수용", "의문", "수정필요"].index(current_status) if current_status in ["수용", "의문", "수정필요"] else 0
                        )
                    with v_col2:
                        v_comment = st.text_input(
                            "비판적 코멘트 (이유나 의문점)",
                            value=ver.get("comment", ""),
                            key=f"v_comment_{idx}",
                            placeholder="예: 빛이 꺾이는 이유는 알겠지만, 초점이 어디에 생기는지는 설명이 부족함"
                        )
                        if st.button("검증 결과 저장", key=f"btn_save_ver_{idx}"):
                            clean_status = v_status.split()[0]
                            st.session_state.session_mgr.update_verification(msg["id"], clean_status, v_comment)
                            st.success("비판적 검증 기록이 저장되었습니다!")
                            st.rerun()

    st.markdown("---")

    # 대화 입력창 (원리 11 데이터 수집 연계)
    col_input, col_type = st.columns([3, 1])
    with col_type:
        delegation_type = st.selectbox(
            "나의 질문 성향 (원리 11)",
            ["주도적 탐구 (내 생각을 담음)", "AI에게 위임 (단순 답 요구)"],
            index=0,
            help="주도적 탐구: 내 생각, 가설, 시도를 포함하여 질문함 / AI에게 위임: '그냥 답 알려줘' 형태의 질문"
        )
    with col_input:
        user_input = st.text_input("질문이나 생각을 입력하세요", placeholder="현재 선택한 인지 전략을 활용하여 AI에게 질문하거나 내 생각을 말해보세요...")

    c_btn1, c_btn2 = st.columns([1, 1])
    with c_btn1:
        if st.button("✉️ 메시지 전송", type="primary", use_container_width=True):
            if user_input.strip():
                del_code = "learner_directed" if "주도적" in delegation_type else "ai_delegated"
                st.session_state.session_mgr.add_user_message(user_input, del_code)
                
                # AI 호출
                with st.spinner("소크라-봇이 사고하는 중입니다..."):
                    reply, reasoning = llm.generate_response(session_data, user_input)
                    st.session_state.session_mgr.add_ai_message(reply, reasoning)
                
                st.rerun()
            else:
                st.warning("메시지를 입력해주세요.")

    with c_btn2:
        if st.button("🏁 대화 마치고 3단계 성찰로 이동하기", use_container_width=True):
            st.session_state.active_step = "종결 및 성찰"
            st.rerun()

# ==============================================================================
# 3단계: 대화 종결 및 성찰 (원리 11, 12, 13)
# ==============================================================================
with tab_reflect:
    st.subheader("🌟 대화 종결 및 성찰: 메타인지와 AI 상호작용 돌아보기")
    st.caption("AI와의 대화를 마친 후, 나의 배움 과정과 AI 활용 방식을 다각도로 성찰하는 단계입니다.")

    # 통계 계산
    del_stats = st.session_state.session_mgr.get_delegation_stats()
    ver_stats = st.session_state.session_mgr.get_verification_stats()

    col_m1, col_m2, col_m3, col_m4 = st.columns(4)
    col_m1.metric("총 대화 횟수", f"{del_stats['total']}회")
    col_m2.metric("학습자 주도 질문", f"{del_stats['learner_directed']}회 ({del_stats['learner_ratio']}%)")
    col_m3.metric("AI 위임 질문", f"{del_stats['ai_delegated']}회")
    col_m4.metric("AI 답변 비판적 검토율", f"{round((ver_stats['accepted'] + ver_stats['questioned'])/max(1, ver_stats['total'])*100, 1)}%")

    st.markdown("---")

    # --- 원리 11: 학습자-AI 간 역할 및 위임 성찰 ---
    st.markdown("### 🤝 원리 11: 역할 및 주도권 성찰")
    st.markdown("학습 과정 중 **내가 주도권을 쥔 순간**과 **AI에게 무비판적으로 위임해버린 순간**을 돌아봅니다.")
    
    col_chart1, col_chart2 = st.columns(2)
    with col_chart1:
        if del_stats["total"] > 0:
            df_del = pd.DataFrame({
                "유형": ["학습자 주도 질문", "AI 단순 위임"],
                "건수": [del_stats["learner_directed"], del_stats["ai_delegated"]]
            })
            fig_del = px.pie(df_del, values="건수", names="유형", title="질문 주도성 비율", color_discrete_sequence=["#2ca02c", "#ff7f0e"])
            fig_del.update_traces(textposition='inside', textinfo='percent+label')
            st.plotly_chart(fig_del, use_container_width=True)
        else:
            st.info("대화 내역이 없습니다.")

    with col_chart2:
        refl_role = st.text_area(
            "📝 주도권 성찰 작성",
            value=session_data["reflection"].get("role_delegation_notes", ""),
            placeholder="예: 초반에는 답만 바로 알려달라고 위임했으나, 중반부터는 내가 렌즈의 특징을 직접 정리해서 맞는지 확인받는 주도적인 질문을 던졌다.",
            height=180
        )

    st.markdown("---")

    # --- 원리 12: AI와의 상호작용 및 질문 궤적 성찰 ---
    st.markdown("### 📈 원리 12: 질문 궤적 및 프롬프트 적절성 성찰")
    st.markdown("내가 입력한 질문(프롬프트)들이 얼마나 명확하고 효과적이었는지 되짚어봅니다.")

    # 대화 로그 테이블 표시
    user_prompts = [
        {"순번": i+1, "시간": m.get("timestamp"), "질문 내용": m["content"], "유형": "주도적" if m.get("delegation_type")=="learner_directed" else "위임"}
        for i, m in enumerate(session_data.get("messages", [])) if m["role"] == "user"
    ]
    if user_prompts:
        st.dataframe(pd.DataFrame(user_prompts), use_container_width=True)
    
    refl_prompt = st.text_area(
        "📝 질문 궤적 및 프롬프트 개선점 성찰",
        value=session_data["reflection"].get("prompt_trajectory_notes", ""),
        placeholder="예: 질문이 너무 짧고 모호했던 2번째 질문에서는 AI 답변도 원론적이었다. 4번째 질문처럼 '볼록렌즈의 초점 거리'라고 명확히 조건을 주었을 때 훨씬 좋은 피드백을 얻을 수 있었다.",
        height=100
    )

    st.markdown("---")

    # --- 원리 13: 교과 내용지식 및 인지 전략 변화 성찰 (AI 소거 유사 과업) ---
    st.markdown("### 🎓 원리 13: AI 도움 없는 전이 과업 수행 & 전후 변화 성찰")
    st.markdown("이제 **AI의 도움을 받지 않고**, 오늘 학습한 원리를 유사한 새로운 문제에 직접 적용해 봅니다.")

    if not session_data["reflection"].get("transfer_task_prompt"):
        if st.button("🎲 유사 수준의 전이 과업(문제) 출제받기"):
            with st.spinner("오늘 학습한 내용을 바탕으로 전이 과제를 생성 중입니다..."):
                t_task = llm.generate_transfer_task(session_data)
                session_data["reflection"]["transfer_task_prompt"] = t_task
                st.rerun()

    if session_data["reflection"].get("transfer_task_prompt"):
        st.warning(f"📌 **[도전 과제 (AI 없이 풀기)]**\n\n{session_data['reflection']['transfer_task_prompt']}")
        transfer_ans = st.text_area(
            "나의 자가 해결 답변 (오직 내 힘으로만 작성하기)",
            value=session_data["reflection"].get("transfer_task_answer", ""),
            height=150,
            placeholder="AI의 힌트 없이, 오늘 배운 인지 전략을 활용하여 나만의 풀이와 설명을 적어보세요."
        )

    # 사전 vs 사후 이해도 변화 비교
    col_score1, col_score2 = st.columns(2)
    with col_score1:
        st.write(f"학습 전 사전 이해도 점수: **{session_data['context'].get('prior_understanding_score', 3)}점** / 5점")
        post_score = st.slider(
            "학습 후 현재 나의 최종 이해도 점수 (사후 이해도)",
            1, 5,
            session_data["reflection"].get("post_understanding_score", 4)
        )
    with col_score2:
        df_scores = pd.DataFrame({
            "시점": ["학습 전 (사전)", "학습 후 (사후)"],
            "이해도 점수 (5점 만점)": [session_data['context'].get('prior_understanding_score', 3), post_score]
        })
        fig_score = px.bar(df_scores, x="시점", y="이해도 점수 (5점 만점)", range_y=[0, 5], color="시점", text="이해도 점수 (5점 만점)")
        st.plotly_chart(fig_score, use_container_width=True)

    refl_growth = st.text_area(
        "📝 인지 전략 발전 및 종합 배움 성찰",
        value=session_data["reflection"].get("cognitive_growth_notes", ""),
        placeholder="예: 정교화 전략을 사용하여 내 안경 렌즈와 스마트폰 카메라 렌즈의 차이를 직접 비교해본 것이 기억에 오래 남을 것 같다. 다음번에는 표로 정리하는 조직화 전략도 같이 써보고 싶다.",
        height=100
    )

    if st.button("💾 최종 성찰 기록 저장 및 완료", type="primary", use_container_width=True):
        session_data["reflection"]["role_delegation_notes"] = refl_role
        session_data["reflection"]["prompt_trajectory_notes"] = refl_prompt
        if "transfer_ans" in locals():
            session_data["reflection"]["transfer_task_answer"] = transfer_ans
        session_data["reflection"]["post_understanding_score"] = post_score
        session_data["reflection"]["cognitive_growth_notes"] = refl_growth
        st.success("🎉 모든 학습 및 성찰 과정이 성공적으로 완료되었습니다! 상단 사이드바에서 학습 데이터를 다운로드할 수 있습니다.")
