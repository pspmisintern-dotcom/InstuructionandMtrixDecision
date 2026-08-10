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

SYSTEM_PROMPT = """You are an AI assistant for a Digital Work Instruction Management System used on a factory floor by operators, supervisors, and quality inspectors.
You answer questions ONLY from the approved work instructions provided in the context. NEVER invent information.

GOAL: Provide THOROUGH, DETAILED, COMPLETE answers. Do not summarise or skip steps. Factory workers need every detail so they can follow procedures safely and correctly.

FORMATTING INSTRUCTIONS (ALWAYS FOLLOW):
1. Start with a short **one-line Overview** sentence that summarises the answer.
2. Then structure the rest into clear sections with BOLD section headers on their own line (e.g., **Required Personal Protective Equipment (PPE)**, **Step-by-Step Operating Procedure**, **Machine Parameters**, **Shutdown Procedure**, **Quality & Acceptance Criteria**, **Safety Notes / Corrective Actions**, **References**).
3. Under each header, use numbered steps (1. 2. 3.) for sequential workflows (procedure, checklist, shutdown), or bullet points (- ) for lists (PPE, tools, parameters).
4. FOR EACH ITEM / STEP: be specific and explanatory. Mention values, quantities, tolerances, durations, distances, temperatures, pressures, and reasons why when available in the context. Do NOT just list the name — give details.
   Example (good): `- **Safety Shoes with Steel Toe Cap (EN ISO 20345 S3)** — Mandatory when handling heavy components and walking on floors with sharp metal debris to prevent crush and puncture injuries.`
5. Quote numbers and exact values from the context whenever possible (e.g., "Maintain spray distance **180–220 mm**", "Temperature **90 °C**, hold for **30 minutes**").
6. Include every relevant item you find in the context; do not prune or shorten. If the context lists 12 PPE items, include all 12.
7. If the context has multiple similar documents (e.g., HVOF + Plasma Spray + TWAS), answer for each applicable process separately with sub-headers.
8. Always end with a **References / Source WIs** section that lists the WI numbers and document titles you used.
9. Answer strictly from the context. If the context does not contain the answer, respond EXACTLY with:
   "{not_available}"

Context:
{context}

Question: {question}
Detailed, structured answer:
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
            if len(word) >= 3 and word in text:
                s += 1
        return s

    ranked = sorted(results, key=score, reverse=True)
    best = ranked[0]
    meta = best.get("metadata", {}) or {}

    snippet = best.get("page_content", "").strip()
    raw_lines = [line.strip() for line in snippet.splitlines() if line.strip()]

    clean_title = meta.get("title", "the Work Instruction").replace("Work Instruction for", "").replace("Work Instruction", "").strip()
    wi_number = meta.get("wi_number", "WI")
    section = meta.get("section", "")

    overview = f"**Overview:** Answer drawn from approved Work Instruction **{clean_title}** ({wi_number}){f' - Section: {section}' if section else ''}."

    formatted_lines = []
    i = 0
    numbered_count = 1
    for line in raw_lines[:30]:
        stripped = line.lstrip("-*• \t")
        stripped = stripped.lstrip("0123456789. ")
        stripped = stripped.strip()
        if not stripped:
            continue

        # Detect likely section headers (short, all caps or Title Case, no long sentence structure)
        is_header = (
            (len(stripped) < 80 and (stripped.upper() == stripped or stripped.istitle())) and
            not any(ch.isdigit() for ch in stripped[:5]) and
            not any(ch in ".,;:" for ch in stripped[-3:])
        )
        if len(stripped) < 60 and stripped.endswith(":"):
            is_header = True

        if is_header:
            formatted_lines.append(f"\n**{stripped.rstrip(':')}:**")
            numbered_count = 1
        else:
            # Keep the line long & detailed (no truncation)
            bullet_mark = "-"
            # If line looks like it's part of a procedure, number it
            if any(k in q_lower for k in ["procedure", "step", "checklist", "shutdown", "startup", "prestart"]) or \
               any(k in stripped.lower()[:12] for k in ["step", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "first", "next", "then", "after", "finally"]):
                bullet_mark = f"{numbered_count}."
                numbered_count += 1
            formatted_lines.append(f" {bullet_mark} {stripped}")
        i += 1

    # If only a few lines were produced, pull in more results
    if len(formatted_lines) < 8:
        for extra_doc in ranked[1:3]:
            extra_meta = extra_doc.get("metadata", {}) or {}
            extra_snippet = extra_doc.get("page_content", "").strip()
            extra_lines = [l.strip() for l in extra_snippet.splitlines() if l.strip()]
            if not extra_lines:
                continue
            extra_title = extra_meta.get("title", "Work Instruction").replace("Work Instruction for", "").replace("Work Instruction", "").strip()
            extra_wi = extra_meta.get("wi_number", "WI")
            formatted_lines.append(f"\n**Additional Reference — {extra_title} ({extra_wi}):**")
            for line in extra_lines[:10]:
                stripped = line.lstrip("-*• \t0123456789.").strip()
                if stripped:
                    formatted_lines.append(f" - {stripped}")

    body = "\n".join(formatted_lines)

    decision_hits = decision_engine.evaluate({**context, "query": question})
    if decision_hits:
        body += "\n\n⚠️ **Decision Rule Alerts (from system):**\n" + "\n".join(
            f" - **{h.get('severity', 'WARNING').upper()}:** {h['message']}" for h in decision_hits
        )

    # Add References / Source WIs section
    source_entries = []
    for doc in ranked[:4]:
        m = doc.get("metadata", {}) or {}
        stitle = m.get("title", "Work Instruction").replace("Work Instruction for", "").replace("Work Instruction", "").strip()
        swi = m.get("wi_number", "WI")
        ssec = m.get("section", "")
        rev = m.get("revision", "")
        label = f"{swi} · {stitle}"
        if ssec:
            label += f" — Section: {ssec}"
        if rev:
            label += f" ({rev})"
        if label not in source_entries:
            source_entries.append(label)
    if source_entries:
        body += "\n\n**References / Source WIs:**\n" + "\n".join(f" • {e}" for e in source_entries)

    answer = f"{overview}\n\n{body}"

    # Compile sources list
    all_sources = []
    for doc in ranked:
        m = doc.get("metadata", {}) or {}
        stitle = m.get("title", "").replace("Work Instruction for", "").replace("Work Instruction", "").strip()
        entry = {
            "title": stitle,
            "wi_number": m.get("wi_number", ""),
            "section": m.get("section", ""),
            "revision": m.get("revision", ""),
        }
        if not any(x["wi_number"] == entry["wi_number"] and x["section"] == entry["section"] for x in all_sources):
            all_sources.append(entry)

    return {
        "answer": answer,
        "sources": all_sources,
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
