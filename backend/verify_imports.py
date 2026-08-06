"""Verifies all backend modules import correctly under langchain 1.x."""
import sys
import traceback

MODULES = [
    "knowledge_base",
    "decision_engine",
    "agent_graph",
    "ai_assistant",
    "doc_parser",
    "qr",
    "routes.auth_routes",
    "routes.dashboard_routes",
    "routes.workinstruction_routes",
    "routes.ai_routes",
    "routes.decision_routes",
    "routes.document_routes",
    "routes.user_routes",
    "routes.checklist_routes",
    "routes.inspection_routes",
    "routes.audit_routes",
    "routes.report_routes",
    "routes.notification_routes",
    "seed",
    "main",
]

results = []
for mod in MODULES:
    try:
        __import__(mod)
        results.append(f"OK: {mod}")
    except Exception as e:
        results.append(f"FAIL: {mod}: {e}")
        traceback.print_exc()

with open("import_check_out.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(results))
    f.write("\n")

print("\n".join(results))
