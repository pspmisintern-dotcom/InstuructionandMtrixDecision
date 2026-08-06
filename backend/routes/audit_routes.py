from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, AuditLog, WorkInstruction
from backend.auth import get_current_user, require_role

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
def get_audit_logs(
    current_user: User = Depends(require_role("admin", "supervisor")),
    db: Session = Depends(get_db),
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    limit: int = Query(100),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()

    result = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first()
        wi = db.query(WorkInstruction).filter(WorkInstruction.id == log.work_instruction_id).first()
        result.append({
            "id": log.id,
            "user": user.full_name if user else "Unknown",
            "username": user.username if user else "",
            "role": user.role if user else "",
            "work_instruction": f"{wi.title} ({wi.wi_number})" if wi else None,
            "action": log.action,
            "detail": log.detail,
            "timestamp": log.timestamp,
        })
    return result
