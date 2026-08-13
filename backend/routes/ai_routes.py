from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, AuditLog
from backend.auth import get_current_user
from backend.ai_assistant import ask_question
from backend.agent_graph import node_ai_assistant, WorkflowState, run_workflow

router = APIRouter(prefix="/ai", tags=["ai"])


def require_ai_access(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to check if the user has AI Assistant access."""
    if current_user.role != "admin" and not current_user.ai_assistant_enabled:
        raise HTTPException(
            status_code=403,
            detail="AI Assistant access has not been granted. Please contact the administrator.",
        )
    return current_user


class AskRequest(BaseModel):
    question: str
    context: Optional[Dict] = None


class WorkflowRequest(BaseModel):
    operator_name: str = ""
    work_title: str = ""
    wi_number: str = ""
    ppe_confirmed: bool = False
    pre_start_ok: bool = False
    process_data: Dict = {}
    inspection_ok: bool = False
    approval: Dict = {}
    ai_question: str = ""


@router.post("/ask")
def ask(req: AskRequest, current_user: User = Depends(require_ai_access), db: Session = Depends(get_db)):
    if not req.question.strip():
        return {"answer": "Please ask a question.", "sources": []}

    result = ask_question(req.question, req.context or {})

    # Log the AI question to audit trail
    db.add(AuditLog(
        user_id=current_user.id,
        action="AI_QUESTION",
        detail=f"Q: {req.question} | A: {result.get('answer', '')[:300]}",
    ))
    db.commit()

    return result


@router.post("/workflow")
def run_workflow(req: WorkflowRequest, current_user: User = Depends(require_ai_access), db: Session = Depends(get_db)):
    """Run the LangGraph workflow through the AI node (or full graph)."""
    state: WorkflowState = {
        "operator_id": current_user.id,
        "operator_name": req.operator_name or current_user.full_name,
        "work_title": req.work_title,
        "wi_number": req.wi_number,
        "ppe_confirmed": req.ppe_confirmed,
        "pre_start_ok": req.pre_start_ok,
        "process_data": req.process_data,
        "inspection_ok": req.inspection_ok,
        "approval": req.approval,
        "ai_question": req.ai_question,
    }

    # If there's an AI question, run the assistant node
    if req.ai_question:
        result_state = node_ai_assistant(state)
        return {
            "answer": result_state.get("ai_answer", {}),
            "audit_logs": result_state.get("audit_logs", []),
            "blocked": result_state.get("blocked", False),
            "complete": result_state.get("complete", False),
        }

    # Run the full workflow graph and return the final state.
    result = run_workflow(state)
    return {
        "state": result,
        "blocked": result.get("blocked", False),
        "block_reason": result.get("block_reason"),
        "complete": result.get("complete", False),
        "decisions": result.get("decisions", []),
        "audit_logs": result.get("audit_logs", []),
    }
