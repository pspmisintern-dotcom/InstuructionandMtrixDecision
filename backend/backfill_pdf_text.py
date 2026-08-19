"""
backfill_pdf_text.py

One-off backfill: WorkInstruction rows created by scan_and_populate_pdfs
before the pdf_text_extract.py fix only had a generic placeholder sentence
in `scope` and nothing in `procedure` -- the AI Assistant had no real
document content to search or answer from for any PDF-only work
instruction. This extracts the actual text from each such PDF and fills in
`procedure`, so a rebuilt knowledge base (backend.knowledge_base.load_from_db)
can retrieve real content.

Usage:
    python -m backend.backfill_pdf_text
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import SessionLocal
from backend.models import WorkInstruction
from backend.pdf_text_extract import extract_pdf_text
from backend.routes.workinstruction_routes import resolve_pdf_path


def main():
    db = SessionLocal()
    try:
        rows = (
            db.query(WorkInstruction)
            .filter(WorkInstruction.file_path.like("pdf:%"))
            .filter(WorkInstruction.procedure.is_(None))
            .all()
        )
        print(f"Found {len(rows)} PDF-backed work instructions without extracted text.")

        updated, failed = 0, 0
        for wi in rows:
            parts = wi.file_path.split(":", 2)
            lang = parts[1] if len(parts) == 3 else "en"
            path = resolve_pdf_path(wi.file_path, lang)
            if not path:
                print(f"  [skip] {wi.wi_number} ({wi.file_path}): PDF file not found")
                failed += 1
                continue

            text = extract_pdf_text(path)
            if not text:
                print(f"  [skip] {wi.wi_number} ({wi.file_path}): no extractable text (scanned image?)")
                failed += 1
                continue

            wi.procedure = text
            updated += 1
            print(f"  [ok]   {wi.wi_number} ({wi.file_path}): {len(text)} chars")

        db.commit()
        print(f"\nUpdated {updated} rows, {failed} could not be extracted.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
