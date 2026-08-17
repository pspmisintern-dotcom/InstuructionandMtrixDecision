import os
import re
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.database import get_db
from backend.models import User, WorkInstruction, Section, AuditLog
from backend.auth import get_current_user
from backend.qr import work_instruction_qr
from backend.pdf_converter import docx_to_translated_pdf, SUPPORTED_LANGUAGES

router = APIRouter(prefix="/workinstructions", tags=["workinstructions"])

DEPARTMENTS = ["Grinding", "Masking", "Spraying", "Production"]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "data"

LANGUAGE_FOLDERS = {
    "en": DATA_ROOT / "English Data",
    "hi": DATA_ROOT / "HIndi data",
    "mr": DATA_ROOT / "Marathi data",
}

FALLBACK_DATA_DIRS = [
    DATA_ROOT,
    Path(__file__).resolve().parents[1] / "data",
    PROJECT_ROOT,
]

# Cache for PDF scan results - only re-scan when folder mtime changes
_pdf_scan_cache = {"mtime": 0, "data": None}


def extract_wi_number_from_pdf(filename: str) -> str:
    match = re.search(r"(WI[_\- ]?\d+)", filename, re.IGNORECASE)
    if match:
        return match.group(1).replace("_", "").replace("-", "").replace(" ", "")
    return "WI"


def extract_title_from_pdf(filename: str, lang: str) -> str:
    name = re.sub(r"\.pdf$", "", filename, flags=re.IGNORECASE)
    name = re.sub(r"_Hindi$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"_Marathi$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"^WI[_\- ]?\d+[_\s\-]*for[_\s]+", "", name, flags=re.IGNORECASE)
    name = re.sub(r"^WI[_\- ]?\d+[_\s\-]*to[_\s]+", "To ", name, flags=re.IGNORECASE)
    name = re.sub(r"^WI[_\- ]?\d+[_\s\-]*", "", name, flags=re.IGNORECASE)
    name = name.replace("_", " ").replace("(", "").replace(")", "")
    name = re.sub(r"\s+", " ", name).strip()
    return name or "Untitled Work Instruction"


def determine_department_from_filename(filename: str) -> str:
    lower = filename.lower()
    if any(k in lower for k in ["grind", "abrasive", "wheel", "surface finish", "polish"]):
        return "Grinding"
    if any(k in lower for k in ["mask", "tape", "cover", "protect"]):
        return "Masking"
    if any(k in lower for k in ["spray", "blasting", "coating", "paint", "thermal", "hvof", "plasma", "twas", "pta"]):
        return "Spraying"
    return "Production"


def _get_folder_mtime() -> float:
    """Get the latest modification time across all language folders."""
    latest = 0.0
    for folder in LANGUAGE_FOLDERS.values():
        if folder.exists():
            try:
                latest = max(latest, folder.stat().st_mtime)
            except OSError:
                pass
    return latest


def scan_and_populate_pdfs(db: Session):
    """Scan language-specific PDF folders and populate WorkInstruction records for any new PDFs.
    Uses a cache to avoid re-scanning the filesystem on every request — only re-scans
    when a folder's modification time changes (i.e. a new PDF is added or removed).
    Uses a single batch query to check existing records for efficiency.
    """
    current_mtime = _get_folder_mtime()
    if current_mtime == _pdf_scan_cache["mtime"] and _pdf_scan_cache["data"] is not None:
        # Cache is still valid — skip filesystem scan
        return

    # Fetch all existing file_path keys in a single query for efficiency
    existing_paths = set(
        row[0] for row in db.query(WorkInstruction.file_path).filter(
            WorkInstruction.file_path.like("pdf:%")
        ).all()
    )

    new_records = []
    for lang, folder in LANGUAGE_FOLDERS.items():
        if not folder.exists():
            continue
        for pdf_file in sorted(folder.glob("*.pdf")):
            # For non-English folders, only include files with the language suffix
            # to avoid duplicates (e.g. Hindi folder has both "WI_06 Plasma Spray.pdf"
            # and "WI_01_for_Inward_Hindi.pdf" - the non-suffixed ones are English duplicates)
            if lang != "en":
                lang_suffix = {"hi": "hindi", "mr": "marathi"}.get(lang, lang).lower()
                file_lower = pdf_file.name.lower()
                # Only include if filename contains the language suffix (case-insensitive)
                if lang_suffix not in file_lower:
                    continue

            file_path_key = f"pdf:{lang}:{pdf_file.name}"
            if file_path_key in existing_paths:
                continue

            wi_number = extract_wi_number_from_pdf(pdf_file.name)
            title = extract_title_from_pdf(pdf_file.name, lang)
            department = determine_department_from_filename(pdf_file.name)

            lang_label = {"en": "English", "hi": "Hindi", "mr": "Marathi"}.get(lang, lang)
            record = WorkInstruction(
                wi_number=wi_number,
                title=title,
                revision="Rev 1",
                department=department,
                activity=title,
                scope=f"{title} - work instruction document ({lang_label} version).",
                file_path=file_path_key,
            )
            new_records.append(record)

    if new_records:
        db.add_all(new_records)
        db.commit()

    # Update cache
    _pdf_scan_cache["mtime"] = current_mtime
    _pdf_scan_cache["data"] = True


