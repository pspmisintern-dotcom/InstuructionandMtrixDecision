"""
migrate_departments.py

SUPERSEDED: the canonical department list and mapping logic now live in
backend/departments.py. This script's old DEPT_MAP incorrectly mapped
"Quality" -> "Production", which was the root cause of quality-related work
instructions losing their department. Kept here as a historical record only
-- do not re-run against a DB that already uses backend/departments.py's
LEGACY_DEPARTMENT_MAP (dashboard_routes.py normalizes legacy names on read),
and use backend/fix_quality_departments.py for the WI-44/47/37/31/39/30/26/
23/12/11/10 -> Quality correction instead.
"""

import sys
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import SessionLocal
from backend.models import WorkInstruction, User
from sqlalchemy import func

# Map old department names to new canonical ones (Quality no longer maps to
# Production -- see backend/departments.py for the current canonical mapping)
DEPT_MAP = {
    "Spray / Surface Engineering": "Spraying",
    "Surface Engineering": "Spraying",
    "Blasting": "Spraying",
    "Logistics / Stores": "Production",
    "Safety / EHS": "Production",
    "Quality Assurance": "Quality",
    "Inspection": "Quality",
    "Calibration": "Quality",
}


def main():
    db = SessionLocal()
    try:
        # Update Work Instructions
        updated_wi = 0
        for wi in db.query(WorkInstruction).all():
            if wi.department in DEPT_MAP:
                wi.department = DEPT_MAP[wi.department]
                updated_wi += 1

        # Update Users
        updated_users = 0
        for u in db.query(User).all():
            if u.department in DEPT_MAP:
                u.department = DEPT_MAP[u.department]
                updated_users += 1

        db.commit()

        # Verify
        print(f"Updated Work Instructions: {updated_wi}")
        print(f"Updated Users: {updated_users}")
        print()

        depts = (
            db.query(WorkInstruction.department, func.count(WorkInstruction.id))
            .group_by(WorkInstruction.department)
            .all()
        )
        print("Work Instruction Departments after update:")
        for d in depts:
            print(f"  {d[0]}: {d[1]}")

        print()
        user_depts = (
            db.query(User.department, func.count(User.id))
            .group_by(User.department)
            .all()
        )
        print("User Departments after update:")
        for d in user_depts:
            print(f"  {d[0]}: {d[1]}")

    finally:
        db.close()


if __name__ == "__main__":
    main()