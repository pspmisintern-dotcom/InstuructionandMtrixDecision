from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, DecisionRule, AuditLog
from backend.auth import get_current_user, require_role
from backend.decision_engine import DecisionEngine

router = APIRouter(prefix="/decision", tags=["decision"])


class EvaluateRequest(BaseModel):
    work: str = "*"
    process_data: Dict = {}


class RuleCreate(BaseModel):
    name: str
    work: str = "*"
    condition_field: str
    condition_operator: str
    condition_value: str
    action_type: str
    action_detail: str


def compute_risk_score(triggered) -> int:
    """Compute a 0-100 risk score from triggered rule weights."""
    score = 0
    for t in triggered:
        action_type = t.get("action_type", "info")
        if action_type == "block":
            score += 35
        elif action_type == "notify":
            score += 15
        elif action_type == "recommend":
            score += 10
        else:  # display / info
            score += 5
    return min(score, 100)


@router.post("/evaluate")
def evaluate(eval_req: EvaluateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    engine = DecisionEngine(db)
    context = {"work": eval_req.work, **eval_req.process_data}
    triggered = engine.evaluate(context)
    risk_score = compute_risk_score(triggered)

    db.add(AuditLog(
        user_id=current_user.id,
        action="DECISION_EVALUATE",
        detail=f"Work={eval_req.work} | Risk={risk_score} | Decisions: {[t['rule'] for t in triggered]}",
    ))
    db.commit()

    return {"triggered": triggered, "count": len(triggered), "risk_score": risk_score}


@router.get("/rules")
def list_rules(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rules = db.query(DecisionRule).filter(DecisionRule.is_active == True).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "work": r.work,
            "condition_field": r.condition_field,
            "condition_operator": r.condition_operator,
            "condition_value": r.condition_value,
            "action_type": r.action_type,
            "action_detail": r.action_detail,
        }
        for r in rules
    ]


@router.post("/rules")
def create_rule(
    rule: RuleCreate,
    current_user: User = Depends(require_role("admin", "supervisor")),
    db: Session = Depends(get_db),
):
    new_rule = DecisionRule(
        name=rule.name,
        work=rule.work,
        condition_field=rule.condition_field,
        condition_operator=rule.condition_operator,
        condition_value=rule.condition_value,
        action_type=rule.action_type,
        action_detail=rule.action_detail,
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return {"id": new_rule.id, "message": "Rule created"}


@router.put("/rules/{rule_id}")
def update_rule(
    rule_id: int,
    rule: RuleCreate,
    current_user: User = Depends(require_role("admin", "supervisor")),
    db: Session = Depends(get_db),
):
    existing = db.query(DecisionRule).filter(DecisionRule.id == rule_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")
    existing.name = rule.name
    existing.work = rule.work
    existing.condition_field = rule.condition_field
    existing.condition_operator = rule.condition_operator
    existing.condition_value = rule.condition_value
    existing.action_type = rule.action_type
    existing.action_detail = rule.action_detail
    db.commit()
    db.refresh(existing)
    return {"id": existing.id, "message": "Rule updated"}


@router.delete("/rules/{rule_id}")
def delete_rule(
    rule_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    rule = db.query(DecisionRule).filter(DecisionRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.is_active = False
    db.commit()
    return {"message": "Rule deactivated"}
