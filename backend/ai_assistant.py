"""
ai_assistant.py

RAG-powered AI assistant using LangChain.

- If an OpenAI API key is present, uses a GPT chat model with a retrieval
  chain over the knowledge base.
- If no API key, falls back to a deterministic retrieval-based answer that
  extracts the most relevant document snippets.

The assistant only answers from approved Work Instructions and always cites
the source document/section. If no relevant match is found, it returns the
standard "not available" message and never hallucinates.
"""

import os
from pathlib import Path
from typing import Dict, List, Optional
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)

from backend.knowledge_base import semantic_search, get_retriever
from backend.decision_engine import decision_engine

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

NOT_AVAILABLE_MSG = (
    "This information is not available in the approved Work Instructions. "
    "Please contact your Supervisor."
)

SYSTEM_PROMPT = """You are an AI assistant for a Digital Work Instruction Management System.
You answer questions ONLY from the approved Work Instructions provided in the context.
Rules:
- Answer strictly based on the provided context. Do not use outside knowledge.
- If the context does not contain the answer, respond exactly:
  "{not_available}"
- Always cite the source Work Instruction (title / WI number) and section.
- Be concise, clear, and safety-focused.
- Provide step-by-step instructions when relevant.

Context:
{context}

Question: {question}
Answer:
"""


def _build_offline_answer(question: str, results: List, context: Dict) -> Dict:
    """Deterministic fallback answer from retrieved documents (no LLM)."""
    if not results:
        return {
            "answer": NOT_AVAILABLE_MSG,
            "sources": [],
            "mode": "offline",
        }

    # Rank results by simple keyword overlap
    q_lower = question.lower()

    def score(doc):
        text = doc.get("page_content", "").lower()
        s = 0
        for word in q_lower.split():
            if word in text:
                s += 1
        return s

    ranked = sorted(results, key=score, reverse=True)
    best = ranked[0]
    meta = best.get("metadata", {}) or {}

    snippet = best.get("page_content", "").strip()
    if len(snippet) > 900:
        snippet = snippet[:900] + "..."

    answer = "Based on {title} ({wi_number}):\n\n{snippet}".format(
        title=meta.get("title", "the Work Instruction"),
        wi_number=meta.get("wi_number", "WI"),
        snippet=snippet,
    )

    decision_hits = decision_engine.evaluate({**context, "query": question})
    if decision_hits:
        extra = "\n\n\u26a0 Decision Alert:\n" + "\n".join(
            f"- {h['message']}" for h in decision_hits
        )
        answer += extra

    return {
        "answer": answer,
        "sources": [
            {
                "title": meta.get("title", ""),
                "wi_number": meta.get("wi_number", ""),
                "section": meta.get("section", ""),
                "revision": meta.get("revision", ""),
            }
        ],
        "mode": "offline",
    }


def _build_llm_answer(question: str, context: Dict) -> Dict:
    """Answer using OpenAI GPT if available; otherwise fallback offline."""
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.prompts import PromptTemplate
        from langchain.chains import RetrievalQA
    except Exception:
        return _build_offline_answer(question, semantic_search(question, k=6), context)

    retriever = get_retriever(k=5)
    if retriever is None:
        return _build_offline_answer(question, [], context)

    try:
        llm = ChatOpenAI(model=OPENAI_MODEL, temperature=0, openai_api_key=OPENAI_API_KEY)
        prompt = PromptTemplate(
            template=SYSTEM_PROMPT.format(not_available=NOT_AVAILABLE_MSG),
            input_variables=["context", "question"],
        )
        qa = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True,
            chain_type_kwargs={"prompt": prompt},
        )
        result = qa.invoke({"query": question})
        answer = result.get("result", NOT_AVAILABLE_MSG)

        sources = []
        for doc in result.get("source_documents", []):
            meta = doc.metadata or {}
            sources.append({
                "title": meta.get("title", ""),
                "wi_number": meta.get("wi_number", ""),
                "section": meta.get("section", ""),
                "revision": meta.get("revision", ""),
            })

        return {
            "answer": answer,
            "sources": sources,
            "mode": "openai",
        }
    except Exception:
        return _build_offline_answer(question, semantic_search(question, k=6), context)


def ask_question(question: str, context: Optional[Dict] = None) -> Dict:
    """Entry point: answer a question using the RAG pipeline."""
    context = context or {}

    # Always do semantic search first regardless of mode
    results = semantic_search(question, k=6)

    if OPENAI_API_KEY:
        try:
            return _build_llm_answer(question, context)
        except Exception as e:
            print(f"[ai_assistant] LLM error, falling back to offline: {e}")
            return _build_offline_answer(question, results, context)
    else:
        return _build_offline_answer(question, results, context)
