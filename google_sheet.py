import os
import logging
import asyncio
import requests
from typing import List, Dict, Tuple, Optional
import config

logger = logging.getLogger(__name__)

class GoogleSheetManager:
    """구글 스프레드시트와 연동하여 문파원 명단 및 4대 컨텐츠 참여를 관리하는 클래스"""

    def __init__(self, gas_url: str = config.GAS_WEBAPP_URL):
        self.gas_url = gas_url

    def connect(self) -> bool:
        """연동 상태 확인"""
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
        """GAS 웹 앱으로 POST 요청 전송 (자동 리다이렉트 추적 및 재시도)"""
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

    def setup_sheet_sync(self) -> Tuple[bool, str]:
        """구글 시트를 도깨비 문파 4대 컨텐츠 및 34명 명단으로 자동 빌드"""
        res = self._call_gas({"action": "setup_sheet"})
        return res.get("success", False), res.get("message", "")

    async def setup_sheet(self) -> Tuple[bool, str]:
        return await asyncio.to_thread(self.setup_sheet_sync)

    def get_all_members_sync(self) -> Dict[str, dict]:
        """시트에서 모든 문파원 목록 및 참여 횟수 조회"""
        res = self._call_gas({"action": "get_members"})
        if res.get("success"):
            return res.get("members", {})
        return {}

    async def get_all_members(self) -> Dict[str, dict]:
        return await asyncio.to_thread(self.get_all_members_sync)

    def add_participation_sync(self, recognized_names: List[str], content_name: str = "") -> Tuple[List[str], List[str]]:
        """인식된 문파원들의 특정 컨텐츠 체크박스 체크 (대규모 인원 시 분할 안전 처리)"""
        if not recognized_names:
            return [], []

        # 15명 이하일 때는 단일 호출로 신속 처리
        if len(recognized_names) <= 15:
            res = self._call_gas({
                "action": "add_participation", 
                "names": recognized_names,
                "content": content_name
            })
            if res.get("success"):
                return res.get("updated", []), res.get("unknown", [])
            return [], recognized_names

        # 15명 초과 대규모 인원일 경우: 15명씩 나누어 전송하여 구글 시트 타임아웃을 원천 차단
        logger.info(f"대규모 인원 감지 ({len(recognized_names)}명) - 15명씩 분할하여 안전하게 시트에 반영합니다.")
        all_updated = []
        all_unknown = []
        chunk_size = 15
        for i in range(0, len(recognized_names), chunk_size):
            chunk = recognized_names[i:i + chunk_size]
            res = self._call_gas({
                "action": "add_participation", 
                "names": chunk,
                "content": content_name
            })
            if res.get("success"):
                all_updated.extend(res.get("updated", []))
                all_unknown.extend(res.get("unknown", []))
            else:
                all_unknown.extend(chunk)
        return all_updated, all_unknown

    async def add_participation(self, recognized_names: List[str], content_name: str = "") -> Tuple[List[str], List[str]]:
        return await asyncio.to_thread(self.add_participation_sync, recognized_names, content_name)

    def add_new_member_sync(self, name: str) -> bool:
        """신규 문파원 등록"""
        res = self._call_gas({"action": "add_member", "name": name})
        return res.get("success", False)

    async def add_new_member(self, name: str) -> bool:
        return await asyncio.to_thread(self.add_new_member_sync, name)

    def delete_member_sync(self, name: str) -> Tuple[bool, str]:
        """문파원 삭제 (구글 시트에서 해당 행 삭제)"""
        res = self._call_gas({"action": "delete_member", "name": name})
        if res.get("success"):
            return True, res.get("message", f"'{name}' 문파원이 삭제되었습니다.")
        return False, res.get("message", res.get("error", "문파원 삭제에 실패했습니다."))

    async def delete_member(self, name: str) -> Tuple[bool, str]:
        return await asyncio.to_thread(self.delete_member_sync, name)

    def reset_all_counts_sync(self) -> int:
        """모든 문파원 체크박스를 해제하여 참여 횟수 0으로 리셋"""
        res = self._call_gas({"action": "reset"})
        return res.get("reset_count", 0)

    async def reset_all_counts(self) -> int:
        return await asyncio.to_thread(self.reset_all_counts_sync)
