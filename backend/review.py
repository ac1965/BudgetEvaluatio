from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from database import get_db
from auth import get_current_user, UserContext
import os, httpx, json

router = APIRouter(prefix="/review", tags=["review"])


class ReviewPost(BaseModel):
    project_id: int
    author: str
    role: str
    comment: str
    status: str


class AutoReviewRequest(BaseModel):
    project_id: int
    text: str


class ConfirmRequest(BaseModel):
    confirmed_by: str


def _audit(db, project_id, user_name, action, target_table=None, target_id=None, detail=None):
    db.execute(
        text("""
            INSERT INTO audit_logs (project_id, user_name, action, target_table, target_id, detail)
            VALUES (:p, :u, :a, :tt, :ti, :d::jsonb)
        """),
        {"p": project_id, "u": user_name, "a": action, "tt": target_table,
         "ti": target_id, "d": json.dumps(detail or {}, ensure_ascii=False)}
    )


@router.get("/{project_id}")
def get_review(project_id: int, db: Session = Depends(get_db),
               user: UserContext = Depends(get_current_user)):
    user.require("read")
    rows = db.execute(
        text("""
            SELECT id, author, role, comment, status, version,
                   confirmed_by,
                   to_char(confirmed_at, 'YYYY-MM-DD HH24:MI') AS confirmed_at,
                   to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
            FROM review_logs
            WHERE project_id = :id
            ORDER BY created_at
        """),
        {"id": project_id}
    ).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/")
def post_review(data: ReviewPost, db: Session = Depends(get_db),
                user: UserContext = Depends(get_current_user)):
    user.require("write")
    if data.status not in {"issue", "reply", "review", "close"}:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    ver = db.execute(
        text("SELECT COALESCE(MAX(version),0) FROM review_logs WHERE project_id=:p"),
        {"p": data.project_id}
    ).scalar()
    result = db.execute(
        text("""
            INSERT INTO review_logs (project_id,author,role,comment,status,version)
            VALUES (:p,:a,:r,:c,:s,:v) RETURNING id
        """),
        {"p": data.project_id, "a": data.author, "r": data.role,
         "c": data.comment, "s": data.status, "v": ver+1}
    )
    new_id = result.fetchone()[0]
    _audit(db, data.project_id, user.username, "post_review", "review_logs", new_id,
           {"status": data.status, "version": ver+1})
    db.commit()
    return {"status": "ok", "id": new_id, "version": ver+1}


@router.post("/{log_id}/confirm")
def confirm_review(log_id: int, req: ConfirmRequest, db: Session = Depends(get_db),
                   user: UserContext = Depends(get_current_user)):
    user.require("confirm")
    row = db.execute(
        text("SELECT project_id, status FROM review_logs WHERE id=:id"),
        {"id": log_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if row.status == "close":
        raise HTTPException(status_code=400, detail="既に確定済み")
    db.execute(
        text("UPDATE review_logs SET status='close', confirmed_by=:by, confirmed_at=now() WHERE id=:id"),
        {"by": req.confirmed_by, "id": log_id}
    )
    _audit(db, row.project_id, user.username, "confirm_review", "review_logs", log_id,
           {"confirmed_by": req.confirmed_by})
    db.commit()
    return {"status": "ok", "confirmed": True}


@router.post("/auto")
async def auto_review(req: AutoReviewRequest, db: Session = Depends(get_db),
                      user: UserContext = Depends(get_current_user)):
    user.require("write")
    ollama_url   = os.getenv("OLLAMA_URL",   "http://ollama:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5")
    system_prompt = """あなたは日本の政府IT調達のデジタル統括アドバイザーです。
DS-110・DS-910の観点から調達仕様書・見積書をレビューし、具体的な指摘事項を200字以内で箇条書き。条文番号を明示。"""
    payload = {
        "model": ollama_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": req.text},
        ],
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{ollama_url}/api/chat",
            json=payload,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Ollama API error: {resp.text[:200]}")
    comment = resp.json()["message"]["content"]
    ver = db.execute(
        text("SELECT COALESCE(MAX(version),0) FROM review_logs WHERE project_id=:p"),
        {"p": req.project_id}
    ).scalar()
    result = db.execute(
        text("INSERT INTO review_logs (project_id,author,role,comment,status,version) VALUES (:p,'AI自動レビュー','AI',:c,'issue',:v) RETURNING id"),
        {"p": req.project_id, "c": comment, "v": ver+1}
    )
    new_id = result.fetchone()[0]
    _audit(db, req.project_id, "ai", "auto_review", "review_logs", new_id, {})
    db.commit()
    return {"status": "ok", "comment": comment, "id": new_id}


@router.delete("/{log_id}")
def close_review(log_id: int, db: Session = Depends(get_db),
                 user: UserContext = Depends(get_current_user)):
    user.require("write")
    row = db.execute(text("SELECT project_id FROM review_logs WHERE id=:id"), {"id": log_id}).fetchone()
    db.execute(text("UPDATE review_logs SET status='close' WHERE id=:id"), {"id": log_id})
    if row:
        _audit(db, row.project_id, user.username, "close_review", "review_logs", log_id, {})
    db.commit()
    return {"status": "ok"}


@router.get("/{project_id}/audit")
def get_audit(project_id: int, db: Session = Depends(get_db),
              user: UserContext = Depends(get_current_user)):
    user.require("confirm")
    rows = db.execute(
        text("""
            SELECT user_name, action, target_table, target_id, detail,
                   to_char(created_at,'YYYY-MM-DD HH24:MI:SS') AS created_at
            FROM audit_logs WHERE project_id=:p ORDER BY created_at DESC LIMIT 100
        """),
        {"p": project_id}
    ).fetchall()
    return [dict(r._mapping) for r in rows]
