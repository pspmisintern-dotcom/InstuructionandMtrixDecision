from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.models import (
    User, WorkInstruction, AuditLog, Checklist, Approval, Report, Notification
)
from backend.auth import get_current_user, require_role

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/types")
def report_types(current_user: User = Depends(get_current_user)):
    return {
        "types": [
            "operator_compliance",
            "ppe_compliance",
            "training_status",
            "inspection_results",
            "ai_usage",
            "faq",
            "wi_usage",
            "revision_history",
            "audit_trail",
        ]
    }


@router.get("/{report_type}")
def generate_report(
    report_type: str,
    current_user: User = Depends(require_role("admin", "supervisor")),
    db: Session = Depends(get_db),
):
    if report_type == "operator_compliance":
        data = compliance_report(db)
    elif report_type == "ppe_compliance":
        data = ppe_compliance_report(db)
    elif report_type == "inspection_results":
        data = inspection_report(db)
    elif report_type == "ai_usage":
        data = ai_usage_report(db)
    elif report_type == "wi_usage":
        data = wi_usage_report(db)
    elif report_type == "audit_trail":
        data = audit_trail_report(db)
    elif report_type == "faq":
        data = faq_report(db)
    elif report_type == "revision_history":
        data = revision_history_report(db)
    elif report_type == "training_status":
        data = training_status_report(db)
    else:
        data = {"error": "Unknown report type"}

    # Persist report
    report = Report(name=f"{report_type}", report_type=report_type, payload=data, created_by=current_user.id)
    db.add(report)
    db.commit()

    return {"report_type": report_type, "generated_at": datetime.utcnow(), "data": data}


def compliance_report(db):
    operators = db.query(User).filter(User.role == "operator").all()
    result = []
    for op in operators:
        total_actions = db.query(AuditLog).filter(AuditLog.user_id == op.id).count()
        checklist_actions = db.query(AuditLog).filter(
            AuditLog.user_id == op.id, AuditLog.action.like("CHECKLIST%")
        ).count()
        compliance = round((checklist_actions / total_actions * 100), 2) if total_actions else 0
        result.append({
            "operator": op.full_name,
            "total_actions": total_actions,
            "checklist_completions": checklist_actions,
            "compliance_percentage": compliance,
        })
    return result


def ppe_compliance_report(db):
    logs = db.query(AuditLog).filter(AuditLog.action == "PPE_CHECK").all()
    confirmed = sum(1 for l in logs if "True" in (l.detail or ""))
    return {
        "total_ppe_checks": len(logs),
        "confirmed": confirmed,
        "blocked": len(logs) - confirmed,
        "compliance_rate": round(confirmed / len(logs) * 100, 2) if logs else 0,
    }


def inspection_report(db):
    inspections = db.query(AuditLog).filter(AuditLog.action == "INSPECTION_SUBMIT").all()
    passes = sum(1 for i in inspections if "result: pass" in (i.detail or "").lower())
    fails = sum(1 for i in inspections if "result: fail" in (i.detail or "").lower())
    return {
        "total_inspections": len(inspections),
        "passed": passes,
        "failed": fails,
        "approvals_pending": db.query(Approval).filter(Approval.status == "pending").count(),
    }


def ai_usage_report(db):
    ai_logs = db.query(AuditLog).filter(AuditLog.action == "AI_QUESTION").all()
    return {
        "total_ai_questions": len(ai_logs),
        "recent": [
            {"detail": l.detail, "time": l.timestamp} for l in ai_logs[-20:]
        ],
    }


def wi_usage_report(db):
    rows = (
        db.query(WorkInstruction.title, func.count(AuditLog.id).label("views"))
        .join(AuditLog, AuditLog.work_instruction_id == WorkInstruction.id)
        .group_by(WorkInstruction.id)
        .order_by(func.count(AuditLog.id).desc())
        .all()
    )
    return [{"title": r[0], "views": r[1]} for r in rows]


def audit_trail_report(db):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(200).all()
    return [
        {
            "user_id": l.user_id,
            "action": l.action,
            "detail": l.detail,
            "timestamp": l.timestamp,
        }
        for l in logs
    ]


def faq_report(db):
    ai_logs = db.query(AuditLog).filter(AuditLog.action == "AI_QUESTION").all()
    questions = []
    for l in ai_logs:
        detail = l.detail or ""
        if "Q:" in detail and "| A:" in detail:
            q = detail.split("Q:")[1].split("| A:")[0].strip()
            questions.append(q)
    freq = {}
    for q in questions:
        freq[q] = freq.get(q, 0) + 1
    top = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:10]
    return [{"question": q, "count": c} for q, c in top]


def revision_history_report(db):
    wis = db.query(WorkInstruction).all()
    return [
        {
            "wi_number": w.wi_number,
            "title": w.title,
            "revision": w.revision,
            "is_latest": w.is_latest,
            "is_archived": w.is_archived,
        }
        for w in wis
    ]


def training_status_report(db):
    operators = db.query(User).filter(User.role == "operator").all()
    return [
        {
            "operator": op.full_name,
            "department": op.department,
            "status": "Certified" if op.is_active else "Inactive",
        }
        for op in operators
    ]
