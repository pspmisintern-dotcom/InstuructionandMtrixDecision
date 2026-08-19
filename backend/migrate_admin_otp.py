"""
migrate_admin_otp.py

Adds the `otp_code_hash`, `otp_expires_at`, and `otp_attempts` columns to the
existing `users` table so admin login can require a one-time email code as a
second authentication factor (see backend/routes/auth_routes.py).
"""

import sys
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import inspect, text
from backend.database import engine

NEW_COLUMNS = {
    "otp_code_hash": "VARCHAR(300)",
    "otp_expires_at": "TIMESTAMP",
    "otp_attempts": "INTEGER DEFAULT 0",
}


def main():
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("users")]

    with engine.begin() as conn:
        for name, coltype in NEW_COLUMNS.items():
            if name in columns:
                print(f"Column '{name}' already exists on 'users'. Skipping.")
                continue
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {coltype}"))
            print(f"Added '{name}' column to 'users' table.")


if __name__ == "__main__":
    main()
