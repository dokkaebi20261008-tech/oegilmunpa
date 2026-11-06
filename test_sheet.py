import sys
import os
import logging
from google_sheet import GoogleSheetManager

# 윈도우 콘솔 UTF-8 인코딩 보장
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s]: %(message)s")

def main():
    print("=" * 60)
    print("📊 구글 스프레드시트 연동 테스트를 시작합니다...")
    print("=" * 60)

    manager = GoogleSheetManager()
    
    print(f"[*] 현재 연동 모드: {manager.mode}")
    if manager.mode == "GAS":
        print(f"[*] Apps Script URL: {manager.gas_url[:30]}...")

    if not manager.connect():
        print("\n❌ 스프레드시트 연결에 실패했습니다.")
        print("\n💡 100% 무료 세팅 체크리스트:")
        print(" 1. 구글 스프레드시트 > 확장 프로그램 > Apps Script 열기")
        print(" 2. apps_script.js 내용을 복사해 붙여넣고 저장")
        print(" 3. 배포 > 새 배포 > 유형: 웹 앱 > 액세스: 모든 사용자(Anyone) 로 배포")
        print(" 4. 생성된 웹 앱 URL을 .env 파일의 GAS_WEBAPP_URL에 입력")
        sys.exit(1)

    print("\n✅ 스프레드시트 연결 성공!")

    print("\n[1] 문파원 목록 및 참여 횟수 조회 중...")
    members = manager.get_all_members_sync()
    
    if not members:
        print("⚠️ 등록된 문파원이 없거나 헤더를 찾지 못했습니다.")
        print("   시트에 문파원 닉네임들을 적어주세요. (예: A5=문파원 닉네임, A6=홍길동...)")
    else:
        print(f"총 {len(members)}명의 문파원이 정상 조회되었습니다:")
        for idx, (name, info) in enumerate(members.items(), start=1):
            print(f" {idx:2d}. {name} (현재 참여수: {info.get('count', 0)}회)")

    print("\n🎉 모든 테스트가 정상적으로 완료되었습니다!")

if __name__ == "__main__":
    main()
