# AI-Powered Digital Work Instruction Management System

An enterprise-grade web application that digitizes manufacturing Work Instructions (WI), replacing paper/PDF documents with an interactive workflow, RAG-powered AI assistant, decision matrix engine, digital checklists, QR code access, revision control, role-based access, audit trails, and reports.

## Tech Stack

- **Frontend:** Next.js (React), Tailwind CSS, Material UI
- **Backend:** Python FastAPI
- **AI/RAG:** LangChain, LangGraph, OpenAI GPT + embeddings (with offline fallback)
- **Vector Store:** FAISS (with optional OpenAI embeddings)
- **Database:** SQLite (default) / PostgreSQL (configurable)
- **Auth:** JWT
- **Deployment:** Docker

## Features

1. **Dashboard** — Today's jobs, operators, pending approvals, most-viewed WIs, recent AI questions, notifications.
2. **Digital Work Instructions** — Interactive step-by-step digital SOPs with PPE gating.
3. **AI Assistant** — RAG chatbot that answers ONLY from approved Work Instructions, always cites sources, never hallucinates.
4. **Decision Matrix Engine** — Configurable IF/THEN rules (humidity, coating thickness, surface roughness, torch ignition, component damage, pressure, moisture, PPE).
5. **Document Management** — Upload `.docx`, revision control, archive obsolete revisions.
6. **User Management** — Admin / Supervisor / Operator roles.
7. **Digital Checklists** — PPE, Machine, Process, Inspection checklists.
8. **Inspection Module** — Submit inspections, supervisor/QA approvals.
9. **Audit Logs** — Complete operator activity trail.
10. **Reports & Analytics** — Compliance, PPE, training, inspection, AI usage, FAQ, WI usage, revision history, audit trail.
11. **QR Code Access** — Generate QR per machine / WI / component.
12. **Notifications** — Safety and quality alerts.
13. **Dark Mode** — Responsive, modern industrial theme.

## Getting Started

### Option A: Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs

### Option B: Local Development

#### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python seed.py   # Loads the .docx work instructions into DB + knowledge base
cd ..
uvicorn backend.main:app --reload
```

> If you prefer to run from the project root, use `uvicorn backend.main:app --reload`.

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000 and proxies `/api` to the backend.

## Demo Users

| Role       | Username   | Password       |
|------------|------------|----------------|
| Admin      | admin      | admin123       |
| Supervisor | supervisor | supervisor123 |
| Operator   | operator   | operator123    |

## Environment Variables

Create `backend/.env` (see `backend/.env.example`):

| Variable                  | Description                                        |
|---------------------------|----------------------------------------------------|
| `SECRET_KEY`              | JWT signing secret (change in production)          |
| `DATABASE_URL`            | SQLite or PostgreSQL URL                           |
| `OPENAI_API_KEY`          | OpenAI key for GPT RAG (optional)                  |
| `OPENAI_MODEL`            | GPT model name                                     |
| `OPENAI_EMBEDDING_MODEL`  | Embedding model                                    |
| `WI_DOCUMENTS_DIR`        | Directory containing the `.docx` work instructions |
| `CORS_ORIGINS`            | Comma-separated allowed origins                    |

## AI Assistant Behavior

- **With `OPENAI_API_KEY`:** Uses GPT with a LangChain retrieval chain over the FAISS knowledge base (semantic search first, then LLM answer).
- **With `LLM_PROVIDER=ollama`:** Uses an Ollama model via LangChain community support, if installed and available.
- **Without an LLM provider or valid key/server:** Uses an offline deterministic retrieval answer with keyword ranking + HuggingFace MiniLM embeddings for semantic search.
- The assistant is constrained to only answer from approved Work Instructions. If no match is found, it returns:
  > "This information is not available in the approved Work Instructions. Please contact your Supervisor."
- Answers always cite the source Work Instruction and section.

## Document Parsing

The system parses the provided `.docx` Work Instructions into structured fields:
- Title, WI number, Revision, Department, Scope, PPE, Pre-start checks, Machine parameters, Operating procedure, Inspection, Quality requirements, Shutdown procedure, etc.

Each document is split into chunks, embedded, and stored in FAISS with metadata (Document, Revision, Department, Machine, Component, Process, PPE, Inspection, Parameters).

## License

Proprietary / internal use.
