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
    # NOTE: don't run Base.metadata.create_all() on every serverless cold
    # start — on Postgres it issues dozens of round-trips (has_table checks
    # per model + CREATE TABLE IF NOT EXISTS), which used to add seconds to
    # the first request after idle (e.g. login). Tables are created by
    # migrations/seed; only run the DDL for local SQLite dev, which is free.
    if engine.url.get_backend_name() == "sqlite":
        print("[main] Creating database tables (sqlite)...")
        Base.metadata.create_all(bind=engine)
        print("[main] Database tables ready.")
    else:
        print("[main] Skipping DDL on serverless Postgres (tables pre-created).")
        _ensure_performance_indexes()

    print("[main] Skipping RAG knowledge-base loading during startup.")

    yield

    print("[main] Application shutting down.")


def _ensure_performance_indexes():
    """Create the small set of speed-critical indexes with CONCURRENTLY-free
    CREATE INDEX IF NOT EXISTS (no-op when they already exist).

    Needed because lifespan no longer runs create_all() on Postgres, so the
    new Index() entries in models.py would otherwise never materialize in
    production. Each statement is a single cheap catalog check when the
    index exists — far cheaper than create_all()'s per-table round-trips.
    Runs in a short-lived connection with a tight timeout so a slow DB
    never blocks a cold start for long."""
    statements = [
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_timestamp ON audit_logs (timestamp)",
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_timestamp_desc ON audit_logs (timestamp DESC)",
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_action_timestamp ON audit_logs (action, timestamp DESC)",
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_read_created ON notifications (user_id, is_read, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_is_read ON notifications (is_read)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications (created_at)",
        "CREATE INDEX IF NOT EXISTS ix_wi_archived_dept ON work_instructions (is_archived, department)",
        "CREATE INDEX IF NOT EXISTS ix_wi_is_archived ON work_instructions (is_archived)",
        "CREATE INDEX IF NOT EXISTS ix_wi_department ON work_instructions (department)",
        "CREATE INDEX IF NOT EXISTS ix_wi_is_latest ON work_instructions (is_latest)",
    ]
    db = SessionLocal()
    try:
        # Single transaction for all statements: when indexes already exist
        # each is just a cheap catalog lookup, and one COMMIT keeps the
        # cold-start cost to ~1 round-trip batch instead of 12.
        try:
            for stmt in statements:
                db.execute(sql_text(stmt))
            db.commit()
        except Exception as e:
            print(f"[main] performance-index check skipped: {e}")
            try:
                db.rollback()
            except Exception:
                pass
        else:
            print("[main] Performance indexes ensured.")
    finally:
        db.close()

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
