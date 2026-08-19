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
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import text as sql_text

from backend.database import Base, engine, SessionLocal
from backend.ip_validator import is_ip_allowed, get_client_ip_from_request, format_ip_ranges_for_display
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
    print("[main] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("[main] Database tables ready.")

    print("[main] Skipping RAG knowledge-base loading during startup.")

    yield

    print("[main] Application shutting down.")

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

# Paths that must remain reachable even from outside the factory network
# (health checks, CORS preflight, the root status endpoint, and the
# keep-warm cron ping which runs from Vercel's infrastructure, not the
# factory network).
_NETWORK_GATE_EXEMPT_PATHS = {"/", "/health", "/health-db"}


@app.middleware("http")
async def factory_network_gate(request: Request, call_next):
    """Enforce factory-WiFi-only access on every request, not just at login.
    A token obtained on-site should stop working once the device leaves the
    allowed IP range(s) configured via FACTORY_NETWORK_ONLY/ALLOWED_IP_RANGES
    in backend/.env."""
    if request.method == "OPTIONS" or request.url.path in _NETWORK_GATE_EXEMPT_PATHS:
        return await call_next(request)

    client_ip = get_client_ip_from_request(request)
    if not is_ip_allowed(client_ip):
        return JSONResponse(
            status_code=403,
            content={
                "detail": (
                    "Access denied: this application is only accessible from the "
                    f"factory network. Allowed ranges: {format_ip_ranges_for_display()}"
                )
            },
        )
    return await call_next(request)


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


@app.get("/health-db")
def health_db():
    """Lightweight DB ping used by a scheduled cron (see vercel.json) to keep
    Neon's serverless compute from auto-suspending. Neon's default idle
    timeout is a few minutes; once suspended, the next real request (e.g. a
    user login) pays a multi-second wake-up penalty. Pinging this endpoint
    every few minutes keeps the compute warm so logins stay fast."""
    db = SessionLocal()
    try:
        db.execute(sql_text("SELECT 1"))
        return {"status": "OK", "db": "warm"}
    except Exception as e:
        return {"status": "ERROR", "db": str(e)}
    finally:
        db.close()
