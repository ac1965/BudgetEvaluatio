"""
RBAC モジュール
現在: X-User-Name / X-User-Role ヘッダーによるシンプル認証
本番: Keycloak JWT検証に差し替え
"""
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from typing import Optional

ROLE_PERMISSIONS = {
    "admin":     {"read", "write", "confirm", "export", "manage"},
    "evaluator": {"read", "write", "confirm"},
    "pjmo":      {"read", "write"},
    "viewer":    {"read"},
}


class UserContext:
    def __init__(self, username: str, display_name: str, role: str):
        self.username = username
        self.display_name = display_name
        self.role = role

    def can(self, permission: str) -> bool:
        return permission in ROLE_PERMISSIONS.get(self.role, set())

    def require(self, permission: str):
        if not self.can(permission):
            raise HTTPException(
                status_code=403,
                detail=f"権限不足: {permission} が必要です（現在のロール: {self.role}）"
            )


def get_current_user(
    x_user_name: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> UserContext:
    if not x_user_name:
        return UserContext("anonymous", "匿名ユーザー", "viewer")
    row = db.execute(
        text("SELECT display_name, role FROM users WHERE username=:u"),
        {"u": x_user_name}
    ).fetchone()
    if row:
        return UserContext(x_user_name, row.display_name, row.role)
    valid_roles = set(ROLE_PERMISSIONS.keys())
    role = x_user_role if x_user_role in valid_roles else "viewer"
    return UserContext(x_user_name, x_user_name, role)
