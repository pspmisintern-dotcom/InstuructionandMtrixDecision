"""Test the API endpoints with the Neon PostgreSQL database."""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

# Test login
resp = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
print(f"Login status: {resp.status_code}")
if resp.status_code == 200:
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test work instructions list
    resp2 = client.get("/workinstructions", headers=headers)
    print(f"Work instructions status: {resp2.status_code}")
    if resp2.status_code == 200:
        data = resp2.json()
        print(f"Count: {len(data)}")
        if data:
            print(f"First: {data[0]}")
    else:
        print(f"Error: {resp2.text}")

    # Test departments
    resp3 = client.get("/workinstructions/departments", headers=headers)
    print(f"Departments status: {resp3.status_code}")
    if resp3.status_code == 200:
        print(f"Departments: {resp3.json()}")
    else:
        print(f"Error: {resp3.text}")

    # Test dashboard summary
    resp4 = client.get("/dashboard/summary", headers=headers)
    print(f"Dashboard status: {resp4.status_code}")
    if resp4.status_code == 200:
        data = resp4.json()
        print(f"Total WI: {data.get('total_work_instructions')}")
        print(f"Department distribution: {data.get('department_distribution')}")
    else:
        print(f"Error: {resp4.text}")
else:
    print(f"Login error: {resp.text}")