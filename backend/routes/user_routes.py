import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, AuditLog
from backend.auth import get_current_user, require_role
from backend.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])

ADMIN_FIXED_USERNAME = "admin"
DEPARTMENTS = ["Grinding", "Masking", "Spraying", "Production"]


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
    email: str
    full_name: str
    role: str = "operator"
    department: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


def _user_dict(u: User) -> dict:
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
    }


@router.get("")
def list_users(
    current_user: User = Depends(require_role("admin", "supervisor")),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
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

    exists = db.query(User).filter(
        (User.username == new_user.username) | (User.email == new_user.email)
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    # Auto-generate a secure random password (system-created, not admin-typed)
    generated_password = generate_random_password()

    user = User(
        username=new_user.username,
        email=new_user.email,
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

    db.add(AuditLog(user_id=current_user.id, action="UPDATE_USER", detail=f"Updated user {user.username}"))
    db.commit()
    return {"message": "User updated"}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Protect the fixed admin account
    if user.username.lower() == ADMIN_FIXED_USERNAME.lower():
        raise HTTPException(status_code=403, detail="Cannot deactivate the fixed admin account.")
    user.is_active = False
    db.add(AuditLog(user_id=current_user.id, action="DEACTIVATE_USER", detail=f"Deactivated {user.username}"))
    db.commit()
    return {"message": "User deactivated"}
