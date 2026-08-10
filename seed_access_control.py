import sys
sys.path.insert(0, '.')
from backend.database import Base, engine, SessionLocal
from backend.models import User
from backend.security import hash_password
from datetime import datetime, timedelta

# Drop and recreate
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print("Tables created with new schema")

# Seed users
users = [
    {"username": "admin", "email": "admin@company.com", "full_name": "System Administrator", "password": "admin123", "role": "admin", "department": "IT / Management"},
    {"username": "supervisor", "email": "supervisor@company.com", "full_name": "Production Supervisor", "password": "supervisor123", "role": "supervisor", "department": "Production"},
    {"username": "operator", "email": "operator@company.com", "full_name": "Blasting Operator", "password": "operator123", "role": "operator", "department": "Surface Engineering"},
]

db = SessionLocal()
for u in users:
    user = User(
        username=u["username"],
        email=u["email"],
        full_name=u["full_name"],
        hashed_password=hash_password(u["password"]),
        role=u["role"],
        department=u["department"],
        access_granted=(u["role"] == "admin"),
    )
    db.add(user)

db.commit()
print("Users seeded")
for u in db.query(User).all():
    print(f"  - {u.username}: role={u.role}, access_granted={u.access_granted}")
db.close()