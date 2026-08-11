"""
populate_pdfs.py

Populates the Neon PostgreSQL database with work instructions from the PDF data folders.
"""

import sys
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import SessionLocal
from backend.routes.workinstruction_routes import scan_and_populate_pdfs
from backend.models import WorkInstruction, User, DecisionRule
from sqlalchemy import func


def main():
    db = SessionLocal()
    try:
        # Populate work instructions from PDFs
        scan_and_populate_pdfs(db)
        print("PDF scan complete")

        # Verify data
        print(f"Users: {db.query(User).count()}")
        print(f"Decision Rules: {db.query(DecisionRule).count()}")
        print(f"Work Instructions: {db.query(WorkInstruction).count()}")

        depts = (
            db.query(WorkInstruction.department, func.count(WorkInstruction.id))
            .group_by(WorkInstruction.department)
            .all()
        )
        print("\nWork Instruction Departments:")
        for d in depts:
            print(f"  {d[0]}: {d[1]}")

    finally:
        db.close()


if __name__ == "__main__":
    main()