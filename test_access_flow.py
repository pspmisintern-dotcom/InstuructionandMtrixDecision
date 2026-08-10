import json
import urllib.request

BASE = "http://localhost:8000"

def api_post(path, data, token=None):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {"detail": body}

def api_get(path, token):
    req = urllib.request.Request(
        f"{BASE}{path}",
        headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


# 1. Try supervisor login (should be denied without access)
status, resp = api_post("/auth/login", {"username": "supervisor", "password": "supervisor123"})
print(f"1. Supervisor login without access: {status}")
print(f"   Detail: {resp.get('detail', 'N/A')}")

# 2. Admin login (should succeed)
status, resp = api_post("/auth/login", {"username": "admin", "password": "admin123"})
print(f"2. Admin login: {status}")
if status == 200:
    token = resp["access_token"]
    print(f"   Token: {token[:20]}...")

    # 3. Get users list
    status, users = api_get("/users", token)
    print(f"3. Get users: {status}")
    for u in users:
        print(f"   - {u['username']}: role={u['role']}, access_granted={u.get('access_granted', 'N/A')}")

    # 4. Find supervisor user id
    supervisor = next((u for u in users if u["username"] == "supervisor"), None)
    if supervisor:
        # 5. Grant access to supervisor
        status, resp = api_post("/auth/grant-access", {"user_id": supervisor["id"], "duration_hours": 2}, token)
        print(f"4. Grant access to supervisor: {status}")
        print(f"   Response: {resp}")

        # 6. Try supervisor login with new password
        if status == 200:
            new_pw = resp.get("new_password")
            status, resp = api_post("/auth/login", {"username": "supervisor", "password": new_pw})
            print(f"5. Supervisor login with new password: {status}")
            if status == 200:
                print(f"   Login successful with granted access!")
            else:
                print(f"   Login failed: {resp.get('detail', 'N/A')}")
    else:
        print("4. Supervisor not found in users list!")