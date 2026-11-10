import os
import json
import logging
import asyncio
import requests
from typing import List, Dict, Tuple, Optional
import config

logger = logging.getLogger(__name__)

class GoogleSheetManager:
    """문파원 명단 및 4대 컨텐츠 참여 관리 클래스 (구글 시트 가동 중단 시 외길 문파 공식 웹 포털 DB 단독 전담)"""

    def __init__(self, gas_url: str = config.GAS_WEBAPP_URL):
        self.gas_url = gas_url

    @property
    def is_enabled(self) -> bool:
        return getattr(config, "ENABLE_GOOGLE_SHEETS", False)

    def connect(self) -> bool:
        """연동 상태 확인"""
        if not self.is_enabled:
            logger.info("ℹ️ 구글 스프레드시트 가동이 중단되었습니다. (외길 문파 공식 웹 포털 DB 전담 운영 모드)")
            return True

        if not self.gas_url:
            logger.error("GAS_WEBAPP_URL이 설정되지 않았습니다.")
            return False
        try:
            data = self._call_gas({"action": "get_members"})
            if data.get("success"):
                members_cnt = len(data.get("members", {}))
                logger.info(f"Google Apps Script 웹 앱 연동 성공! (현재 문파원 {members_cnt}명)")
                return True
            logger.warning(f"Google Apps Script 응답 오류: {data}")
            return False
        except Exception as e:
            logger.error(f"Google Apps Script 연결 실패: {e}")
            return False

    def _call_gas(self, payload: dict) -> dict:
        """GAS 웹 앱으로 POST 요청 전송 (연동 중단 시 원천 차단)"""
        if not self.is_enabled:
            logger.warning("구글 스프레드시트가 비활성화(가동 중단)되어 있어 GAS 호출을 차단합니다.")
            return {}

        headers = {"Content-Type": "application/json"}
        last_err = None
        for attempt in range(2):
            try:
                response = requests.post(self.gas_url, json=payload, headers=headers, timeout=90)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                last_err = e
                logger.warning(f"GAS 요청 재시도 ({attempt+1}/2): {e}")
        if last_err:
            raise last_err
        return {}

    def _call_web_api(self, payload: dict) -> dict:
        """웹사이트 출석 API 호출 (배포 및 로컬 엔드포인트 자동 시도)"""
        urls = [
            f"{config.WEB_SITE_URL}/api/attendance",
            "http://localhost:3000/api/attendance"
        ]
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "python-requests/oegil-bot"
        }
        for url in urls:
            try:
                res = requests.post(url, json=payload, headers=headers, timeout=15)
                if res.ok:
                    return res.json()
            except Exception:
                pass
        return {}

    def setup_sheet_sync(self) -> Tuple[bool, str]:
        """시트 자동 빌드 (구글 시트 비활성화 시 안내 메시지 반환)"""
        if not self.is_enabled:
            return True, "구글 시트 가동이 중단된 상태입니다. (외길 문파 공식 웹 포털 DB 운영 중)"
        res = self._call_gas({"action": "setup_sheet"})
        return res.get("success", False), res.get("message", "")

    async def setup_sheet(self) -> Tuple[bool, str]:
        return await asyncio.to_thread(self.setup_sheet_sync)

    def get_all_members_sync(self) -> Dict[str, dict]:
        """모든 문파원 목록 및 참여 점수/횟수 조회"""
        if not self.is_enabled:
            # 1. 웹 포털 API 실시간 조회
            urls = [
                f"{config.WEB_SITE_URL}/api/attendance",
                "http://localhost:3000/api/attendance"
            ]
            headers = {"User-Agent": "python-requests/oegil-bot"}
            for url in urls:
                try:
                    res = requests.get(url, headers=headers, timeout=10)
                    if res.ok:
                        data = res.json()
                        att_list = data.get("attendance", [])
                        if att_list:
                            members_dict = {}
                            for idx, m in enumerate(att_list, start=1):
                                nick = m.get("nickname")
                                if nick:
                                    pts = m.get("totalPoints") if m.get("totalPoints") is not None else m.get("weeklyPoints", 0)
                                    members_dict[nick] = {
                                        "row": idx,
                                        "count": pts,
                                        "name": nick,
                                        "totalPoints": m.get("totalPoints", 0),
                                        "weeklyPoints": m.get("weeklyPoints", 0)
                                    }
                            return members_dict
                except Exception as e:
                    logger.debug(f"웹 API 조회 시도 ({url}): {e}")

            # 2. 로컬 db.json 폴백
            local_db = os.path.join(os.path.dirname(__file__), "web", "data", "db.json")
            if os.path.exists(local_db):
                try:
                    with open(local_db, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        att_map = data.get("attendance", {})
                        members_dict = {}
                        for idx, (nick, m) in enumerate(att_map.items(), start=1):
                            pts = m.get("totalPoints") if m.get("totalPoints") is not None else m.get("weeklyPoints", 0)
                            members_dict[nick] = {
                                "row": idx,
                                "count": pts,
                                "name": nick,
                                "totalPoints": m.get("totalPoints", 0),
                                "weeklyPoints": m.get("weeklyPoints", 0)
                            }
                        return members_dict
                except Exception as e:
                    logger.error(f"로컬 db.json 폴백 읽기 오류: {e}")
            return {}

        res = self._call_gas({"action": "get_members"})
        if res.get("success"):
            return res.get("members", {})
        return {}

    async def get_all_members(self) -> Dict[str, dict]:
        return await asyncio.to_thread(self.get_all_members_sync)

    def add_participation_sync(self, recognized_names: List[str], content_name: str = "", part_type: str = "MANUAL") -> Tuple[List[str], List[str]]:
        """인식된 문파원들의 특정 컨텐츠 출석 체크 (MANUAL: 수동 1.0P, CLONE: 분신 0.25P)"""
        if not recognized_names:
            return [], []

        if not self.is_enabled:
            data = self._call_web_api({
                "names": recognized_names,
                "content": content_name,
                "type": part_type
            })
            if data.get("success"):
                return recognized_names, []
            return recognized_names, []

        # 구글 시트 활성화 시
        if len(recognized_names) <= 15:
            res = self._call_gas({
                "action": "add_participation", 
                "names": recognized_names,
                "content": content_name,
                "type": part_type
            })
            if res.get("success"):
                return res.get("updated", []), res.get("unknown", [])
            return [], recognized_names

        all_updated = []
        all_unknown = []
        chunk_size = 15
        for i in range(0, len(recognized_names), chunk_size):
            chunk = recognized_names[i:i + chunk_size]
            res = self._call_gas({
                "action": "add_participation", 
                "names": chunk,
                "content": content_name,
                "type": part_type
            })
            if res.get("success"):
                all_updated.extend(res.get("updated", []))
                all_unknown.extend(res.get("unknown", []))
            else:
                all_unknown.extend(chunk)
        return all_updated, all_unknown

    async def add_participation(self, recognized_names: List[str], content_name: str = "", part_type: str = "MANUAL") -> Tuple[List[str], List[str]]:
        return await asyncio.to_thread(self.add_participation_sync, recognized_names, content_name, part_type)

    def add_new_member_sync(self, name: str) -> bool:
        """신규 문파원 등록"""
        if not self.is_enabled:
            data = self._call_web_api({"action": "ADD_MEMBER", "nickname": name})
            return data.get("success", False)

        res = self._call_gas({"action": "add_member", "name": name})
        return res.get("success", False)

    async def add_new_member(self, name: str) -> bool:
        return await asyncio.to_thread(self.add_new_member_sync, name)

    def delete_member_sync(self, name: str) -> Tuple[bool, str]:
        """문파원 삭제"""
        if not self.is_enabled:
            data = self._call_web_api({"action": "DELETE_MEMBER", "nickname": name})
            if data.get("success"):
                return True, data.get("message", f"'{name}' 문파원이 웹 포털 출석부에서 삭제되었습니다.")
            return False, data.get("message", "문파원 삭제에 실패했습니다.")

        res = self._call_gas({"action": "delete_member", "name": name})
        if res.get("success"):
            return True, res.get("message", f"'{name}' 문파원이 삭제되었습니다.")
        return False, res.get("message", res.get("error", "문파원 삭제에 실패했습니다."))

    async def delete_member(self, name: str) -> Tuple[bool, str]:
        return await asyncio.to_thread(self.delete_member_sync, name)

    def reset_all_counts_sync(self) -> int:
        """출석부 리셋"""
        if not self.is_enabled:
            self._call_web_api({"action": "RESET_WEEKLY_CONTENT"})
            members = self.get_all_members_sync()
            return len(members)

        res = self._call_gas({"action": "reset"})
        return res.get("reset_count", 0)

    async def reset_all_counts(self) -> int:
        return await asyncio.to_thread(self.reset_all_counts_sync)
