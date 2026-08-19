"""
fix_quality_departments.py

One-off correction: Work Instructions 44, 37, 31, 39, 30, 26, 23, 12, 11, 10
belong in the Quality department but were misclassified as Production by
earlier keyword-matcher logic (see backend/departments.py for the fix to
that logic going forward). This script directly sets department="Quality"
for every language row (English/Hindi/Marathi) of these WI numbers,
regardless of how their wi_number is formatted in the DB (e.g. "WI10",
"WI_10", "WI 10").

Note: WI47 (Training & HR) was originally included in this list but is
correctly HR, not Quality -- it is intentionally excluded here.

Usage:
    python -m backend.fix_quality_departments
"""

import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import SessionLocal
from backend.models import WorkInstruction

TARGET_WI_NUMBERS = {"10", "11", "12", "23", "26", "30", "31", "37", "39", "44"}


def extract_number(wi_number: str) -> str:
    match = re.search(r"(\d+)", wi_number or "")
    return match.group(1) if match else ""


def main():
    db = SessionLocal()
    try:
        updated = 0
        for wi in db.query(WorkInstruction).all():
            if extract_number(wi.wi_number) in TARGET_WI_NUMBERS and wi.department != "Quality":
                print(f"  {wi.wi_number:8} {wi.department!r:20} -> 'Quality'   ({wi.file_path})")
                wi.department = "Quality"
                updated += 1
        db.commit()
        print(f"\nUpdated {updated} rows.\n")

        print("Verification (wi_number, department, file_path) for target WIs:")
        rows = (
            db.query(WorkInstruction.wi_number, WorkInstruction.department, WorkInstruction.file_path)
            .all()
        )
        for wi_number, department, file_path in sorted(rows, key=lambda r: (extract_number(r[0]), r[2] or "")):
            if extract_number(wi_number) in TARGET_WI_NUMBERS:
                print(f"  {wi_number:8} {department:10} {file_path}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
