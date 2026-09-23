import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.database import get_db
from backend.models import (
    User, AuditLog, Checklist, Approval, Report, Notification,
)
from backend.auth import get_current_user, require_role
from backend.security import hash_password
from backend.departments import DEPARTMENTS

router = APIRouter(prefix="/users", tags=["users"])

ADMIN_FIXED_USERNAME = "admin"


def generate_random_password(length: int = 12) -> str:
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        has_digit = any(c.isdigit() for c in candidate)
        has_upper = any(c.isupper() for c in candidate)
        has_lower = any(c.islower() for c in candidate)
        has_symbol = any(c in "!@#$%&" for c in candidate)
        if has_digit and has_upper and has_lower and has_symbol:
            return candidate


class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: str
    role: str = "operator"
    department: Optional[str] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


def _access_state(u: User) -> str:
    """Derive a single, accurate status for a user from every flag that
    actually gates login (see auth_routes.login), instead of exposing the raw
    `is_active` flag on its own.

    Previously the UI showed "Active" for any user whose `is_active` was True,
    even when their access window had already expired or was never granted —
    so an account that could NOT log in still looked Active. That mismatch is
    what made the Status column look wrong.
    """
    if not u.is_active:
        return "inactive"

    request_status = (u.access_request_status or "").lower()
    if request_status == "pending":
        return "pending"
    if request_status == "rejected":
        return "rejected"

    if not u.access_granted:
        return "not_granted"

    # Expired access windows are auto-revoked by the backend on the next login
    # attempt; report them as expired here so the list is accurate immediately.
    if u.access_expires_at and u.access_expires_at < datetime.utcnow():
        return "expired"

    if u.must_change_password:
        return "password_change_required"

    return "active"


def _user_dict(u: User) -> dict:
    status = _access_state(u)
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role,
        "department": u.department,
        "is_active": u.is_active,
        "access_granted": u.access_granted,
        "access_granted_at": u.access_granted_at,
        "access_expires_at": u.access_expires_at,
        "access_request_status": u.access_request_status,
        "access_requested_at": u.access_requested_at,
        "access_request_reason": u.access_request_reason,
        "must_change_password": u.must_change_password,
        "ai_assistant_enabled": u.ai_assistant_enabled,
        "last_access_ip": u.last_access_ip,
        "created_at": u.created_at,
        # Derived, login-accurate status fields for the UI.
        "status": status,
        "access_expired": status == "expired",
        "access_active": status in ("active", "password_change_required"),
    }


@router.get("")
def list_users(
    current_user: User = Depends(require_role("admin", "supervisor")),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.role != "admin").all()
    return [_user_dict(u) for u in users]


