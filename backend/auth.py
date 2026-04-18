"""
RBAC モジュール
本番はKeycloak JWT検証に差し替える。
現在はヘッダー X-User-Name / X-User-Role によるシンプル認証。
X-User-Name は btoa(encodeURIComponent(name)) でBase64エンコードされている。
"""
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from typing import Optional
import base64
from urllib.parse import unquote

ROLE_PERMISSIONS = {
    "admin":     {"read", "write", "confirm", "export", "manage"},
    "evaluator": {"read", "write", "confirm"},
    "pjmo":      {"read", "write"},
    "viewer":    {"read"},
}


def _decode_username(raw: str) -> str:
    """btoa(encodeURIComponent(name)) → 元の文字列に戻す"""
    try:
        # Base64デコード → URLデコード
        decoded = base64.b64decode(raw + "==").decode("utf-8")
        return unquote(decoded)
    except Exception:
        return raw  # デコード失敗時はそのまま使用


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

    username = _decode_username(x_user_name)

    row = db.execute(
        text("SELECT display_name, role FROM users WHERE username=:u"),
        {"u": username}
    ).fetchone()

    if row:
        return UserContext(username, row.display_name, row.role)

    valid_roles = set(ROLE_PERMISSIONS.keys())
    role = x_user_role if x_user_role in valid_roles else "viewer"
    return UserContext(username, username, role)
