import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = BASE_DIR / "wi_system.db"

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{DEFAULT_DB_PATH}"
elif DATABASE_URL.startswith("sqlite:///"):
    sqlite_path = Path(DATABASE_URL.replace("sqlite:///", "", 1))
    if not sqlite_path.is_absolute():
        sqlite_path = (BASE_DIR / sqlite_path).resolve()
    DATABASE_URL = f"sqlite:///{sqlite_path}"

# Configure engine for SQLite (check_same_thread) or PostgreSQL
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # Remote Postgres (e.g. Neon serverless): fast-connect settings.
    # - connect_timeout=5: fail fast instead of hanging the login request
    #   for 30s+ when the DB is waking up.
    # - keepalives_*: detect dead connections quickly so requests don't
    #   stall on a half-open socket after Neon suspends idle compute.
    connect_args = {
        "connect_timeout": 5,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 3,
        "application_name": "wi-backend",
    }

# Pool strategy:
# - SQLite (local dev): default QueuePool is fine.
# - Remote Postgres on serverless (Vercel): every invocation may be a fresh
#   process, so a persistent QueuePool just holds stale sockets that need a
#   pool_pre_ping round-trip on EVERY checkout (doubling login latency: one
#   extra SELECT 1 before the real query). NullPool opens a fresh connection
#   per checkout with no ping overhead, which is faster and safer here.
_pool_kwargs = {}
if not DATABASE_URL.startswith("sqlite"):
    from sqlalchemy.pool import NullPool
    _pool_kwargs = {"poolclass": NullPool, "pool_pre_ping": False}
else:
    _pool_kwargs = {"pool_pre_ping": True}

# pool_pre_ping avoids surfacing errors from stale/dropped connections (e.g.
# after Neon suspends an idle serverless Postgres compute) by testing the
# connection with a lightweight ping before handing it out, transparently
# reconnecting instead of failing the request.
# NOTE: only enabled for local SQLite above; serverless Postgres uses
# NullPool (fresh connection each time) so no ping round-trip is needed.
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_recycle=300,
    **_pool_kwargs,
)
print(f"[database] DATABASE_URL={DATABASE_URL}")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
