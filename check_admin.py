import sys
sys.path.insert(0, '.')

from backend.database import SessionLocal
from backend.models import User
from backend.security import hash_password, verify_password

db = SessionLocal()

# Check if admin exists
admin = db.query(User).filter(User.username == 'admin').first()

if admin:
    print("✓ Admin user found in database")
    print(f"  ID: {admin.id}")
    print(f"  Username: {admin.username}")
    print(f"  Full Name: {admin.full_name}")
    print(f"  Email: {admin.email}")
    print(f"  Role: {admin.role}")
    print(f"  Is Active: {admin.is_active}")
    print(f"  Access Granted: {admin.access_granted}")
    print(f"  Hash (first 50 chars): {admin.hashed_password[:50]}")
    print()
    
    # Test password
    test_pwd = "Admin@1234"
    is_correct = verify_password(test_pwd, admin.hashed_password)
    print(f"  Testing password '{test_pwd}': {is_correct}")
    
    if not is_correct:
        print()
        print("Password doesn't match! Resetting to Admin@1234...")
        admin.hashed_password = hash_password("Admin@1234")
        db.commit()
        print("✓ Password reset successfully")
else:
    print("✗ Admin user NOT found in database!")
    print("Creating admin user...")
    
    from datetime import datetime
    admin = User(
        username="admin",
        email="admin@company.com",
        full_name="System Administrator",
        hashed_password=hash_password("Admin@1234"),
        role="admin",
        department="IT / Management",
        is_active=True,
        access_granted=True,
        must_change_password=False,
        created_at=datetime.utcnow(),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print(f"✓ Admin user created with ID {admin.id}")

db.close()
