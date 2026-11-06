import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
DISCORD_CHANNEL_ID = os.getenv("DISCORD_CHANNEL_ID", "").strip()
SPREADSHEET_KEY = os.getenv("SPREADSHEET_KEY", "1HKKUt_nW6H01moxJwmjsdjGnEwOrKHj9Cy-AjYFWUC4")
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "credentials.json")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# [추천/100% 무료] 구글 스프레드시트 Apps Script 웹앱 URL
GAS_WEBAPP_URL = os.getenv("GAS_WEBAPP_URL", "").strip()

# 외길 문파 공식 웹사이트 URL (Vercel 배포 URL 또는 로컬)
WEB_SITE_URL = os.getenv("WEB_SITE_URL", "http://localhost:3000").rstrip("/")

# 봇 명령어 접두사
COMMAND_PREFIX = "!"
