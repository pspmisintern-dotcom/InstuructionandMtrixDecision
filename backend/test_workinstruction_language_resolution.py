from pathlib import Path

from backend.routes.workinstruction_routes import resolve_pdf_path


def test_resolve_pdf_path_uses_matching_wi_number_for_translated_files():
    english_path = "pdf:en:WI_01_Inward.pdf"
    hi_path = resolve_pdf_path(english_path, "hi")
    mr_path = resolve_pdf_path(english_path, "mr")
    or_path = resolve_pdf_path(english_path, "or")

    assert hi_path is not None
    assert hi_path.name.lower().endswith("hindi.pdf")
    assert mr_path is not None
    assert "mr" in mr_path.name.lower() or "marathi" in mr_path.name.lower()
    assert or_path is not None
    assert "or" in or_path.name.lower() or "odia" in or_path.name.lower()
