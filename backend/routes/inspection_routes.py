from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, WorkInstruction, Approval, AuditLog, Notification
from backend.auth import get_current_user, require_role

router = APIRouter(prefix="/inspection", tags=["inspection"])


class InspectionSubmit(BaseModel):
    work_instruction_id: int
    result: str  # pass | fail
    measurements: Dict = {}
    remarks: Optional[str] = None
    require_supervisor_approval: bool = False
    require_qa_approval: bool = False


class ApprovalDecision(BaseModel):
    approval_id: int
    status: str  # approved | rejected
    comment: Optional[str] = None


@router.post("/submit")
def submit_inspection(
    data: InspectionSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wi = db.query(WorkInstruction).filter(WorkInstruction.id == data.work_instruction_id).first()
    if not wi:
        raise HTTPException(status_code=404, detail="Work Instruction not found")

    db.add(AuditLog(
        user_id=current_user.id,
        work_instruction_id=wi.id,
        action="INSPECTION_SUBMIT",
        detail=f"Inspection result: {data.result} | measurements: {data.measurements} | remarks: {data.remarks}",
    ))

    # Create approval requests if required
    approvals_created = []
    if data.require_supervisor_approval or wi.supervisor_approval_required:
        approval = Approval(
            work_instruction_id=wi.id,
            type="supervisor",
            status="pending",
            comment=data.remarks,
        )
        db.add(approval)
        approvals_created.append("supervisor")
        db.add(Notification(
            title="⚠ Supervisor Approval Required",
            message=f"Work '{wi.title}' requires supervisor approval.",
            severity="warning",
        ))

    if data.require_qa_approval or wi.qa_approval_required:
        approval = Approval(
            work_instruction_id=wi.id,
            type="qa",
            status="pending",
            comment=data.remarks,
        )
        db.add(approval)
        approvals_created.append("qa")
        db.add(Notification(
            title="⚠ QA Approval Required",
            message=f"Work '{wi.title}' requires QA approval.",
            severity="warning",
        ))

    db.commit()
    return {
        "message": f"Inspection submitted: {data.result}",
        "approvals_requested": approvals_created,
    }


@router.get("/pending")
def pending_approvals(
    current_user: User = Depends(require_role("supervisor", "admin")),
    db: Session = Depends(get_db),
):
    approvals = db.query(Approval).filter(Approval.status == "pending").all()
    result = []
    for a in approvals:
        wi = db.query(WorkInstruction).filter(WorkInstruction.id == a.work_instruction_id).first()
        result.append({
            "id": a.id,
            "work_instruction_id": a.work_instruction_id,
            "work_title": wi.title if wi else "N/A",
            "type": a.type,
            "status": a.status,
            "comment": a.comment,
            "created_at": a.created_at,
        })
    return result


@router.get("/all")
def all_inspections(
    current_user: User = Depends(require_role("supervisor", "admin")),
    db: Session = Depends(get_db),
):
    """Return the full inspection/approval history for admin/supervisor review."""
    approvals = db.query(Approval).order_by(Approval.created_at.desc()).limit(500).all()
    result = []
    for a in approvals:
        wi = db.query(WorkInstruction).filter(WorkInstruction.id == a.work_instruction_id).first()
        result.append({
            "id": a.id,
            "work_instruction_id": a.work_instruction_id,
            "work_title": wi.title if wi else "N/A",
            "wi_number": wi.wi_number if wi else None,
            "activity": wi.activity if wi else None,
            "department": wi.department if wi else None,
            "type": a.type,
            "status": a.status,
            "comment": a.comment,
            "approver_name": a.approver_name,
            "created_at": a.created_at,
            "updated_at": a.updated_at,
        })
    return result


@router.post("/approve")
def decide_approval(
    data: ApprovalDecision,
    current_user: User = Depends(require_role("supervisor", "admin")),
    db: Session = Depends(get_db),
):
    approval = db.query(Approval).filter(Approval.id == data.approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail="Approval already decided")

    approval.status = data.status
    approval.comment = data.comment
    approval.approver_id = current_user.id
    approval.approver_name = current_user.full_name
    approval.updated_at = datetime.utcnow()

    db.add(AuditLog(
        user_id=current_user.id,
        work_instruction_id=approval.work_instruction_id,
        action="APPROVAL_DECISION",
        detail=f"{approval.type} approval {data.status}",
    ))

    wi = db.query(WorkInstruction).filter(WorkInstruction.id == approval.work_instruction_id).first()
    db.add(Notification(
        title=f"{approval.type.upper()} Approval {data.status}",
        message=f"Work '{wi.title if wi else 'N/A'}' approval was {data.status}.",
        severity="info",
    ))
    db.commit()
    return {"message": f"Approval {data.status}"}
