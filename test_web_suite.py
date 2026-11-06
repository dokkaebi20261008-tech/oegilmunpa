import requests
import json
import sys

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE = 'http://127.0.0.1:3000'

def run_tests():
    print('=== [1] Attendance API Test ===')
    res = requests.get(f'{BASE}/api/attendance')
    assert res.status_code == 200, f'Status: {res.status_code}'
    data = res.json()
    print(f'Total members: {data["totalMembers"]}, Total points: {data["totalGuildPoints"]}')

    # Test Manual vs Clone Attendance
    print('\n=== [2] Attendance Check (Manual 1.0P vs Clone 0.25P) ===')
    # Manual 1.0
    r1 = requests.post(f'{BASE}/api/attendance', json={'names': ['테스트전사1'], 'content': '요신', 'type': 'MANUAL'}).json()
    print('Manual check result:', r1['updated'])

    # Clone 0.25
    r2 = requests.post(f'{BASE}/api/attendance', json={'names': ['테스트전사2'], 'content': '요신', 'type': 'CLONE'}).json()
    print('Clone check result:', r2['updated'])

    # Verify points in DB
    res_att = requests.get(f'{BASE}/api/attendance').json()
    m1 = next(m for m in res_att['attendance'] if m['nickname'] == '테스트전사1')
    m2 = next(m for m in res_att['attendance'] if m['nickname'] == '테스트전사2')
    print(f'테스트전사1 points: {m1["totalPoints"]} (Expected: 1.0)')
    print(f'테스트전사2 points: {m2["totalPoints"]} (Expected: 0.25)')
    assert m1['totalPoints'] == 1.0, f'Expected 1.0, got {m1["totalPoints"]}'
    assert m2['totalPoints'] == 0.25, f'Expected 0.25, got {m2["totalPoints"]}'

    print('\n=== [3] Auth Test (Register & Login) ===')
    reg_res = requests.post(f'{BASE}/api/auth/register', json={
        'username': 'testuser99',
        'password': 'password123!',
        'nickname': '테스트전사1'
    }).json()
    print('Register result:', reg_res.get('success'))

    login_session = requests.Session()
    login_res = login_session.post(f'{BASE}/api/auth/login', json={
        'username': 'testuser99',
        'password': 'password123!'
    }).json()
    print('Login result:', login_res.get('success'), 'User:', login_res.get('user', {}).get('nickname'))
    assert login_res.get('success') is True

    print('\n=== [4] Auction & Bid Test ===')
    auc_res = requests.get(f'{BASE}/api/auction').json()
    first_auc = next((a for a in auc_res['auctions'] if a['status'] == 'ACTIVE'), None)
    if not first_auc:
        # 관리자 세션으로 활성 경매 하나 생성
        admin_session = requests.Session()
        admin_session.post(f'{BASE}/api/auth/login', json={'username': 'admin', 'password': 'admin1234'})
        created = admin_session.post(f'{BASE}/api/auction', json={
            'title': '🔥 [전설] 신기 쟁탈전 보물 상패',
            'startingBid': 10000,
            'minBidIncrement': 1000,
            'durationHours': 72
        }).json()
        first_auc = created['auction']
    print('Current auction:', first_auc['title'], 'Current bid:', first_auc['currentBid'])

    # Bid on auction
    bid_amount = first_auc['currentBid'] + first_auc['minBidIncrement']
    bid_res = login_session.post(f'{BASE}/api/auction/{first_auc["id"]}/bid', json={'amount': bid_amount}).json()
    print('Bid result:', bid_res.get('success'), 'New bid:', bid_res.get('auction', {}).get('currentBid'))
    assert bid_res.get('success') is True

    print('\n=== [5] Auction End & 3만금전 Point-based Distribution Test ===')
    admin_session = requests.Session()
    admin_login = admin_session.post(f'{BASE}/api/auth/login', json={'username': 'admin', 'password': 'admin1234'}).json()
    assert admin_login.get('success') is True, 'Admin login failed'

    end_res = admin_session.post(f'{BASE}/api/auction/{first_auc["id"]}/end').json()
    print('End & distribution success:', end_res.get('success'))
    assert end_res.get('success') is True

    dist = end_res.get('distribution', {})
    print(f'Total Distributed Gold: {dist.get("totalGold"):,} 금전')
    print(f'Total Guild Points: {dist.get("totalPoints")} P')
    print(f'Gold per point: {dist.get("goldPerPoint"):,} 금전')
    print('Participants sample distribution (Top 5):')
    for p in dist.get('participants', [])[:5]:
        print(f'  - {p["nickname"]}: {p["points"]}P -> {p["share"]:,} 금전')

    print('\n=== [6] Guild Shop Test ===')
    shop_res = requests.get(f'{BASE}/api/shop').json()
    print('Shop items count:', len(shop_res.get('items', [])))
    assert len(shop_res.get('items', [])) > 0

    print('\n🎉>>> ALL AUTOMATED TESTS PASSED 100% SUCCESSFULLY! <<<🎉')

if __name__ == '__main__':
    run_tests()
