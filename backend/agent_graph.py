"""
agent_graph.py

LangGraph stateful agent that orchestrates the operator digital workflow.

The graph guides an operator through:
    Login -> Select Work -> PPE check -> Pre-start Inspection -> Decision Matrix
    -> Process Steps -> Inspection -> Final Approval -> Complete

It uses conditional edges to enforce gating (e.g., PPE not confirmed -> block,
humidity high -> notify + disable, component damaged -> stop + notify).

Each step is logged to the audit trail.
"""

from typing import TypedDict, List, Dict, Any
from datetime import datetime

from backend.decision_engine import decision_engine
from backend.ai_assistant import ask_question


class WorkflowState(TypedDict, total=False):
    operator_id: int
    operator_name: str
    work_instruction_id: int
    work_title: str
    wi_number: str
    step: str
    ppe_confirmed: bool
    ppe_items: List[str]
    pre_start_ok: bool
    decisions: List[Dict]
    process_data: Dict[str, Any]
    inspection_ok: bool
    approval: Dict
    audit_logs: List[Dict]
    complete: bool
    blocked: bool
    block_reason: str
    ai_question: str
    ai_answer: Dict


def _log(state: WorkflowState, action: str, detail: str) -> WorkflowState:
    log = {
        "timestamp": datetime.utcnow().isoformat(),
        "operator": state.get("operator_name", ""),
        "work": state.get("work_title", ""),
        "action": action,
        "detail": detail,
    }
    logs = state.get("audit_logs", [])
    logs.append(log)
    return {**state, "audit_logs": logs}


def node_select_work(state: WorkflowState) -> WorkflowState:
    
    state["step"] = "selected"
    return _log(state, "SELECT_WORK", f"Selected work: {state.get('work_title', '')} ({state.get('wi_number', '')})")


def node_ppe_check(state: WorkflowState) -> WorkflowState:
    return _log(state, "PPE_CHECK", f"PPE confirmed: {state.get('ppe_confirmed', False)}")


def route_after_ppe(state: WorkflowState) -> str:
    if not state.get("ppe_confirmed", False):
        state["blocked"] = True
        state["block_reason"] = "⚠ PPE Required. Operator cannot continue without confirming required PPE."
        return "blocked"
    return "pre_start"


def node_pre_start(state: WorkflowState) -> WorkflowState:
    return _log(state, "PRE_START", f"Pre-start inspection OK: {state.get('pre_start_ok', False)}")


def route_after_pre_start(state: WorkflowState) -> str:
    if not state.get("pre_start_ok", False):
        state["blocked"] = True
        state["block_reason"] = "⚠ Machine Inspection Pending. Complete pre-start checks before proceeding."
        return "blocked"
    return "decision"


def node_decision_matrix(state: WorkflowState) -> WorkflowState:
    """Evaluate the decision engine against current process data."""
    context = {
        "work": state.get("work_title", ""),
        **state.get("process_data", {}),
    }
    decisions = decision_engine.evaluate(context)
    state["decisions"] = decisions

    # Check for blocking actions
    for d in decisions:
        if d["action_type"] in ("block",):
            state["blocked"] = True
            state["block_reason"] = d["message"]
            break
    return _log(state, "DECISION_MATRIX", f"Evaluated {len(decisions)} decision rule(s): {[d['rule'] for d in decisions]}")


def route_after_decision(state: WorkflowState) -> str:
    if state.get("blocked", False):
        return "blocked"
    # If any notify/display actions exist, could route to a notification node
    return "process"


def node_process_steps(state: WorkflowState) -> WorkflowState:
    return _log(state, "PROCESS_STEPS", "Operator completed process steps.")


def node_inspection(state: WorkflowState) -> WorkflowState:
    return _log(state, "INSPECTION", f"Inspection OK: {state.get('inspection_ok', False)}")


def route_after_inspection(state: WorkflowState) -> str:
    if not state.get("inspection_ok", False):
        state["blocked"] = True
        state["block_reason"] = "Inspection failed. Component does not meet acceptance criteria."
        return "blocked"
    return "approval"


def node_approval(state: WorkflowState) -> WorkflowState:
    approval = state.get("approval", {})
    return _log(state, "APPROVAL", f"Approval: {approval.get('type', 'N/A')} -> {approval.get('status', 'pending')}")


def route_after_approval(state: WorkflowState) -> str:
    approval = state.get("approval", {})
    if approval.get("status") != "approved":
        state["blocked"] = True
        state["block_reason"] = "Work awaiting supervisor/QA approval."
        return "blocked"
    return "complete"


def node_complete(state: WorkflowState) -> WorkflowState:
    state["complete"] = True
    return _log(state, "COMPLETE", "Work instruction execution completed successfully.")


def node_blocked(state: WorkflowState) -> WorkflowState:
    return _log(state, "BLOCKED", f"Workflow blocked: {state.get('block_reason', 'Unknown')}")


def node_ai_assistant(state: WorkflowState) -> WorkflowState:
    """Handle an AI question within the workflow."""
    question = state.get("ai_question", "")
    if question:
        answer = ask_question(question, state.get("process_data", {}))
        state["ai_answer"] = answer
        return _log(state, "AI_QUESTION", f"Q: {question} | A: {answer.get('answer', '')[:200]}")
    return state


def _run_full_workflow(initial_state: WorkflowState) -> WorkflowState:
    state = node_select_work(initial_state)
    state = node_ppe_check(state)
    if not state.get("ppe_confirmed", False):
        return node_blocked(state)

    state = node_pre_start(state)
    if not state.get("pre_start_ok", False):
        return node_blocked(state)

    state = node_decision_matrix(state)
    if state.get("blocked", False):
        return node_blocked(state)

    state = node_process_steps(state)
    state = node_inspection(state)
    if not state.get("inspection_ok", False):
        return node_blocked(state)

    state = node_approval(state)
    if state.get("approval", {}).get("status") != "approved":
        return node_blocked(state)

    if state.get("ai_question"):
        state = node_ai_assistant(state)

    return node_complete(state)


def run_workflow(initial_state: WorkflowState) -> Dict:
    """Run the workflow and return the resulting state."""
    result = _run_full_workflow(initial_state)
    return result
