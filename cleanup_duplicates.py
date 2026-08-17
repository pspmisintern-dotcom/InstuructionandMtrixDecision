"""Clean up duplicate work instructions in the database."""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import SessionLocal
from backend.models import WorkInstruction, AuditLog, Section, Checklist
from sqlalchemy import text

db = SessionLocal()

# Delete dependent records first (audit_logs, sections, checklists reference work_instructions)
db.execute(text('DELETE FROM audit_logs'))
db.execute(text('DELETE FROM sections'))
db.execute(text('DELETE FROM checklists'))
db.commit()
print('Cleared dependent records')

# Delete all work instructions
db.execute(text('DELETE FROM work_instructions'))
db.commit()
print('Cleared all work instructions')

# Re-scan from scratch
from backend.routes.workinstruction_routes import scan_and_populate_pdfs
scan_and_populate_pdfs(db)
db.commit()

qs = db.query(WorkInstruction).all()
from collections import Counter
nums = [w.wi_number for w in qs]
counts = Counter(nums)
dups = {k: v for k, v in counts.items() if v > 1}
print(f'After re-scan: Total={len(qs)}, Unique={len(counts)}, Duplicates={dups}')
db.close()