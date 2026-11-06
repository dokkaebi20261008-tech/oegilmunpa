import urllib.request
import json
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "https://oegilmunpa.vercel.app"

def test_live_site():
    print(f"=== Testing Live Vercel Site: {BASE_URL} ===")
    
    # 1. Main Page & Cache Headers Test
    req = urllib.request.Request(BASE_URL)
    with urllib.request.urlopen(req) as resp:
        code = resp.getcode()
        cache_control = resp.headers.get("Cache-Control", "")
        pragma = resp.headers.get("Pragma", "")
        expires = resp.headers.get("Expires", "")
        print(f"1. Main Page Status: {code} OK")
        print(f"   Cache-Control: {cache_control}")
        print(f"   Pragma: {pragma}, Expires: {expires}")
        assert code == 200, "Main page failed"
        assert "no-store" in cache_control, "Cache-Control must contain no-store"

    # 2. Attendance API Test
    req = urllib.request.Request(f"{BASE_URL}/api/attendance")
    with urllib.request.urlopen(req) as resp:
        code = resp.getcode()
        data = json.loads(resp.read().decode('utf-8'))
        print(f"2. Attendance API: {code} OK")
        print(f"   Total Guild Members: {data.get('totalMembers')}")
        print(f"   Total Guild Points: {data.get('totalGuildPoints')}P")
        assert data.get("success") is True, "Attendance API not success"
        assert data.get("totalMembers", 0) >= 48, "Must have all guild members"

    # 3. Auction API Test
    req = urllib.request.Request(f"{BASE_URL}/api/auction")
    with urllib.request.urlopen(req) as resp:
        code = resp.getcode()
        data = json.loads(resp.read().decode('utf-8'))
        print(f"3. Auction API: {code} OK")
        print(f"   Auctions Count: {len(data.get('auctions', []))}")
        assert data.get("success") is True, "Auction API not success"

    # 4. Shop API Test
    req = urllib.request.Request(f"{BASE_URL}/api/shop")
    with urllib.request.urlopen(req) as resp:
        code = resp.getcode()
        data = json.loads(resp.read().decode('utf-8'))
        print(f"4. Shop API: {code} OK")
        print(f"   Shop Items Count: {len(data.get('items', []))}")
        assert data.get("success") is True, "Shop API not success"

    print("\n>>> LIVE PRODUCTION VERCEL VERIFICATION COMPLETE: ALL SYSTEMS NOMINAL! <<<")

if __name__ == "__main__":
    test_live_site()
