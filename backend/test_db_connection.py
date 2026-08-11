"""Test database connection and work instruction loading."""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import SessionLocal
from backend.models import WorkInstruction

db = SessionLocal()
try:
    count = db.query(WorkInstruction).count()
    print(f"Total Work Instructions: {count}")

    results = db.query(WorkInstruction).filter(WorkInstruction.is_archived == False).all()
    print(f"Non-archived: {len(results)}")

    results2 = db.query(WorkInstruction).filter(WorkInstruction.file_path.like("pdf:en:%")).all()
    print(f"English PDFs: {len(results2)}")

    if results:
        wi = results[0]
        print(f"First WI: id={wi.id}, wi_number={wi.wi_number}, title={wi.title}, department={wi.department}, file_path={wi.file_path}")

    print("Database queries OK")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
finally:
    db.close()