"""
migrate_dedupe_work_instructions.py

One-off cleanup + hardening for a duplicate-PDF bug: scan_and_populate_pdfs()
(backend/routes/workinstruction_routes.py) re-scans the data folders and
inserts any PDF not already present as a WorkInstruction row. On serverless
(Vercel) each request can be a fresh process with an empty in-memory cache,
so two concurrent requests can both decide a new PDF is "missing" and both
insert it before either commits -- producing duplicate rows with the same
file_path (e.g. two "pdf:hi:WI_47 Training & HR-hindi.pdf" rows), which show
up in the UI as the same document listed twice.

This script:
1. Deletes duplicate WorkInstruction rows sharing a file_path, keeping the
   lowest id (any AuditLog rows referencing a deleted duplicate are
   reassigned to the kept row first, since AuditLog.work_instruction_id has
   no cascade).
2. Adds a unique index on file_path so the database itself rejects future
   duplicate inserts, regardless of how many concurrent processes race.

Safe to re-run.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import func, text
from backend.database import SessionLocal, engine
from backend.models import WorkInstruction, AuditLog


def main():
    db = SessionLocal()
    try:
        dupe_paths = (
            db.query(WorkInstruction.file_path, func.count(WorkInstruction.id))
            .filter(WorkInstruction.file_path.isnot(None))
            .group_by(WorkInstruction.file_path)
            .having(func.count(WorkInstruction.id) > 1)
            .all()
        )

        removed = 0
        for file_path, _count in dupe_paths:
            rows = (
                db.query(WorkInstruction)
                .filter(WorkInstruction.file_path == file_path)
                .order_by(WorkInstruction.id)
                .all()
            )
            keep, extras = rows[0], rows[1:]
            for extra in extras:
                db.query(AuditLog).filter(
                    AuditLog.work_instruction_id == extra.id
                ).update({"work_instruction_id": keep.id})
                db.delete(extra)
                removed += 1
            print(f"Kept id={keep.id}, removed {len(extras)} duplicate(s) of {file_path!r}")

        db.commit()
        print(f"\nRemoved {removed} duplicate row(s) total.")

        # Postgres and SQLite both support this syntax.
        db.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_work_instructions_file_path_unique "
            "ON work_instructions (file_path)"
        ))
        db.commit()
        print("Ensured unique index on work_instructions.file_path.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
