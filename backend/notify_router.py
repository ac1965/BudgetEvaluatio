"""
A2A/MCP連携 通知モジュール
Agent Card（JSON-LD / schema.org）形式でイベントを外部に通知
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from auth import get_current_user, UserContext
import os, httpx, json
from datetime import datetime

router = APIRouter(prefix="/notify", tags=["notify"])
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")


def build_agent_card(event_type: str, log: dict, project_name: str) -> dict:
    STATUS_LABEL = {"issue": "指摘", "reply": "回答", "review": "再評価", "close": "確定"}
    return {
        "@context": "https://schema.org",
        "@type": "ReviewAction",
        "identifier": f"pjmo-review-{log['id']}",
        "name": f"[{STATUS_LABEL.get(log['status'], log['status'])}] {project_name}",
        "description": log["comment"][:200],
        "agent": {"@type": "Person", "name": log["author"], "jobTitle": log["role"]},
        "object": {"@type": "GovernmentService", "name": project_name},
        "actionStatus": event_type,
        "startTime": log.get("created_at", ""),
        "pjmo_metadata": {
            "project_id": log["project_id"], "log_id": log["id"],
            "status": log["status"], "version": log.get("version", 1),
        }
    }


async def _send_webhook(payload: dict, project_id: int, event_type: str, db: Session):
    if not WEBHOOK_URL:
        return
    sent_at = None
    status = "failed"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(WEBHOOK_URL, json=payload,
                                     headers={"Content-Type": "application/json"})
        status = "sent" if resp.status_code < 400 else "failed"
        sent_at = datetime.now()
    except Exception as e:
        status = f"error: {str(e)[:100]}"
    db.execute(
        text("""
            INSERT INTO webhook_logs (project_id, event_type, payload, status, sent_at)
            VALUES (:p, :e, :payload::jsonb, :s, :t)
        """),
        {"p": project_id, "e": event_type,
         "payload": json.dumps(payload, ensure_ascii=False), "s": status, "t": sent_at}
    )
    db.commit()


@router.post("/review/{log_id}")
async def notify_review(log_id: int, background_tasks: BackgroundTasks,
                        db: Session = Depends(get_db),
                        user: UserContext = Depends(get_current_user)):
    user.require("write")
    row = db.execute(
        text("SELECT r.*, p.name AS project_name FROM review_logs r JOIN projects p ON p.id=r.project_id WHERE r.id=:id"),
        {"id": log_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="ログが見つかりません")
    log = dict(row._mapping)
    payload = build_agent_card("review_posted", log, log["project_name"])
    background_tasks.add_task(_send_webhook, payload, log["project_id"], "review_posted", db)
    return {"status": "queued", "payload_preview": payload}


@router.get("/logs/{project_id}")
def get_webhook_logs(project_id: int, db: Session = Depends(get_db),
                     user: UserContext = Depends(get_current_user)):
    user.require("read")
    rows = db.execute(
        text("""
            SELECT id, event_type, status,
                   to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
                   to_char(sent_at, 'YYYY-MM-DD HH24:MI') AS sent_at
            FROM webhook_logs WHERE project_id=:p ORDER BY created_at DESC LIMIT 50
        """),
        {"p": project_id}
    ).fetchall()
    return [dict(r._mapping) for r in rows]
