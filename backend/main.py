import os
import sys
from pathlib import Path

# Ensure the project root is on sys.path so that the `backend` package is
# importable regardless of the working directory or how uvicorn is launched.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import Base, engine, SessionLocal
from backend.knowledge_base import load_from_db
from backend.routes import (
    auth_routes,
    dashboard_routes,
    workinstruction_routes,
    ai_routes,
    user_routes,
    checklist_routes,
    audit_routes,
    notification_routes,
)


load_dotenv()

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000"
    ).split(",")
    if origin.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    Base.metadata.create_all(bind=engine)
    # Load the RAG knowledge base from the database
    try:
        load_from_db()
    except Exception as e:
        print(f"[main] Knowledge base load failed: {e}")
    yield

app = FastAPI(
    title="Digital Work Instruction Management System",
    description="RAG-powered work instruction management with multilingual PDF viewing.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(workinstruction_routes.router)
app.include_router(ai_routes.router)
app.include_router(user_routes.router)
app.include_router(checklist_routes.router)
app.include_router(audit_routes.router)
app.include_router(notification_routes.router)


@app.get("/")
def root():
    return {
        "app": "AI-Powered Digital Work Instruction Management System",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "OK"}