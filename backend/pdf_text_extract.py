"""
pdf_text_extract.py

Extracts real text content from a Work Instruction PDF so it can be indexed
by the RAG knowledge base. Previously PDF-scanned work instructions (see
routes/workinstruction_routes.py:scan_and_populate_pdfs) only stored a
generic placeholder sentence ("<title> - work instruction document
(<lang> version)."), never the actual document body, so the AI Assistant
had nothing real to retrieve or answer from for any WI that came from a
PDF (as opposed to a parsed .docx).
"""

import re
from pathlib import Path
from typing import Optional

from pypdf import PdfReader


def extract_pdf_text(path: Path) -> Optional[str]:
    """Extract and lightly clean all text from a PDF. Returns None on failure
    or if no extractable text is found (e.g. a scanned image-only PDF)."""
    try:
        reader = PdfReader(str(path))
    except Exception:
        return None

    pages_text = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            pages_text.append(text)

    if not pages_text:
        return None

    raw = "\n".join(pages_text)

    # pypdf sometimes flattens what were visually separate lines/paragraphs
    # (e.g. numbered steps laid out as table cells) into one long text line.
    # Re-split before numbered-list markers and common section labels so the
    # downstream answer formatter (ai_assistant._build_offline_answer) can
    # still detect headers/steps line-by-line.
    raw = re.sub(r"(?<=[.:\)])\s+(?=\d+\.\s)", "\n", raw)
    raw = re.sub(r"\s+(?=\d+\.\s)", "\n", raw)
    raw = re.sub(r"(?<=[a-z])\s+(?=(?:PPE|Scope|Procedure|Tools?|Consumables?|Safety|Inspection|Acceptance Criteria|Machine Parameters?)\s*[:\)])", "\n", raw)

    # Collapse excess whitespace and drop noise lines (page numbers, blank
    # header/footer artifacts) while preserving line structure for the
    # numbered-step / header detection in ai_assistant._build_offline_answer.
    cleaned_lines = []
    seen = set()
    for line in raw.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if not line:
            continue
        if re.fullmatch(r"page \d+( of \d+)?", line, re.IGNORECASE):
            continue
        key = line.lower()
        if key in seen and len(line) < 40:
            # Drop short repeated header/footer lines (company name, form
            # code) but keep longer repeated content lines as-is.
            continue
        seen.add(key)
        cleaned_lines.append(line)

    text = "\n".join(cleaned_lines).strip()
    # Postgres text columns reject embedded NUL bytes, which some PDF
    # extractions produce for odd character encodings.
    text = text.replace("\x00", "")
    return text or None
