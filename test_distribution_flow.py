import urllib.request
import http.cookiejar
import json
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://localhost:3000"

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def login():
    login_data = json.dumps({"username": "admin", "password": "admin1234"}).encode('utf-8')
    login_req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=login_data, headers={'Content-Type': 'application/json'})
    with opener.open(login_req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def post_json(endpoint, data):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with opener.open(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_json(endpoint):
    req = urllib.request.Request(f"{BASE_URL}{endpoint}")
    with opener.open(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def test_distribution():
    login()
    print("=== [1] Testing Distribution Page Accessibility ===")
    req = urllib.request.Request(f"{BASE_URL}/distribution")
    with opener.open(req) as resp:
        assert resp.getcode() == 200
        print("Distribution page rendered 200 OK")

    print("\n=== [2] Testing Toggle Content Cell (수동 / 분신 / 미참) ===")
    r1 = post_json('/api/attendance', {'nickname': '뱀설', 'content': '요신', 'type': 'CLONE'})
    assert r1.get('success') is True
    print("Set 뱀설 요신 to CLONE (0.25P): Success")

    r2 = post_json('/api/attendance', {'nickname': '뱀설', 'content': '결계', 'type': 'MANUAL'})
    assert r2.get('success') is True
    print("Set 뱀설 결계지 to MANUAL (1.0P): Success")

    r3 = post_json('/api/attendance', {'nickname': '뱀설', 'content': '미혹', 'type': 'ABSENT'})
    assert r3.get('success') is True
    print("Set 뱀설 미혹 to ABSENT (0P): Success")

    data = get_json('/api/attendance')
    member_map = {m['nickname']: m for m in data['attendance']}
    bs = member_map.get('뱀설')
    assert bs is not None
    assert bs['yosin']['type'] == 'CLONE'
    assert bs['mihok']['type'] == 'ABSENT'
    print(f"Verified 뱀설: 요신={bs['yosin']['type']}({bs['yosin']['points']}P), 미혹={bs['mihok']['type']}({bs['mihok']['points']}P)")

    print("\n=== [3] Testing Member Add & Delete ===")
    new_nick = "신규테스트문파원"
    r_add = post_json('/api/attendance', {'action': 'ADD_MEMBER', 'nickname': new_nick})
    assert r_add.get('success') is True
    print(f"Added member [{new_nick}]: Success")

    r_del = post_json('/api/attendance', {'action': 'DELETE_MEMBER', 'nickname': new_nick})
    assert r_del.get('success') is True
    print(f"Deleted member [{new_nick}]: Success")

    print("\n=== [4] Testing Batch '전원 올 수동(4점)' ===")
    r_all_manual = post_json('/api/attendance', {'action': 'SET_ALL_MANUAL'})
    assert r_all_manual.get('success') is True
    data_manual = get_json('/api/attendance')
    for m in data_manual['attendance']:
        assert m['totalPoints'] == 4.0
        assert m['rate'] == 100
    print("All members verified at 4.0P (100% attendance)")

    print("\n=== [5] Testing Batch '전원 초기화(0점)' ===")
    r_reset = post_json('/api/attendance', {'action': 'RESET_ALL'})
    assert r_reset.get('success') is True
    data_reset = get_json('/api/attendance')
    for m in data_reset['attendance']:
        assert m['totalPoints'] == 0
        assert m['rate'] == 0
    print("All members verified reset to 0P")

    # Restore realistic demo data
    post_json('/api/attendance', {'nickname': '뱀설', 'content': '요신', 'type': 'MANUAL'})
    post_json('/api/attendance', {'nickname': '뱀설', 'content': '결계', 'type': 'MANUAL'})
    post_json('/api/attendance', {'nickname': '뱀설', 'content': '미혹', 'type': 'MANUAL'})
    post_json('/api/attendance', {'nickname': '뱀설', 'content': '신기', 'type': 'MANUAL'})

    post_json('/api/attendance', {'nickname': '상두불', 'content': '요신', 'type': 'MANUAL'})
    post_json('/api/attendance', {'nickname': '상두불', 'content': '결계', 'type': 'CLONE'})
    post_json('/api/attendance', {'nickname': '상두불', 'content': '미혹', 'type': 'MANUAL'})

    post_json('/api/attendance', {'nickname': '해암', 'content': '요신', 'type': 'CLONE'})
    post_json('/api/attendance', {'nickname': '해암', 'content': '결계', 'type': 'CLONE'})
    print("Restored realistic guild participation state.")

    print("\n>>> ALL DISTRIBUTION AUTOMATED TESTS PASSED 100%! <<<")

if __name__ == "__main__":
    test_distribution()