def resolve_pdf_path(file_path: str, lang: str = "en") -> Optional[Path]:
    """Resolve a PDF path from a file_path stored in DB like 'pdf:en:WI_06 Plasma Spray.pdf'."""
    if file_path and file_path.startswith("pdf:"):
        parts = file_path.split(":", 2)
        if len(parts) == 3:
            stored_lang = parts[1]
            filename = parts[2]
            target_lang = lang if lang in LANGUAGE_FOLDERS else stored_lang
            if target_lang in LANGUAGE_FOLDERS:
                folder = LANGUAGE_FOLDERS[target_lang]
                candidate = folder / filename
                if candidate.exists():
                    return candidate
                # For non-English languages, also try with the language suffix
                if target_lang != "en":
                    lang_suffix = {"hi": "Hindi", "mr": "Marathi"}.get(target_lang, target_lang)
                    base_name = Path(filename).stem
                    suffixed = folder / f"{base_name}_{lang_suffix}.pdf"
                    if suffixed.exists():
                        return suffixed
            if stored_lang in LANGUAGE_FOLDERS:
                folder = LANGUAGE_FOLDERS[stored_lang]
                candidate = folder / filename
                if candidate.exists():
                    return candidate
    return None


def clean_wi_title(wi: WorkInstruction) -> str:
    """Return a clean, short, human-readable title for a work instruction."""
    if wi.file_path and wi.file_path.startswith("pdf:"):
        parts = wi.file_path.split(":", 2)
        if len(parts) == 3:
            lang = parts[1]
            filename = parts[2]
            return extract_title_from_pdf(filename, lang)
    if wi.file_path:
        name = Path(wi.file_path).name
    else:
        name = f"{wi.wi_number}.docx"
    name = re.sub(r"\.docx?$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\.pdf$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"_Hindi$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"_Marathi$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"^WI[_\- ]?\d+[_\s\-]*for[_\s]+", "", name, flags=re.IGNORECASE)
    name = re.sub(r"^WI[_\- ]?\d+[_\s\-]*", "", name, flags=re.IGNORECASE)
    name = name.replace("_", " ").replace("(", "").replace(")", "")
    name = re.sub(r"work instruction\s*for\s*", "", name, flags=re.IGNORECASE)
    name = re.sub(r"work instruction", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s+", " ", name).strip()
    if name:
        return name.capitalize()
    title = wi.title or wi.wi_number or "Untitled"
    title = re.sub(r"Operations?/Work/Job\s*Activity\s*covered\s*by\s*this\s*assessment\s*:\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s+", " ", title).strip()
    return title.capitalize() or wi.wi_number


def wi_to_dict(wi: WorkInstruction) -> dict:
    lang = "en"
    if wi.file_path and wi.file_path.startswith("pdf:"):
        parts = wi.file_path.split(":", 2)
        if len(parts) == 3:
            lang = parts[1]
    return {
        "id": wi.id,
        "wi_number": wi.wi_number,
        "title": clean_wi_title(wi),
        "revision": wi.revision,
        "department": wi.department,
        "activity": wi.activity,
        "file_path": wi.file_path,
        "scope": wi.scope,
        "applicability": wi.applicability,
        "customer": wi.customer,
        "component": wi.component,
        "ppe": wi.ppe,
        "tools_required": wi.tools_required,
        "consumables": wi.consumables,
        "prerequisites": wi.prerequisites,
        "pre_start_checks": wi.pre_start_checks,
        "machine_parameters": wi.machine_parameters,
        "procedure": wi.procedure,
        "inspection": wi.inspection,
        "quality_requirements": wi.quality_requirements,
        "acceptance_criteria": wi.acceptance_criteria,
        "shutdown_procedure": wi.shutdown_procedure,
        "safety_notes": wi.safety_notes,
        "supervisor_approval_required": wi.supervisor_approval_required,
        "qa_approval_required": wi.qa_approval_required,
        "is_archived": wi.is_archived,
        "is_latest": wi.is_latest,
        "language": lang,
    }


@router.get("")
def list_work_instructions(
    q: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    lang: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_and_populate_pdfs(db)

    query = db.query(WorkInstruction).filter(WorkInstruction.is_archived == False)
    if q:
        query = query.filter(
            (WorkInstruction.title.ilike(f"%{q}%"))
            | (WorkInstruction.wi_number.ilike(f"%{q}%"))
            | (WorkInstruction.procedure.ilike(f"%{q}%"))
        )
    if department:
        query = query.filter(WorkInstruction.department == department)
    if lang:
        pattern = f"pdf:{lang}:%"
        query = query.filter(WorkInstruction.file_path.like(pattern))
    wis = query.order_by(WorkInstruction.wi_number).all()
    return [wi_to_dict(wi) for wi in wis]


@router.get("/departments")
def list_departments(
    lang: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_and_populate_pdfs(db)
    return DEPARTMENTS


@router.get("/{wi_id}")
def get_work_instruction(
    wi_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan_and_populate_pdfs(db)
    wi = db.query(WorkInstruction).filter(WorkInstruction.id == wi_id).first()
    if not wi:
        raise HTTPException(status_code=404, detail="Work Instruction not found")

    sections = db.query(Section).filter(Section.work_instruction_id == wi.id).order_by(Section.order_index).all()

    # Log the view
    db.add(AuditLog(
        user_id=current_user.id,
        work_instruction_id=wi.id,
        action="VIEW_WI",
        detail=f"Viewed {wi.title} ({wi.wi_number})",
    ))
    db.commit()

    data = wi_to_dict(wi)
    data["sections"] = [
        {"heading": s.heading, "content": s.content, "order_index": s.order_index}
        for s in sections
    ]
    data["qr_code"] = work_instruction_qr(wi.id)
    return data


@router.get("/{wi_id}/sections")
def get_wi_sections(
    wi_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sections = db.query(Section).filter(Section.work_instruction_id == wi_id).order_by(Section.order_index).all()
    return [
        {"heading": s.heading, "content": s.content, "order_index": s.order_index}
        for s in sections
    ]


def _resolve_document_path(wi: WorkInstruction, lang: str = "en") -> Optional[Path]:
    """Resolve the absolute path to the source document for a work instruction."""
    pdf_path = resolve_pdf_path(wi.file_path, lang)
    if pdf_path:
        return pdf_path

    candidates = []
    if wi.file_path and not wi.file_path.startswith("pdf:"):
        candidates.append(Path(wi.file_path))
    if wi.wi_number:
        num = wi.wi_number.replace("WI", "").strip()
        for data_dir in FALLBACK_DATA_DIRS:
            if data_dir.exists():
                for f in data_dir.iterdir():
                    if f.suffix.lower() in (".docx", ".doc") and f.name.lower().startswith(f"wi_{num}"):
                        candidates.append(f)
    for path in candidates:
        if path.exists() and path.is_file():
            return path
    return None


@router.get("/{wi_id}/file")
def get_work_instruction_file(
    wi_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wi = db.query(WorkInstruction).filter(WorkInstruction.id == wi_id).first()
    if not wi:
        raise HTTPException(status_code=404, detail="Work Instruction not found")

    path = _resolve_document_path(wi)
    if not path:
        raise HTTPException(status_code=404, detail="Source document file not found")

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        media_type = "application/pdf"
    elif suffix == ".docx":
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        media_type = "application/msword"
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.get("/languages")
def list_supported_languages(current_user: User = Depends(get_current_user)):
    return [{"code": code, "label": label} for code, label in SUPPORTED_LANGUAGES.items()]


@router.get("/{wi_id}/pdf")
def get_work_instruction_pdf(
    wi_id: int,
    lang: str = Query("en"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a PDF for in-browser viewing. Serves pre-made PDFs from language folders, or converts docx."""
    wi = db.query(WorkInstruction).filter(WorkInstruction.id == wi_id).first()
    if not wi:
        raise HTTPException(status_code=404, detail="Work Instruction not found")

    pdf_path = resolve_pdf_path(wi.file_path, lang)
    if pdf_path:
        db.add(AuditLog(
            user_id=current_user.id,
            work_instruction_id=wi.id,
            action="VIEW_PDF",
            detail=f"Viewed PDF ({lang}) for {wi.wi_number}",
        ))
        db.commit()
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=pdf_path.name,
            headers={"Content-Disposition": "inline"},
        )

    path = _resolve_document_path(wi, lang)
    if not path:
        raise HTTPException(status_code=404, detail="Source document file not found in data folder")

    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"

    try:
        converted_pdf_path = docx_to_translated_pdf(path, lang, title=clean_wi_title(wi))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF conversion failed: {str(e)}")

    db.add(AuditLog(
        user_id=current_user.id,
        work_instruction_id=wi.id,
        action="VIEW_PDF",
        detail=f"Viewed PDF ({lang}) for {wi.wi_number}",
    ))
    db.commit()

    return FileResponse(
        converted_pdf_path,
        media_type="application/pdf",
        filename=f"{wi.wi_number}_{lang}.pdf",
        headers={"Content-Disposition": "inline"},
    )
