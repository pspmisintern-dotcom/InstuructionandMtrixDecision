from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.models import User, WorkInstruction, AuditLog, Checklist, Notification, Report
from backend.auth import get_current_user
from backend.departments import DEPARTMENTS, LEGACY_DEPARTMENT_MAP

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# Short-lived in-process cache for the heavy dashboard summary. The page and
# its 2-minute poller hit this endpoint often; the underlying numbers (WI
# counts, dept breakdown, most-viewed) change rarely, so serving a cached
# snapshot for 30s turns ~10 sequential remote-DB round-trips into zero.
_SUMMARY_CACHE: dict = {"payload": None, "at": 0.0}
_SUMMARY_CACHE_TTL_SECONDS = 30.0


def _summary_cache_get():
    import time

    if (
        _SUMMARY_CACHE["payload"] is not None
        and (time.monotonic() - _SUMMARY_CACHE["at"]) < _SUMMARY_CACHE_TTL_SECONDS
    ):
        return _SUMMARY_CACHE["payload"]
    return None


def _summary_cache_set(payload: dict):
    import time

    _SUMMARY_CACHE["payload"] = payload
    _SUMMARY_CACHE["at"] = time.monotonic()


@router.get("/summary")
def dashboard_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    start_today = datetime(today.year, today.month, today.day)

    # Global (non-user-specific) part is cached; per-user bits are merged in
    # fresh below so the badge counts never go stale for the wrong user.
    cached_global = _summary_cache_get()
    if cached_global is None:
        total_wi = db.query(WorkInstruction).filter(WorkInstruction.is_archived == False).count()  # noqa: E712
        active_operators = db.query(User).filter(User.role == "operator", User.is_active == True).count()  # noqa: E712
        total_users = db.query(User).count()
        today_logs = db.query(AuditLog).filter(AuditLog.timestamp >= start_today).count()
        today_checklists = db.query(Checklist).filter(Checklist.checked_at >= start_today).count()

        # Department breakdown of work instructions (normalized to canonical departments)
        dept_counts_rows = (
            db.query(WorkInstruction.department, func.count(WorkInstruction.id))
            .filter(WorkInstruction.is_archived == False)  # noqa: E712
            .group_by(WorkInstruction.department)
            .all()
        )
        raw_distribution = {}
        for r in dept_counts_rows:
            dept = r[0] or "General"
            dept = LEGACY_DEPARTMENT_MAP.get(dept, dept)
            raw_distribution[dept] = raw_distribution.get(dept, 0) + r[1]

        department_distribution = [
            {"department": dept, "count": raw_distribution.get(dept, 0)}
            for dept in DEPARTMENTS
        ]

        # Most viewed work instructions (based on audit logs)
        most_viewed_rows = (
            db.query(WorkInstruction.id, WorkInstruction.wi_number, WorkInstruction.title, WorkInstruction.department, func.count(AuditLog.id).label("views"))
            .join(AuditLog, AuditLog.work_instruction_id == WorkInstruction.id)
            .group_by(WorkInstruction.id)
            .order_by(func.count(AuditLog.id).desc())
            .limit(5)
            .all()
        )
        most_viewed = [
            {"id": r[0], "wi_number": r[1], "title": r[2], "department": r[3] or "General", "views": r[4]}
            for r in most_viewed_rows
        ]

        # Fallback to general instructions if no view logs yet
        if not most_viewed:
            recent_wis = db.query(WorkInstruction).filter(WorkInstruction.is_archived == False).limit(5).all()  # noqa: E712
            most_viewed = [
                {"id": wi.id, "wi_number": wi.wi_number, "title": wi.title, "department": wi.department or "General", "views": 1}
                for wi in recent_wis
            ]

        # Recent AI questions (audit logs with AI_QUESTION action)
        recent_ai = (
            db.query(AuditLog)
            .filter(AuditLog.action == "AI_QUESTION")
            .order_by(AuditLog.timestamp.desc())
            .limit(5)
            .all()
        )
        recent_ai_questions = [{"detail": a.detail, "time": a.timestamp} for a in recent_ai]

        # Recent general system activity logs
        recent_activities_rows = (
            db.query(AuditLog)
            .order_by(AuditLog.timestamp.desc())
            .limit(6)
            .all()
        )
        recent_activities = [
            {"action": a.action, "detail": a.detail, "timestamp": a.timestamp}
            for a in recent_activities_rows
        ]

        cached_global = {
            "total_work_instructions": total_wi,
            "active_operators": active_operators,
            "total_users": total_users,
            "today_logs": today_logs,
            "today_checklists": today_checklists,
            "department_distribution": department_distribution,
            "most_viewed": most_viewed,
            "recent_ai_questions": recent_ai_questions,
            "recent_activities": recent_activities,
        }
        _summary_cache_set(cached_global)

    # Per-user bits are always fresh (cheap indexed queries + small limit).
    unread_notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read == False  # noqa: E712
    ).count()

    # Notifications
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        **cached_global,
        "unread_notifications": unread_notifications,
        "notifications": [
            {"title": n.title, "message": n.message, "severity": n.severity, "is_read": n.is_read}
            for n in notifications
        ],
    }
