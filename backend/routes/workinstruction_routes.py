import os
import re
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.database import get_db
from backend.models import User, WorkInstruction, Section, AuditLog
from backend.auth import get_current_user
from backend.qr import work_instruction_qr

router = APIRouter(prefix="/workinstructions", tags=["workinstructions"])

# The folder where the original .docx/.doc work instructions are stored.
# Searches both the project root `data/` and `backend/data/`.
DATA_DIRS = [
    Path(__file__).resolve().parents[2] / "data",
    Path(__file__).resolve().parents[1] / "data",
]


def clean_wi_title(wi: WorkInstruction) -> str:
    """Return a clean, short, human-readable title for a work instruction."""
    # Prefer a clean title derived from the source filename (e.g. "WI_01 for Inward.docx" -> "Inward").
    if wi.file_path:
        name = Path(wi.file_path).name
    else:
        name = f"{wi.wi_number}.docx"
    name = re.sub(r"\.docx?$", "", name, flags=re.IGNORECASE)
    # Strip leading WI number tokens
    name = re.sub(r"^WI[_\- ]?\d+[\s\-]*for\s*", "", name, flags=re.IGNORECASE)
    name = re.sub(r"^WI[_\- ]?\d+[\s\-]*", "", name, flags=re.IGNORECASE)
    name = name.replace("_", " ").replace("(", "").replace(")", "")
    name = re.sub(r"work instruction\s*for\s*", "", name, flags=re.IGNORECASE)
    name = re.sub(r"work instruction", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s+", " ", name).strip()
    if name:
        return name.capitalize()
    # Fallback to DB title, but collapse any repeated "Operations/Work/..." header repeats.
    title = wi.title or wi.wi_number or "Untitled"
    title = re.sub(r"Operations?/Work/Job\s*Activity\s*covered\s*by\s*this\s*assessment\s*:\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s+", " ", title).strip()
    return title.capitalize() or wi.wi_number


def wi_to_dict(wi: WorkInstruction) -> dict:
    return {
        "id": wi.id,
        "wi_number": wi.wi_number,
        "title": clean_wi_title(wi),
        "revision": wi.revision,
        "department": wi.department,
        "activity": wi.activity,
        "file_path": wi.file_path,
        "scope": wi.scope,
        "applicability": wi.applicability,
        "customer": wi.customer,
        "component": wi.component,
        "ppe": wi.ppe,
        "tools_required": wi.tools_required,
        "consumables": wi.consumables,
        "prerequisites": wi.prerequisites,
        "pre_start_checks": wi.pre_start_checks,
        "machine_parameters": wi.machine_parameters,
        "procedure": wi.procedure,
        "inspection": wi.inspection,
        "quality_requirements": wi.quality_requirements,
        "acceptance_criteria": wi.acceptance_criteria,
        "shutdown_procedure": wi.shutdown_procedure,
        "safety_notes": wi.safety_notes,
        "supervisor_approval_required": wi.supervisor_approval_required,
        "qa_approval_required": wi.qa_approval_required,
        "is_archived": wi.is_archived,
        "is_latest": wi.is_latest,
    }


@router.get("")
def list_work_instructions(
    q: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(WorkInstruction).filter(WorkInstruction.is_archived == False)
    if q:
        query = query.filter(
            (WorkInstruction.title.ilike(f"%{q}%"))
            | (WorkInstruction.wi_number.ilike(f"%{q}%"))
            | (WorkInstruction.procedure.ilike(f"%{q}%"))
        )
    if department:
        query = query.filter(WorkInstruction.department == department)
    wis = query.order_by(WorkInstruction.wi_number).all()
    return [wi_to_dict(wi) for wi in wis]


@router.get("/departments")
def list_departments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    departments = (
        db.query(WorkInstruction.department)
        .filter(WorkInstruction.department.isnot(None))
        .distinct()
        .all()
    )
    return [d[0] for d in departments if d[0]]


@router.get("/{wi_id}")
def get_work_instruction(
    wi_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wi = db.query(WorkInstruction).filter(WorkInstruction.id == wi_id).first()
    if not wi:
        raise HTTPException(status_code=404, detail="Work Instruction not found")

    sections = db.query(Section).filter(Section.work_instruction_id == wi.id).order_by(Section.order_index).all()

    # Log the view
    db.add(AuditLog(
        user_id=current_user.id,
        work_instruction_id=wi.id,
        action="VIEW_WI",
        detail=f"Viewed {wi.title} ({wi.wi_number})",
    ))
    db.commit()

    data = wi_to_dict(wi)
    data["sections"] = [
        {"heading": s.heading, "content": s.content, "order_index": s.order_index}
        for s in sections
    ]
    data["qr_code"] = work_instruction_qr(wi.id)
    return data


@router.get("/{wi_id}/sections")
def get_wi_sections(
    wi_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sections = db.query(Section).filter(Section.work_instruction_id == wi_id).order_by(Section.order_index).all()
    return [
        {"heading": s.heading, "content": s.content, "order_index": s.order_index}
        for s in sections
    ]


def _resolve_document_path(wi: WorkInstruction) -> Optional[Path]:
    """Resolve the absolute path to the source document for a work instruction."""
    candidates = []
    if wi.file_path:
        candidates.append(Path(wi.file_path))
    # Fallback: search the project data folders for a file matching the WI number.
    if wi.wi_number:
        num = wi.wi_number.replace("WI", "").strip()
        for data_dir in DATA_DIRS:
            if data_dir.exists():
                for f in data_dir.iterdir():
                    if f.suffix.lower() in (".docx", ".doc") and f.name.lower().startswith(f"wi_{num}"):
                        candidates.append(f)
    for path in candidates:
        if path.exists() and path.is_file():
            return path
    return None


@router.get("/{wi_id}/file")
def get_work_instruction_file(
    wi_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wi = db.query(WorkInstruction).filter(WorkInstruction.id == wi_id).first()
    if not wi:
        raise HTTPException(status_code=404, detail="Work Instruction not found")

    path = _resolve_document_path(wi)
    if not path:
        raise HTTPException(status_code=404, detail="Source document file not found")

    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if path.suffix.lower() == ".docx"
        else "application/msword",
        filename=path.name,
    )
