"""
Convert Work Instruction .docx files to translated PDF for in-browser viewing.
Preserves images and tables from the original document.
"""

import hashlib
import re
import tempfile
from pathlib import Path
from typing import List, Optional, Tuple, Union

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn
from fpdf import FPDF
from deep_translator import GoogleTranslator

SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "mr": "Marathi",
}

CACHE_DIR = Path(__file__).resolve().parent / "data" / "pdf_cache"
FONT_DIR = Path(__file__).resolve().parent / "fonts"


def _ensure_cache_dir() -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR


def _cache_key(doc_path: Path, lang: str) -> str:
    stat = doc_path.stat()
    raw = f"{doc_path.resolve()}:{stat.st_mtime}:{stat.st_size}:{lang}"
    return hashlib.md5(raw.encode()).hexdigest()


def _get_font_path() -> Optional[Path]:
    """Locate a Unicode-capable font for multilingual PDF output."""
    candidates = [
        FONT_DIR / "DejaVuSans.ttf",
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/Nirmala.ttf"),
        Path("C:/Windows/Fonts/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/TTF/DejaVuSans.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def _sanitize_for_pdf(text: str) -> str:
    """Remove characters that break PDF rendering."""
    if not text:
        return ""
    text = text.replace("\x00", "")
    # Replace common problematic chars
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    return text


def translate_text(text: str, target_lang: str) -> str:
    """Translate text to target language. Returns original if lang is English."""
    if not text or not text.strip():
        return text
    if target_lang == "en":
        return text
    try:
        translator = GoogleTranslator(source="auto", target=target_lang)
        # Split long text into chunks (Google Translate limit ~5000 chars)
        if len(text) <= 4500:
            return translator.translate(text)
        chunks = []
        current = ""
        for line in text.split("\n"):
            if len(current) + len(line) + 1 > 4500:
                if current:
                    chunks.append(current)
                current = line
            else:
                current = f"{current}\n{line}" if current else line
        if current:
            chunks.append(current)
        return "\n".join(translator.translate(chunk) for chunk in chunks)
    except Exception:
        return text


def _extract_images_from_element(element, doc: Document) -> List[Tuple[bytes, str]]:
    """Extract images from an XML element by searching for all blip and imagedata references."""
    images = []
    
    # Search for a:blip elements (used in w:drawing)
    for blip in element.findall('.//' + qn('a:blip')):
        embed_id = blip.get(qn('r:embed'))
        link_id = blip.get(qn('r:link'))
        rel_id = embed_id or link_id
        if rel_id and rel_id in doc.part.related_parts:
            image_part = doc.part.related_parts[rel_id]
            content_type = getattr(image_part, 'content_type', '')
            ext = 'png'
            if 'jpeg' in content_type or 'jpg' in content_type:
                ext = 'jpg'
            elif 'gif' in content_type:
                ext = 'gif'
            elif 'bmp' in content_type:
                ext = 'bmp'
            elif 'wmf' in content_type:
                ext = 'wmf'
            images.append((image_part.blob, ext))
    
    # Search for v:imagedata elements (used in w:pict for legacy images)
    # Use the full VML namespace URI since 'v:' prefix may not be registered
    VML_NS = 'urn:schemas-microsoft-com:vml'
    for imagedata in element.findall(f'.//{{{VML_NS}}}imagedata'):
        rel_id = imagedata.get(qn('r:id'))
        if rel_id and rel_id in doc.part.related_parts:
            image_part = doc.part.related_parts[rel_id]
            content_type = getattr(image_part, 'content_type', '')
            ext = 'png'
            if 'jpeg' in content_type or 'jpg' in content_type:
                ext = 'jpg'
            elif 'gif' in content_type:
                ext = 'gif'
            elif 'bmp' in content_type:
                ext = 'bmp'
            elif 'wmf' in content_type:
                ext = 'wmf'
            images.append((image_part.blob, ext))
    
    return images


def _extract_images_from_paragraph(paragraph: Paragraph, doc: Document) -> List[Tuple[bytes, str]]:
    """Extract inline images from a paragraph. Returns list of (image_bytes, extension)."""
    images = []
    # Search the entire paragraph element, not just runs
    images.extend(_extract_images_from_element(paragraph._element, doc))
    return images


def _extract_images_from_table(table: Table, doc: Document) -> List[Tuple[bytes, str]]:
    """Extract images from table cells."""
    images = []
    # Search the entire table element for images
    images.extend(_extract_images_from_element(table._element, doc))
    return images


def _iter_block_items(parent):
    """Iterate through document body elements in order (paragraphs and tables)."""
    from docx.document import Document as _Document
    from docx.oxml.table import CT_Tbl
    from docx.oxml.text.paragraph import CT_P
    from docx.table import Table as _Table
    from docx.text.paragraph import Paragraph as _Paragraph

    if isinstance(parent, _Document):
        parent_elm = parent.element.body
    else:
        parent_elm = parent._element

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield _Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield _Table(child, parent)


def extract_docx_content(doc_path: Path) -> List[dict]:
    """
    Extract content from a .docx file preserving structure.
    Returns a list of content blocks:
      - {"type": "paragraph", "text": str, "images": [(bytes, ext), ...]}
      - {"type": "table", "rows": [[str, ...], ...], "images": [(bytes, ext), ...]}
    """
    doc = Document(str(doc_path))
    blocks = []

    for block in _iter_block_items(doc):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            images = _extract_images_from_paragraph(block, doc)
            if text or images:
                blocks.append({
                    "type": "paragraph",
                    "text": text,
                    "images": images,
                })
        elif isinstance(block, Table):
            rows = []
            for row in block.rows:
                cells = []
                for cell in row.cells:
                    cell_text = cell.text.strip()
                    cells.append(cell_text)
                rows.append(cells)
            images = _extract_images_from_table(block, doc)
            if rows:
                blocks.append({
                    "type": "table",
                    "rows": rows,
                    "images": images,
                })

    return blocks


def translate_blocks(blocks: List[dict], target_lang: str) -> List[dict]:
    """Translate text in content blocks while preserving images."""
    if target_lang == "en":
        return blocks

    translated = []
    for block in blocks:
        if block["type"] == "paragraph":
            translated.append({
                "type": "paragraph",
                "text": translate_text(block["text"], target_lang),
                "images": block["images"],
            })
        elif block["type"] == "table":
            translated_rows = []
            for row in block["rows"]:
                translated_rows.append([translate_text(cell, target_lang) for cell in row])
            translated.append({
                "type": "table",
                "rows": translated_rows,
                "images": block["images"],
            })
    return translated


class UnicodePDF(FPDF):
    def __init__(self):
        super().__init__()
        self.font_path = _get_font_path()
        if self.font_path:
            self.add_font("UnicodeFont", "", str(self.font_path))
            self.set_font("UnicodeFont", size=11)
        else:
            self.set_font("Helvetica", size=11)

    def _set_font_size(self, size: int = 11, style: str = ""):
        if self.font_path:
            # Use the same font for all styles since we only have one font file
            self.set_font("UnicodeFont", size=size)
        else:
            self.set_font("Helvetica", style=style, size=size)


def _render_image(pdf: UnicodePDF, image_data: Tuple[bytes, str], max_width: float = 170):
    """Render an image in the PDF, scaling to fit within max_width."""
    try:
        # Save image to temp file
        with tempfile.NamedTemporaryFile(suffix=f".{image_data[1]}", delete=False) as tmp:
            tmp.write(image_data[0])
            tmp_path = tmp.name

        # Get image dimensions
        pdf.image(tmp_path, x=10, w=max_width)
        pdf.ln(5)

        # Clean up temp file
        Path(tmp_path).unlink(missing_ok=True)
    except Exception:
        pass


def _render_table(pdf: UnicodePDF, rows: List[List[str]], max_width: float = 190):
    """Render a table with borders in the PDF."""
    if not rows:
        return

    # Calculate column widths
    num_cols = max(len(row) for row in rows)
    if num_cols == 0:
        return

    col_width = max_width / num_cols
    line_height = 6
    cell_padding = 2

    # Set smaller font for tables
    pdf._set_font_size(9)

    for row_idx, row in enumerate(rows):
        # Calculate row height based on content
        max_lines = 1
        for cell in row:
            cell_text = _sanitize_for_pdf(cell)
            # Estimate number of lines needed
            chars_per_line = max(int(col_width / 2.5), 10)
            lines = max(1, len(cell_text) // chars_per_line + 1)
            max_lines = max(max_lines, lines)

        row_height = max_lines * line_height + cell_padding * 2

        # Check if we need a new page
        if pdf.get_y() + row_height > pdf.page_break_trigger:
            pdf.add_page()
            pdf._set_font_size(9)

        # Draw row background for header
        if row_idx == 0:
            pdf.set_fill_color(230, 230, 230)

        # Draw cells
        x_start = pdf.get_x()
        y_start = pdf.get_y()

        for col_idx in range(num_cols):
            cell_text = _sanitize_for_pdf(row[col_idx]) if col_idx < len(row) else ""
            x = x_start + col_idx * col_width

            # Draw cell border
            pdf.rect(x, y_start, col_width, row_height)

            # Draw cell text
            pdf.set_xy(x + cell_padding, y_start + cell_padding)
            pdf.multi_cell(col_width - cell_padding * 2, line_height, cell_text)

        # Move to next row
        pdf.set_xy(x_start, y_start + row_height)

    # Reset font size
    pdf._set_font_size(11)
    pdf.ln(5)


def generate_pdf(blocks: List[dict], title: str, output_path: Path) -> Path:
    """Generate a PDF from content blocks, preserving images and tables."""
    pdf = UnicodePDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title
    pdf._set_font_size(16, "B")
    pdf.multi_cell(0, 10, _sanitize_for_pdf(title))
    pdf.ln(5)

    for block in blocks:
        if block["type"] == "paragraph":
            # Render images first (if any)
            for img in block.get("images", []):
                _render_image(pdf, img)

            # Render text
            text = _sanitize_for_pdf(block.get("text", ""))
            if text.strip():
                pdf._set_font_size(11)
                pdf.multi_cell(0, 6, text)
                pdf.ln(2)

        elif block["type"] == "table":
            # Render images from table (if any)
            for img in block.get("images", []):
                _render_image(pdf, img)

            # Render table
            _render_table(pdf, block.get("rows", []))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))
    return output_path


def docx_to_translated_pdf(doc_path: Path, lang: str, title: str = "") -> Path:
    """
    Convert a .docx file to a translated PDF.
    Preserves images and tables from the original document.
    Uses caching to avoid re-translating unchanged documents.
    """
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"

    cache_dir = _ensure_cache_dir()
    cache_file = cache_dir / f"{_cache_key(doc_path, lang)}.pdf"

    if cache_file.exists():
        return cache_file

    # Extract content preserving structure (paragraphs, tables, images)
    blocks = extract_docx_content(doc_path)

    # Translate text if needed
    translated_blocks = translate_blocks(blocks, lang)

    # Translate title if needed
    doc_title = title or doc_path.stem
    if lang != "en":
        doc_title = translate_text(doc_title, lang)

    generate_pdf(translated_blocks, doc_title, cache_file)
    return cache_file