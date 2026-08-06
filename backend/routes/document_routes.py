import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import User, WorkInstruction, AuditLog
from backend.auth import get_current_user, require_role
from backend.doc_parser import parse_work_instruction
from backend.knowledge_base import build_documents_from_parsed, build_vectorstore

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")


@router.get("")
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = db.query(WorkInstruction).order_by(WorkInstruction.wi_number).all()
    return [
        {
            "id": d.id,
            "wi_number": d.wi_number,
            "title": d.title,
            "revision": d.revision,
            "department": d.department,
            "is_archived": d.is_archived,
            "is_latest": d.is_latest,
            "file_path": d.file_path,
        }
        for d in docs
    ]


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith((".docx", ".doc")):
        raise HTTPException(status_code=400, detail="Only .docx/.doc files supported")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    dest_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(dest_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        parsed = parse_work_instruction(dest_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")

    # Archive any existing latest revision with same WI number
    existing = db.query(WorkInstruction).filter(
        WorkInstruction.wi_number == parsed["wi_number"],
        WorkInstruction.is_latest == True,
    ).all()
    for ex in existing:
        ex.is_latest = False
        ex.is_archived = True

    wi = WorkInstruction(
        wi_number=parsed["wi_number"],
        title=parsed["title"],
        revision=parsed["revision"],
        department=parsed["department"],
        scope=parsed.get("scope"),
        ppe=parsed.get("ppe"),
        procedure=parsed.get("procedure"),
        inspection=parsed.get("inspection"),
        shutdown_procedure=parsed.get("shutdown_procedure"),
        file_path=dest_path,
    )
    db.add(wi)
    db.add(AuditLog(
        user_id=current_user.id,
        action="UPLOAD_DOCUMENT",
        detail=f"Uploaded {file.filename} as {parsed['wi_number']}",
    ))
    db.commit()

    # Rebuild knowledge base incrementally (simplified: rebuild all)
    try:
        all_parsed = []
        for d in db.query(WorkInstruction).all():
            if d.file_path and os.path.exists(d.file_path):
                all_parsed.append(parse_work_instruction(d.file_path))
        if all_parsed:
            docs = build_documents_from_parsed(all_parsed)
            build_vectorstore(docs)
    except Exception as e:
        print(f"[documents] KB rebuild warning: {e}")

    return {"message": "Document uploaded and indexed", "wi_number": parsed["wi_number"], "title": parsed["title"]}


@router.post("/{wi_id}/archive")
def archive_document(
    wi_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    wi = db.query(WorkInstruction).filter(WorkInstruction.id == wi_id).first()
    if not wi:
        raise HTTPException(status_code=404, detail="Document not found")
    wi.is_archived = True
    wi.is_latest = False
    db.commit()
    return {"message": f"Document {wi.wi_number} archived"}
