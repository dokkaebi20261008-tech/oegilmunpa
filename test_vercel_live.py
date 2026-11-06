import urllib.request
import urllib.error
import http.cookiejar
import json
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "https://oegilmunpa.vercel.app"

def test_live_site():
    print(f"=== Testing Live Vercel Site: {BASE_URL} ===")
    
    # 1. Main Page Gatekeeper for Guests
    req = urllib.request.Request(BASE_URL)
    with urllib.request.urlopen(req) as resp:
        code = resp.getcode()
        cache_control = resp.headers.get("Cache-Control", "")
        print(f"1. Guest Main Page Status: {code} OK")
        print(f"   Cache-Control: {cache_control}")
        assert code == 200, "Main page failed"
        assert "no-store" in cache_control, "Cache-Control must contain no-store"

    # 2. Protected APIs should reject unauthenticated requests with 401
    for ep in ['/api/attendance', '/api/auction', '/api/shop']:
        req = urllib.request.Request(f"{BASE_URL}{ep}")
        try:
            with urllib.request.urlopen(req) as resp:
                assert False, f"Expected 401 for {ep}, got {resp.getcode()}"
        except urllib.error.HTTPError as e:
            assert e.code == 401, f"Expected 401, got {e.code}"
            print(f"   Protected {ep}: 401 Unauthorized (Properly Secured)")

    # 3. Authenticated Member Login & Access
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    login_data = json.dumps({"username": "admin", "password": "admin1234"}).encode('utf-8')
    login_req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=login_data, headers={'Content-Type': 'application/json'})
    with opener.open(login_req) as resp:
        login_res = json.loads(resp.read().decode('utf-8'))
        assert login_res.get('success') is True
        print(f"2. Logged in successfully as: {login_res.get('user', {}).get('nickname')}")

    # 4. Authenticated API Access
    for ep in ['/api/attendance', '/api/auction', '/api/shop']:
        req = urllib.request.Request(f"{BASE_URL}{ep}")
        with opener.open(req) as resp:
            assert resp.getcode() == 200
            data = json.loads(resp.read().decode('utf-8'))
            assert data.get('success') is True
            print(f"   Authorized {ep}: 200 OK")

    print("\n>>> LIVE PRODUCTION VERCEL SECURITY & GATEKEEPER VERIFICATION COMPLETE! <<<")

if __name__ == "__main__":
    test_live_site()
