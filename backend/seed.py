"""
seed.py

Populates the database with:
- Default admin/supervisor/operator users
- Parsed Work Instructions from the .docx files
- Decision matrix rules
- A LangChain FAISS knowledge base for RAG

Run:  python seed.py
"""

import os
from pathlib import Path
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)

from backend.database import Base, engine, SessionLocal
from backend.models import (
    User,
    WorkInstruction,
    Section,
    DecisionRule,
    AuditLog,
)
from backend.security import hash_password
from backend.doc_parser import parse_all_work_instructions
from backend.knowledge_base import build_documents_from_parsed, build_vectorstore
from backend.decision_engine import DEFAULT_RULES


def seed_users(db):
    users = [
        {
            "username": "admin",
            "email": "admin@company.com",
            "full_name": "System Administrator",
            "password": "admin123",
            "role": "admin",
            "department": "IT / Management",
        },
        {
            "username": "supervisor",
            "email": "supervisor@company.com",
            "full_name": "Production Supervisor",
            "password": "supervisor123",
            "role": "supervisor",
            "department": "Production",
        },
        {
            "username": "operator",
            "email": "operator@company.com",
            "full_name": "Spraying Operator",
            "password": "operator123",
            "role": "operator",
            "department": "Spraying",
        },
    ]
    for u in users:
        exists = db.query(User).filter(User.username == u["username"]).first()
        if not exists:
            # Admin always has access; supervisor/operator need admin to grant access
            access_granted = u["role"] == "admin"
            db.add(User(
                username=u["username"],
                email=u["email"],
                full_name=u["full_name"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
                department=u["department"],
                access_granted=access_granted,
            ))
    db.commit()
    print("[seed] Users seeded.")


def seed_decision_rules(db):
    count = db.query(DecisionRule).count()
    if count == 0:
        for rule in DEFAULT_RULES:
            db.add(DecisionRule(
                name=rule["name"],
                work=rule["work"],
                condition_field=rule["condition_field"],
                condition_operator=rule["condition_operator"],
                condition_value=rule["condition_value"],
                action_type=rule["action_type"],
                action_detail=rule["action_detail"],
            ))
        db.commit()
        print(f"[seed] Seeded {len(DEFAULT_RULES)} decision rules.")
        return

    # Existing rules present: add any that are missing (by name) so new
    # Inward/Challan rules are included without wiping user-customized rules.
    existing_names = {r.name for r in db.query(DecisionRule).all()}
    added = 0
    for rule in DEFAULT_RULES:
        if rule["name"] not in existing_names:
            db.add(DecisionRule(
                name=rule["name"],
                work=rule["work"],
                condition_field=rule["condition_field"],
                condition_operator=rule["condition_operator"],
                condition_value=rule["condition_value"],
                action_type=rule["action_type"],
                action_detail=rule["action_detail"],
            ))
            added += 1
    db.commit()
    print(f"[seed] Decision rules present. Added {added} new rules.")


def seed_work_instructions(db, wi_dir):
    parsed = parse_all_work_instructions(wi_dir)
    print(f"[seed] Parsed {len(parsed)} work instructions from {wi_dir}")

    # Clear existing (simple re-seed)
    db.query(Section).delete()
    db.query(WorkInstruction).delete()
    db.commit()

    for wi in parsed:
        record = WorkInstruction(
            wi_number=wi.get("wi_number", "WI"),
            title=wi.get("title", ""),
            revision=wi.get("revision", "Rev 1"),
            department=wi.get("department", ""),
            activity=wi.get("activity"),
            scope=wi.get("scope"),
            applicability=wi.get("applicability"),
            customer=wi.get("customer"),
            component=wi.get("component"),
            ppe=wi.get("ppe"),
            tools_required=wi.get("tools_required"),
            consumables=wi.get("consumables"),
            prerequisites=wi.get("prerequisites"),
            pre_start_checks=wi.get("pre_start_checks"),
            machine_parameters=wi.get("machine_parameters"),
            procedure=wi.get("procedure"),
            inspection=wi.get("inspection"),
            quality_requirements=wi.get("quality_requirements"),
            acceptance_criteria=wi.get("acceptance_criteria"),
            shutdown_procedure=wi.get("shutdown_procedure"),
            safety_notes=wi.get("safety_notes"),
            supervisor_approval_required=wi.get("supervisor_approval_required", False),
            qa_approval_required=wi.get("qa_approval_required", False),
            file_path=wi.get("file_path"),
        )
        db.add(record)
        db.flush()  # get record.id

        for section in wi.get("sections", []):
            db.add(Section(
                work_instruction_id=record.id,
                heading=section.get("heading", ""),
                content=section.get("content", ""),
                order_index=section.get("order_index", 0),
            ))
    db.commit()
    print(f"[seed] Seeded {len(parsed)} work instructions into DB.")

    # Build knowledge base
    print("[seed] Building RAG knowledge base...")
    docs = build_documents_from_parsed(parsed)
    build_vectorstore(docs)
    print(f"[seed] Knowledge base built with {len(docs)} document chunks.")

    return parsed


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_users(db)
        seed_decision_rules(db)
        wi_dir = os.getenv("WI_DOCUMENTS_DIR", ".")
        seed_work_instructions(db, wi_dir)
        print("\n[seed] Database seeding complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
