from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, AuditLog
from backend.auth import get_current_user, require_role
from backend.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    password: str
    role: str = "operator"
    department: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


@router.get("")
def list_users(
    current_user: User = Depends(require_role("admin", "supervisor")),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "department": u.department,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.post("")
def create_user(
    new_user: UserCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    exists = db.query(User).filter(
        (User.username == new_user.username) | (User.email == new_user.email)
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    user = User(
        username=new_user.username,
        email=new_user.email,
        full_name=new_user.full_name,
        hashed_password=hash_password(new_user.password),
        role=new_user.role,
        department=new_user.department,
    )
    db.add(user)
    db.add(AuditLog(user_id=current_user.id, action="CREATE_USER", detail=f"Created user {new_user.username}"))
    db.commit()
    db.refresh(user)
    return {"id": user.id, "message": "User created"}


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

    if updates.full_name is not None:
        user.full_name = updates.full_name
    if updates.email is not None:
        user.email = updates.email
    if updates.role is not None:
        user.role = updates.role
    if updates.department is not None:
        user.department = updates.department
    if updates.is_active is not None:
        user.is_active = updates.is_active
    if updates.password:
        user.hashed_password = hash_password(updates.password)

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
    user.is_active = False
    db.add(AuditLog(user_id=current_user.id, action="DEACTIVATE_USER", detail=f"Deactivated {user.username}"))
    db.commit()
    return {"message": "User deactivated"}
