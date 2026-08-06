import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)

from backend.database import Base, engine, SessionLocal
from backend.knowledge_base import load_from_db
from backend.routes import (
    auth_routes,
    dashboard_routes,
    workinstruction_routes,
    ai_routes,
    decision_routes,
    document_routes,
    user_routes,
    checklist_routes,
    inspection_routes,
    audit_routes,
    report_routes,
    notification_routes,
)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")


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
    title="AI-Powered Digital Work Instruction Management System",
    description="RAG-powered work instruction management with decision matrix and LangGraph workflow.",
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

# Register routers
app.include_router(auth_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(workinstruction_routes.router)
app.include_router(ai_routes.router)
app.include_router(decision_routes.router)
app.include_router(document_routes.router)
app.include_router(user_routes.router)
app.include_router(checklist_routes.router)
app.include_router(inspection_routes.router)
app.include_router(audit_routes.router)
app.include_router(report_routes.router)
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
