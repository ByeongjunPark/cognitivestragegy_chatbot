"""
초중등 메타인지 & AI 성찰 챗봇 백엔드 서버 (FastAPI + SQLite)
민감 개인정보를 수집하지 않는 닉네임 + 빠칭코(그림 4자리) 비밀번호 기반 회원관리 및 학습 데이터 저장 API
"""

import os
import sqlite3
import json
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Cognitive Strategy Chatbot Backend API")

# CORS 설정 (프론트엔드 GitHub Pages 또는 로컬 웹페이지 통신 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "chatbot_database.sqlite"

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# DB 테이블 초기화
def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        # 1. 회원 테이블 (닉네임 + 빠칭코 4자리 그림 PIN + 학년)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT UNIQUE NOT NULL,
                slot_pin TEXT NOT NULL,
                grade_level TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # 2. 학습 세션 및 성찰 기록 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS learning_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subject TEXT,
                unit TEXT,
                learning_goal TEXT,
                prior_score INTEGER,
                post_score INTEGER,
                learner_directed_count INTEGER DEFAULT 0,
                ai_delegated_count INTEGER DEFAULT 0,
                dialogue_log TEXT,
                reflection_log TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        conn.commit()

init_db()

# --- Pydantic 데이터 모델 ---
class UserRegisterRequest(BaseModel):
    nickname: str
    slot_pin: List[str]  # 4자리 이모지 리스트 예: ["🍎", "🐶", "🚀", "🍕"]
    grade_level: str     # 예: "초등 3~4학년", "초등 5~6학년", "중학교 1~3학년"

class UserLoginRequest(BaseModel):
    nickname: str
    slot_pin: List[str]

class SessionSaveRequest(BaseModel):
    nickname: str
    subject: str
    unit: str
    learning_goal: str
    prior_score: int
    post_score: int
    learner_directed_count: int
    ai_delegated_count: int
    dialogue_log: list
    reflection_log: dict

# --- 회원가입 API ---
@app.post("/api/register")
def register(req: UserRegisterRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id FROM users WHERE nickname = ?", (req.nickname,))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="이미 존재하는 닉네임입니다. 다른 닉네임을 사용해주세요.")
    
    pin_str = json.dumps(req.slot_pin, ensure_ascii=False)
    cursor.execute(
        "INSERT INTO users (nickname, slot_pin, grade_level) VALUES (?, ?, ?)",
        (req.nickname, pin_str, req.grade_level)
    )
    db.commit()
    user_id = cursor.lastrowid
    return {
        "success": True,
        "message": f"'{req.nickname}' 학생의 회원가입이 완료되었습니다!",
        "user_id": user_id,
        "nickname": req.nickname
    }

# --- 로그인 API ---
@app.post("/api/login")
def login(req: UserLoginRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id, slot_pin, grade_level FROM users WHERE nickname = ?", (req.nickname,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="가입되지 않은 닉네임입니다. [회원가입]을 먼저 진행해주세요.")
    
    stored_pin = json.loads(user["slot_pin"])
    if stored_pin != req.slot_pin:
        raise HTTPException(status_code=401, detail="그림 비밀번호가 일치하지 않습니다. 다시 확인해주세요.")
    
    # 해당 사용자의 최근 학습 이력 불러오기
    cursor.execute("""
        SELECT * FROM learning_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 5
    """, (user["id"],))
    sessions = [dict(row) for row in cursor.fetchall()]

    return {
        "success": True,
        "message": "로그인에 성공했습니다!",
        "user_id": user["id"],
        "nickname": req.nickname,
        "grade_level": user["grade_level"],
        "recent_sessions": sessions
    }

# --- 학습 세션 및 성찰 데이터 저장 API ---
@app.post("/api/session/save")
def save_session(req: SessionSaveRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id FROM users WHERE nickname = ?", (req.nickname,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    cursor.execute("""
        INSERT INTO learning_sessions (
            user_id, subject, unit, learning_goal, prior_score, post_score,
            learner_directed_count, ai_delegated_count, dialogue_log, reflection_log
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user["id"], req.subject, req.unit, req.learning_goal, req.prior_score, req.post_score,
        req.learner_directed_count, req.ai_delegated_count,
        json.dumps(req.dialogue_log, ensure_ascii=False),
        json.dumps(req.reflection_log, ensure_ascii=False)
    ))
    db.commit()
    return {"success": True, "message": "학습 및 성찰 기록이 백엔드 DB에 안전하게 저장되었습니다."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
