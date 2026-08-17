"""
migrate_notification_sender.py

Adds the `sender_id` column to the existing `notifications` table so admins
and supervisors can be attributed as the sender of a notification, which lets
the notifications page show read/unread status per recipient for messages
they sent.
"""

import sys
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import inspect, text
from backend.database import engine


def main():
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("notifications")]

    if "sender_id" in columns:
        print("Column 'sender_id' already exists on 'notifications'. Nothing to do.")
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE notifications ADD COLUMN sender_id INTEGER REFERENCES users(id)"))

    print("Added 'sender_id' column to 'notifications' table.")


if __name__ == "__main__":
    main()
