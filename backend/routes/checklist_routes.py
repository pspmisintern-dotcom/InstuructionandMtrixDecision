from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, Checklist, WorkInstruction, AuditLog
from backend.auth import get_current_user

router = APIRouter(prefix="/checklists", tags=["checklists"])


class ChecklistItem(BaseModel):
    work_instruction_id: int
    category: str
    item: str
    is_checked: bool = False


@router.get("/{wi_id}")
def get_checklists(
    wi_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(Checklist).filter(
        Checklist.work_instruction_id == wi_id,
        Checklist.user_id == current_user.id,
    ).all()
    return [
        {
            "id": c.id,
            "category": c.category,
            "item": c.item,
            "is_checked": c.is_checked,
            "checked_at": c.checked_at,
        }
        for c in items
    ]


@router.post("/{wi_id}/items")
def add_checklist_items(
    wi_id: int,
    items: List[ChecklistItem],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wi = db.query(WorkInstruction).filter(WorkInstruction.id == wi_id).first()
    if not wi:
        raise HTTPException(status_code=404, detail="Work Instruction not found")

    for item in items:
        db.add(Checklist(
            work_instruction_id=wi_id,
            user_id=current_user.id,
            category=item.category,
            item=item.item,
            is_checked=item.is_checked,
        ))
    db.commit()
    return {"message": f"Added {len(items)} checklist items"}


@router.put("/{item_id}")
def toggle_checklist_item(
    item_id: int,
    is_checked: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(Checklist).filter(Checklist.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    item.is_checked = is_checked
    item.checked_at = datetime.utcnow() if is_checked else None
    db.add(AuditLog(
        user_id=current_user.id,
        work_instruction_id=item.work_instruction_id,
        action="CHECKLIST_TOGGLE",
        detail=f"{item.category}: {item.item} -> {'checked' if is_checked else 'unchecked'}",
    ))
    db.commit()
    return {"message": "Updated", "is_checked": item.is_checked}
