from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/")
def list_projects(db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT id, name, description FROM projects ORDER BY id")
    ).fetchall()
    return [dict(r._mapping) for r in rows]
