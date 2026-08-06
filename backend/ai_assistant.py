"""
ai_assistant.py

RAG-powered AI assistant using local retrieval and optional OpenAI/Ollama.

- If an OpenAI API key is present, uses a GPT chat model with a retrieval
  chain over the knowledge base.
- If no API key is available, falls back to a deterministic retrieval-based
  answer that extracts the most relevant document snippets.

The assistant only answers from approved Work Instructions and always cites
the source document/section. If no relevant match is found, it returns the
standard "not available" message and never hallucinates.
"""

import os
from pathlib import Path
from typing import Dict, List, Optional
from dotenv import load_dotenv

import openai

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)

from backend.knowledge_base import semantic_search
from backend.decision_engine import decision_engine

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama2")
OLLAMA_API_BASE_URL = os.getenv("OLLAMA_API_BASE_URL", "http://localhost:11434")
OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "")

NOT_AVAILABLE_MSG = (
    "This information is not available in the approved instructions. "
    "Please contact your Supervisor."
)

SYSTEM_PROMPT = """You are an AI assistant for a Digital Work Instruction Management System.
You answer questions ONLY from the approved instructions provided in the context.

CRITICAL FORMATTING INSTRUCTIONS:
- You MUST ALWAYS structure your answer in clean, easy-to-read BULLETED POINTS or NUMBERED STEPS.
- KEEP YOUR ANSWER SHORT AND CONCISE. Use at most 5 bullet points.
- Each bullet must be brief (one short line or clause). Do not write long paragraphs.
- Use bold section headers (e.g., **Required PPE**, **Operating Steps**, **Inspection Criteria**).
- Format each item or procedure rule as a bullet point (`- ` or `• `).
- Answer strictly based on the provided context. Do not use outside knowledge.
- If the context does not contain the answer, respond exactly:
  "{not_available}"
- Always cite the source instruction title / WI number.

Context:
{context}

Question: {question}
Answer in structured bullet points:
"""


def _build_offline_answer(question: str, results: List, context: Dict) -> Dict:
    """Deterministic fallback answer from retrieved documents (no LLM)."""
    if not results:
        return {
            "answer": NOT_AVAILABLE_MSG,
            "sources": [],
            "mode": "offline",
        }

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
    lines = [line.strip() for line in snippet.splitlines() if line.strip()]

    # Format snippet lines as short structured bullet points (max 5, keep each brief)
    bullet_items = []
    for line in lines[:5]:
        text = line.lstrip("-*•123456789. ").strip()
        if len(text) > 120:
            text = text[:117].rstrip() + "..."
        bullet_items.append(f"• {text}")

    formatted_points = "\n".join(bullet_items)

    clean_title = meta.get("title", "the Work Instruction").replace("Work Instruction for", "").replace("Work Instruction", "").strip()

    answer = f"**Key Instructions for {clean_title} ({meta.get('wi_number', 'WI')}):**\n\n{formatted_points}"

    decision_hits = decision_engine.evaluate({**context, "query": question})
    if decision_hits:
        extra = "\n\n⚠️ **Decision Rule Alerts:**\n" + "\n".join(
            f"• {h['message']}" for h in decision_hits
        )
        answer += extra

    return {
        "answer": answer,
        "sources": [
            {
                "title": clean_title,
                "wi_number": meta.get("wi_number", ""),
                "section": meta.get("section", ""),
                "revision": meta.get("revision", ""),
            }
        ],
        "mode": "offline",
    }


def _format_context_results(results: List[dict]) -> str:
    formatted = []
    for doc in results:
        meta = doc.get("metadata", {}) or {}
        title = meta.get("title", "Instruction")
        wi_number = meta.get("wi_number", "")
        section = meta.get("section", "")
        snippet = doc.get("page_content", "").strip()
        header = f"{title} ({wi_number})"
        if section:
            header += f" - {section}"
        formatted.append(f"{header}\n{snippet}")
    return "\n\n".join(formatted)


def _build_openai_answer(question: str, results: List[dict], context: Dict) -> Dict:
    if not OPENAI_API_KEY:
        return _build_offline_answer(question, results, context)

    try:
        openai.api_key = OPENAI_API_KEY
        prompt = SYSTEM_PROMPT.format(
            not_available=NOT_AVAILABLE_MSG,
            context=_format_context_results(results),
            question=question,
        )
        response = openai.ChatCompletion.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant for an industrial document management system. Answer only from the provided context and cite sources when possible.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            max_tokens=700,
        )
        answer = response.choices[0].message["content"].strip()
    except Exception:
        return _build_offline_answer(question, results, context)

    sources = []
    for doc in results:
        meta = doc.get("metadata", {}) or {}
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


