from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.models import User, WorkInstruction, AuditLog, Checklist, Approval, Notification, Report
from backend.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    start_today = datetime(today.year, today.month, today.day)

    total_wi = db.query(WorkInstruction).filter(WorkInstruction.is_archived == False).count()
    active_operators = db.query(User).filter(User.role == "operator", User.is_active == True).count()
    total_users = db.query(User).count()

    pending_approvals = db.query(Approval).filter(Approval.status == "pending").count()
    pending_qa = db.query(Approval).filter(Approval.status == "pending", Approval.type == "qa").count()
    pending_sup = db.query(Approval).filter(Approval.status == "pending", Approval.type == "supervisor").count()

    today_logs = db.query(AuditLog).filter(AuditLog.timestamp >= start_today).count()
    today_checklists = db.query(Checklist).filter(Checklist.checked_at >= start_today).count()

    unread_notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read == False
    ).count()

    # Most viewed work instructions (based on audit logs)
    most_viewed_rows = (
        db.query(WorkInstruction.title, func.count(AuditLog.id).label("views"))
        .join(AuditLog, AuditLog.work_instruction_id == WorkInstruction.id)
        .group_by(WorkInstruction.id)
        .order_by(func.count(AuditLog.id).desc())
        .limit(5)
        .all()
    )
    most_viewed = [{"title": r[0], "views": r[1]} for r in most_viewed_rows]

    # Recent AI questions (audit logs with AI_QUESTION action)
    recent_ai = (
        db.query(AuditLog)
        .filter(AuditLog.action == "AI_QUESTION")
        .order_by(AuditLog.timestamp.desc())
        .limit(5)
        .all()
    )
    recent_ai_questions = [{"detail": a.detail, "time": a.timestamp} for a in recent_ai]

    # Notifications
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_work_instructions": total_wi,
        "active_operators": active_operators,
        "total_users": total_users,
        "pending_approvals": pending_approvals,
        "pending_qa_approvals": pending_qa,
        "pending_supervisor_approvals": pending_sup,
        "today_logs": today_logs,
        "today_checklists": today_checklists,
        "unread_notifications": unread_notifications,
        "most_viewed": most_viewed,
        "recent_ai_questions": recent_ai_questions,
        "notifications": [
            {"title": n.title, "message": n.message, "severity": n.severity, "is_read": n.is_read}
            for n in notifications
        ],
    }
