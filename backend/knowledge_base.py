"""
knowledge_base.py

Builds and manages the RAG knowledge base using FAISS and local embeddings.

- Loads Work Instruction documents (split into sections/chunks).
- Creates embeddings with HuggingFace MiniLM.
- Stores vectors in a FAISS index with metadata.
- Provides semantic search for the RAG pipeline.
"""

import os
import re
from pathlib import Path
from typing import List, Optional, Dict
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

# Global vector store (built at startup / seed)
_vectorstore = None
_embedding_model = None
_documents: List[Dict] = []


def get_embedding_model():
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model

    # Imported lazily: sentence-transformers pulls in transformers/torch, a
    # multi-hundred-MB import graph that would otherwise load on every cold
    # start (including for requests that never touch the AI assistant, like
    # login) since this module is imported transitively from main.py.
    from sentence_transformers import SentenceTransformer

    try:
        _embedding_model = SentenceTransformer(OPENAI_EMBEDDING_MODEL)
    except Exception:
        _embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _embedding_model


def _chunk_text(text: str, chunk_size: int = 200, overlap: int = 40) -> List[str]:
    words = text.split()
    if len(words) <= chunk_size:
        return [text.strip()]

    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end == len(words):
            break
        start += chunk_size - overlap
    return chunks


def build_documents_from_parsed(parsed_instructions: List[dict]) -> List[dict]:
    documents: List[dict] = []

    for wi in parsed_instructions:
        base_meta = {
            "wi_number": wi.get("wi_number", ""),
            "title": wi.get("title", ""),
            "revision": wi.get("revision", "Rev 1"),
            "department": wi.get("department", ""),
            "file_path": wi.get("file_path", ""),
        }

        full_text = wi.get("raw_text", "")
        if full_text:
            documents.append({"page_content": full_text, "metadata": dict(base_meta)})

        for section in wi.get("sections", []):
            content = section.get("content", "").strip()
            if not content:
                continue
            meta = dict(base_meta)
            meta["section"] = section.get("heading", "").replace("_", " ").title()
            for chunk in _chunk_text(content):
                documents.append({"page_content": chunk, "metadata": meta})

    return documents


def build_vectorstore(documents: List[dict]):
    global _vectorstore, _documents
    _documents = documents
    if not documents:
        _vectorstore = None
        return None

    import faiss
    import numpy as np

    embedding_model = get_embedding_model()
    texts = [doc["page_content"] for doc in documents]
    embeddings = embedding_model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    embeddings = np.asarray(embeddings, dtype=np.float32)

    dimension = embeddings.shape[1]
    _vectorstore = faiss.IndexFlatL2(dimension)
    _vectorstore.add(embeddings)
    return _vectorstore


def semantic_search(query: str, k: int = 5) -> List[dict]:
    if _vectorstore is None or not _documents:
        return []
    import numpy as np

    embedding_model = get_embedding_model()
    query_embedding = embedding_model.encode([query], convert_to_numpy=True, show_progress_bar=False).astype(np.float32)
    distances, indices = _vectorstore.search(query_embedding, min(k, len(_documents)))
    results = []
    for idx in indices[0]:
        if idx < 0 or idx >= len(_documents):
            continue
        results.append(_documents[idx])
    return results


def get_retriever(k: int = 5):
    class Retriever:
        def __init__(self, k):
            self.k = k

        def get_relevant_documents(self, query: str):
            return semantic_search(query, k=self.k)

    return Retriever(k)


def get_vectorstore():
    return _vectorstore


def _clean_title_title(title: str) -> str:
    title = title or ""
    title = re.sub(
        r"(?:Operations?/Work/Job\s*Activity\s*covered\s*by\s*this\s*assessment\s*:\s*)+",
        "",
        title,
        flags=re.IGNORECASE,
    ).strip()
    title = re.sub(r"\|+", "|", title)
    title = re.sub(r"\s*\|\s*", " | ", title).strip()
    parts = [part.strip() for part in title.split("|") if part.strip()]
    cleaned = []
    for part in parts:
        if part.lower() not in [c.lower() for c in cleaned]:
            cleaned.append(part)
    return cleaned[0] if cleaned else title


def _clean_combined_text(text: str) -> str:
    text = text or ""
    text = re.sub(
        r"(?:Operations?/Work/Job\s*Activity\s*covered\s*by\s*this\s*assessment\s*:\s*)+",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\s*\|\s*", " | ", text)
    cleaned_lines = []
    seen = set()
    for line in text.splitlines():
        normalized = re.sub(r"\s+", " ", line).strip().lower()
        if normalized and normalized not in seen:
            seen.add(normalized)
            cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def load_from_db():
    global _vectorstore, _documents
    if _vectorstore is not None:
        return _vectorstore

    from backend.database import SessionLocal
    from backend.models import WorkInstruction, Section

    db = SessionLocal()
    try:
        wis = db.query(WorkInstruction).filter(WorkInstruction.is_archived == False).all()
        docs: List[dict] = []
        for wi in wis:
            cleaned_title = _clean_title_title(wi.title)
            base_meta = {
                "wi_number": wi.wi_number,
                "title": cleaned_title,
                "revision": wi.revision,
                "department": wi.department or "",
                "file_path": wi.file_path or "",
            }
            # Short summary doc (title/scope/ppe) — cheap to match on general
            # "what is this WI about" style questions.
            summary = _clean_combined_text(f"{cleaned_title}\n{wi.scope or ''}\n{wi.ppe or ''}")
            docs.append({"page_content": summary, "metadata": dict(base_meta)})

            # The full extracted document body (from PDF text extraction, or
            # the docx-parsed procedure text) is often long, so it must be
            # chunked -- otherwise it gets truncated by the embedding model's
            # input length and most of the document becomes unsearchable.
            if wi.procedure:
                for chunk in _chunk_text(wi.procedure):
                    docs.append({"page_content": chunk, "metadata": dict(base_meta)})

            for sec in wi.sections:
                meta = dict(base_meta)
                meta["section"] = sec.heading.replace("_", " ").title()
                for chunk in _chunk_text(sec.content):
                    docs.append({"page_content": chunk, "metadata": meta})
        if docs:
            _documents = docs
            build_vectorstore(docs)
            print(f"[knowledge_base] Loaded {len(docs)} chunks from DB.")
        else:
            print("[knowledge_base] No documents found in DB to load.")
    finally:
        db.close()
    return _vectorstore
