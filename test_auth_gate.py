import urllib.request
import urllib.error
import http.cookiejar
import json
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://localhost:3000"

def test_gatekeeper():
    print("=== [1] Testing Unauthenticated Guest Gatekeeper ===")
    
    # 1. Main Page for Guest
    req = urllib.request.Request(f"{BASE_URL}/")
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        assert "정회원 전용 포털" in html or "외길 문파" in html
        assert resp.getcode() == 200
        print("Guest main page rendered: Gatekeeper landing shown")

    # 2. Protected APIs should reject unauthenticated requests with 401
    for ep in ['/api/attendance', '/api/auction', '/api/shop']:
        req = urllib.request.Request(f"{BASE_URL}{ep}")
        try:
            with urllib.request.urlopen(req) as resp:
                assert False, f"Expected 401 for {ep}, got {resp.getcode()}"
        except urllib.error.HTTPError as e:
            assert e.code == 401, f"Expected 401, got {e.code}"
            data = json.loads(e.read().decode('utf-8'))
            assert data.get('authenticated') is False
            print(f"Verified {ep} strictly blocked with 401 Unauthorized: {data.get('message')}")

    print("\n=== [2] Testing Authenticated Member Access ===")
    # Login as admin or member1
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    login_data = json.dumps({"username": "admin", "password": "admin1234"}).encode('utf-8')
    login_req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=login_data, headers={'Content-Type': 'application/json'})
    with opener.open(login_req) as resp:
        login_res = json.loads(resp.read().decode('utf-8'))
        assert login_res.get('success') is True
        print(f"Login success as: {login_res.get('user', {}).get('nickname')}")

    # Now call protected APIs with the session cookie
    for ep in ['/api/attendance', '/api/auction', '/api/shop']:
        req = urllib.request.Request(f"{BASE_URL}{ep}")
        with opener.open(req) as resp:
            assert resp.getcode() == 200
            data = json.loads(resp.read().decode('utf-8'))
            assert data.get('success') is True
            print(f"Verified {ep} authorized with 200 OK for logged-in member")

    print("\n>>> ALL AUTH GATEKEEPER TESTS PASSED 100%! <<<")

if __name__ == "__main__":
    test_gatekeeper()