@router.get("/pending-requests")
def list_pending_requests(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Admin-only: returns all users whose access_request_status is 'pending'.
    These are operators/supervisors waiting for the admin to grant or reject access.
    """
    pending = (
        db.query(User)
        .filter(User.access_request_status == "pending")
        .order_by(User.access_requested_at)
        .all()
    )
    return {
        "count": len(pending),
        "pending_requests": [_user_dict(u) for u in pending],
    }


@router.post("")
def create_user(
    new_user: UserCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    # Block creation of additional admin users
    if new_user.role not in ("operator", "supervisor"):
        raise HTTPException(
            status_code=400,
            detail="Only operator and supervisor accounts can be created. The admin account is fixed.",
        )

    if new_user.department and new_user.department not in DEPARTMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid department. Must be one of: {', '.join(DEPARTMENTS)}",
        )

    email = new_user.email or f"{new_user.username}@users.local"

    existing = db.query(User).filter(
        (User.username == new_user.username) | (User.email == email)
    ).first()
    if existing is not None and (existing.is_active is not False or existing.role == "admin"):
        raise HTTPException(status_code=400, detail="Username or email already exists")

    # Auto-generate a secure random password (system-created, not admin-typed)
    generated_password = generate_random_password()

    if existing is not None:
        # The username is still held by a deactivated account, which used to be
        # a dead end: the admin could not re-add the person ("Username or email
        # already exists") and the account could not log in either. Reuse that
        # row and reactivate it with a brand-new one-time password instead.
        existing.full_name = new_user.full_name
        existing.email = email
        existing.role = new_user.role
        existing.department = new_user.department
        existing.hashed_password = hash_password(generated_password)
        existing.is_active = True
        existing.access_granted = False
        existing.access_granted_at = None
        existing.access_expires_at = None
        existing.must_change_password = True
        existing.access_request_status = "approved"
        db.add(AuditLog(
            user_id=current_user.id,
            action="REACTIVATE_USER",
            detail=(
                f"Re-added {new_user.role} '{new_user.username}' — the existing "
                "deactivated account was reactivated with a new password."
            ),
        ))
        db.commit()
        db.refresh(existing)
        return {
            "id": existing.id,
            "message": (
                f"'{new_user.username}' already existed as a deactivated account. "
                "It has been reactivated with a new password."
            ),
            "username": existing.username,
            "generated_password": generated_password,
            "must_change_password": True,
            "reactivated": True,
        }

    user = User(
        username=new_user.username,
        email=email,
        full_name=new_user.full_name,
        hashed_password=hash_password(generated_password),
        role=new_user.role,
        department=new_user.department,
        access_request_status="approved",
        must_change_password=True,
    )
    db.add(user)
    db.add(AuditLog(
        user_id=current_user.id,
        action="CREATE_USER",
        detail=f"Created {new_user.role} '{new_user.username}' with auto-generated password.",
    ))
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "message": "User created successfully. Share the generated password with them.",
        "username": user.username,
        "generated_password": generated_password,
        "must_change_password": True,
    }


@router.put("/{user_id}")
def update_user(
    user_id: int,
    updates: UserUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Protect the fixed admin account from modifications that would break login
    if user.username.lower() == ADMIN_FIXED_USERNAME.lower():
        allowed_fields = {"full_name", "email", "department"}
        for field_name, value in updates.model_dump(exclude_unset=True).items():
            if field_name not in allowed_fields:
                raise HTTPException(
                    status_code=403,
                    detail=f"Cannot modify '{field_name}' on the fixed admin account.",
                )

    old_username = user.username
    if updates.username is not None:
        username = updates.username.strip()
        if not username:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        if len(username) > 100:
            raise HTTPException(status_code=400, detail="Username must be 100 characters or fewer")
        if username.lower() == ADMIN_FIXED_USERNAME.lower():
            raise HTTPException(status_code=400, detail="The username 'admin' is reserved")
        duplicate = db.query(User).filter(
            User.username == username,
            User.id != user.id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = username

    if updates.full_name is not None:
        user.full_name = updates.full_name
    if updates.email is not None:
        user.email = updates.email
    if updates.role is not None:
        if user.username.lower() == ADMIN_FIXED_USERNAME.lower():
            raise HTTPException(status_code=403, detail="Cannot change the admin account role.")
        user.role = updates.role
    if updates.department is not None:
        user.department = updates.department
    if updates.is_active is not None:
        if user.username.lower() == ADMIN_FIXED_USERNAME.lower():
            raise HTTPException(status_code=403, detail="Cannot deactivate the fixed admin account.")
        user.is_active = updates.is_active

    detail = f"Updated user {old_username}"
    if old_username != user.username:
        detail += f"; username changed to {user.username}"
    db.add(AuditLog(user_id=current_user.id, action="UPDATE_USER", detail=detail))
    db.commit()
    return {"message": "User updated"}


@router.post("/{user_id}/activate")
def activate_user(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Reactivate a deactivated account so it can log in again.

    Needed because login refuses any user with is_active = False. Accounts
    deactivated by the older "delete" behaviour could otherwise never be
    restored: their username is still taken, so they couldn't be re-created,
    and they couldn't log in either.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username.lower() == ADMIN_FIXED_USERNAME.lower():
        raise HTTPException(status_code=403, detail="The fixed admin account is always active.")

    already_active = user.is_active is True
    user.is_active = True
    if not already_active:
        db.add(AuditLog(
            user_id=current_user.id,
            action="ACTIVATE_USER",
            detail=f"Admin '{current_user.username}' reactivated '{user.username}'.",
        ))
    db.commit()
    return {
        "message": (
            f"'{user.username}' is already active."
            if already_active
            else f"'{user.username}' has been reactivated and can log in again."
        ),
        "user": _user_dict(user),
    }


@router.post("/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Temporarily disable login for a user without deleting the account.

    Keeps all records intact (unlike DELETE), so it is reversible via
    /activate. Useful for suspending someone while keeping their history.
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username.lower() == ADMIN_FIXED_USERNAME.lower():
        raise HTTPException(status_code=403, detail="Cannot deactivate the fixed admin account.")

    user.is_active = False
    # Also drop the access window so a later reactivation doesn't silently
    # restore a stale session/expiry the admin never intended to keep.
    user.access_granted = False
    user.access_granted_at = None
    user.access_expires_at = None

    db.add(AuditLog(
        user_id=current_user.id,
        action="DEACTIVATE_USER",
        detail=f"Admin '{current_user.username}' deactivated '{user.username}'.",
    ))
    db.commit()
    return {
        "message": f"'{user.username}' has been deactivated and can no longer log in.",
        "user": _user_dict(user),
    }


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Permanently delete an operator/supervisor account.

    Previously this only flipped `is_active = False` (a soft "deactivate")
    while GET /users still returned the row, so the user stayed visible in the
    table and the admin saw the delete "do nothing". It now removes the row
    for real, after detaching/cleaning up every table that references it, so
    the delete cannot fail on a foreign-key constraint:

    - audit_logs       -> user_id set to NULL (history is preserved; the log
                          detail text already contains the username)
    - checklists       -> the user's personal checklist progress is deleted
    - notifications    -> notifications addressed to the user are deleted;
                          notifications they sent keep the message with a
                          NULL sender
    - approvals        -> approver_id set to NULL
    - reports          -> created_by set to NULL
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Protect the fixed admin account
    if user.username.lower() == ADMIN_FIXED_USERNAME.lower():
        raise HTTPException(status_code=403, detail="Cannot delete the fixed admin account.")

    username = user.username
    role = user.role

    try:
        # Detach audit history instead of deleting it — the audit trail must
        # survive the account, and its detail strings already name the user.
        db.query(AuditLog).filter(AuditLog.user_id == user_id).update(
            {AuditLog.user_id: None}, synchronize_session=False
        )
        db.query(Approval).filter(Approval.approver_id == user_id).update(
            {Approval.approver_id: None}, synchronize_session=False
        )
        db.query(Report).filter(Report.created_by == user_id).update(
            {Report.created_by: None}, synchronize_session=False
        )
        db.query(Notification).filter(Notification.sender_id == user_id).update(
            {Notification.sender_id: None}, synchronize_session=False
        )
        db.query(Notification).filter(Notification.user_id == user_id).delete(
            synchronize_session=False
        )
        db.query(Checklist).filter(Checklist.user_id == user_id).delete(
            synchronize_session=False
        )

        db.delete(user)
        db.add(AuditLog(
            user_id=current_user.id,
            action="DELETE_USER",
            detail=f"Admin '{current_user.username}' permanently deleted {role} '{username}'.",
        ))
        db.commit()
    except IntegrityError as e:
        db.rollback()
        print(f"[user_routes] Failed to delete user '{username}': {e}")
        raise HTTPException(
            status_code=409,
            detail=(
                f"'{username}' is still referenced by other records and could not be "
                "deleted. Please try again or contact support."
            ),
        )

    return {"message": f"User '{username}' deleted.", "deleted_id": user_id, "username": username}