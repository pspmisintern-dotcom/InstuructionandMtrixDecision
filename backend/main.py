import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Ensure the project root is on sys.path so package imports like
# `from backend.database import ...` work regardless of the current working directory.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)

from backend.database import Base, engine, SessionLocal

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
app.include_router(auth_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(workinstruction_routes.router)
app.include_router(ai_routes.router)
app.include_router(user_routes.router)
app.include_router(checklist_routes.router)
app.include_router(audit_routes.router)
app.include_router(notification_routes.router)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        print("[main] Database tables ready")
    except Exception as e:
        print(f"[main] Database initialization failed: {e}")

    # DO NOT load the RAG knowledge base here
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

# Register routers
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
