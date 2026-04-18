from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from auth import get_current_user, UserContext

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/")
def list_users(db: Session = Depends(get_db),
               user: UserContext = Depends(get_current_user)):
    user.require("read")
    rows = db.execute(
        text("SELECT username, display_name, role FROM users ORDER BY id")
    ).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/me")
def me(user: UserContext = Depends(get_current_user)):
    return {
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role,
        "permissions": list(
            {"read", "write", "confirm", "export", "manage"}
            if user.role == "admin"
            else {"read", "write", "confirm"} if user.role == "evaluator"
            else {"read", "write"} if user.role == "pjmo"
            else {"read"}
        ),
    }
