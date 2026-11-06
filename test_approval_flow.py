import requests
import sys

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE = 'http://127.0.0.1:3000'

def test_approval():
    print('=== [1] 신규 유저 가입 신청 (승인제 테스트) ===')
    import time
    ts = int(time.time())
    test_uname = f'user_{ts}'
    test_nick = f'문파원_{ts}'
    
    # 1. 회원가입 신청
    reg = requests.post(f'{BASE}/api/auth/register', json={
        'username': test_uname,
        'password': 'password1234',
        'nickname': test_nick
    }).json()
    print('가입 신청 결과:', reg.get('success'), '승인 대기 여부:', reg.get('pendingApproval'))
    assert reg.get('pendingApproval') is True, f'Expected pendingApproval True, got {reg}'

    # 2. 승인 전 로그인 시도 (반드시 실패해야 함)
    print('\n=== [2] 승인 전 로그인 차단 검증 ===')
    s_user = requests.Session()
    login_before = s_user.post(f'{BASE}/api/auth/login', json={
        'username': test_uname,
        'password': 'password1234'
    })
    print('승인 전 로그인 응답 코드:', login_before.status_code)
    print('승인 전 로그인 응답 메시지:', login_before.json().get('message'))
    assert login_before.status_code == 403, f'Expected 403, got {login_before.status_code}'
    assert '승인 대기' in login_before.json().get('message')

    # 3. 관리자 로그인 및 대기자 확인
    print('\n=== [3] 문파장(관리자) 로그인 및 대기자 확인 ===')
    s_admin = requests.Session()
    admin_login = s_admin.post(f'{BASE}/api/auth/login', json={
        'username': 'admin',
        'password': 'admin1234'
    }).json()
    assert admin_login.get('success') is True, 'Admin login failed'

    admin_users = s_admin.get(f'{BASE}/api/admin/users').json()
    print('승인 대기자 수:', admin_users.get('pendingCount'))
    target_user = next((u for u in admin_users.get('users', []) if u['username'] == test_uname), None)
    assert target_user is not None, 'Pending user not found in admin list'
    print(f'대기자 발견: {target_user["nickname"]} (상태: {target_user["status"]})')

    # 4. 관리자가 가입 승인 실행
    print('\n=== [4] 문파장의 가입 승인 처리 ===')
    approve_res = s_admin.post(f'{BASE}/api/admin/users', json={
        'action': 'APPROVE',
        'userId': target_user['id']
    }).json()
    print('승인 결과:', approve_res.get('message'))
    assert approve_res.get('success') is True

    # 5. 승인 후 유저 로그인 재시도 (이제 성공해야 함!)
    print('\n=== [5] 승인 후 정상 로그인 검증 ===')
    login_after = s_user.post(f'{BASE}/api/auth/login', json={
        'username': test_uname,
        'password': 'password1234'
    }).json()
    print('승인 후 로그인 성공 여부:', login_after.get('success'))
    print('로그인된 유저 닉네임:', login_after.get('user', {}).get('nickname'))
    assert login_after.get('success') is True
    assert login_after.get('user', {}).get('nickname') == test_nick

    print('\n🎉>>> [관리자 승인제 회원가입 시스템] 모든 테스트 100% 통과! <<<🎉')

if __name__ == '__main__':
    test_approval()