def get_llm_provider():
    return os.getenv("LLM_PROVIDER", "ollama").lower()

def get_ollama_model():
    return os.getenv("OLLAMA_MODEL", "llama2")

def get_ollama_base_url():
    return os.getenv("OLLAMA_API_BASE_URL", "http://localhost:11434").rstrip("/")


def _build_ollama_answer(question: str, results: List[dict], context: Dict) -> Dict:
    try:
        import requests
    except Exception:
        return _build_offline_answer(question, results, context)

    ollama_base = get_ollama_base_url()
    ollama_model = get_ollama_model()
    prompt = SYSTEM_PROMPT.format(
        not_available=NOT_AVAILABLE_MSG,
        context=_format_context_results(results),
        question=question,
    )

    headers = {"Content-Type": "application/json"}
    if os.getenv("OLLAMA_API_KEY"):
        headers["Authorization"] = f"Bearer {os.getenv('OLLAMA_API_KEY')}"

    answer = None
    # Method 1: Native Ollama /api/chat endpoint
    try:
        url = f"{ollama_base}/api/chat"
        payload = {
            "model": ollama_model,
            "messages": [
                {"role": "system", "content": "You are an AI assistant for an industrial document management system. Answer only from the provided context and cite sources when possible."},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "options": {"temperature": 0.0}
        }
        res = requests.post(url, json=payload, headers=headers, timeout=30)
        if res.status_code == 200:
            data = res.json()
            answer = data.get("message", {}).get("content", "").strip()
    except Exception as e:
        print(f"[ai_assistant] Ollama /api/chat attempt failed: {e}")

    # Method 2: OpenAI compatibility endpoint /v1/chat/completions
    if not answer:
        try:
            url = f"{ollama_base}/v1/chat/completions"
            payload = {
                "model": ollama_model,
                "messages": [
                    {"role": "system", "content": "You are an AI assistant for an industrial document management system. Answer only from the provided context and cite sources when possible."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0,
                "max_tokens": 700,
            }
            res = requests.post(url, json=payload, headers=headers, timeout=30)
            if res.status_code == 200:
                data = res.json()
                choice = data.get("choices", [{}])[0]
                answer = (choice.get("message", {}).get("content") or choice.get("text") or "").strip()
        except Exception as e:
            print(f"[ai_assistant] Ollama /v1/chat/completions attempt failed: {e}")

    if not answer:
        print("[ai_assistant] Ollama inference unavailable or unreachable. Falling back to offline RAG retrieval.")
        return _build_offline_answer(question, results, context)

    sources = []
    for doc in results:
        meta = doc.get("metadata", {}) or {}
        sources.append({
            "title": meta.get("title", ""),
            "wi_number": meta.get("wi_number", ""),
            "section": meta.get("section", ""),
            "revision": meta.get("revision", ""),
        })

    return {
        "answer": answer,
        "sources": sources,
        "mode": "ollama",
        "model": ollama_model,
    }


def _build_llm_answer(question: str, context: Dict) -> Dict:
    """Answer using an LLM if available; otherwise fallback offline."""
    results = semantic_search(question, k=6)
    provider = get_llm_provider()
    openai_key = os.getenv("OPENAI_API_KEY", "")

    if provider == "ollama":
        return _build_ollama_answer(question, results, context)
    if openai_key:
        return _build_openai_answer(question, results, context)
    return _build_offline_answer(question, results, context)


def ask_question(question: str, context: Optional[Dict] = None) -> Dict:
    """Entry point: answer a question using the RAG pipeline."""
    context = context or {}

    # Always do semantic search first regardless of mode
    results = semantic_search(question, k=6)
    provider = get_llm_provider()
    openai_key = os.getenv("OPENAI_API_KEY", "")

    if provider == "ollama" or openai_key:
        try:
            return _build_llm_answer(question, context)
        except Exception as e:
            print(f"[ai_assistant] LLM error, falling back to offline: {e}")
            return _build_offline_answer(question, results, context)
    return _build_offline_answer(question, results, context)
