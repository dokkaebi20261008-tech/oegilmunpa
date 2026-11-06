import os
import json
import logging
import asyncio
from typing import List, Set
from PIL import Image, ImageEnhance, ImageFilter
import io
from rapidfuzz import fuzz, process, distance
import config

logger = logging.getLogger(__name__)

try:
    from google import genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

class NicknameScanner:
    """게임 스크린샷에서 문파원 닉네임을 초정밀 감지하는 AI 스캐너 (고화질 복원 + 듀얼패스 + 정밀 퍼지 엔진)"""

    # 초고속 + 정밀 비전 Flash 모델 후보군
    MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash"]

    def __init__(self, gemini_api_key: str = config.GEMINI_API_KEY):
        self.gemini_api_key = gemini_api_key
        self.client = None

        if HAS_GENAI and self.gemini_api_key:
            try:
                self.client = genai.Client(api_key=self.gemini_api_key)
                logger.info("Google GenAI 클라이언트 초기화 완료 (정밀 비전 모드).")
            except Exception as e:
                logger.warning(f"Google GenAI 초기화 실패: {e}")

    def preprocess_image(self, pil_img: Image.Image) -> Image.Image:
        """저해상도/디스코드 압축 이미지의 폰트 픽셀을 2배 고화질 복원 및 선명화"""
        w, h = pil_img.size
        # 가로 해상도가 1600px 미만인 경우 2배 고품질 리샘플링
        if w < 1600 or h < 900:
            scale = 2.0
            new_w, new_h = int(w * scale), int(h * scale)
            pil_img = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            # 텍스트 대비 향상 및 언샵 마스크 선명화
            pil_img = ImageEnhance.Contrast(pil_img).enhance(1.2)
            pil_img = ImageEnhance.Sharpness(pil_img).enhance(1.4)
            pil_img = pil_img.filter(ImageFilter.UnsharpMask(radius=2, percent=120, threshold=3))
        return pil_img

    def match_with_roster(self, raw_names: List[str], registered_members: List[str]) -> List[str]:
        """2글자/3글자 단문 닉네임의 1글자 오타까지 완벽하게 살려내는 정밀 퍼지 매칭"""
        results: Set[str] = set()

        for raw_name in raw_names:
            clean_name = raw_name.strip()
            if not clean_name:
                continue

            # 1. 완전 일치
            if clean_name in registered_members:
                results.add(clean_name)
                continue

            # 2. 2글자 닉네임 전용 편집 거리(Levenshtein) 검사
            # 예: '해안' -> '해암', '승디' -> '승기', '채권' -> '채권' (거리 1 이내)
            best_match = None
            best_dist = 99
            for member in registered_members:
                dist = distance.Levenshtein.distance(clean_name, member)
                if len(member) == 2:
                    if dist <= 1 and dist < best_dist:
                        best_dist = dist
                        best_match = member
                elif len(member) == 3:
                    if dist <= 1 and dist < best_dist:
                        best_dist = dist
                        best_match = member

            if best_match and best_dist <= 1:
                results.add(best_match)
                continue

            # 3. 3글자 이상 일반 퍼지 매칭 (유사도 70% 이상 또는 부분 일치)
            match = process.extractOne(clean_name, registered_members, scorer=fuzz.ratio, score_cutoff=70)
            if match:
                results.add(match[0])
            else:
                # 부분 포함 매칭 (예: [외길]홍길동 -> 홍길동)
                match_partial = process.extractOne(clean_name, registered_members, scorer=fuzz.partial_ratio, score_cutoff=85)
                if match_partial:
                    results.add(match_partial[0])

        return list(results)

    def _call_gemini_ocr(self, pil_img: Image.Image, members_str: str) -> List[str]:
        prompt = f"""
당신은 대한민국 최고 수준의 모바일/PC 게임 '도깨비의 세계' 참여자 스크린샷 정밀 분석 AI입니다.
주어진 스크린샷 내에 실제로 존재하는 문파원들의 닉네임을 [문파원 등록 명단]과 철저히 대조하여 한 명도 빠짐없이 모두 추출해야 합니다.

[문파원 등록 명단]
{members_str}

[정밀 판독 지침]
1. 닉네임 위치:
   - 캐릭터 머리 위, 문파명 '외길' 바로 밑에 위치한 닉네임
   - 화면 좌/우/중앙/외곽에 위치한 모든 캐릭터의 이름
   - 파티/공격대 프레임, 기여도/순위표 UI 창이 있다면 그 안의 이름도 모두 포함
2. 글자가 스킬 이펙트, 타 캐릭터 몸체, 무기에 살짝 가려져 있어도 2~3글자 형태가 명단과 유사하면 반드시 인식해 주세요.
3. 레벨, 전투력, 문파명(외길), 직책(문파장/부문주 등), 숫자는 제외하고 오직 순수 '닉네임'만 추출하세요.
4. 반드시 JSON 배열 형식으로만 응답하세요. 예: ["닉네임1", "닉네임2", "닉네임3"]
5. 명단에 있는 인원이 없으면 빈 배열 []을 반환하세요.
"""
        text = ""
        last_error = None

        for model_name in self.MODELS:
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=[prompt, pil_img]
                )
                if response and response.text:
                    text = response.text.strip()
                    break
            except Exception as e:
                logger.warning(f"모델 {model_name} 호출 실패, 다음 모델 시도: {e}")
                last_error = e

        if not text:
            if last_error:
                raise last_error
            return []

        if "```" in text:
            lines = text.splitlines()
            cleaned_lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(cleaned_lines).strip()

        try:
            detected = json.loads(text)
            if isinstance(detected, list):
                return detected
        except Exception as e:
            logger.error(f"Gemini 응답 JSON 파싱 실패 ({e}): {text}")

        return []

    def scan_with_gemini(self, image_bytes: bytes, registered_members: List[str]) -> List[str]:
        """2중 집중 스캔 (전체 화면 + 밀집 영역 크롭 확대 스캔)을 통한 극대화된 인식률 제공"""
        if not self.client:
            raise RuntimeError("Gemini AI가 설정되지 않았습니다. .env에 GEMINI_API_KEY를 입력해주세요.")

        original_img = Image.open(io.BytesIO(image_bytes))
        members_str = ", ".join(registered_members)

        # 1. 고화질 전처리
        enhanced_full_img = self.preprocess_image(original_img)

        # Pass 1: 전체 화면 스캔
        raw_detected_1 = self._call_gemini_ocr(enhanced_full_img, members_str)
        all_raw_names: Set[str] = set(raw_detected_1)

        # Pass 2: 캐릭터 밀집 중앙 영역 크롭 2차 정밀 스캔 (광장/레이드 겹침 완벽 해소)
        w, h = enhanced_full_img.size
        if w > 600 and h > 400:
            try:
                # 캐릭터가 주로 몰려있는 중앙 70% 구역 크롭
                crop_box = (int(w * 0.12), int(h * 0.15), int(w * 0.88), int(h * 0.85))
                cropped_img = enhanced_full_img.crop(crop_box)
                # 크롭된 영역을 다시 고해상도로 확대
                cropped_enhanced = cropped_img.resize((w, h), Image.Resampling.LANCZOS)
                raw_detected_2 = self._call_gemini_ocr(cropped_enhanced, members_str)
                all_raw_names.update(raw_detected_2)
            except Exception as e:
                logger.warning(f"Pass 2 크롭 스캔 실패 (무시됨): {e}")

        # 정밀 퍼지 매칭 엔진으로 최종 보정
        final_members = self.match_with_roster(list(all_raw_names), registered_members)
        return final_members

    async def scan_image(self, image_bytes: bytes, registered_members: List[str]) -> List[str]:
        """비동기 방식으로 스크린샷에서 닉네임 목록 감지"""
        return await asyncio.to_thread(self.scan_with_gemini, image_bytes, registered_members)
