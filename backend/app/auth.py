"""
Authentication, session management, and role-based access control for BhashaLens.
Uses PBKDF2-HMAC-SHA256 with 600,000 iterations for secure password hashing.
Supports secure session tokens with HTTP-only cookies and Bearer tokens.
"""
from __future__ import annotations
import hashlib
import hmac
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.db import get_connection

security = HTTPBearer(auto_error=False)

SESSION_COOKIE_NAME = "bhashalens_session"
DEFAULT_SESSION_DAYS = 7
HASH_ITERATIONS = 600_000


def hash_password(password: str) -> tuple[str, str]:
    """Generates a random 16-byte salt and hashes password with PBKDF2-SHA256."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        HASH_ITERATIONS,
    )
    return salt, key.hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    """Constant-time verification of password against salt and hash."""
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        HASH_ITERATIONS,
    )
    return hmac.compare_digest(key.hex(), expected_hash)


def get_user_by_id(user_id: str) -> Optional[dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, email, name, role, is_active, created_at, last_login_at FROM users WHERE id = ?;", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?);", (email.strip(),))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def register_user(
    name: str,
    email: str,
    password: str,
    role: str = "USER",
    allow_privileged_creation: bool = False,
) -> dict[str, Any]:
    """
    Registers a new user. Enforces valid email, minimum password length (8 chars),
    and prevents non-USER roles unless created via privileged internal workflow.
    """
    clean_name = name.strip()
    clean_email = email.strip().lower()

    if not clean_name:
        raise ValueError("Full name is required.")
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        raise ValueError("A valid email address is required.")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")

    # Prevent privilege escalation through public registration
    effective_role = role.upper()
    if not allow_privileged_creation and effective_role != "USER":
        effective_role = "USER"

    if effective_role not in ("USER", "ADMIN", "REVIEWER"):
        raise ValueError(f"Invalid role: {role}")

    existing = get_user_by_email(clean_email)
    if existing:
        raise ValueError(f"An account with email '{clean_email}' already exists.")

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    salt, p_hash = hash_password(password)
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    try:
        with conn:
            conn.execute("""
            INSERT INTO users (id, email, name, password_hash, salt, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?);
            """, (user_id, clean_email, clean_name, p_hash, salt, effective_role, now_iso))
        return {
            "id": user_id,
            "email": clean_email,
            "name": clean_name,
            "role": effective_role,
            "is_active": True,
            "created_at": now_iso,
        }
    finally:
        conn.close()


def authenticate_user(email: str, password: str) -> Optional[dict[str, Any]]:
    user = get_user_by_email(email)
    if not user:
        return None
    if not user.get("is_active", 1):
        raise ValueError("Account is disabled. Please contact an administrator.")
    if not verify_password(password, user["salt"], user["password_hash"]):
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    try:
        with conn:
            conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?;", (now_iso, user["id"]))
    finally:
        conn.close()

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "is_active": bool(user["is_active"]),
        "created_at": user["created_at"],
        "last_login_at": now_iso,
    }


def create_session(user_id: str, days: int = DEFAULT_SESSION_DAYS) -> str:
    token = secrets.token_urlsafe(36)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    try:
        with conn:
            conn.execute("""
            INSERT INTO sessions (token, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?);
            """, (token, user_id, expires_at, now_iso))
        return token
    finally:
        conn.close()


def delete_session(token: str) -> None:
    conn = get_connection()
    try:
        with conn:
            conn.execute("DELETE FROM sessions WHERE token = ?;", (token,))
    finally:
        conn.close()


def get_user_from_token(token: str) -> Optional[dict[str, Any]]:
    if not token:
        return None
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
        SELECT s.expires_at, u.id, u.email, u.name, u.role, u.is_active, u.created_at, u.last_login_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?;
        """, (token,))
        row = cur.fetchone()
        if not row:
            return None

        # Check expiration
        expires_at = datetime.fromisoformat(row["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            # Expired session cleanup
            cur.execute("DELETE FROM sessions WHERE token = ?;", (token,))
            conn.commit()
            return None

        if not row["is_active"]:
            return None

        return {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
            "is_active": bool(row["is_active"]),
            "created_at": row["created_at"],
            "last_login_at": row["last_login_at"],
        }
    finally:
        conn.close()


def extract_token_from_request(
    request: Request,
    bearer_creds: Optional[HTTPAuthorizationCredentials] = None,
) -> Optional[str]:
    """Extracts session token from Bearer Authorization header or HttpOnly Cookie."""
    if bearer_creds and bearer_creds.credentials:
        return bearer_creds.credentials

    # Check cookies
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    # Check X-Session-Token header fallback
    alt_header = request.headers.get("X-Session-Token")
    if alt_header:
        return alt_header

    return None


async def get_optional_current_user(
    request: Request,
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict[str, Any]]:
    token = extract_token_from_request(request, bearer_creds)
    if not token:
        return None
    return get_user_from_token(token)


async def get_required_current_user(
    request: Request,
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict[str, Any]:
    user = await get_optional_current_user(request, bearer_creds)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(allowed_roles: list[str]):
    """Enforces role-based authorization dependency."""
    async def _role_checker(
        user: dict[str, Any] = Depends(get_required_current_user),
    ) -> dict[str, Any]:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}",
            )
        return user
    return _role_checker


def list_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        query = "SELECT id, email, name, role, is_active, created_at, last_login_at FROM users WHERE 1=1"
        params: list[Any] = []
        if role:
            query += " AND role = ?"
            params.append(role.upper())
        if is_active is not None:
            query += " AND is_active = ?"
            params.append(1 if is_active else 0)
        if search:
            query += " AND (name LIKE ? OR email LIKE ?)"
            term = f"%{search.strip()}%"
            params.extend([term, term])
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?;"
        params.extend([limit, offset])

        cur = conn.cursor()
        cur.execute(query, params)
        rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "email": r["email"],
                "name": r["name"],
                "role": r["role"],
                "is_active": bool(r["is_active"]),
                "created_at": r["created_at"],
                "last_login_at": r["last_login_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def update_user_status(user_id: str, is_active: bool, acting_user_id: str) -> dict[str, Any]:
    if user_id == acting_user_id and not is_active:
        raise ValueError("Administrators cannot deactivate their own active account.")

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, email, name, role FROM users WHERE id = ?;", (user_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"User '{user_id}' not found.")

        with conn:
            conn.execute("UPDATE users SET is_active = ? WHERE id = ?;", (1 if is_active else 0, user_id))
            if not is_active:
                # Invalidate active sessions
                conn.execute("DELETE FROM sessions WHERE user_id = ?;", (user_id,))

        return {
            "id": user_id,
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
            "is_active": is_active,
            "updated": True,
        }
    finally:
        conn.close()


def update_user_role(user_id: str, new_role: str, acting_user_id: str) -> dict[str, Any]:
    role_up = new_role.upper()
    if role_up not in ("USER", "ADMIN", "REVIEWER"):
        raise ValueError(f"Invalid role '{new_role}'. Must be USER, ADMIN, or REVIEWER.")

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, email, name, role FROM users WHERE id = ?;", (user_id,))
        target_user = cur.fetchone()
        if not target_user:
            raise ValueError(f"User '{user_id}' not found.")

        # Safety check: Prevent demoting the last active ADMIN
        if target_user["role"] == "ADMIN" and role_up != "ADMIN":
            cur.execute("SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = 1;")
            admin_count = cur.fetchone()[0]
            if admin_count <= 1:
                raise ValueError("Cannot demote the last active administrator account.")

        with conn:
            conn.execute("UPDATE users SET role = ? WHERE id = ?;", (role_up, user_id))

        return {
            "id": user_id,
            "email": target_user["email"],
            "name": target_user["name"],
            "role": role_up,
            "updated": True,
        }
    finally:
        conn.close()


def seed_demo_accounts() -> dict[str, Any]:
    """
    Ensures safe, reproducible local development and demo accounts exist:
    1. Demo User: user@bhashalens.org / DemoUser123!
    2. Demo Admin: admin@bhashalens.org / AdminPass123!
    3. Demo Reviewer: reviewer@bhashalens.org / ReviewerPass123!
    Seeds sample submissions for Demo User so User Portal looks realistic immediately.
    """
    demo_accounts = [
        {
            "name": "Demo Evaluator",
            "email": "user@bhashalens.org",
            "password": "DemoUser123!",
            "role": "USER",
        },
        {
            "name": "Lead Administrator",
            "email": "admin@bhashalens.org",
            "password": "AdminPass123!",
            "role": "ADMIN",
        },
        {
            "name": "Speech Reviewer",
            "email": "reviewer@bhashalens.org",
            "password": "ReviewerPass123!",
            "role": "REVIEWER",
        },
    ]

    created = []
    for acc in demo_accounts:
        existing = get_user_by_email(acc["email"])
        if not existing:
            u = register_user(
                name=acc["name"],
                email=acc["email"],
                password=acc["password"],
                role=acc["role"],
                allow_privileged_creation=True,
            )
            created.append(u)

    # Attach some demo submissions to Demo User if none exist
    demo_user = get_user_by_email("user@bhashalens.org")
    if demo_user:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM submissions WHERE user_id = ?;", (demo_user["id"],))
            user_sub_count = cur.fetchone()[0]
            if user_sub_count == 0:
                # Link existing submissions without user_id, or create sample records
                cur.execute("SELECT id FROM submissions WHERE user_id IS NULL LIMIT 5;")
                unlinked = cur.fetchall()
                with conn:
                    for row in unlinked:
                        conn.execute("UPDATE submissions SET user_id = ? WHERE id = ?;", (demo_user["id"], row["id"]))
        finally:
            conn.close()

    return {"seeded": len(created), "accounts": ["user@bhashalens.org", "admin@bhashalens.org", "reviewer@bhashalens.org"]}
