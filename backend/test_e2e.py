"""End-to-end smoke test for AI assistant, decision engine, and knowledge base."""
import os
import sys

os.environ["WI_DOCUMENTS_DIR"] = r"c:\Users\ADMIIN\Documents\Digitise instruction Project"

print("=== Testing Knowledge Base Load ===")
import knowledge_base
knowledge_base.load_from_db()
vs = knowledge_base.get_vectorstore()
print(f"Vector store built: {vs is not None}")
if vs:
    print(f"Vector count: {vs.index.ntotal}")

print("\n=== Testing Semantic Search ===")
if vs:
    results = knowledge_base.semantic_search("What PPE is required for blasting?", k=3)
    for r in results:
        print(f"- [{r.metadata.get('wi_number','')}] {r.metadata.get('title','')} (section: {r.metadata.get('section','')})")
        print(f"  {r.page_content[:120]}...")

print("\n=== Testing AI Assistant RAG ===")
from ai_assistant import ask_question
try:
    answer = ask_question("What PPE is required for blasting?")
    print(f"Answer: {answer}")
except Exception as e:
    print(f"AI assistant error (expected if no OpenAI key, using fallback): {e}")

print("\n=== Testing Decision Engine ===")
from decision_engine import evaluate_decision
test_cases = [
    {"work": "Blasting", "humidity": 85},
    {"work": "Blasting", "surface_roughness": "NOT OK"},
    {"work": "Spray", "coating_thickness": "LOW"},
    {"work": "Spray", "coating_thickness": "HIGH"},
    {"work": "HVOF", "torch_status": "ignition_failed"},
    {"work": "Inward", "component_damaged": True},
]
for tc in test_cases:
    result = evaluate_decision(tc)
    print(f"Input {tc} -> {len(result)} actions")
    for a in result:
        print(f"   [{a.get('action_type')}] {a.get('action_detail')}")

print("\n=== ALL TESTS DONE ===")
