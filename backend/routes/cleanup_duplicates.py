"""
cleanup_duplicates.py

Removes duplicate WorkInstruction records (same wi_number + language) and
updates department assignments based on the new department mapping.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import SessionLocal
from backend.models import WorkInstruction, Section, AuditLog, Checklist
from sqlalchemy import func


def determine_department_from_filename(filename: str) -> str:
    lower = filename.lower()
    if any(k in lower for k in ["grind", "abrasive", "wheel", "surface finish", "polish", "bainline"]):
        return "Grinding"
    if any(k in lower for k in ["mask", "tape", "cover", "protect"]):
        return "Masking"
    if any(k in lower for k in ["spray", "blasting", "coating", "paint", "thermal", "hvof", "plasma", "twas", "pta"]):
        return "Spraying"
    if any(k in lower for k in ["hr", "training"]):
        return "HR"
    if any(k in lower for k in ["maintenance"]):
        return "Maintenance"
    if any(k in lower for k in ["sales"]):
        return "Sales"
    if any(k in lower for k in ["quality", "qa", "qms"]):
        return "Quality Assurance"
    if any(k in lower for k in ["calibration"]):
        return "Calibration"
    if any(k in lower for k in ["marketing"]):
        return "Marketing"
    if any(k in lower for k in ["purchase"]):
        return "Purchase"
    if any(k in lower for k in ["inspection", "inward", "outward", "final"]):
        return "Inspection"
    if any(k in lower for k in ["packing"]):
        return "Packing"
    return "Production"


def main():
    db = SessionLocal()
    try:
        # Step 1: Update departments based on file_path filename
        updated = 0
        for wi in db.query(WorkInstruction).filter(WorkInstruction.file_path.like("pdf:%")).all():
            if wi.file_path and wi.file_path.startswith("pdf:"):
                parts = wi.file_path.split(":", 2)
                if len(parts) == 3:
                    filename = parts[2]
                    new_dept = determine_department_from_filename(filename)
                    if wi.department != new_dept:
                        wi.department = new_dept
                        updated += 1
        db.commit()
        print(f"[cleanup] Updated departments for {updated} work instructions.")

        # Step 2: Remove duplicate records (same wi_number + language)
        # Keep the lowest id for each wi_number + language combo
        dupes = (
            db.query(
                WorkInstruction.wi_number,
                WorkInstruction.file_path,
                func.count(WorkInstruction.id),
                func.min(WorkInstruction.id),
            )
            .filter(WorkInstruction.file_path.like("pdf:%"))
            .group_by(WorkInstruction.wi_number, WorkInstruction.file_path)
            .having(func.count(WorkInstruction.id) > 1)
            .all()
        )

        removed = 0
        for wi_number, file_path, count, keep_id in dupes:
            # Delete duplicate records (all except the one to keep)
            dup_records = (
                db.query(WorkInstruction)
                .filter(
                    WorkInstruction.wi_number == wi_number,
                    WorkInstruction.file_path == file_path,
                    WorkInstruction.id != keep_id,
                )
                .all()
            )
            for rec in dup_records:
                # Delete related records first
                db.query(Section).filter(Section.work_instruction_id == rec.id).delete()
                db.query(Checklist).filter(Checklist.work_instruction_id == rec.id).delete()
                db.query(AuditLog).filter(AuditLog.work_instruction_id == rec.id).delete()
                db.delete(rec)
                removed += 1
        db.commit()
        print(f"[cleanup] Removed {removed} duplicate work instruction records.")

        # Step 3: Also remove duplicates where same wi_number exists with different file_path
        # (e.g. WI18 has both en and hi records - keep only the English one)
        wi_numbers = (
            db.query(WorkInstruction.wi_number)
            .filter(WorkInstruction.file_path.like("pdf:%"))
            .group_by(WorkInstruction.wi_number)
            .having(func.count(WorkInstruction.id) > 1)
            .all()
        )

        removed2 = 0
        for (wi_number,) in wi_numbers:
            records = (
                db.query(WorkInstruction)
                .filter(
                    WorkInstruction.wi_number == wi_number,
                    WorkInstruction.file_path.like("pdf:%"),
                )
                .order_by(WorkInstruction.id)
                .all()
            )
            # Keep the English record (pdf:en:) if it exists, otherwise keep the first
            keep = None
            for rec in records:
                if rec.file_path and rec.file_path.startswith("pdf:en:"):
                    keep = rec
                    break
            if keep is None:
                keep = records[0]

            for rec in records:
                if rec.id == keep.id:
                    continue
                db.query(Section).filter(Section.work_instruction_id == rec.id).delete()
                db.query(Checklist).filter(Checklist.work_instruction_id == rec.id).delete()
                db.query(AuditLog).filter(AuditLog.work_instruction_id == rec.id).delete()
                db.delete(rec)
                removed2 += 1
        db.commit()
        print(f"[cleanup] Removed {removed2} additional duplicate records (same wi_number, different language).")

        # Verify
        total = db.query(WorkInstruction).count()
        print(f"[cleanup] Total work instructions remaining: {total}")

        depts = (
            db.query(WorkInstruction.department, func.count(WorkInstruction.id))
            .group_by(WorkInstruction.department)
            .all()
        )
        print("\nDepartments after cleanup:")
        for d in depts:
            print(f"  {d[0]}: {d[1]}")

    finally:
        db.close()


if __name__ == "__main__":
    main()