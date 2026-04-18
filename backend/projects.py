from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from database import get_db
from auth import get_current_user, UserContext

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    category: str = "system"  # "system"（評価対象システム）/ "project"（事業）


@router.get("/")
def list_projects(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT id, name, description,
                   COALESCE(category, 'system') AS category,
                   to_char(created_at, 'YYYY-MM-DD') AS created_at
            FROM projects
            ORDER BY id
        """)
    ).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/")
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    user.require("write")
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="名称は必須です")
    if data.category not in ("system", "project"):
        raise HTTPException(status_code=400, detail="category は system または project")

    result = db.execute(
        text("""
            INSERT INTO projects (name, description, category)
            VALUES (:name, :desc, :cat)
            RETURNING id
        """),
        {"name": data.name.strip(), "desc": data.description.strip(), "cat": data.category}
    )
    new_id = result.fetchone()[0]
    db.commit()
    return {"status": "ok", "id": new_id}


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    user.require("manage")
    # レビューログが存在する場合は削除不可
    count = db.execute(
        text("SELECT COUNT(*) FROM review_logs WHERE project_id=:id"),
        {"id": project_id}
    ).scalar()
    if count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"レビューログが {count} 件あるため削除できません"
        )
    db.execute(text("DELETE FROM projects WHERE id=:id"), {"id": project_id})
    db.commit()
    return {"status": "ok"}
